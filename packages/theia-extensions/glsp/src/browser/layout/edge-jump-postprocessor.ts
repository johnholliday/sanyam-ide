/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Edge Jump Postprocessor
 *
 * An IVNodePostprocessor that detects intersections between rendered edge paths
 * and rewrites SVG `d` attributes to insert small arc segments (line bridges)
 * at crossing points. This helps users visually distinguish overlapping edges.
 *
 * Only supports polyline/orthogonal edges. Bezier edges are skipped.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { VNode } from 'snabbdom';
import { IVNodePostprocessor, SModelElementImpl, SEdgeImpl } from 'sprotty';
import type { Action } from 'sprotty-protocol';
import type { Point } from 'sprotty-protocol';
import { EdgeRoutingService, EdgeRoutingServiceSymbol } from './edge-routing-service';

/** Radius of the semicircular jump arc in pixels. */
const JUMP_RADIUS = 9;

/** Minimum distance between two crossings on the same segment to insert both arcs. */
const MIN_CROSSING_DISTANCE = JUMP_RADIUS * 3;

/**
 * A crossing point on a specific edge segment, with parameter t ∈ [0,1]
 * indicating position along that segment.
 */
interface Crossing {
    point: Point;
    /** Parameter along the segment, 0 = p1, 1 = p2 */
    t: number;
}

/**
 * Minimal edge metadata collected during `decorate()`.
 */
interface EdgeInfo {
    edgeId: string;
    isBezier: boolean;
    childIndex: number;
}

/**
 * Edge data with parsed route points, built during `postUpdate()`.
 */
interface EdgeData {
    edgeId: string;
    routePoints: Point[];
    childIndex: number;
    pathElement: Element;
}

/**
 * Parse an SVG path `d` attribute into a list of points.
 * Supports M, L, H, V commands (absolute). Returns the points that form
 * straight-line segments. Returns empty array for paths with curves (C, Q, A, etc.).
 */
function parsePathToPoints(d: string): Point[] {
    const points: Point[] = [];
    // Tokenize: split on command letters, keeping the letter
    const commands = d.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/g);
    if (!commands) {
        return points;
    }

    let cx = 0;
    let cy = 0;

    for (const cmd of commands) {
        const letter = cmd.charAt(0);
        const args = cmd.slice(1).trim();
        // Parse all numbers from the args string
        const nums = args.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)?.map(Number) ?? [];

        switch (letter) {
            case 'M':
                // moveto absolute: pairs of (x, y)
                for (let i = 0; i + 1 < nums.length; i += 2) {
                    cx = nums[i];
                    cy = nums[i + 1];
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'm':
                // moveto relative
                for (let i = 0; i + 1 < nums.length; i += 2) {
                    cx += nums[i];
                    cy += nums[i + 1];
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'L':
                // lineto absolute: pairs of (x, y)
                for (let i = 0; i + 1 < nums.length; i += 2) {
                    cx = nums[i];
                    cy = nums[i + 1];
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'l':
                // lineto relative
                for (let i = 0; i + 1 < nums.length; i += 2) {
                    cx += nums[i];
                    cy += nums[i + 1];
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'H':
                for (const n of nums) {
                    cx = n;
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'h':
                for (const n of nums) {
                    cx += n;
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'V':
                for (const n of nums) {
                    cy = n;
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'v':
                for (const n of nums) {
                    cy += n;
                    points.push({ x: cx, y: cy });
                }
                break;
            case 'Z':
            case 'z':
                // Close path — ignore for crossing computation
                break;
            case 'C':
            case 'c':
            case 'S':
            case 's':
            case 'Q':
            case 'q':
            case 'T':
            case 't':
            case 'A':
            case 'a':
                // Curves — bail out, we don't handle bezier crossings
                return [];
            default:
                break;
        }
    }

    return points;
}

/**
 * Compute the intersection point of two line segments (p1→p2) and (p3→p4).
 * Returns the intersection point if the segments cross, or undefined.
 */
function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | undefined {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;

    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-10) {
        return undefined;
    }

    const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
    const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;

    const eps = 0.01;
    if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) {
        return {
            x: p1.x + t * dx1,
            y: p1.y + t * dy1,
        };
    }
    return undefined;
}

/**
 * Compute parameter t of a point along a segment (p1→p2).
 */
function parameterOnSegment(p1: Point, p2: Point, pt: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) {
        return 0;
    }
    const projDist = (pt.x - p1.x) * dx / len + (pt.y - p1.y) * dy / len;
    return projDist / len;
}

/**
 * Distance between two points.
 */
function dist(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build an SVG path `d` string from route points, inserting semicircular arc
 * jumps at crossing points.
 */
function buildPathWithJumps(routePoints: Point[], crossingsPerSegment: Map<number, Crossing[]>): string {
    const parts: string[] = [];
    parts.push(`M ${routePoints[0].x},${routePoints[0].y}`);

    for (let i = 0; i < routePoints.length - 1; i++) {
        const p1 = routePoints[i];
        const p2 = routePoints[i + 1];
        const crossings = crossingsPerSegment.get(i);

        if (!crossings || crossings.length === 0) {
            parts.push(`L ${p2.x},${p2.y}`);
            continue;
        }

        crossings.sort((a, b) => a.t - b.t);

        // Filter out crossings too close together
        const filtered: Crossing[] = [];
        for (const c of crossings) {
            if (filtered.length === 0 || dist(filtered[filtered.length - 1].point, c.point) >= MIN_CROSSING_DISTANCE) {
                filtered.push(c);
            }
        }

        const segLen = dist(p1, p2);
        if (segLen < 1e-10) {
            parts.push(`L ${p2.x},${p2.y}`);
            continue;
        }
        const ux = (p2.x - p1.x) / segLen;
        const uy = (p2.y - p1.y) / segLen;

        for (const crossing of filtered) {
            const approachX = crossing.point.x - ux * JUMP_RADIUS;
            const approachY = crossing.point.y - uy * JUMP_RADIUS;
            const landingX = crossing.point.x + ux * JUMP_RADIUS;
            const landingY = crossing.point.y + uy * JUMP_RADIUS;

            parts.push(`L ${approachX},${approachY}`);
            parts.push(`A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 1 ${landingX},${landingY}`);
        }

        parts.push(`L ${p2.x},${p2.y}`);
    }

    return parts.join(' ');
}

/**
 * Postprocessor that adds visual edge jumps (line bridges) at edge crossing points.
 *
 * During `decorate()`, it records which elements are edges and their ordering.
 * In `postUpdate()`, it reads the actual rendered SVG path `d` attributes from
 * the DOM, parses them into line segments, computes pairwise intersections, and
 * rewrites path data with arc segments at crossings.
 *
 * Edges rendered later (higher child index) jump over earlier edges.
 */
@injectable()
export class EdgeJumpPostprocessor implements IVNodePostprocessor {
    @inject(EdgeRoutingServiceSymbol) @optional()
    protected edgeRoutingService: EdgeRoutingService | undefined;

    /** Edge metadata collected during the current render cycle. */
    private edgeInfos: Map<string, EdgeInfo> = new Map();

    /**
     * Record edge metadata during the render phase.
     */
    decorate(vnode: VNode, element: SModelElementImpl): VNode {
        if (!this.edgeRoutingService?.edgeJumpsEnabled) {
            return vnode;
        }

        if (!(element instanceof SEdgeImpl)) {
            return vnode;
        }

        const edge = element;
        // Check the global routing mode rather than per-edge routerKind,
        // because routerKind on the model element may be stale if the user
        // switched routing modes without reloading the model.
        const isBezier = this.edgeRoutingService?.currentMode === 'bezier';

        let childIndex = 0;
        const parent = edge.parent;
        if (parent && parent.children) {
            childIndex = parent.children.indexOf(edge);
        }

        this.edgeInfos.set(edge.id, {
            edgeId: edge.id,
            isBezier,
            childIndex,
        });

        return vnode;
    }

    /**
     * After all edges are rendered, read actual SVG paths from the DOM,
     * compute crossings, and patch paths with jump arcs.
     */
    postUpdate(_cause?: Action): void {
        if (!this.edgeRoutingService?.edgeJumpsEnabled) {
            this.edgeInfos.clear();
            return;
        }

        const infos = Array.from(this.edgeInfos.values());
        this.edgeInfos.clear();

        // Build EdgeData by reading actual SVG path `d` attributes from the DOM
        const edgeDataList: EdgeData[] = [];
        for (const info of infos) {
            if (info.isBezier) {
                continue;
            }

            // Find the SVG path element for this edge
            const pathEl = document.querySelector(`[id$="${info.edgeId}"] > path.sanyam-edge-path`)
                ?? document.querySelector(`[id$="${info.edgeId}"] path`);
            if (!pathEl) {
                continue;
            }

            const d = pathEl.getAttribute('d');
            if (!d) {
                continue;
            }

            const routePoints = parsePathToPoints(d);
            if (routePoints.length < 2) {
                continue;
            }

            edgeDataList.push({
                edgeId: info.edgeId,
                routePoints,
                childIndex: info.childIndex,
                pathElement: pathEl,
            });
        }

        if (edgeDataList.length < 2) {
            return;
        }

        // Compute crossings: higher childIndex edge jumps over lower
        const crossingsMap = new Map<string, Map<number, Crossing[]>>();

        for (let i = 0; i < edgeDataList.length; i++) {
            for (let j = i + 1; j < edgeDataList.length; j++) {
                const edgeA = edgeDataList[i];
                const edgeB = edgeDataList[j];

                const [jumper, base] = edgeA.childIndex > edgeB.childIndex
                    ? [edgeA, edgeB]
                    : [edgeB, edgeA];

                for (let si = 0; si < jumper.routePoints.length - 1; si++) {
                    const sp1 = jumper.routePoints[si];
                    const sp2 = jumper.routePoints[si + 1];

                    for (let sj = 0; sj < base.routePoints.length - 1; sj++) {
                        const bp1 = base.routePoints[sj];
                        const bp2 = base.routePoints[sj + 1];

                        const intersection = segmentIntersection(sp1, sp2, bp1, bp2);
                        if (intersection) {
                            if (!crossingsMap.has(jumper.edgeId)) {
                                crossingsMap.set(jumper.edgeId, new Map());
                            }
                            const segMap = crossingsMap.get(jumper.edgeId)!;
                            if (!segMap.has(si)) {
                                segMap.set(si, []);
                            }
                            const t = parameterOnSegment(sp1, sp2, intersection);
                            segMap.get(si)!.push({ point: intersection, t });
                        }
                    }
                }
            }
        }

        // Patch SVG paths for edges with crossings
        for (const [edgeId, segCrossings] of crossingsMap) {
            const edgeData = edgeDataList.find(e => e.edgeId === edgeId);
            if (!edgeData) {
                continue;
            }

            const newD = buildPathWithJumps(edgeData.routePoints, segCrossings);
            edgeData.pathElement.setAttribute('d', newD);
        }
    }
}
