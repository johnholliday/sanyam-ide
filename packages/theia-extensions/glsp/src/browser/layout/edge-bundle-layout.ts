/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Edge Bundle Layout Support
 *
 * Custom ELK element filter and layout postprocessor that work together
 * to enable fan-out edge bundling without disrupting ELK's layered layout.
 *
 * Strategy:
 * 1. The server emits junction nodes + trunk/branch edges (for rendering)
 *    AND "layout proxy" edges (original source→target, for ELK).
 * 2. The element filter excludes junctions and trunk/branch from ELK,
 *    but includes proxy edges so ELK computes good node positions.
 * 3. After ELK layout, the postprocessor reads proxy edge routes,
 *    positions junction nodes at the first bend point of the first proxy,
 *    and removes proxy edges from the model so they don't render.
 *
 * @packageDocumentation
 */

import { DefaultElementFilter, type ILayoutPostprocessor } from 'sprotty-elk';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type { SModelIndex } from 'sprotty-protocol';
import type { SModelElement, SGraph, SNode, SEdge, Point } from 'sprotty-protocol';

// CSS class markers set by the server-side bundleEdges()
const CSS_JUNCTION = 'sanyam-junction';
const CSS_TRUNK = 'edge-trunk';
const CSS_BRANCH = 'edge-branch';
const CSS_PROXY = 'layout-proxy';

/**
 * Check if an element has a specific CSS class.
 */
function hasCssClass(element: SModelElement, cls: string): boolean {
    return Array.isArray((element as any).cssClasses) &&
        (element as any).cssClasses.includes(cls);
}

/**
 * Element filter that excludes junction nodes and trunk/branch edges from
 * ELK layout. Proxy edges (original source→target) are included so ELK
 * can compute proper node positions and edge routes.
 */
export class SanyamElementFilter extends DefaultElementFilter {
    protected override filterNode(node: SNode, index: SModelIndex): boolean {
        // Exclude junction nodes from ELK layout
        if (hasCssClass(node, CSS_JUNCTION)) {
            return false;
        }
        return true;
    }

    protected override filterEdge(edge: SEdge, index: SModelIndex): boolean {
        // Exclude trunk and branch edges from ELK layout
        if (hasCssClass(edge, CSS_TRUNK) || hasCssClass(edge, CSS_BRANCH)) {
            return false;
        }
        // Include proxy edges (and all other edges) — use parent filter
        // which checks that source/target nodes are included
        return super.filterEdge(edge, index);
    }
}

/**
 * Post-layout processor that positions junction nodes and computes
 * trunk/branch edge routing from the ELK-computed proxy edge routes,
 * then removes proxy edges from the model.
 */
export class EdgeBundlePostprocessor implements ILayoutPostprocessor {
    postprocess(elkGraph: ElkNode, sgraph: SGraph, index: SModelIndex): void {
        if (!sgraph.children) return;

        // Build a map of proxy edge routes from the ELK result
        const proxyRoutes = this.collectProxyRoutes(elkGraph);
        if (proxyRoutes.size === 0) return;

        // Group proxy edges by their junction (derive junction ID from proxy ID)
        // Proxy ID format: `${originalEdgeId}_proxy`
        // Junction ID format: `${sourceId}_junction_${safeProperty}`
        // We group proxies by sourceId to find their junction.
        const junctionNodes = sgraph.children.filter(
            (c: SModelElement) => hasCssClass(c, CSS_JUNCTION)
        ) as SNode[];

        for (const junction of junctionNodes) {
            // Find trunk edge for this junction (target is junction)
            const trunk = sgraph.children.find(
                (c: SModelElement) => (c as SEdge).targetId === junction.id && hasCssClass(c, CSS_TRUNK)
            ) as SEdge | undefined;
            if (!trunk) continue;

            // Find branch edges for this junction (source is junction)
            const branches = sgraph.children.filter(
                (c: SModelElement) => (c as SEdge).sourceId === junction.id && hasCssClass(c, CSS_BRANCH)
            ) as SEdge[];
            if (branches.length === 0) continue;

            // Find proxy edges for this bundle (same source as trunk, targets match branches)
            const branchTargets = new Set(branches.map(b => b.targetId));
            const bundleProxies: Array<{ targetId: string; route: Point[] }> = [];
            for (const [proxyId, route] of proxyRoutes) {
                const proxyEl = index.getById(proxyId) as SEdge | undefined;
                if (proxyEl && proxyEl.sourceId === trunk.sourceId && branchTargets.has(proxyEl.targetId)) {
                    bundleProxies.push({ targetId: proxyEl.targetId, route });
                }
            }

            if (bundleProxies.length === 0) continue;

            // Position the junction node at the first bend point of the first
            // proxy route (the point where the edge leaves the source layer).
            // If no bend points, use the midpoint of the first proxy route.
            const firstRoute = bundleProxies[0]!.route;
            const junctionPoint = this.computeJunctionPoint(firstRoute);
            junction.position = { x: junctionPoint.x - 4, y: junctionPoint.y - 4 }; // center 8x8 dot

            // Set trunk routing: source start → junction point
            // Use only the first segment of the first proxy route
            if (firstRoute.length >= 2) {
                trunk.routingPoints = [firstRoute[0]!, junctionPoint];
            }

            // Set branch routing: junction point → each target
            for (const branch of branches) {
                const proxy = bundleProxies.find(p => p.targetId === branch.targetId);
                if (proxy && proxy.route.length >= 2) {
                    // Route from junction to the target end of the proxy route
                    branch.routingPoints = [junctionPoint, proxy.route[proxy.route.length - 1]!];
                }
            }
        }

        // Remove proxy edges from the model (they served their purpose for ELK)
        sgraph.children = sgraph.children.filter(
            (c: SModelElement) => !hasCssClass(c, CSS_PROXY)
        );
    }

    /**
     * Collect routing points from all proxy edges in the ELK result.
     */
    private collectProxyRoutes(elkNode: ElkNode): Map<string, Point[]> {
        const routes = new Map<string, Point[]>();

        if (elkNode.edges) {
            for (const elkEdge of elkNode.edges) {
                // Only collect proxy edges
                if (!elkEdge.id.endsWith('_proxy')) continue;
                const points = this.extractRoutePoints(elkEdge);
                if (points.length >= 2) {
                    routes.set(elkEdge.id, points);
                }
            }
        }

        // Recurse into child nodes (for hierarchical graphs)
        if (elkNode.children) {
            for (const child of elkNode.children) {
                const childRoutes = this.collectProxyRoutes(child);
                for (const [id, route] of childRoutes) {
                    routes.set(id, route);
                }
            }
        }

        return routes;
    }

    /**
     * Extract routing points from an ELK edge result.
     */
    private extractRoutePoints(elkEdge: ElkExtendedEdge): Point[] {
        const points: Point[] = [];
        if (elkEdge.sections && elkEdge.sections.length > 0) {
            const section = elkEdge.sections[0]!;
            if (section.startPoint) points.push(section.startPoint);
            if (section.bendPoints) points.push(...section.bendPoints);
            if (section.endPoint) points.push(section.endPoint);
        }
        return points;
    }

    /**
     * Compute the junction point from a proxy edge route.
     * Uses the first bend point if available, otherwise the midpoint.
     */
    private computeJunctionPoint(route: Point[]): Point {
        if (route.length >= 3) {
            // First bend point — where the edge turns after leaving the source
            return route[1]!;
        }
        // Midpoint between start and end
        const start = route[0]!;
        const end = route[route.length - 1]!;
        return {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
        };
    }
}
