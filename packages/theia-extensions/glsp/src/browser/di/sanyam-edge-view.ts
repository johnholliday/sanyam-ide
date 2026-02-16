/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Edge View
 *
 * A delegating edge view that renders as either polyline or bezier curve
 * based on the current EdgeRoutingService mode. Optionally appends an
 * arrowhead polygon at the target end of the edge.
 *
 * For bezier mode, the SVG path is rendered directly from the ELK routing
 * points rather than delegating to Sprotty's BezierCurveEdgeView.  This is
 * necessary because sprotty-elk stores section startPoint/endPoint inside
 * `routingPoints`, but Sprotty's BezierEdgeRouter expects only intermediate
 * control points — causing a format mismatch that produces chaotic curves.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { VNode, h } from 'snabbdom';
import {
    PolylineEdgeView,
    SEdgeImpl,
} from 'sprotty';
import { SanyamEdgeImpl } from './sanyam-model-factory';
import type { Point } from 'sprotty-protocol';
import type { IViewArgs, RenderingContext } from 'sprotty';
import { EdgeRouterRegistry } from 'sprotty/lib/features/routing/routing';
import { RoutableView } from 'sprotty/lib/features/routing/views';
import { svg } from 'sprotty/lib/lib/jsx';
import { EdgeRoutingService, EdgeRoutingServiceSymbol } from '../layout/edge-routing-service';

/** Half-width of the arrowhead triangle base, in pixels. */
const ARROW_HALF_WIDTH = 8;

/** Length of the arrowhead triangle along the edge direction, in pixels. */
const ARROW_LENGTH = 15;

/**
 * Edge view that delegates to PolylineEdgeView for orthogonal/straight modes,
 * and renders bezier curves directly from ELK routing points for bezier mode.
 * Optionally renders an arrowhead polygon at the target end of the edge.
 */
@injectable()
export class SanyamEdgeView extends RoutableView {
    @inject(EdgeRouterRegistry)
    edgeRouterRegistry: EdgeRouterRegistry;

    @inject(EdgeRoutingServiceSymbol) @optional()
    edgeRoutingService: EdgeRoutingService | undefined;

    private polylineView: PolylineEdgeView | undefined;

    private getPolylineView(): PolylineEdgeView {
        if (!this.polylineView) {
            this.polylineView = new PolylineEdgeView();
            (this.polylineView as any).edgeRouterRegistry = this.edgeRouterRegistry;
        }
        return this.polylineView;
    }

    render(edge: Readonly<SEdgeImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
        // Sync the edge's routerKind with the current routing mode.
        // routerKind is set at model creation time but doesn't update when the
        // user changes routing mode.  For bezier we use 'polyline' so that
        // hit-testing and anchor computation use the PolylineEdgeRouter (which
        // simply threads through the ELK routing points), not the
        // BezierEdgeRouter whose grouping expectations are incompatible with
        // the points that sprotty-elk produces.
        if (this.edgeRoutingService) {
            const mode = this.edgeRoutingService.currentMode;
            (edge as SEdgeImpl).routerKind = mode === 'bezier'
                ? 'polyline'
                : this.edgeRoutingService.getSprottyRouterKind();
        }

        const isBezier = this.edgeRoutingService
            ? this.edgeRoutingService.currentMode === 'bezier'
            : (edge as any).routerKind === 'bezier';

        // For bezier mode, compute anchor-corrected points before rendering.
        // ELK's startPoint/endPoint in routingPoints may not align with Sprotty's
        // rendered node borders. We replace them with PolylineEdgeRouter-computed
        // anchors (which use AnchorComputer + actual node bounds), keeping ELK's
        // intermediate bezier control points unchanged.
        const bezierPoints = isBezier
            ? this.computeAnchoredBezierPoints(edge, args)
            : undefined;

        const vnode = isBezier
            ? this.renderBezier(edge, context, bezierPoints, args)
            : this.getPolylineView().render(edge, context, args);

        if (!vnode || !vnode.children) {
            return vnode;
        }

        // Apply sanyam-edge-path class and edge-type CSS classes to all <path> children.
        // In polyline mode, Sprotty's PolylineEdgeView produces bare <path> with no classes.
        // In bezier mode, renderBezier() adds sanyam-edge-path but not edge-type classes.
        // This post-processing ensures both modes get the full set of classes.
        const sanyamEdge = edge as SanyamEdgeImpl;
        for (const child of vnode.children) {
            const childVNode = child as VNode;
            if (childVNode.sel === 'path') {
                if (!childVNode.data) { childVNode.data = {}; }
                const classes: Record<string, boolean> = {
                    'sanyam-edge-path': true,
                    ...(childVNode.data.class || {}),
                };
                if (sanyamEdge.cssClasses) {
                    for (const cls of sanyamEdge.cssClasses) {
                        classes[cls] = true;
                    }
                }
                childVNode.data.class = classes;
            }
        }

        // Append arrowhead if visible
        if (this.edgeRoutingService?.arrowheadsVisible !== false) {
            const arrowhead = this.createArrowhead(edge, bezierPoints, args);
            if (arrowhead) {
                vnode.children.push(arrowhead);
            }
        }

        return vnode;
    }

    /**
     * Compute bezier points with Sprotty-computed source/target anchors.
     *
     * ELK SPLINES stores `routingPoints = [startPoint, cp1, cp2, ..., endPoint]`
     * where startPoint/endPoint are ELK's computed border anchors.  These may not
     * match Sprotty's actual rendered node borders (different bounds, padding, or
     * anchor computation).  We replace them with PolylineEdgeRouter-computed
     * anchors that use the AnchorComputer + actual node bounds, preserving the
     * intermediate bezier control points from ELK.
     *
     * @param edge - The edge to compute points for
     * @param args - Optional view args
     * @returns Anchor-corrected bezier points, or undefined if insufficient data
     */
    private computeAnchoredBezierPoints(edge: Readonly<SEdgeImpl>, args?: IViewArgs): Point[] | undefined {
        const rps = edge.routingPoints;
        if (!rps || rps.length < 2) {
            return undefined;
        }

        // Get the route from the PolylineEdgeRouter, which computes proper
        // source/target anchors using AnchorComputer + actual node bounds.
        const route = this.edgeRouterRegistry.route(edge, args);
        if (route.length < 2) {
            return undefined;
        }

        const sourceAnchor = route[0];
        const targetAnchor = route[route.length - 1];

        // Replace ELK's start/end anchors with Sprotty-computed ones.
        // Keep all intermediate control points from ELK unchanged.
        // Point count stays the same, so cubic bezier grouping is preserved.
        return [
            sourceAnchor,
            ...rps.slice(1, -1),
            targetAnchor,
        ];
    }

    /**
     * Render bezier curves from anchor-corrected routing points.
     *
     * The points follow ELK SPLINES format with replaced endpoints:
     *   [sourceAnchor, cp1, cp2, targetAnchor]                          — 1 segment
     *   [sourceAnchor, cp1, cp2, junction, cp3, cp4, targetAnchor]      — 2 segments
     *
     * These map directly to SVG cubic bezier commands:
     *   M source C cp1 cp2 target
     *   M source C cp1 cp2 junction C cp3 cp4 target
     *
     * @param edge - The edge to render
     * @param context - Rendering context
     * @param bezierPoints - Pre-computed anchor-corrected points, or undefined to fall back
     * @param args - Optional view args
     */
    private renderBezier(edge: Readonly<SEdgeImpl>, context: RenderingContext, bezierPoints: Point[] | undefined, args?: IViewArgs): VNode | undefined {
        if (!bezierPoints || bezierPoints.length < 2) {
            // No valid bezier data — fall back to polyline
            return this.getPolylineView().render(edge, context, args);
        }

        const d = this.buildBezierPath(bezierPoints);

        const children: VNode[] = [
            h('path', { attrs: { d }, class: { 'sanyam-edge-path': true } }),
        ];
        children.push(...context.renderChildren(edge, { route: bezierPoints }));

        return h('g', { ns: 'http://www.w3.org/2000/svg', class: { 'sprotty-edge': true, mouseover: edge.hoverFeedback } }, children);
    }

    /**
     * Build an SVG path string from ELK routing points.
     *
     * If the number of points matches the cubic-bezier grouping (4, 7, 10, …),
     * cubic C commands are used.  Otherwise, falls back to straight L segments.
     */
    private buildBezierPath(points: readonly Point[]): string {
        let d = `M ${points[0].x},${points[0].y}`;

        const remaining = points.length - 1;

        if (remaining >= 3 && remaining % 3 === 0) {
            // Proper cubic bezier: groups of 3 (cp1 cp2 endpoint) after M
            for (let i = 1; i + 2 < points.length; i += 3) {
                d += ` C ${points[i].x},${points[i].y}`
                   + ` ${points[i + 1].x},${points[i + 1].y}`
                   + ` ${points[i + 2].x},${points[i + 2].y}`;
            }
        } else {
            // Fallback: straight line segments
            for (let i = 1; i < points.length; i++) {
                d += ` L ${points[i].x},${points[i].y}`;
            }
        }

        return d;
    }

    /**
     * Create a triangular arrowhead polygon at the target end of the edge.
     * The triangle points in the direction of the last segment.
     *
     * @param edge - The edge to create the arrowhead for
     * @param bezierPoints - If provided, use these points for direction instead of the router
     * @param args - Optional view args
     */
    private createArrowhead(edge: Readonly<SEdgeImpl>, bezierPoints: readonly Point[] | undefined, args?: IViewArgs): VNode | undefined {
        let target: Point;
        let prev: Point;

        if (bezierPoints && bezierPoints.length >= 2) {
            // For bezier mode: use the last two routing points (last control point → endpoint).
            // The direction from the last control point to the endpoint gives the
            // tangent of the bezier curve at its end — the correct arrowhead direction.
            target = bezierPoints[bezierPoints.length - 1];
            prev = bezierPoints[bezierPoints.length - 2];
        } else {
            // For polyline modes: use the edge router
            const route = this.edgeRouterRegistry.route(edge, args);
            if (route.length < 2) {
                return undefined;
            }
            target = route[route.length - 1];
            prev = route[route.length - 2];
        }

        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-6) {
            return undefined;
        }

        // Unit vector along the edge direction
        const ux = dx / len;
        const uy = dy / len;
        // Perpendicular unit vector
        const px = -uy;
        const py = ux;

        // Tip of the arrow at the target point
        const tipX = target.x;
        const tipY = target.y;
        // Base corners of the triangle
        const baseX = target.x - ux * ARROW_LENGTH;
        const baseY = target.y - uy * ARROW_LENGTH;
        const leftX = baseX + px * ARROW_HALF_WIDTH;
        const leftY = baseY + py * ARROW_HALF_WIDTH;
        const rightX = baseX - px * ARROW_HALF_WIDTH;
        const rightY = baseY - py * ARROW_HALF_WIDTH;

        const pointsStr = `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;

        return svg('polygon', {
            attrs: { points: pointsStr },
            class: { 'sanyam-edge-arrowhead': true },
        }) as VNode;
    }
}
