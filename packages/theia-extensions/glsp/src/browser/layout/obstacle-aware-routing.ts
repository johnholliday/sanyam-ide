/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Obstacle-Aware Edge Routing Repair
 *
 * Post-hoc repair pass that detects edge segments crossing over nodes
 * and inserts detour waypoints to route around them. Provides two
 * entry points:
 *
 * - {@link repairEdgeRoutes} — operates on the Sprotty internal model
 *   (`SModelRootImpl`). Used by {@link SanyamMoveCommand} after drag.
 *
 * - {@link repairProtocolEdgeRoutes} — operates on the sprotty-protocol
 *   model (`SGraph`). Used as a post-processing step after ELK layout,
 *   before the model is dispatched to the viewer.
 *
 * @packageDocumentation
 */

import type { SModelRootImpl, SParentElementImpl } from 'sprotty';
import { SNodeImpl } from 'sprotty';
import { SRoutableElementImpl } from 'sprotty/lib/features/routing/model';
import { getAbsoluteBounds } from 'sprotty/lib/features/bounds/model';
import type { Bounds, Point } from 'sprotty-protocol/lib/utils/geometry';
import type { SGraph, SNode, SEdge, SModelElement } from 'sprotty-protocol/lib/model';

/**
 * Clearance (in pixels) added around node bounding boxes when testing
 * for edge–node intersections.
 */
const OBSTACLE_MARGIN = 15;

/**
 * Maximum number of detour iterations per edge to prevent runaway
 * waypoint insertion on pathological layouts.
 */
const MAX_DETOUR_ITERATIONS = 10;

// ---------------------------------------------------------------------------
// Shared geometry helpers
// ---------------------------------------------------------------------------

/**
 * Test whether the line segment from `p0` to `p1` intersects the
 * axis-aligned rectangle defined by `rect` (with margin applied).
 *
 * Uses the Liang-Barsky parametric clipping algorithm.
 */
function segmentIntersectsRect(p0: Point, p1: Point, rect: Bounds): boolean {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;

    const xMin = rect.x - OBSTACLE_MARGIN;
    const xMax = rect.x + rect.width + OBSTACLE_MARGIN;
    const yMin = rect.y - OBSTACLE_MARGIN;
    const yMax = rect.y + rect.height + OBSTACLE_MARGIN;

    const p = [-dx, dx, -dy, dy];
    const q = [p0.x - xMin, xMax - p0.x, p0.y - yMin, yMax - p0.y];

    let tMin = 0;
    let tMax = 1;

    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i]! < 0) {
                return false;
            }
        } else {
            const t = q[i]! / p[i]!;
            if (p[i]! < 0) {
                tMin = Math.max(tMin, t);
            } else {
                tMax = Math.min(tMax, t);
            }
            if (tMin > tMax) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Compute two waypoints that route a segment around an obstacle by going
 * around the shorter side.
 */
function computeDetour(p0: Point, p1: Point, rect: Bounds): [Point, Point] {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;

    const halfW = rect.width / 2 + OBSTACLE_MARGIN;
    const halfH = rect.height / 2 + OBSTACLE_MARGIN;

    // Normalized displacement of midpoint from obstacle center
    const relX = Math.abs(mx - cx) / Math.max(halfW, 1);
    const relY = Math.abs(my - cy) / Math.max(halfH, 1);

    if (relX >= relY) {
        // Route above or below the obstacle
        const routeY = my < cy
            ? rect.y - OBSTACLE_MARGIN
            : rect.y + rect.height + OBSTACLE_MARGIN;
        return [
            { x: p0.x, y: routeY },
            { x: p1.x, y: routeY },
        ];
    } else {
        // Route left or right of the obstacle
        const routeX = mx < cx
            ? rect.x - OBSTACLE_MARGIN
            : rect.x + rect.width + OBSTACLE_MARGIN;
        return [
            { x: routeX, y: p0.y },
            { x: routeX, y: p1.y },
        ];
    }
}

/**
 * Core repair loop: iteratively insert detour waypoints into a path
 * until no segments cross any obstacle.
 *
 * @param path - The full path including source/target anchors
 * @param obstacles - Map of obstacle ID → absolute bounds
 * @param excludeIds - IDs of obstacles to skip (source/target nodes)
 * @returns The repaired path, or `undefined` if no modifications were needed
 */
function repairPath(
    path: Point[],
    obstacles: Map<string, Bounds>,
    excludeIds: Set<string>
): Point[] | undefined {
    let currentPath = path;
    let modified = false;

    for (let iteration = 0; iteration < MAX_DETOUR_ITERATIONS; iteration++) {
        let foundCrossing = false;

        for (let i = 0; i < currentPath.length - 1; i++) {
            const p0 = currentPath[i]!;
            const p1 = currentPath[i + 1]!;

            for (const [nodeId, rect] of obstacles) {
                if (excludeIds.has(nodeId)) {
                    continue;
                }

                if (segmentIntersectsRect(p0, p1, rect)) {
                    const [d0, d1] = computeDetour(p0, p1, rect);
                    currentPath = [
                        ...currentPath.slice(0, i + 1),
                        d0,
                        d1,
                        ...currentPath.slice(i + 1),
                    ];
                    foundCrossing = true;
                    modified = true;
                    break;
                }
            }

            if (foundCrossing) {
                break;
            }
        }

        if (!foundCrossing) {
            break;
        }
    }

    return modified ? currentPath : undefined;
}

// ===========================================================================
// Internal model version (SModelRootImpl — for SanyamMoveCommand)
// ===========================================================================

/**
 * Collect absolute bounding boxes for all nodes in the internal model.
 * Skips expanded container nodes (edges may legitimately route through them).
 */
function collectInternalObstacles(root: SModelRootImpl): Map<string, Bounds> {
    const obstacles = new Map<string, Bounds>();

    function traverse(parent: SParentElementImpl): void {
        for (const child of parent.children) {
            if (child instanceof SNodeImpl) {
                const cssClasses: string[] | undefined = (child as any).cssClasses;
                const isContainer = cssClasses?.includes('sanyam-container');
                const isCollapsed = cssClasses?.includes('collapsed');
                if (isContainer && !isCollapsed) {
                    traverse(child);
                    continue;
                }

                const bounds = getAbsoluteBounds(child);
                if (bounds.width > 0 && bounds.height > 0) {
                    obstacles.set(child.id, bounds);
                }

                if (child.children.length > 0) {
                    traverse(child);
                }
            }
        }
    }

    traverse(root);
    return obstacles;
}

/**
 * Repair edge routes in the Sprotty internal model to avoid crossing
 * over nodes. Used by {@link SanyamMoveCommand} after drag completion.
 *
 * @param root - The Sprotty internal model root
 */
export function repairEdgeRoutes(root: SModelRootImpl): void {
    const obstacles = collectInternalObstacles(root);
    if (obstacles.size === 0) {
        return;
    }

    const edges: SRoutableElementImpl[] = [];
    function findEdges(parent: SParentElementImpl): void {
        for (const child of parent.children) {
            if (child instanceof SRoutableElementImpl) {
                edges.push(child);
            }
            if ('children' in child && (child as SParentElementImpl).children) {
                findEdges(child as SParentElementImpl);
            }
        }
    }
    findEdges(root);

    for (const edge of edges) {
        const source = edge.source;
        const target = edge.target;
        if (!source || !target) {
            continue;
        }

        const excludeIds = new Set<string>();
        excludeIds.add(source.id);
        excludeIds.add(target.id);
        let el: any = source.parent;
        while (el && el.id) {
            excludeIds.add(el.id);
            el = el.parent;
        }
        el = target.parent;
        while (el && el.id) {
            excludeIds.add(el.id);
            el = el.parent;
        }

        const sourceBounds = getAbsoluteBounds(source);
        const targetBounds = getAbsoluteBounds(target);
        const sourceCenter: Point = {
            x: sourceBounds.x + sourceBounds.width / 2,
            y: sourceBounds.y + sourceBounds.height / 2,
        };
        const targetCenter: Point = {
            x: targetBounds.x + targetBounds.width / 2,
            y: targetBounds.y + targetBounds.height / 2,
        };

        const path = [sourceCenter, ...edge.routingPoints, targetCenter];
        const repaired = repairPath(path, obstacles, excludeIds);
        if (repaired) {
            edge.routingPoints = repaired.slice(1, -1);
        }
    }
}

// ===========================================================================
// Protocol model version (SGraph — for post-ELK layout)
// ===========================================================================

/**
 * Collect absolute bounding boxes for all nodes in the protocol model.
 * Computes absolute positions by accumulating parent offsets.
 */
function collectProtocolObstacles(graph: SGraph): Map<string, Bounds> {
    const obstacles = new Map<string, Bounds>();

    function traverse(children: SModelElement[] | undefined, offsetX: number, offsetY: number): void {
        if (!children) return;
        for (const child of children) {
            const node = child as SNode;
            if (node.position && node.size && node.size.width > 0 && node.size.height > 0) {
                // Check if this is a node type (not an edge or label)
                if (child.type?.startsWith('node')) {
                    const cssClasses: string[] | undefined = (child as any).cssClasses;
                    const isContainer = cssClasses?.includes('sanyam-container');
                    const isCollapsed = cssClasses?.includes('collapsed');

                    const absX = offsetX + node.position.x;
                    const absY = offsetY + node.position.y;

                    if (isContainer && !isCollapsed) {
                        // Skip expanded container but traverse children
                        traverse(node.children, absX, absY);
                        continue;
                    }

                    obstacles.set(child.id, {
                        x: absX,
                        y: absY,
                        width: node.size.width,
                        height: node.size.height,
                    });

                    // Recurse into node children
                    traverse(node.children, absX, absY);
                }
            }
        }
    }

    traverse(graph.children, 0, 0);
    return obstacles;
}

/**
 * Build the set of IDs to exclude from obstacle checks for a given edge
 * (source/target and their parent chain). Operates on the protocol model.
 */
function buildExcludeIdsProtocol(
    edge: SEdge,
    parentMap: Map<string, string>
): Set<string> {
    const excludeIds = new Set<string>();
    excludeIds.add(edge.sourceId);
    excludeIds.add(edge.targetId);

    // Walk up the parent chain for source
    let parentId = parentMap.get(edge.sourceId);
    while (parentId) {
        excludeIds.add(parentId);
        parentId = parentMap.get(parentId);
    }
    // Walk up the parent chain for target
    parentId = parentMap.get(edge.targetId);
    while (parentId) {
        excludeIds.add(parentId);
        parentId = parentMap.get(parentId);
    }

    return excludeIds;
}

/**
 * Build a child → parent ID map and a node center map from the protocol model.
 */
function buildProtocolMaps(graph: SGraph): {
    parentMap: Map<string, string>;
    nodeCenters: Map<string, Point>;
} {
    const parentMap = new Map<string, string>();
    const nodeCenters = new Map<string, Point>();

    function traverse(children: SModelElement[] | undefined, parentId: string, offsetX: number, offsetY: number): void {
        if (!children) return;
        for (const child of children) {
            parentMap.set(child.id, parentId);
            const node = child as SNode;
            if (node.position && node.size && child.type?.startsWith('node')) {
                const absX = offsetX + node.position.x;
                const absY = offsetY + node.position.y;
                nodeCenters.set(child.id, {
                    x: absX + node.size.width / 2,
                    y: absY + node.size.height / 2,
                });
                traverse(node.children, child.id, absX, absY);
            } else {
                traverse((child as any).children, child.id, offsetX, offsetY);
            }
        }
    }

    traverse(graph.children, graph.id, 0, 0);
    return { parentMap, nodeCenters };
}

/**
 * Repair edge routes in the sprotty-protocol model to avoid crossing
 * over nodes. Used as a post-processing step after ELK layout, before
 * the model is dispatched to the viewer.
 *
 * Mutates edge `routingPoints` in place.
 *
 * @param graph - The sprotty-protocol graph model (after ELK layout)
 */
export function repairProtocolEdgeRoutes(graph: SGraph): void {
    const obstacles = collectProtocolObstacles(graph);
    if (obstacles.size === 0) {
        return;
    }

    const { parentMap, nodeCenters } = buildProtocolMaps(graph);

    // Collect all edges from the graph
    const edges: SEdge[] = [];
    function findEdges(children: SModelElement[] | undefined): void {
        if (!children) return;
        for (const child of children) {
            if (child.type?.startsWith('edge')) {
                edges.push(child as SEdge);
            }
            findEdges((child as any).children);
        }
    }
    findEdges(graph.children);

    for (const edge of edges) {
        const sourceCenter = nodeCenters.get(edge.sourceId);
        const targetCenter = nodeCenters.get(edge.targetId);
        if (!sourceCenter || !targetCenter) {
            continue;
        }

        const excludeIds = buildExcludeIdsProtocol(edge, parentMap);

        const routingPoints = edge.routingPoints ?? [];
        const path = [sourceCenter, ...routingPoints, targetCenter];
        const repaired = repairPath(path, obstacles, excludeIds);
        if (repaired) {
            edge.routingPoints = repaired.slice(1, -1);
        }
    }
}
