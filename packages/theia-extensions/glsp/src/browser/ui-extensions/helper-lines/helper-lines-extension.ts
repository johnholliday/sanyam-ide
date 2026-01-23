/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Helper Lines Extension
 *
 * Provides alignment guides and snap lines during element dragging.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Helper Lines Extension ID.
 */
export const HELPER_LINES_ID = 'sanyam-helper-lines';

/**
 * CSS classes for helper lines.
 */
export const HelperLinesClasses = {
    CONTAINER: 'sanyam-helper-lines-container',
    LINE_HORIZONTAL: 'sanyam-helper-line-horizontal',
    LINE_VERTICAL: 'sanyam-helper-line-vertical',
    LINE_CENTER: 'sanyam-helper-line-center',
    LINE_EDGE: 'sanyam-helper-line-edge',
    LINE_SPACING: 'sanyam-helper-line-spacing',
} as const;

/**
 * Alignment type.
 */
export type AlignmentType = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'horizontal-center' | 'vertical-center';

/**
 * Alignment info.
 */
export interface AlignmentInfo {
    type: AlignmentType;
    position: number;
    referenceElementId: string;
    axis: 'horizontal' | 'vertical';
}

/**
 * Element bounds.
 */
export interface ElementBounds {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

/**
 * Show helper lines action.
 */
export interface ShowHelperLinesAction extends Action {
    kind: 'showHelperLines';
    movingElementId: string;
    position: { x: number; y: number };
}

export namespace ShowHelperLinesAction {
    export const KIND = 'showHelperLines';

    export function create(movingElementId: string, position: { x: number; y: number }): ShowHelperLinesAction {
        return { kind: KIND, movingElementId, position };
    }
}

/**
 * Hide helper lines action.
 */
export interface HideHelperLinesAction extends Action {
    kind: 'hideHelperLines';
}

export namespace HideHelperLinesAction {
    export const KIND = 'hideHelperLines';

    export function create(): HideHelperLinesAction {
        return { kind: KIND };
    }
}

/**
 * Snap result.
 */
export interface SnapResult {
    snappedPosition: { x: number; y: number };
    alignments: AlignmentInfo[];
}

/**
 * Helper Lines Extension.
 *
 * Displays alignment guides during element movement:
 * - Center-to-center alignment (horizontal and vertical)
 * - Edge-to-edge alignment
 * - Spacing guides for equidistant positioning
 */
@injectable()
export class HelperLinesExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Snap threshold in pixels */
    protected snapThreshold: number = 10;

    /** Current alignments */
    protected currentAlignments: AlignmentInfo[] = [];

    /** SVG overlay for lines */
    protected svgOverlay: SVGSVGElement | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    /** Element bounds cache */
    protected elementBoundsCache: Map<string, ElementBounds> = new Map();

    /** Current moving element ID */
    protected movingElementId: string | undefined;

    id(): string {
        return HELPER_LINES_ID;
    }

    containerClass(): string {
        return HelperLinesClasses.CONTAINER;
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
        containerElement.style.position = 'absolute';
        containerElement.style.top = '0';
        containerElement.style.left = '0';
        containerElement.style.width = '100%';
        containerElement.style.height = '100%';
        containerElement.style.pointerEvents = 'none';
        containerElement.style.overflow = 'hidden';

        // Create SVG overlay
        this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgOverlay.setAttribute('width', '100%');
        this.svgOverlay.setAttribute('height', '100%');
        this.svgOverlay.style.position = 'absolute';
        this.svgOverlay.style.top = '0';
        this.svgOverlay.style.left = '0';

        containerElement.appendChild(this.svgOverlay);
    }

    /**
     * Set the snap threshold.
     */
    setSnapThreshold(threshold: number): void {
        this.snapThreshold = threshold;
    }

    /**
     * Start showing helper lines for a moving element.
     */
    startHelperLines(movingElementId: string): void {
        this.movingElementId = movingElementId;
        this.updateElementBoundsCache();
        this.show();
    }

    /**
     * Update helper lines during movement.
     */
    updateHelperLines(position: { x: number; y: number }, size: { width: number; height: number }): SnapResult {
        if (!this.movingElementId) {
            return { snappedPosition: position, alignments: [] };
        }

        // Calculate moving element bounds at new position
        const movingBounds: ElementBounds = {
            id: this.movingElementId,
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            centerX: position.x + size.width / 2,
            centerY: position.y + size.height / 2,
        };

        // Find alignments
        const alignments = this.findAlignments(movingBounds);
        this.currentAlignments = alignments;

        // Calculate snapped position
        const snappedPosition = this.calculateSnappedPosition(position, alignments);

        // Render lines
        this.renderAlignmentLines(alignments, movingBounds, snappedPosition);

        return { snappedPosition, alignments };
    }

    /**
     * Stop showing helper lines.
     */
    stopHelperLines(): void {
        this.movingElementId = undefined;
        this.currentAlignments = [];
        this.clearLines();
        this.hide();
    }

    /**
     * Update the element bounds cache.
     */
    protected updateElementBoundsCache(): void {
        this.elementBoundsCache.clear();

        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return;
        }

        // Find all node elements
        const nodes = svgContainer.querySelectorAll('.sprotty-node, [id^="node"]');
        nodes.forEach(node => {
            const id = node.id;
            if (id && id !== this.movingElementId) {
                const bounds = this.getElementBounds(node as SVGGraphicsElement);
                if (bounds) {
                    this.elementBoundsCache.set(id, bounds);
                }
            }
        });
    }

    /**
     * Get element bounds from SVG element.
     */
    protected getElementBounds(element: SVGGraphicsElement): ElementBounds | undefined {
        try {
            const bbox = element.getBBox();
            const ctm = element.getCTM();

            if (!ctm) {
                return {
                    id: element.id,
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height,
                    centerX: bbox.x + bbox.width / 2,
                    centerY: bbox.y + bbox.height / 2,
                };
            }

            const svg = element.ownerSVGElement;
            if (!svg) {
                return undefined;
            }

            const point = svg.createSVGPoint();
            point.x = bbox.x;
            point.y = bbox.y;
            const transformed = point.matrixTransform(ctm);

            return {
                id: element.id,
                x: transformed.x,
                y: transformed.y,
                width: bbox.width,
                height: bbox.height,
                centerX: transformed.x + bbox.width / 2,
                centerY: transformed.y + bbox.height / 2,
            };
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Find alignments between moving element and other elements.
     */
    protected findAlignments(movingBounds: ElementBounds): AlignmentInfo[] {
        const alignments: AlignmentInfo[] = [];

        for (const [id, bounds] of this.elementBoundsCache) {
            // Center-to-center horizontal alignment
            if (Math.abs(movingBounds.centerY - bounds.centerY) <= this.snapThreshold) {
                alignments.push({
                    type: 'horizontal-center',
                    position: bounds.centerY,
                    referenceElementId: id,
                    axis: 'horizontal',
                });
            }

            // Center-to-center vertical alignment
            if (Math.abs(movingBounds.centerX - bounds.centerX) <= this.snapThreshold) {
                alignments.push({
                    type: 'vertical-center',
                    position: bounds.centerX,
                    referenceElementId: id,
                    axis: 'vertical',
                });
            }

            // Top alignment
            if (Math.abs(movingBounds.y - bounds.y) <= this.snapThreshold) {
                alignments.push({
                    type: 'top',
                    position: bounds.y,
                    referenceElementId: id,
                    axis: 'horizontal',
                });
            }

            // Bottom alignment
            const movingBottom = movingBounds.y + movingBounds.height;
            const boundsBottom = bounds.y + bounds.height;
            if (Math.abs(movingBottom - boundsBottom) <= this.snapThreshold) {
                alignments.push({
                    type: 'bottom',
                    position: boundsBottom,
                    referenceElementId: id,
                    axis: 'horizontal',
                });
            }

            // Left alignment
            if (Math.abs(movingBounds.x - bounds.x) <= this.snapThreshold) {
                alignments.push({
                    type: 'left',
                    position: bounds.x,
                    referenceElementId: id,
                    axis: 'vertical',
                });
            }

            // Right alignment
            const movingRight = movingBounds.x + movingBounds.width;
            const boundsRight = bounds.x + bounds.width;
            if (Math.abs(movingRight - boundsRight) <= this.snapThreshold) {
                alignments.push({
                    type: 'right',
                    position: boundsRight,
                    referenceElementId: id,
                    axis: 'vertical',
                });
            }
        }

        return alignments;
    }

    /**
     * Calculate snapped position based on alignments.
     */
    protected calculateSnappedPosition(
        position: { x: number; y: number },
        alignments: AlignmentInfo[]
    ): { x: number; y: number } {
        let x = position.x;
        let y = position.y;

        // Find the closest horizontal and vertical alignments
        const horizontalAlignments = alignments.filter(a => a.axis === 'horizontal');
        const verticalAlignments = alignments.filter(a => a.axis === 'vertical');

        if (horizontalAlignments.length > 0) {
            // Use the first horizontal alignment
            const alignment = horizontalAlignments[0];
            if (alignment.type === 'horizontal-center') {
                y = alignment.position - (this.elementBoundsCache.get(this.movingElementId!)?.height || 0) / 2;
            } else if (alignment.type === 'top') {
                y = alignment.position;
            } else if (alignment.type === 'bottom') {
                y = alignment.position - (this.elementBoundsCache.get(this.movingElementId!)?.height || 0);
            }
        }

        if (verticalAlignments.length > 0) {
            // Use the first vertical alignment
            const alignment = verticalAlignments[0];
            if (alignment.type === 'vertical-center') {
                x = alignment.position - (this.elementBoundsCache.get(this.movingElementId!)?.width || 0) / 2;
            } else if (alignment.type === 'left') {
                x = alignment.position;
            } else if (alignment.type === 'right') {
                x = alignment.position - (this.elementBoundsCache.get(this.movingElementId!)?.width || 0);
            }
        }

        return { x, y };
    }

    /**
     * Render alignment lines.
     */
    protected renderAlignmentLines(
        alignments: AlignmentInfo[],
        movingBounds: ElementBounds,
        snappedPosition: { x: number; y: number }
    ): void {
        this.clearLines();

        if (!this.svgOverlay) {
            return;
        }

        for (const alignment of alignments) {
            const refBounds = this.elementBoundsCache.get(alignment.referenceElementId);
            if (!refBounds) {
                continue;
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

            if (alignment.axis === 'horizontal') {
                // Horizontal line
                const minX = Math.min(snappedPosition.x, refBounds.x) - 20;
                const maxX = Math.max(snappedPosition.x + movingBounds.width, refBounds.x + refBounds.width) + 20;

                line.setAttribute('x1', String(minX));
                line.setAttribute('y1', String(alignment.position));
                line.setAttribute('x2', String(maxX));
                line.setAttribute('y2', String(alignment.position));
                line.classList.add(HelperLinesClasses.LINE_HORIZONTAL);
            } else {
                // Vertical line
                const minY = Math.min(snappedPosition.y, refBounds.y) - 20;
                const maxY = Math.max(snappedPosition.y + movingBounds.height, refBounds.y + refBounds.height) + 20;

                line.setAttribute('x1', String(alignment.position));
                line.setAttribute('y1', String(minY));
                line.setAttribute('x2', String(alignment.position));
                line.setAttribute('y2', String(maxY));
                line.classList.add(HelperLinesClasses.LINE_VERTICAL);
            }

            // Add type-specific class
            if (alignment.type.includes('center')) {
                line.classList.add(HelperLinesClasses.LINE_CENTER);
            } else {
                line.classList.add(HelperLinesClasses.LINE_EDGE);
            }

            this.svgOverlay.appendChild(line);
        }
    }

    /**
     * Clear all lines.
     */
    protected clearLines(): void {
        if (this.svgOverlay) {
            this.svgOverlay.innerHTML = '';
        }
    }

    /**
     * Find the SVG container.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                return container.querySelector('svg.sprotty-graph') as SVGSVGElement;
            }
        }
        return undefined;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Update cache if model changes during drag
        if (this.movingElementId) {
            this.updateElementBoundsCache();
        }
    }
}
