/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Viewport Action Handler
 *
 * Handles viewport actions like zoom, center, and fit to screen.
 * Properly accesses the current viewport state to perform relative operations.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import {
    IActionHandler,
    ICommand,
    TYPES,
    LocalModelSource,
} from 'sprotty';
import {
    Action,
    CenterAction,
    FitToScreenAction,
    SetViewportAction,
    Viewport,
} from 'sprotty-protocol';

/**
 * Zoom In Action.
 */
export interface ZoomInAction extends Action {
    kind: 'zoomIn';
    factor?: number;
}

export namespace ZoomInAction {
    export const KIND = 'zoomIn';

    export function create(factor: number = 1.2): ZoomInAction {
        return { kind: KIND, factor };
    }
}

/**
 * Zoom Out Action.
 */
export interface ZoomOutAction extends Action {
    kind: 'zoomOut';
    factor?: number;
}

export namespace ZoomOutAction {
    export const KIND = 'zoomOut';

    export function create(factor: number = 1.2): ZoomOutAction {
        return { kind: KIND, factor };
    }
}

/**
 * Reset Zoom Action.
 */
export interface ResetZoomAction extends Action {
    kind: 'resetZoom';
}

export namespace ResetZoomAction {
    export const KIND = 'resetZoom';

    export function create(): ResetZoomAction {
        return { kind: KIND };
    }
}

/**
 * Center Diagram Action.
 */
export interface CenterDiagramAction extends Action {
    kind: 'centerDiagram';
    elementIds?: string[];
    animate?: boolean;
}

export namespace CenterDiagramAction {
    export const KIND = 'centerDiagram';

    export function create(elementIds?: string[], animate: boolean = true): CenterDiagramAction {
        return { kind: KIND, elementIds, animate };
    }
}

/**
 * Fit Diagram Action.
 */
export interface FitDiagramAction extends Action {
    kind: 'fitDiagram';
    elementIds?: string[];
    padding?: number;
    animate?: boolean;
}

export namespace FitDiagramAction {
    export const KIND = 'fitDiagram';

    export function create(elementIds?: string[], padding: number = 20, animate: boolean = true): FitDiagramAction {
        return { kind: KIND, elementIds, padding, animate };
    }
}

/**
 * Action handler for viewport operations.
 */
@injectable()
export class ViewportActionHandler implements IActionHandler {
    @inject(TYPES.ModelSource)
    protected modelSource!: LocalModelSource;

    /** Minimum zoom level */
    protected readonly MIN_ZOOM = 0.1;

    /** Maximum zoom level */
    protected readonly MAX_ZOOM = 4.0;

    /** Default zoom level */
    protected readonly DEFAULT_ZOOM = 1.0;

    /** Track current zoom level locally since model might not update immediately */
    protected currentZoom: number = 1.0;

    /** Track current scroll position */
    protected currentScroll: { x: number; y: number } = { x: 0, y: 0 };

    /**
     * Handle viewport actions.
     */
    handle(action: Action): void | ICommand | Action {
        console.log('[ViewportActionHandler] Received action:', action.kind);
        switch (action.kind) {
            case ZoomInAction.KIND:
                console.log('[ViewportActionHandler] Handling ZoomInAction');
                this.handleZoomIn(action as ZoomInAction);
                break;
            case ZoomOutAction.KIND:
                console.log('[ViewportActionHandler] Handling ZoomOutAction');
                this.handleZoomOut(action as ZoomOutAction);
                break;
            case ResetZoomAction.KIND:
                console.log('[ViewportActionHandler] Handling ResetZoomAction');
                this.handleResetZoom();
                break;
            case CenterDiagramAction.KIND:
                console.log('[ViewportActionHandler] Handling CenterDiagramAction');
                this.handleCenter(action as CenterDiagramAction);
                break;
            case FitDiagramAction.KIND:
                console.log('[ViewportActionHandler] Handling FitDiagramAction');
                this.handleFit(action as FitDiagramAction);
                break;
            default:
                console.log('[ViewportActionHandler] Unknown action kind:', action.kind);
        }
    }

    /**
     * Get the current viewport from DOM, model, or tracked state.
     */
    protected getCurrentViewport(): Viewport {
        // First try to get from the SVG transform (most accurate)
        const viewportFromDom = this.getViewportFromDom();
        if (viewportFromDom) {
            this.currentZoom = viewportFromDom.zoom;
            this.currentScroll = { ...viewportFromDom.scroll };
            return viewportFromDom;
        }

        // Then try to get from the model
        const model = (this.modelSource as any).model;
        if (model && model.type === 'graph') {
            const graph = model as any;
            if (graph.scroll !== undefined && graph.zoom !== undefined) {
                // Update our tracked state from model
                this.currentZoom = graph.zoom;
                this.currentScroll = { ...graph.scroll };
                return {
                    scroll: graph.scroll,
                    zoom: graph.zoom,
                };
            }
        }

        // Use tracked state (which persists across zoom operations)
        return {
            scroll: this.currentScroll,
            zoom: this.currentZoom,
        };
    }

    /**
     * Get viewport state from the DOM transform attribute.
     */
    protected getViewportFromDom(): Viewport | undefined {
        // Find the main graph group with the viewport transform
        const graphGroup = document.querySelector('g.sprotty-graph') as SVGGElement
            ?? document.querySelector('g[id$="_root"]') as SVGGElement
            ?? document.querySelector('svg.sprotty-graph > g[transform]') as SVGGElement;

        if (!graphGroup) {
            return undefined;
        }

        const transform = graphGroup.getAttribute('transform');
        if (!transform) {
            return undefined;
        }

        // Parse transform string
        let scroll = { x: 0, y: 0 };
        let zoom = 1;

        const translateMatch = transform.match(/translate\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
        if (translateMatch) {
            scroll.x = parseFloat(translateMatch[1]) || 0;
            scroll.y = parseFloat(translateMatch[2]) || 0;
        }

        const scaleMatch = transform.match(/scale\s*\(\s*(-?[\d.]+)/);
        if (scaleMatch) {
            zoom = parseFloat(scaleMatch[1]) || 1;
        }

        // Handle matrix transform
        const matrixMatch = transform.match(/matrix\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
        if (matrixMatch) {
            zoom = parseFloat(matrixMatch[1]) || 1;
            scroll.x = parseFloat(matrixMatch[5]) || 0;
            scroll.y = parseFloat(matrixMatch[6]) || 0;
        }

        console.log('[ViewportActionHandler] getViewportFromDom:', { scroll, zoom }, 'from transform:', transform);
        return { scroll, zoom };
    }

    /**
     * Get element IDs from the current model for centering/fitting.
     */
    protected getElementIds(): string[] {
        const model = (this.modelSource as any).model;
        if (model && model.children) {
            return model.children
                .filter((child: any) => child.type?.startsWith('node:'))
                .map((child: any) => child.id);
        }
        return [];
    }

    /**
     * Get the viewport dimensions from the DOM.
     */
    protected getViewportDimensions(): { width: number; height: number } {
        // Try to find the diagram container
        const model = (this.modelSource as any).model;
        if (model?.id) {
            const container = document.getElementById(model.id);
            if (container) {
                const rect = container.getBoundingClientRect();
                return { width: rect.width, height: rect.height };
            }
        }
        // Default fallback
        return { width: 800, height: 600 };
    }

    /**
     * Calculate adjusted scroll position to zoom around the viewport center.
     * When zooming, we want the center of the view to stay at the center.
     *
     * In Sprotty's coordinate system:
     * - Transform is: translate(scroll.x, scroll.y) scale(zoom)
     * - A model point (mx, my) appears at screen position: (mx * zoom + scroll.x, my * zoom + scroll.y)
     * - The center of viewport in model coords: ((viewportWidth/2 - scroll.x) / zoom, (viewportHeight/2 - scroll.y) / zoom)
     */
    protected calculateCenteredScroll(
        oldScroll: { x: number; y: number },
        oldZoom: number,
        newZoom: number
    ): { x: number; y: number } {
        const dimensions = this.getViewportDimensions();

        // Calculate the center point in model coordinates (before zoom)
        const centerModelX = (dimensions.width / 2 - oldScroll.x) / oldZoom;
        const centerModelY = (dimensions.height / 2 - oldScroll.y) / oldZoom;

        // Calculate new scroll to keep the same model point at viewport center after zoom
        // newScroll.x + centerModelX * newZoom = viewportWidth/2
        const newScrollX = dimensions.width / 2 - centerModelX * newZoom;
        const newScrollY = dimensions.height / 2 - centerModelY * newZoom;

        return { x: newScrollX, y: newScrollY };
    }

    /**
     * Handle zoom in action.
     */
    protected async handleZoomIn(action: ZoomInAction): Promise<void> {
        const factor = action.factor ?? 1.2;
        const viewport = this.getCurrentViewport();

        const newZoom = Math.min(viewport.zoom * factor, this.MAX_ZOOM);
        const newScroll = this.calculateCenteredScroll(viewport.scroll, viewport.zoom, newZoom);

        console.info('[ViewportActionHandler] Zooming in:', viewport.zoom, '->', newZoom);

        await this.setViewport(newScroll, newZoom);
    }

    /**
     * Handle zoom out action.
     */
    protected async handleZoomOut(action: ZoomOutAction): Promise<void> {
        const factor = action.factor ?? 1.2;
        const viewport = this.getCurrentViewport();

        const newZoom = Math.max(viewport.zoom / factor, this.MIN_ZOOM);
        const newScroll = this.calculateCenteredScroll(viewport.scroll, viewport.zoom, newZoom);

        console.info('[ViewportActionHandler] Zooming out:', viewport.zoom, '->', newZoom);

        await this.setViewport(newScroll, newZoom);
    }

    /**
     * Handle reset zoom action.
     */
    protected async handleResetZoom(): Promise<void> {
        const viewport = this.getCurrentViewport();

        const newScroll = this.calculateCenteredScroll(viewport.scroll, viewport.zoom, this.DEFAULT_ZOOM);

        console.info('[ViewportActionHandler] Resetting zoom to:', this.DEFAULT_ZOOM);
        await this.setViewport(newScroll, this.DEFAULT_ZOOM);
    }

    /**
     * Handle center action.
     */
    protected async handleCenter(action: CenterDiagramAction): Promise<void> {
        const elementIds = action.elementIds ?? this.getElementIds();
        console.info('[ViewportActionHandler] Centering diagram with elements:', elementIds.length);

        const centerAction: CenterAction = {
            kind: 'center',
            elementIds,
            animate: action.animate ?? true,
            retainZoom: true,
        };

        await this.modelSource.actionDispatcher.dispatch(centerAction);
    }

    /**
     * Handle fit to screen action.
     */
    protected async handleFit(action: FitDiagramAction): Promise<void> {
        const elementIds = action.elementIds ?? this.getElementIds();
        console.info('[ViewportActionHandler] Fitting diagram with elements:', elementIds.length);

        const fitAction: FitToScreenAction = {
            kind: 'fit',
            elementIds,
            padding: action.padding ?? 20,
            animate: action.animate ?? true,
        };

        await this.modelSource.actionDispatcher.dispatch(fitAction);
    }

    /**
     * Set viewport with the given scroll and zoom.
     */
    protected async setViewport(scroll: { x: number; y: number }, zoom: number): Promise<void> {
        // Update our tracked state BEFORE dispatching to ensure next zoom uses correct value
        this.currentZoom = zoom;
        this.currentScroll = { ...scroll };

        // Get the root element ID from the model
        const model = (this.modelSource as any).model;
        const elementId = model?.id ?? 'graph';

        const viewportAction: SetViewportAction = {
            kind: 'viewport',
            elementId,
            newViewport: {
                scroll,
                zoom,
            },
            animate: true,
        };

        await this.modelSource.actionDispatcher.dispatch(viewportAction);
    }
}
