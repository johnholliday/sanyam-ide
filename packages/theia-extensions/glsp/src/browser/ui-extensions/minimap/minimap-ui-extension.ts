/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Mini-map UI Extension
 *
 * Provides an overview navigator for large diagrams.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Mini-map Extension ID.
 */
export const MINIMAP_ID = 'sanyam-minimap';

/**
 * CSS classes for mini-map.
 */
export const MinimapClasses = {
    CONTAINER: 'sanyam-minimap-container',
    CANVAS: 'sanyam-minimap-canvas',
    VIEWPORT: 'sanyam-minimap-viewport',
    POSITION_TOP_LEFT: 'position-top-left',
    POSITION_TOP_RIGHT: 'position-top-right',
    POSITION_BOTTOM_LEFT: 'position-bottom-left',
    POSITION_BOTTOM_RIGHT: 'position-bottom-right',
} as const;

/**
 * Mini-map position.
 */
export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Mini-map configuration.
 */
export interface MinimapConfig {
    /** Position in the diagram area */
    position: MinimapPosition;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Margin from edge in pixels */
    margin: number;
    /** Whether to show by default */
    showByDefault: boolean;
}

/**
 * Set viewport action (for mini-map navigation).
 */
export interface SetViewportFromMinimapAction extends Action {
    kind: 'setViewportFromMinimap';
    scroll: { x: number; y: number };
    zoom: number;
    animate: boolean;
}

export namespace SetViewportFromMinimapAction {
    export const KIND = 'setViewportFromMinimap';

    export function create(scroll: { x: number; y: number }, zoom: number, animate: boolean = true): SetViewportFromMinimapAction {
        return { kind: KIND, scroll, zoom, animate };
    }
}

/**
 * Toggle mini-map action.
 */
export interface ToggleMinimapAction extends Action {
    kind: 'toggleMinimap';
    visible?: boolean;
}

export namespace ToggleMinimapAction {
    export const KIND = 'toggleMinimap';

    export function create(visible?: boolean): ToggleMinimapAction {
        return { kind: KIND, visible };
    }
}

/**
 * Mini-map UI Extension.
 *
 * Provides a scaled overview of the diagram in a corner:
 * - Shows all diagram elements in miniature
 * - Displays current viewport as a rectangle
 * - Click to navigate, drag viewport
 */
@injectable()
export class MinimapUIExtension extends AbstractUIExtension {
    protected readonly logger = createLogger({ name: 'Minimap' });

    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Configuration */
    protected config: MinimapConfig = {
        position: 'bottom-right',
        width: 200,
        height: 150,
        margin: 10,
        showByDefault: true,
    };

    /** Canvas element for rendering */
    protected canvasElement: HTMLCanvasElement | undefined;

    /** Viewport indicator element */
    protected viewportElement: HTMLElement | undefined;

    /** Current model bounds */
    protected modelBounds: { x: number; y: number; width: number; height: number } | undefined;

    /** Current viewport */
    protected currentViewport: { scroll: { x: number; y: number }; zoom: number } = {
        scroll: { x: 0, y: 0 },
        zoom: 1,
    };

    /** Scale factor for mini-map */
    protected scale: number = 1;

    /** Is dragging the viewport */
    protected isDragging: boolean = false;

    /** Drag start position */
    protected dragStart: { x: number; y: number } | undefined;

    /** Viewport position at drag start */
    protected dragStartViewport: { x: number; y: number } | undefined;

    /** Flag to prevent click after drag */
    protected justDragged: boolean = false;

    /** Track if mouse moved during drag (to distinguish drag from click) */
    protected dragHadMovement: boolean = false;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    /** Throttle timer for updates */
    protected updateTimer: ReturnType<typeof setTimeout> | undefined;

    /** MutationObserver for viewport changes */
    protected viewportObserver: MutationObserver | undefined;

    id(): string {
        return MINIMAP_ID;
    }

    containerClass(): string {
        return MinimapClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        if (this.parentContainerElement) {
            return this.parentContainerElement;
        }

        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container?.parentElement) {
                return container.parentElement;
            }
        }

        return undefined;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // Apply position class
        this.applyPositionStyle(containerElement);

        // Create canvas for diagram rendering
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.className = MinimapClasses.CANVAS;
        this.canvasElement.width = this.config.width;
        this.canvasElement.height = this.config.height;
        this.canvasElement.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvasElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        containerElement.appendChild(this.canvasElement);

        // Create viewport indicator
        this.viewportElement = document.createElement('div');
        this.viewportElement.className = MinimapClasses.VIEWPORT;
        this.viewportElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        containerElement.appendChild(this.viewportElement);

        // Document-level mouse events for dragging
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);

        // Set up viewport observer to watch for diagram viewport changes
        this.setupViewportObserver();

        // Hide by default - shown via toolbar toggle
        containerElement.style.display = 'none';
    }

    /**
     * Set up a MutationObserver to watch for viewport transform changes.
     */
    protected setupViewportObserver(): void {
        // Clean up existing observer
        if (this.viewportObserver) {
            this.viewportObserver.disconnect();
        }

        this.viewportObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'transform') {
                    // Viewport changed, update the minimap
                    this.onViewportChanged();
                }
            }
        });

        // Start observing after a delay to let the diagram load
        setTimeout(() => this.startObservingViewport(), 500);
    }

    /**
     * Start observing the viewport graph group for transform changes.
     */
    protected startObservingViewport(): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer || !this.viewportObserver) {
            this.logger.debug({ svgContainer: !!svgContainer, observer: !!this.viewportObserver }, 'Cannot start observing');
            return;
        }

        // Log all group elements in the SVG for debugging
        const allGroups = svgContainer.querySelectorAll('g');
        this.logger.debug({ count: allGroups.length }, 'All <g> elements in SVG');
        allGroups.forEach((g, i) => {
            if (i < 5) {
                this.logger.debug({ index: i, id: g.id, class: g.className?.baseVal, transform: g.getAttribute('transform') }, 'SVG group element');
            }
        });

        // Find the viewport root group — always the direct child <g> of the SVG container
        let graphGroup = svgContainer.querySelector(':scope > g') as SVGGElement;
        if (!graphGroup) {
            graphGroup = svgContainer.querySelector('g[id$="_root"]') as SVGGElement;
        }

        if (graphGroup) {
            this.logger.debug({ element: graphGroup.id || graphGroup.className?.baseVal, transform: graphGroup.getAttribute('transform') }, 'Starting viewport observation');
            this.viewportObserver.observe(graphGroup, {
                attributes: true,
                attributeFilter: ['transform'],
            });
        } else {
            this.logger.warn('No graph group found to observe');
        }
    }

    /**
     * Called when the diagram viewport changes.
     */
    protected onViewportChanged(): void {
        this.logger.debug('onViewportChanged triggered');
        // Sync viewport and update indicator (but don't re-render shapes)
        this.syncViewportFromDiagram();
        this.updateViewportIndicator();
    }

    /**
     * Apply position style based on config.
     */
    protected applyPositionStyle(containerElement: HTMLElement): void {
        containerElement.style.position = 'absolute';
        containerElement.style.width = `${this.config.width}px`;
        containerElement.style.height = `${this.config.height}px`;
        containerElement.style.zIndex = '500';

        switch (this.config.position) {
            case 'top-left':
                containerElement.style.top = `${this.config.margin}px`;
                containerElement.style.left = `${this.config.margin}px`;
                containerElement.classList.add(MinimapClasses.POSITION_TOP_LEFT);
                break;
            case 'top-right':
                containerElement.style.top = `${this.config.margin}px`;
                containerElement.style.right = `${this.config.margin}px`;
                containerElement.classList.add(MinimapClasses.POSITION_TOP_RIGHT);
                break;
            case 'bottom-left':
                containerElement.style.bottom = `${this.config.margin}px`;
                containerElement.style.left = `${this.config.margin}px`;
                containerElement.classList.add(MinimapClasses.POSITION_BOTTOM_LEFT);
                break;
            case 'bottom-right':
            default:
                containerElement.style.bottom = `${this.config.margin}px`;
                containerElement.style.right = `${this.config.margin}px`;
                containerElement.classList.add(MinimapClasses.POSITION_BOTTOM_RIGHT);
                break;
        }
    }

    /**
     * Toggle mini-map visibility.
     * Note: This method is called by the action handler, so it should NOT
     * dispatch ToggleMinimapAction to avoid infinite recursion.
     */
    toggleMinimap(): void {
        this.logger.debug({ hasContainer: !!this.containerElement }, 'toggleMinimap called');

        // Ensure the extension is initialized first
        if (!this.containerElement) {
            this.logger.debug('Initializing minimap before toggle');
            this.show();
        }

        if (this.containerElement) {
            const isHidden = this.containerElement.style.display === 'none';
            this.logger.debug({ isHidden }, 'Minimap visibility state');
            this.containerElement.style.display = isHidden ? '' : 'none';
            this.logger.info(`Minimap toggled: ${isHidden ? 'shown' : 'hidden'}`);

            // Update the minimap content when showing
            if (isHidden) {
                this.logger.debug('Calling updateMinimap...');
                this.updateMinimap();
            }
        } else {
            this.logger.warn('Container element not found');
        }
    }

    /**
     * Update the mini-map.
     */
    updateMinimap(): void {
        this.logger.debug('updateMinimap called');
        // Throttle updates
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        this.updateTimer = setTimeout(() => {
            this.logger.debug('updateMinimap timer fired, calling doUpdateMinimap');
            this.doUpdateMinimap();
        }, 100);
    }

    /**
     * Actually update the mini-map.
     */
    protected doUpdateMinimap(): void {
        this.logger.debug('doUpdateMinimap called');
        this.syncViewportFromDiagram();
        this.updateModelBounds();
        this.renderDiagram();
        this.updateViewportIndicator();
        this.logger.debug('doUpdateMinimap completed');
    }

    /**
     * Sync the viewport state from the actual diagram SVG.
     * Reads the transform from the main graph group to get scroll and zoom.
     */
    protected syncViewportFromDiagram(): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            this.logger.debug('syncViewportFromDiagram: no SVG container');
            return;
        }

        // Find the viewport root group — always the direct child <g> of the SVG container.
        // IMPORTANT: Do not use 'g[transform]' here — it does a depth-first search and may
        // match a node's local transform group instead of the viewport group, especially when
        // the viewport group has no transform attribute at default scroll/zoom.
        let graphGroup = svgContainer.querySelector(':scope > g') as SVGGElement;
        if (!graphGroup) {
            graphGroup = svgContainer.querySelector('g[id$="_root"]') as SVGGElement;
        }

        if (!graphGroup) {
            this.logger.debug('syncViewportFromDiagram: no graph group found');
            return;
        }

        // Parse the transform attribute to get scroll and zoom
        const transform = graphGroup.getAttribute('transform');
        this.logger.debug({ transform }, 'syncViewportFromDiagram: transform');
        if (transform) {
            const viewport = this.parseTransform(transform);
            if (viewport) {
                this.currentViewport = viewport;
                this.logger.debug({ viewport: this.currentViewport }, 'Synced viewport from diagram');
            }
        } else {
            // No transform attribute means default viewport (identity transform)
            this.currentViewport = { scroll: { x: 0, y: 0 }, zoom: 1 };
            this.logger.debug('syncViewportFromDiagram: no transform, using default viewport');
        }
    }

    /**
     * Parse an SVG transform string to extract scroll and zoom.
     * Handles transforms like "translate(x, y) scale(z)", "scale(z) translate(x, y)", or "matrix(a,b,c,d,e,f)"
     */
    protected parseTransform(transform: string): { scroll: { x: number; y: number }; zoom: number } | undefined {
        let scroll = { x: 0, y: 0 };
        let zoom = 1;

        // Try to parse translate - handle both "translate(x,y)" and "translate(x, y)"
        const translateMatch = transform.match(/translate\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
        if (translateMatch) {
            scroll.x = -(parseFloat(translateMatch[1]) || 0);
            scroll.y = -(parseFloat(translateMatch[2]) || 0);
            this.logger.debug({ scroll }, 'parseTransform: translate');
        }

        // Try to parse scale - handle "scale(z)" or "scale(x, y)"
        const scaleMatch = transform.match(/scale\s*\(\s*(-?[\d.]+)/);
        if (scaleMatch) {
            zoom = parseFloat(scaleMatch[1]) || 1;
            this.logger.debug({ zoom }, 'parseTransform: scale');
        }

        // Try to parse matrix(a, b, c, d, e, f) where e=translateX, f=translateY, a=scaleX
        const matrixMatch = transform.match(/matrix\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
        if (matrixMatch) {
            zoom = parseFloat(matrixMatch[1]) || 1;
            scroll.x = -(parseFloat(matrixMatch[5]) || 0);
            scroll.y = -(parseFloat(matrixMatch[6]) || 0);
            this.logger.debug({ zoom, scroll }, 'parseTransform: matrix');
        }

        this.logger.debug({ scroll, zoom }, 'parseTransform result');
        return { scroll, zoom };
    }

    /**
     * Update model bounds from SVG.
     * Calculates bounds directly from shape elements to ensure coordinate consistency.
     */
    protected updateModelBounds(): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            this.logger.warn('updateModelBounds: SVG container not found');
            return;
        }

        this.logger.debug({ id: svgContainer.id, class: svgContainer.className?.baseVal }, 'updateModelBounds: SVG found');

        try {
            // Calculate bounds from shape elements directly to ensure coordinate consistency
            // This avoids the mismatch between SVG's transformed getBBox() and shapes' local getBBox()
            const bounds = this.calculateBoundsFromShapes(svgContainer);

            if (bounds) {
                this.modelBounds = bounds;

                // Calculate scale to fit model in minimap with padding
                const paddedWidth = bounds.width + 40;
                const paddedHeight = bounds.height + 40;
                const scaleX = this.config.width / paddedWidth;
                const scaleY = this.config.height / paddedHeight;
                this.scale = Math.min(scaleX, scaleY, 1);

                this.logger.debug({ modelBounds: this.modelBounds, scale: this.scale }, 'Model bounds from shapes');
            } else {
                this.logger.warn('No valid bounds found from shapes');
            }
        } catch (e) {
            // Ignore errors when model is empty
            this.logger.warn({ err: e }, 'Error getting model bounds');
        }
    }

    /**
     * Calculate bounds from shape elements in MODEL space (untransformed).
     * Uses getCTM() to get transformed positions, then reverses the viewport transform
     * to get original model coordinates.
     */
    protected calculateBoundsFromShapes(svgContainer: SVGSVGElement): { x: number; y: number; width: number; height: number } | undefined {
        const shapes = svgContainer.querySelectorAll('rect, ellipse, polygon, circle');
        this.logger.debug({ count: shapes.length }, 'calculateBoundsFromShapes: found shapes');

        if (shapes.length === 0) {
            return undefined;
        }

        // Get the SVG's CTM to calculate relative positions
        const svgCTM = svgContainer.getScreenCTM();
        if (!svgCTM) {
            this.logger.warn('Could not get SVG screen CTM');
            return undefined;
        }
        const svgCTMInverse = svgCTM.inverse();

        // Get the viewport transform to convert from transformed to model space
        const viewportScroll = this.currentViewport.scroll;
        const viewportZoom = this.currentViewport.zoom;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let validShapeCount = 0;

        shapes.forEach((shape) => {
            try {
                const graphicsElement = shape as SVGGraphicsElement;
                const bbox = graphicsElement.getBBox();
                // Skip very small elements (same filter as renderDiagram)
                if (bbox.width < 10 || bbox.height < 10) {
                    return;
                }

                // Get the shape's transformation matrix relative to the SVG
                const shapeCTM = graphicsElement.getScreenCTM();
                if (!shapeCTM) {
                    return;
                }

                // Calculate the shape's position in SVG coordinates (transformed space)
                // by combining the shape's screen CTM with the SVG's inverse CTM
                const relativeMatrix = svgCTMInverse.multiply(shapeCTM);

                // Transform the bbox corners to get the transformed position
                const transformedX = relativeMatrix.e + bbox.x * relativeMatrix.a;
                const transformedY = relativeMatrix.f + bbox.y * relativeMatrix.d;
                const width = bbox.width * Math.abs(relativeMatrix.a);
                const height = bbox.height * Math.abs(relativeMatrix.d);

                // Convert from transformed space back to MODEL space
                // Sprotty SVG transform: scale(zoom) translate(-scroll.x, -scroll.y)
                // screenPos = (modelPos - scroll) * zoom
                // Therefore: modelPos = screenPos / zoom + scroll
                const modelX = transformedX / viewportZoom + viewportScroll.x;
                const modelY = transformedY / viewportZoom + viewportScroll.y;
                const modelWidth = width / viewportZoom;
                const modelHeight = height / viewportZoom;

                minX = Math.min(minX, modelX);
                minY = Math.min(minY, modelY);
                maxX = Math.max(maxX, modelX + modelWidth);
                maxY = Math.max(maxY, modelY + modelHeight);
                validShapeCount++;
            } catch (e) {
                // Ignore shapes that fail
            }
        });

        this.logger.debug({ validShapeCount, bounds: { minX, minY, maxX, maxY }, viewport: { scroll: viewportScroll, zoom: viewportZoom } }, 'calculateBoundsFromShapes result');

        if (validShapeCount === 0 || minX === Infinity) {
            return undefined;
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * Get transformed bounds for a shape element in MODEL space.
     * Returns the shape's bounding box in model coordinates (before viewport transform).
     */
    protected getTransformedBounds(shape: SVGGraphicsElement, svgContainer: SVGSVGElement): { x: number; y: number; width: number; height: number } | undefined {
        try {
            const bbox = shape.getBBox();
            if (bbox.width < 10 || bbox.height < 10) {
                return undefined;
            }

            const svgCTM = svgContainer.getScreenCTM();
            const shapeCTM = shape.getScreenCTM();
            if (!svgCTM || !shapeCTM) {
                return undefined;
            }

            const relativeMatrix = svgCTM.inverse().multiply(shapeCTM);

            // Calculate transformed position (in screen/SVG space)
            const transformedX = relativeMatrix.e + bbox.x * relativeMatrix.a;
            const transformedY = relativeMatrix.f + bbox.y * relativeMatrix.d;
            const transformedWidth = bbox.width * Math.abs(relativeMatrix.a);
            const transformedHeight = bbox.height * Math.abs(relativeMatrix.d);

            // Convert from transformed space to MODEL space
            // screenPos = (modelPos - scroll) * zoom → modelPos = screenPos / zoom + scroll
            const viewportScroll = this.currentViewport.scroll;
            const viewportZoom = this.currentViewport.zoom;

            return {
                x: transformedX / viewportZoom + viewportScroll.x,
                y: transformedY / viewportZoom + viewportScroll.y,
                width: transformedWidth / viewportZoom,
                height: transformedHeight / viewportZoom,
            };
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Get computed color from CSS variable or fallback.
     */
    protected getColor(cssVar: string, fallback: string): string {
        if (this.containerElement) {
            const computed = getComputedStyle(this.containerElement).getPropertyValue(cssVar.replace('var(', '').replace(')', '').split(',')[0].trim());
            if (computed && computed.trim()) {
                return computed.trim();
            }
        }
        return fallback;
    }

    /**
     * Render the diagram to the canvas.
     */
    protected renderDiagram(): void {
        if (!this.canvasElement) {
            this.logger.warn('Cannot render - no canvas');
            return;
        }
        if (!this.modelBounds) {
            this.logger.warn('Cannot render - no model bounds');
            return;
        }
        this.logger.debug({ canvasWidth: this.canvasElement.width, canvasHeight: this.canvasElement.height, modelBounds: this.modelBounds }, 'renderDiagram');

        const ctx = this.canvasElement.getContext('2d');
        if (!ctx) {
            return;
        }

        // Get colors from CSS variables (canvas doesn't support CSS variables directly)
        const bgColor = this.getColor('--theia-editor-background', '#1e1e1e');
        const fgColor = this.getColor('--theia-foreground', '#cccccc');

        // Clear canvas
        ctx.clearRect(0, 0, this.config.width, this.config.height);

        // Draw background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.config.width, this.config.height);

        // Find all elements and render simplified versions
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            this.logger.warn('renderDiagram: No SVG container');
            return;
        }

        // Log the SVG structure for debugging
        this.logger.debug({ childrenCount: svgContainer.children.length, innerHtmlLength: svgContainer.innerHTML.length }, 'SVG structure');

        // Render all rect, ellipse, and polygon elements (nodes are typically rendered as these)
        const shapes = svgContainer.querySelectorAll('rect, ellipse, polygon, circle');
        this.logger.debug({ count: shapes.length }, 'Found shapes (rect, ellipse, polygon, circle)');
        ctx.fillStyle = fgColor;

        let nodeCount = 0;
        let skippedSmall = 0;
        let outOfBounds = 0;
        this.logger.debug({ scale: this.scale, modelBounds: this.modelBounds }, 'Rendering shapes');
        shapes.forEach((shape, i) => {
            try {
                // Use transformed bounds to get actual position in SVG space
                const transformedBounds = this.getTransformedBounds(shape as SVGGraphicsElement, svgContainer);
                if (!transformedBounds) {
                    skippedSmall++;
                    return;
                }

                const x = (transformedBounds.x - this.modelBounds!.x + 20) * this.scale;
                const y = (transformedBounds.y - this.modelBounds!.y + 20) * this.scale;
                const w = transformedBounds.width * this.scale;
                const h = transformedBounds.height * this.scale;

                // Log first few shapes to debug coordinates
                if (nodeCount < 3) {
                    this.logger.debug({ index: i, transformed: { x: transformedBounds.x.toFixed(1), y: transformedBounds.y.toFixed(1), w: transformedBounds.width.toFixed(1), h: transformedBounds.height.toFixed(1) }, canvas: { x: x.toFixed(1), y: y.toFixed(1), w: w.toFixed(1), h: h.toFixed(1) } }, 'Shape coordinates');
                }

                // Check if within canvas bounds
                if (x < 0 || y < 0 || x > this.config.width || y > this.config.height) {
                    outOfBounds++;
                }

                ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 4));
                nodeCount++;
            } catch (e) {
                // Ignore
            }
        });
        this.logger.debug({ rendered: nodeCount, skippedSmall, outOfBounds }, 'Rendered shapes');

        // Also render Sprotty nodes if present (using transformed bounds)
        const nodes = svgContainer.querySelectorAll('.sprotty-node, [id^="node"]');
        this.logger.debug({ count: nodes.length }, 'Found Sprotty nodes');
        let sprottyNodeCount = 0;
        nodes.forEach(node => {
            try {
                const transformedBounds = this.getTransformedBounds(node as SVGGraphicsElement, svgContainer);
                if (!transformedBounds) {
                    return;
                }

                const x = (transformedBounds.x - this.modelBounds!.x + 20) * this.scale;
                const y = (transformedBounds.y - this.modelBounds!.y + 20) * this.scale;
                const w = transformedBounds.width * this.scale;
                const h = transformedBounds.height * this.scale;

                ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 4));
                sprottyNodeCount++;
            } catch (e) {
                // Ignore
            }
        });
        this.logger.debug({ count: sprottyNodeCount }, 'Rendered Sprotty nodes');

        // Render edges as lines (converting to model space)
        const edges = svgContainer.querySelectorAll('path, line, polyline');
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;

        // Get SVG CTM for edge transformations
        const svgCTM = svgContainer.getScreenCTM();
        const svgCTMInverse = svgCTM?.inverse();

        // Get viewport transform to convert to model space
        const viewportScroll = this.currentViewport.scroll;
        const viewportZoom = this.currentViewport.zoom;

        let edgeCount = 0;
        edges.forEach(edge => {
            try {
                if (edge instanceof SVGPathElement) {
                    const pathLength = edge.getTotalLength();
                    if (pathLength > 20) { // Skip tiny paths
                        const start = edge.getPointAtLength(0);
                        const end = edge.getPointAtLength(pathLength);

                        // Transform the points to SVG coordinate space
                        let startX = start.x, startY = start.y;
                        let endX = end.x, endY = end.y;

                        if (svgCTMInverse) {
                            const edgeCTM = edge.getScreenCTM();
                            if (edgeCTM) {
                                const relativeMatrix = svgCTMInverse.multiply(edgeCTM);
                                startX = relativeMatrix.e + start.x * relativeMatrix.a;
                                startY = relativeMatrix.f + start.y * relativeMatrix.d;
                                endX = relativeMatrix.e + end.x * relativeMatrix.a;
                                endY = relativeMatrix.f + end.y * relativeMatrix.d;
                            }
                        }

                        // Convert from transformed space to MODEL space
                        const modelStartX = startX / viewportZoom + viewportScroll.x;
                        const modelStartY = startY / viewportZoom + viewportScroll.y;
                        const modelEndX = endX / viewportZoom + viewportScroll.x;
                        const modelEndY = endY / viewportZoom + viewportScroll.y;

                        ctx.beginPath();
                        ctx.moveTo(
                            (modelStartX - this.modelBounds!.x + 20) * this.scale,
                            (modelStartY - this.modelBounds!.y + 20) * this.scale
                        );
                        ctx.lineTo(
                            (modelEndX - this.modelBounds!.x + 20) * this.scale,
                            (modelEndY - this.modelBounds!.y + 20) * this.scale
                        );
                        ctx.stroke();
                        edgeCount++;
                    }
                } else if (edge instanceof SVGLineElement) {
                    let x1 = parseFloat(edge.getAttribute('x1') || '0');
                    let y1 = parseFloat(edge.getAttribute('y1') || '0');
                    let x2 = parseFloat(edge.getAttribute('x2') || '0');
                    let y2 = parseFloat(edge.getAttribute('y2') || '0');

                    // Transform the points to SVG coordinate space
                    if (svgCTMInverse) {
                        const edgeCTM = edge.getScreenCTM();
                        if (edgeCTM) {
                            const relativeMatrix = svgCTMInverse.multiply(edgeCTM);
                            x1 = relativeMatrix.e + x1 * relativeMatrix.a;
                            y1 = relativeMatrix.f + y1 * relativeMatrix.d;
                            x2 = relativeMatrix.e + x2 * relativeMatrix.a;
                            y2 = relativeMatrix.f + y2 * relativeMatrix.d;
                        }
                    }

                    // Convert from transformed space to MODEL space
                    const modelX1 = x1 / viewportZoom + viewportScroll.x;
                    const modelY1 = y1 / viewportZoom + viewportScroll.y;
                    const modelX2 = x2 / viewportZoom + viewportScroll.x;
                    const modelY2 = y2 / viewportZoom + viewportScroll.y;

                    ctx.beginPath();
                    ctx.moveTo(
                        (modelX1 - this.modelBounds!.x + 20) * this.scale,
                        (modelY1 - this.modelBounds!.y + 20) * this.scale
                    );
                    ctx.lineTo(
                        (modelX2 - this.modelBounds!.x + 20) * this.scale,
                        (modelY2 - this.modelBounds!.y + 20) * this.scale
                    );
                    ctx.stroke();
                    edgeCount++;
                }
            } catch (e) {
                // Ignore
            }
        });

        this.logger.debug({ shapes: nodeCount, edges: edgeCount }, 'Render complete');
    }

    /**
     * Update the viewport indicator position.
     */
    protected updateViewportIndicator(): void {
        if (!this.viewportElement || !this.modelBounds) {
            return;
        }

        const parent = this.getParentContainer();
        if (!parent) {
            return;
        }

        const parentRect = parent.getBoundingClientRect();

        // Calculate viewport rectangle in mini-map coordinates
        const viewWidth = parentRect.width / this.currentViewport.zoom;
        const viewHeight = parentRect.height / this.currentViewport.zoom;

        const x = (this.currentViewport.scroll.x - this.modelBounds.x + 20) * this.scale;
        const y = (this.currentViewport.scroll.y - this.modelBounds.y + 20) * this.scale;
        const w = viewWidth * this.scale;
        const h = viewHeight * this.scale;

        this.viewportElement.style.left = `${x}px`;
        this.viewportElement.style.top = `${y}px`;
        this.viewportElement.style.width = `${w}px`;
        this.viewportElement.style.height = `${h}px`;
    }

    /**
     * Handle canvas click to navigate.
     */
    protected onCanvasClick(event: MouseEvent): void {
        // Skip click if we just finished dragging (click fires after mouseup)
        if (this.justDragged) {
            this.justDragged = false;
            return;
        }

        if (this.isDragging || !this.modelBounds || !this.canvasElement) {
            return;
        }

        const rect = this.canvasElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Convert to diagram coordinates
        const diagramX = (x / this.scale) + this.modelBounds.x - 20;
        const diagramY = (y / this.scale) + this.modelBounds.y - 20;

        // Center on this point
        const parent = this.getParentContainer();
        if (parent) {
            const parentRect = parent.getBoundingClientRect();
            const newScroll = {
                x: diagramX - parentRect.width / (2 * this.currentViewport.zoom),
                y: diagramY - parentRect.height / (2 * this.currentViewport.zoom),
            };

            this.dispatch(SetViewportFromMinimapAction.create(newScroll, this.currentViewport.zoom));
        }
    }

    /**
     * Handle mouse down for viewport dragging.
     */
    protected onMouseDown = (event: MouseEvent): void => {
        if (!this.canvasElement) {
            return;
        }

        this.isDragging = true;
        this.dragHadMovement = false;
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.dragStartViewport = { ...this.currentViewport.scroll };
        event.preventDefault();
    };

    /**
     * Handle mouse move during dragging.
     */
    protected onMouseMove = (event: MouseEvent): void => {
        if (!this.isDragging || !this.modelBounds || !this.dragStart || !this.dragStartViewport) {
            return;
        }

        // Calculate delta in screen pixels
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;

        // Track if meaningful movement occurred (more than 3 pixels)
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            this.dragHadMovement = true;
        }

        // Convert delta to diagram coordinates (inverse of minimap scale)
        const diagramDeltaX = deltaX / this.scale;
        const diagramDeltaY = deltaY / this.scale;

        // Calculate new scroll position (dragging viewport right increases scroll)
        const newScroll = {
            x: this.dragStartViewport.x + diagramDeltaX,
            y: this.dragStartViewport.y + diagramDeltaY,
        };

        // Dispatch viewport change without animation for responsive dragging
        this.dispatch(SetViewportFromMinimapAction.create(newScroll, this.currentViewport.zoom, false));
    };

    /**
     * Handle mouse up to stop dragging.
     */
    protected onMouseUp = (): void => {
        if (this.isDragging && this.dragHadMovement) {
            this.justDragged = true;
        }
        this.isDragging = false;
        this.dragHadMovement = false;
        this.dragStart = undefined;
        this.dragStartViewport = undefined;
    };

    /**
     * Update viewport from external source.
     */
    setViewport(scroll: { x: number; y: number }, zoom: number): void {
        this.currentViewport = { scroll, zoom };
        this.updateViewportIndicator();
    }

    /**
     * Set mini-map configuration.
     */
    setConfig(config: Partial<MinimapConfig>): void {
        this.config = { ...this.config, ...config };

        if (this.containerElement) {
            this.applyPositionStyle(this.containerElement);
        }

        if (this.canvasElement) {
            this.canvasElement.width = this.config.width;
            this.canvasElement.height = this.config.height;
        }

        this.updateMinimap();
    }

    /**
     * Find the SVG container.
     * Tries multiple selectors to handle different Sprotty configurations.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        this.logger.debug({ diagramContainerId: this.diagramContainerId }, 'findSvgContainer');

        // Try 1: Direct container ID lookup
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            this.logger.debug({ tagName: container?.tagName, className: container?.className }, 'Container by ID');
            if (container) {
                // The container itself might be the SVG (Sprotty creates SVG with the container ID)
                if (container.tagName.toLowerCase() === 'svg') {
                    this.logger.debug('Container IS the SVG');
                    return container as unknown as SVGSVGElement;
                }

                // Try SVG with sprotty-graph class first (most specific)
                let svg = container.querySelector('svg.sprotty-graph') as SVGSVGElement;
                if (svg) {
                    this.logger.debug('Found svg.sprotty-graph in container');
                    return svg;
                }

                // Try any SVG element in the container
                svg = container.querySelector('svg') as SVGSVGElement;
                if (svg) {
                    this.logger.debug('Found svg in container');
                    return svg;
                }
            }
        }

        // Try 2: Look in parent container
        const parent = this.getParentContainer();
        this.logger.debug({ tagName: parent?.tagName, className: parent?.className }, 'Parent container');
        if (parent) {
            // Try SVG with sprotty-graph class
            let svg = parent.querySelector('svg.sprotty-graph') as SVGSVGElement;
            if (svg) {
                this.logger.debug('Found svg.sprotty-graph in parent');
                return svg;
            }

            // Try SVG inside sanyam-diagram-svg-container
            const svgContainer = parent.querySelector('.sanyam-diagram-svg-container');
            if (svgContainer) {
                // Check if the container has an SVG child
                svg = svgContainer.querySelector('svg') as SVGSVGElement;
                if (svg) {
                    this.logger.debug('Found svg in .sanyam-diagram-svg-container');
                    return svg;
                }
                // Also check if any child element is actually a Sprotty SVG
                const sprottyContainer = svgContainer.querySelector('[id^="sprotty"]');
                if (sprottyContainer?.tagName.toLowerCase() === 'svg') {
                    this.logger.debug('Found Sprotty SVG by ID prefix');
                    return sprottyContainer as SVGSVGElement;
                }
            }

            // Fallback: any SVG in parent
            svg = parent.querySelector('svg') as SVGSVGElement;
            if (svg) {
                this.logger.debug('Found svg in parent (fallback)');
                return svg;
            }
        }

        // Try 3: Global search for sprotty graph (last resort)
        const globalSvg = document.querySelector('svg.sprotty-graph') as SVGSVGElement;
        if (globalSvg) {
            this.logger.debug('Found svg.sprotty-graph globally');
            return globalSvg;
        }

        // Try 4: Look for any SVG with sprotty ID pattern
        const sprottyIdSvg = document.querySelector('svg[id^="sprotty"]') as SVGSVGElement;
        if (sprottyIdSvg) {
            this.logger.debug('Found SVG with sprotty ID prefix globally');
            return sprottyIdSvg;
        }

        this.logger.warn('Could not find SVG container');
        return undefined;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Add delay to let DOM settle after model changes
        setTimeout(() => {
            this.updateMinimap();
        }, 100);
    }

    /**
     * Force an immediate update of the minimap.
     * Useful after layout completes or when diagram is first loaded.
     */
    forceUpdate(): void {
        // Cancel any pending throttled update
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = undefined;
        }

        // Ensure minimap is initialized
        if (!this.containerElement) {
            this.show();
        }

        // Wait a bit for DOM to be ready, then update
        setTimeout(() => {
            this.doUpdateMinimap();
            this.logger.debug('Force update completed');
        }, 150);
    }

    override dispose(): void {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        if (this.viewportObserver) {
            this.viewportObserver.disconnect();
            this.viewportObserver = undefined;
        }

        super.dispose();
    }
}
