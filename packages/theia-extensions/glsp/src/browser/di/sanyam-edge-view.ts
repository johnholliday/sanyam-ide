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
 * based on the edge's `routerKind` property. This allows dynamic switching
 * of edge rendering mode via the EdgeRoutingService.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { VNode } from 'snabbdom';
import {
    PolylineEdgeView,
    BezierCurveEdgeView,
    SEdgeImpl,
} from 'sprotty';
import type { IViewArgs, RenderingContext } from 'sprotty';
import { EdgeRouterRegistry } from 'sprotty/lib/features/routing/routing';
import { RoutableView } from 'sprotty/lib/features/routing/views';

/**
 * Edge view that delegates to PolylineEdgeView or BezierCurveEdgeView
 * based on the edge's routerKind property.
 */
@injectable()
export class SanyamEdgeView extends RoutableView {
    @inject(EdgeRouterRegistry)
    edgeRouterRegistry: EdgeRouterRegistry;

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
        const routerKind = (edge as any).routerKind;
        if (routerKind === 'bezier') {
            return this.getBezierView().render(edge, context, args);
        }
        return this.getPolylineView().render(edge, context, args);
    }
}
