/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Marquee Selection Tool
 *
 * Provides rubber band selection for multiple elements.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { DOMHelper } from 'sprotty/lib/base/views/dom-helper';
import { Action, SelectAction } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Marquee Selection Extension ID.
 */
export const MARQUEE_SELECTION_ID = 'sanyam-marquee-selection';

/**
 * CSS classes for marquee selection.
 */
export const MarqueeSelectionClasses = {
    CONTAINER: 'sanyam-marquee-selection-container',
    RECTANGLE: 'sanyam-marquee-rectangle',
} as const;

/**
 * Selection mode.
 */
export type SelectionMode = 'replace' | 'add' | 'remove' | 'toggle';

/**
 * Marquee bounds.
 */
export interface MarqueeBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Start marquee selection action.
 */
export interface StartMarqueeSelectionAction extends Action {
    kind: 'startMarqueeSelection';
    startPosition: { x: number; y: number };
    mode: SelectionMode;
}

export namespace StartMarqueeSelectionAction {
    export const KIND = 'startMarqueeSelection';

    export function create(
        startPosition: { x: number; y: number },
        mode: SelectionMode = 'replace'
    ): StartMarqueeSelectionAction {
        return { kind: KIND, startPosition, mode };
    }
}

/**
 * Update marquee selection action.
 */
export interface UpdateMarqueeSelectionAction extends Action {
    kind: 'updateMarqueeSelection';
    currentPosition: { x: number; y: number };
}

export namespace UpdateMarqueeSelectionAction {
    export const KIND = 'updateMarqueeSelection';

    export function create(currentPosition: { x: number; y: number }): UpdateMarqueeSelectionAction {
        return { kind: KIND, currentPosition };
    }
}

/**
 * Complete marquee selection action.
 */
export interface CompleteMarqueeSelectionAction extends Action {
    kind: 'completeMarqueeSelection';
    selectedElementIds: string[];
    mode: SelectionMode;
}

export namespace CompleteMarqueeSelectionAction {
    export const KIND = 'completeMarqueeSelection';

    export function create(selectedElementIds: string[], mode: SelectionMode): CompleteMarqueeSelectionAction {
        return { kind: KIND, selectedElementIds, mode };
    }
}

/**
 * Cancel marquee selection action.
 */
export interface CancelMarqueeSelectionAction extends Action {
    kind: 'cancelMarqueeSelection';
}

export namespace CancelMarqueeSelectionAction {
    export const KIND = 'cancelMarqueeSelection';

    export function create(): CancelMarqueeSelectionAction {
        return { kind: KIND };
    }
}

/**
 * Enable marquee selection mode action.
 */
export interface EnableMarqueeSelectAction extends Action {
    kind: 'enableMarqueeSelect';
}

export namespace EnableMarqueeSelectAction {
    export const KIND = 'enableMarqueeSelect';

    export function create(): EnableMarqueeSelectAction {
        return { kind: KIND };
    }
}

/**
 * Marquee Selection Tool Extension.
 *
 * Provides rubber band selection:
 * - Click and drag on empty canvas to create selection rectangle
 * - Elements within rectangle are selected
 * - Supports multiple selection modes (replace, add, remove, toggle)
 */
@injectable()
export class MarqueeSelectionTool extends AbstractUIExtension {
    protected readonly logger = createLogger({ name: 'MarqueeTool' });

    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    @inject(TYPES.DOMHelper)
    protected domHelper: DOMHelper;

    /** Selection state */
    protected isSelecting: boolean = false;
    protected startPosition: { x: number; y: number } = { x: 0, y: 0 };
    protected currentPosition: { x: number; y: number } = { x: 0, y: 0 };
    protected selectionMode: SelectionMode = 'replace';

    /** Rectangle element */
    protected rectangleElement: HTMLElement | undefined;

    /** Previously selected IDs (for toggle mode) */
    protected previousSelection: string[] = [];

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return MARQUEE_SELECTION_ID;
    }

    containerClass(): string {
        return MarqueeSelectionClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    getParentContainer(): HTMLElement | undefined {
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

        // Create selection rectangle
        this.rectangleElement = document.createElement('div');
        this.rectangleElement.className = MarqueeSelectionClasses.RECTANGLE;
        this.rectangleElement.style.display = 'none';
        this.rectangleElement.style.position = 'absolute';
        this.rectangleElement.style.pointerEvents = 'none';

        containerElement.appendChild(this.rectangleElement);
    }

    /** Flag to track if marquee mode is enabled */
    protected marqueeEnabled: boolean = false;

    /**
     * Enable marquee selection mode.
     * When enabled, clicking and dragging on the canvas will start a marquee selection.
     */
    enableMarqueeMode(): void {
        this.marqueeEnabled = true;
        this.show();
        this.logger.info('Marquee selection mode enabled');
    }

    /**
     * Disable marquee selection mode.
     */
    disableMarqueeMode(): void {
        this.marqueeEnabled = false;
        this.isSelecting = false;
        this.hide();
        this.logger.info('Marquee selection mode disabled');
    }

    /**
     * Start marquee selection.
     */
    startSelection(position: { x: number; y: number }, mode: SelectionMode = 'replace', previousSelection: string[] = []): void {
        this.isSelecting = true;
        this.startPosition = position;
        this.currentPosition = position;
        this.selectionMode = mode;
        this.previousSelection = previousSelection;

        this.show();
        this.updateRectangle();
    }

    /**
     * Update selection during drag.
     */
    updateSelection(position: { x: number; y: number }): void {
        if (!this.isSelecting) {
            return;
        }

        this.currentPosition = position;
        this.updateRectangle();
    }

    /**
     * Complete the selection.
     */
    completeSelection(): string[] {
        if (!this.isSelecting) {
            return [];
        }

        const bounds = this.getBounds();
        const elementsInBounds = this.findElementsInBounds(bounds);

        // Apply selection mode
        let finalSelection: string[];
        switch (this.selectionMode) {
            case 'add':
                finalSelection = [...new Set([...this.previousSelection, ...elementsInBounds])];
                break;
            case 'remove':
                finalSelection = this.previousSelection.filter(id => !elementsInBounds.includes(id));
                break;
            case 'toggle':
                const toAdd = elementsInBounds.filter(id => !this.previousSelection.includes(id));
                const toRemove = elementsInBounds.filter(id => this.previousSelection.includes(id));
                finalSelection = [
                    ...this.previousSelection.filter(id => !toRemove.includes(id)),
                    ...toAdd,
                ];
                break;
            case 'replace':
            default:
                finalSelection = elementsInBounds;
                break;
        }

        // Dispatch Sprotty SelectAction to perform the actual selection
        const selectAction = SelectAction.create({
            selectedElementsIDs: finalSelection,
            deselectedElementsIDs: this.selectionMode === 'replace' ? this.previousSelection : [],
        });
        this.dispatch(selectAction);

        this.logger.info({ count: finalSelection.length }, 'Selection completed');

        this.cancelSelection();
        return finalSelection;
    }

    /**
     * Cancel the selection.
     */
    cancelSelection(): void {
        this.isSelecting = false;
        this.startPosition = { x: 0, y: 0 };
        this.currentPosition = { x: 0, y: 0 };

        if (this.rectangleElement) {
            this.rectangleElement.style.display = 'none';
        }

        this.hide();
    }

    /**
     * Get the current selection bounds.
     */
    getBounds(): MarqueeBounds {
        const x = Math.min(this.startPosition.x, this.currentPosition.x);
        const y = Math.min(this.startPosition.y, this.currentPosition.y);
        const width = Math.abs(this.currentPosition.x - this.startPosition.x);
        const height = Math.abs(this.currentPosition.y - this.startPosition.y);

        return { x, y, width, height };
    }

    /**
     * Update the rectangle element.
     */
    protected updateRectangle(): void {
        if (!this.rectangleElement) {
            return;
        }

        const bounds = this.getBounds();

        this.rectangleElement.style.display = 'block';
        this.rectangleElement.style.left = `${bounds.x}px`;
        this.rectangleElement.style.top = `${bounds.y}px`;
        this.rectangleElement.style.width = `${bounds.width}px`;
        this.rectangleElement.style.height = `${bounds.height}px`;
    }

    /**
     * Find elements within the selection bounds.
     */
    protected findElementsInBounds(bounds: MarqueeBounds): string[] {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            this.logger.warn('No SVG container found');
            return [];
        }

        const result: string[] = [];

        // Find all selectable elements - look for groups with sanyam-node class or Sprotty node groups
        // Sprotty nodes are typically <g> elements with an id
        const elements = svgContainer.querySelectorAll('g.sanyam-node, g.sprotty-node, g[id*="node"]');
        this.logger.debug({ elementCount: elements.length, bounds }, 'Found elements for selection');

        elements.forEach(element => {
            if (!element.id) {
                return;
            }

            // Convert DOM ID to Sprotty model ID
            const modelId = this.domHelper.findSModelIdByDOMElement(element);

            const elementBounds = this.getElementBounds(element as SVGGraphicsElement);
            if (elementBounds && this.boundsIntersect(bounds, elementBounds)) {
                result.push(modelId);
            }
        });

        this.logger.debug({ result }, 'Elements in bounds');
        return result;
    }

    /**
     * Get element bounds.
     */
    protected getElementBounds(element: SVGGraphicsElement): MarqueeBounds | undefined {
        try {
            const bbox = element.getBBox();
            const screenCtm = element.getScreenCTM();

            if (!screenCtm) {
                return undefined;
            }

            const svg = element.ownerSVGElement;
            if (!svg) {
                return undefined;
            }

            // Transform both corners through screenCTM to get screen-space coordinates
            const tl = svg.createSVGPoint();
            tl.x = bbox.x;
            tl.y = bbox.y;
            const br = svg.createSVGPoint();
            br.x = bbox.x + bbox.width;
            br.y = bbox.y + bbox.height;

            const tlScreen = tl.matrixTransform(screenCtm);
            const brScreen = br.matrixTransform(screenCtm);

            // Convert from screen coords to parent-container-relative coords
            // (matching the marquee rectangle's coordinate space)
            const parentRect = this.getParentContainer()?.getBoundingClientRect();
            const offsetX = parentRect ? parentRect.left : 0;
            const offsetY = parentRect ? parentRect.top : 0;

            return {
                x: tlScreen.x - offsetX,
                y: tlScreen.y - offsetY,
                width: brScreen.x - tlScreen.x,
                height: brScreen.y - tlScreen.y,
            };
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Check if two bounds intersect.
     */
    protected boundsIntersect(a: MarqueeBounds, b: MarqueeBounds): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
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

    /**
     * Check if currently selecting.
     */
    isSelectionActive(): boolean {
        return this.isSelecting;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Cancel selection if model changes
        if (this.isSelecting) {
            this.cancelSelection();
        }
    }
}
