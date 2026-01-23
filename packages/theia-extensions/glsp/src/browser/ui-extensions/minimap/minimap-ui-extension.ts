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
    TOGGLE: 'sanyam-minimap-toggle',
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
}

export namespace SetViewportFromMinimapAction {
    export const KIND = 'setViewportFromMinimap';

    export function create(scroll: { x: number; y: number }, zoom: number): SetViewportFromMinimapAction {
        return { kind: KIND, scroll, zoom };
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

    /** Toggle button element */
    protected toggleElement: HTMLElement | undefined;

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

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    /** Throttle timer for updates */
    protected updateTimer: ReturnType<typeof setTimeout> | undefined;

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

        // Create toggle button
        this.toggleElement = document.createElement('div');
        this.toggleElement.className = MinimapClasses.TOGGLE;
        this.toggleElement.innerHTML = '<span class="codicon codicon-map"></span>';
        this.toggleElement.title = 'Toggle Mini-map';
        this.toggleElement.addEventListener('click', () => this.toggleMinimap());
        containerElement.appendChild(this.toggleElement);

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
        containerElement.appendChild(this.viewportElement);

        // Document-level mouse events for dragging
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);

        // Show or hide based on config
        if (!this.config.showByDefault) {
            containerElement.style.display = 'none';
        }
    }

    /**
     * Apply position style based on config.
     */
    protected applyPositionStyle(containerElement: HTMLElement): void {
        containerElement.style.position = 'absolute';
        containerElement.style.width = `${this.config.width}px`;
        containerElement.style.height = `${this.config.height + 30}px`; // Extra for toggle
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
        // Ensure the extension is initialized first
        if (!this.containerElement) {
            console.info('[MinimapUIExtension] Initializing minimap before toggle');
            this.show();
        }

        if (this.canvasElement && this.viewportElement) {
            const isHidden = this.canvasElement.style.display === 'none';
            this.canvasElement.style.display = isHidden ? '' : 'none';
            this.viewportElement.style.display = isHidden ? '' : 'none';
            console.info('[MinimapUIExtension] Minimap toggled:', isHidden ? 'shown' : 'hidden');

            // Update the minimap content when showing
            if (isHidden) {
                this.updateMinimap();
            }
        } else {
            console.warn('[MinimapUIExtension] Canvas or viewport element not found');
        }
    }

    /**
     * Update the mini-map.
     */
    updateMinimap(): void {
        // Throttle updates
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        this.updateTimer = setTimeout(() => {
            this.doUpdateMinimap();
        }, 100);
    }

    /**
     * Actually update the mini-map.
     */
    protected doUpdateMinimap(): void {
        this.updateModelBounds();
        this.renderDiagram();
        this.updateViewportIndicator();
    }

    /**
     * Update model bounds from SVG.
     */
    protected updateModelBounds(): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            console.debug('[MinimapUIExtension] SVG container not found');
            return;
        }

        try {
            // Try multiple selectors - Sprotty uses different class names
            let graphGroup = svgContainer.querySelector('g.sprotty-graph') as SVGGraphicsElement;
            if (!graphGroup) {
                // Try the first g element if no specific class
                graphGroup = svgContainer.querySelector('g') as SVGGraphicsElement;
            }

            if (graphGroup) {
                const bbox = graphGroup.getBBox();
                // Only update if we have actual content
                if (bbox.width > 0 && bbox.height > 0) {
                    this.modelBounds = {
                        x: bbox.x,
                        y: bbox.y,
                        width: bbox.width,
                        height: bbox.height,
                    };

                    // Calculate scale to fit model in minimap
                    const scaleX = this.config.width / (bbox.width + 40);
                    const scaleY = this.config.height / (bbox.height + 40);
                    this.scale = Math.min(scaleX, scaleY, 1);
                    console.debug('[MinimapUIExtension] Model bounds updated:', this.modelBounds, 'scale:', this.scale);
                }
            }
        } catch (e) {
            // Ignore errors when model is empty
            console.debug('[MinimapUIExtension] Error getting model bounds:', e);
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
        if (!this.canvasElement || !this.modelBounds) {
            console.debug('[MinimapUIExtension] Cannot render - no canvas or model bounds');
            return;
        }

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
            return;
        }

        // Render all rect, ellipse, and polygon elements (nodes are typically rendered as these)
        const shapes = svgContainer.querySelectorAll('rect, ellipse, polygon, circle');
        ctx.fillStyle = fgColor;

        let nodeCount = 0;
        shapes.forEach(shape => {
            try {
                const bbox = (shape as SVGGraphicsElement).getBBox();
                // Skip very small elements (likely not main node shapes)
                if (bbox.width < 10 || bbox.height < 10) {
                    return;
                }

                const x = (bbox.x - this.modelBounds!.x + 20) * this.scale;
                const y = (bbox.y - this.modelBounds!.y + 20) * this.scale;
                const w = bbox.width * this.scale;
                const h = bbox.height * this.scale;

                ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 4));
                nodeCount++;
            } catch (e) {
                // Ignore
            }
        });

        // Also render Sprotty nodes if present
        const nodes = svgContainer.querySelectorAll('.sprotty-node, [id^="node"]');
        nodes.forEach(node => {
            try {
                const bbox = (node as SVGGraphicsElement).getBBox();
                const x = (bbox.x - this.modelBounds!.x + 20) * this.scale;
                const y = (bbox.y - this.modelBounds!.y + 20) * this.scale;
                const w = bbox.width * this.scale;
                const h = bbox.height * this.scale;

                ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 4));
                nodeCount++;
            } catch (e) {
                // Ignore
            }
        });

        // Render edges as lines
        const edges = svgContainer.querySelectorAll('path, line, polyline');
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;

        let edgeCount = 0;
        edges.forEach(edge => {
            try {
                if (edge instanceof SVGPathElement) {
                    const pathLength = edge.getTotalLength();
                    if (pathLength > 20) { // Skip tiny paths
                        const start = edge.getPointAtLength(0);
                        const end = edge.getPointAtLength(pathLength);

                        ctx.beginPath();
                        ctx.moveTo(
                            (start.x - this.modelBounds!.x + 20) * this.scale,
                            (start.y - this.modelBounds!.y + 20) * this.scale
                        );
                        ctx.lineTo(
                            (end.x - this.modelBounds!.x + 20) * this.scale,
                            (end.y - this.modelBounds!.y + 20) * this.scale
                        );
                        ctx.stroke();
                        edgeCount++;
                    }
                } else if (edge instanceof SVGLineElement) {
                    const x1 = parseFloat(edge.getAttribute('x1') || '0');
                    const y1 = parseFloat(edge.getAttribute('y1') || '0');
                    const x2 = parseFloat(edge.getAttribute('x2') || '0');
                    const y2 = parseFloat(edge.getAttribute('y2') || '0');

                    ctx.beginPath();
                    ctx.moveTo(
                        (x1 - this.modelBounds!.x + 20) * this.scale,
                        (y1 - this.modelBounds!.y + 20) * this.scale
                    );
                    ctx.lineTo(
                        (x2 - this.modelBounds!.x + 20) * this.scale,
                        (y2 - this.modelBounds!.y + 20) * this.scale
                    );
                    ctx.stroke();
                    edgeCount++;
                }
            } catch (e) {
                // Ignore
            }
        });

        console.debug(`[MinimapUIExtension] Rendered ${nodeCount} shapes and ${edgeCount} edges`);
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

        const x = (-this.currentViewport.scroll.x - this.modelBounds.x + 20) * this.scale;
        const y = (-this.currentViewport.scroll.y - this.modelBounds.y + 20) * this.scale;
        const w = viewWidth * this.scale;
        const h = viewHeight * this.scale;

        this.viewportElement.style.left = `${x}px`;
        this.viewportElement.style.top = `${y + 30}px`; // Offset for toggle
        this.viewportElement.style.width = `${w}px`;
        this.viewportElement.style.height = `${h}px`;
    }

    /**
     * Handle canvas click to navigate.
     */
    protected onCanvasClick(event: MouseEvent): void {
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
                x: -(diagramX - parentRect.width / (2 * this.currentViewport.zoom)),
                y: -(diagramY - parentRect.height / (2 * this.currentViewport.zoom)),
            };

            this.dispatch(SetViewportFromMinimapAction.create(newScroll, this.currentViewport.zoom));
        }
    }

    /**
     * Handle mouse down for viewport dragging.
     */
    protected onMouseDown = (event: MouseEvent): void => {
        if (this.viewportElement && event.target === this.viewportElement) {
            this.isDragging = true;
            event.preventDefault();
        }
    };

    /**
     * Handle mouse move during dragging.
     */
    protected onMouseMove = (event: MouseEvent): void => {
        if (!this.isDragging || !this.modelBounds) {
            return;
        }

        // TODO: Implement viewport dragging
        // For now, just use click navigation
    };

    /**
     * Handle mouse up to stop dragging.
     */
    protected onMouseUp = (): void => {
        this.isDragging = false;
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
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                // Sprotty renders an SVG element with a group that has class 'sprotty-graph'
                // The SVG itself may have id like 'sprotty' or be the direct child of the container
                const svg = container.querySelector('svg') as SVGSVGElement;
                if (svg) {
                    return svg;
                }
            }
        }

        // Fallback: try to find any Sprotty SVG in the document
        const parent = this.getParentContainer();
        if (parent) {
            const svg = parent.querySelector('svg') as SVGSVGElement;
            if (svg) {
                return svg;
            }
        }

        return undefined;
    }

    override modelChanged(_model: SModelRootImpl): void {
        this.updateMinimap();
    }

    override dispose(): void {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        super.dispose();
    }
}
