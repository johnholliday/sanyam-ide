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
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { VNode } from 'snabbdom';
import {
    PolylineEdgeView,
    BezierCurveEdgeView,
    SEdgeImpl,
} from 'sprotty';
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
 * Edge view that delegates to PolylineEdgeView or BezierCurveEdgeView
 * based on the EdgeRoutingService's current mode, and optionally renders
 * an arrowhead polygon at the target end of the edge.
 */
@injectable()
export class SanyamEdgeView extends RoutableView {
    @inject(EdgeRouterRegistry)
    edgeRouterRegistry: EdgeRouterRegistry;

    @inject(EdgeRoutingServiceSymbol) @optional()
    edgeRoutingService: EdgeRoutingService | undefined;

    private polylineView: PolylineEdgeView | undefined;
    private bezierView: BezierCurveEdgeView | undefined;

    private getPolylineView(): PolylineEdgeView {
        if (!this.polylineView) {
            this.polylineView = new PolylineEdgeView();
            (this.polylineView as any).edgeRouterRegistry = this.edgeRouterRegistry;
        }
        return this.polylineView;
    }

    private getBezierView(): BezierCurveEdgeView {
        if (!this.bezierView) {
            this.bezierView = new BezierCurveEdgeView();
            (this.bezierView as any).edgeRouterRegistry = this.edgeRouterRegistry;
        }
        return this.bezierView;
    }

    render(edge: Readonly<SEdgeImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
        const isBezier = this.edgeRoutingService
            ? this.edgeRoutingService.currentMode === 'bezier'
            : (edge as any).routerKind === 'bezier';

        const vnode = isBezier
            ? this.getBezierView().render(edge, context, args)
            : this.getPolylineView().render(edge, context, args);

        if (!vnode || !vnode.children) {
            return vnode;
        }

        // Append arrowhead if visible
        if (this.edgeRoutingService?.arrowheadsVisible !== false) {
            const arrowhead = this.createArrowhead(edge, args);
            if (arrowhead) {
                vnode.children.push(arrowhead);
            }
        }

        return vnode;
    }

    /**
     * Create a triangular arrowhead polygon at the target end of the edge.
     * The triangle points in the direction of the last segment.
     */
    private createArrowhead(edge: Readonly<SEdgeImpl>, args?: IViewArgs): VNode | undefined {
        const route = this.edgeRouterRegistry.route(edge, args);
        if (route.length < 2) {
            return undefined;
        }

        // Last two points define the direction of the arrowhead
        const target = route[route.length - 1];
        const prev = route[route.length - 2];

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

        const points = `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;

        return svg('polygon', {
            attrs: { points },
            class: { 'sanyam-edge-arrowhead': true },
        }) as VNode;
    }
}
