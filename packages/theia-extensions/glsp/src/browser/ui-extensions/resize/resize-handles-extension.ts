/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Resize Handles Extension
 *
 * Provides resize handles for selected nodes.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Resize Handles Extension ID.
 */
export const RESIZE_HANDLES_ID = 'sanyam-resize-handles';

/**
 * CSS classes for resize handles.
 */
export const ResizeHandleClasses = {
    CONTAINER: 'sanyam-resize-handles-container',
    HANDLE: 'sanyam-resize-handle',
    HANDLE_N: 'sanyam-resize-handle-n',
    HANDLE_NE: 'sanyam-resize-handle-ne',
    HANDLE_E: 'sanyam-resize-handle-e',
    HANDLE_SE: 'sanyam-resize-handle-se',
    HANDLE_S: 'sanyam-resize-handle-s',
    HANDLE_SW: 'sanyam-resize-handle-sw',
    HANDLE_W: 'sanyam-resize-handle-w',
    HANDLE_NW: 'sanyam-resize-handle-nw',
} as const;

/**
 * Handle position.
 */
export type HandlePosition = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/**
 * Resize state.
 */
interface ResizeState {
    isResizing: boolean;
    elementId?: string;
    handlePosition?: HandlePosition;
    initialBounds?: { x: number; y: number; width: number; height: number };
    initialMousePosition?: { x: number; y: number };
}

/**
 * Start resize action.
 */
export interface StartResizeAction extends Action {
    kind: 'startResize';
    elementId: string;
    handlePosition: HandlePosition;
}

export namespace StartResizeAction {
    export const KIND = 'startResize';

    export function create(elementId: string, handlePosition: HandlePosition): StartResizeAction {
        return { kind: KIND, elementId, handlePosition };
    }
}

/**
 * Update resize action.
 */
export interface UpdateResizeAction extends Action {
    kind: 'updateResize';
    newBounds: { x: number; y: number; width: number; height: number };
}

export namespace UpdateResizeAction {
    export const KIND = 'updateResize';

    export function create(newBounds: { x: number; y: number; width: number; height: number }): UpdateResizeAction {
        return { kind: KIND, newBounds };
    }
}

/**
 * Complete resize action.
 */
export interface CompleteResizeAction extends Action {
    kind: 'completeResize';
    elementId: string;
    newBounds: { x: number; y: number; width: number; height: number };
}

export namespace CompleteResizeAction {
    export const KIND = 'completeResize';

    export function create(
        elementId: string,
        newBounds: { x: number; y: number; width: number; height: number }
    ): CompleteResizeAction {
        return { kind: KIND, elementId, newBounds };
    }
}

/**
 * Cancel resize action.
 */
export interface CancelResizeAction extends Action {
    kind: 'cancelResize';
}

export namespace CancelResizeAction {
    export const KIND = 'cancelResize';

    export function create(): CancelResizeAction {
        return { kind: KIND };
    }
}

/**
 * Resize Handles Extension.
 *
 * Displays 8 resize handles (N, NE, E, SE, S, SW, W, NW) on selected nodes.
 * Supports:
 * - Free resize from corners
 * - Constrained resize from edges
 * - Aspect ratio lock (Shift key)
 * - Minimum size enforcement
 */
@injectable()
export class ResizeHandlesExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Minimum element size */
    protected minSize: { width: number; height: number } = { width: 50, height: 30 };

    /** Grid snap size (0 = no snap) */
    protected gridSnapSize: number = 0;

    /** Resize operation state */
    protected resizeState: ResizeState = { isResizing: false };

    /** Currently selected element ID */
    protected selectedElementId: string | undefined;

    /** Handle elements */
    protected handles: Map<HandlePosition, HTMLElement> = new Map();

    /** SVG overlay for handles */
    protected svgOverlay: SVGSVGElement | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return RESIZE_HANDLES_ID;
    }

    containerClass(): string {
        return ResizeHandleClasses.CONTAINER;
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

        // Create SVG overlay for handles
        this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgOverlay.setAttribute('width', '100%');
        this.svgOverlay.setAttribute('height', '100%');
        this.svgOverlay.style.position = 'absolute';
        this.svgOverlay.style.top = '0';
        this.svgOverlay.style.left = '0';
        this.svgOverlay.style.pointerEvents = 'none';

        containerElement.appendChild(this.svgOverlay);

        // Create handle elements
        this.createHandles();
    }

    /**
     * Create all resize handles.
     */
    protected createHandles(): void {
        if (!this.svgOverlay) {
            return;
        }

        const positions: HandlePosition[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

        for (const position of positions) {
            const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            handle.classList.add(ResizeHandleClasses.HANDLE);
            handle.classList.add(`${ResizeHandleClasses.HANDLE}-${position}`);
            handle.setAttribute('width', '8');
            handle.setAttribute('height', '8');
            handle.style.display = 'none';
            handle.style.pointerEvents = 'auto';
            handle.style.cursor = this.getCursorForHandle(position);

            handle.addEventListener('mousedown', (e) => this.onHandleMouseDown(e, position));

            this.svgOverlay.appendChild(handle);
            this.handles.set(position, handle as unknown as HTMLElement);
        }
    }

    /**
     * Get cursor style for a handle position.
     */
    protected getCursorForHandle(position: HandlePosition): string {
        switch (position) {
            case 'n':
            case 's':
                return 'ns-resize';
            case 'e':
            case 'w':
                return 'ew-resize';
            case 'ne':
            case 'sw':
                return 'nesw-resize';
            case 'nw':
            case 'se':
                return 'nwse-resize';
        }
    }

    /**
     * Show handles for a selected element.
     */
    showHandlesForElement(elementId: string): void {
        this.selectedElementId = elementId;
        this.updateHandlePositions();
        this.show();
    }

    /**
     * Hide all handles.
     */
    hideHandles(): void {
        this.selectedElementId = undefined;
        this.handles.forEach(handle => {
            handle.style.display = 'none';
        });
        this.hide();
    }

    /**
     * Update handle positions based on element bounds.
     */
    updateHandlePositions(): void {
        if (!this.selectedElementId) {
            return;
        }

        const bounds = this.getElementBounds(this.selectedElementId);
        if (!bounds) {
            this.hideHandles();
            return;
        }

        const halfHandle = 4; // Half of handle size

        // Position handles
        this.setHandlePosition('nw', bounds.x - halfHandle, bounds.y - halfHandle);
        this.setHandlePosition('n', bounds.x + bounds.width / 2 - halfHandle, bounds.y - halfHandle);
        this.setHandlePosition('ne', bounds.x + bounds.width - halfHandle, bounds.y - halfHandle);
        this.setHandlePosition('e', bounds.x + bounds.width - halfHandle, bounds.y + bounds.height / 2 - halfHandle);
        this.setHandlePosition('se', bounds.x + bounds.width - halfHandle, bounds.y + bounds.height - halfHandle);
        this.setHandlePosition('s', bounds.x + bounds.width / 2 - halfHandle, bounds.y + bounds.height - halfHandle);
        this.setHandlePosition('sw', bounds.x - halfHandle, bounds.y + bounds.height - halfHandle);
        this.setHandlePosition('w', bounds.x - halfHandle, bounds.y + bounds.height / 2 - halfHandle);
    }

    /**
     * Set handle position.
     */
    protected setHandlePosition(position: HandlePosition, x: number, y: number): void {
        const handle = this.handles.get(position);
        if (handle) {
            handle.setAttribute('x', String(x));
            handle.setAttribute('y', String(y));
            handle.style.display = '';
        }
    }

    /**
     * Handle mouse down on a resize handle.
     */
    protected onHandleMouseDown(event: MouseEvent, position: HandlePosition): void {
        event.preventDefault();
        event.stopPropagation();

        if (!this.selectedElementId) {
            return;
        }

        const bounds = this.getElementBounds(this.selectedElementId);
        if (!bounds) {
            return;
        }

        this.resizeState = {
            isResizing: true,
            elementId: this.selectedElementId,
            handlePosition: position,
            initialBounds: { ...bounds },
            initialMousePosition: { x: event.clientX, y: event.clientY },
        };

        // Add document-level event listeners
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);

        this.dispatch(StartResizeAction.create(this.selectedElementId, position));
    }

    /**
     * Handle mouse move during resize.
     */
    protected onMouseMove = (event: MouseEvent): void => {
        if (!this.resizeState.isResizing || !this.resizeState.initialBounds || !this.resizeState.initialMousePosition) {
            return;
        }

        const deltaX = event.clientX - this.resizeState.initialMousePosition.x;
        const deltaY = event.clientY - this.resizeState.initialMousePosition.y;

        const newBounds = this.calculateNewBounds(
            this.resizeState.initialBounds,
            this.resizeState.handlePosition!,
            deltaX,
            deltaY,
            event.shiftKey // Aspect ratio lock
        );

        // Apply minimum size
        newBounds.width = Math.max(newBounds.width, this.minSize.width);
        newBounds.height = Math.max(newBounds.height, this.minSize.height);

        // Apply grid snap
        if (this.gridSnapSize > 0) {
            newBounds.x = Math.round(newBounds.x / this.gridSnapSize) * this.gridSnapSize;
            newBounds.y = Math.round(newBounds.y / this.gridSnapSize) * this.gridSnapSize;
            newBounds.width = Math.round(newBounds.width / this.gridSnapSize) * this.gridSnapSize;
            newBounds.height = Math.round(newBounds.height / this.gridSnapSize) * this.gridSnapSize;
        }

        this.dispatch(UpdateResizeAction.create(newBounds));
    };

    /**
     * Handle mouse up to complete resize.
     */
    protected onMouseUp = (event: MouseEvent): void => {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        if (!this.resizeState.isResizing || !this.resizeState.elementId || !this.resizeState.initialBounds || !this.resizeState.initialMousePosition) {
            this.resizeState = { isResizing: false };
            return;
        }

        const deltaX = event.clientX - this.resizeState.initialMousePosition.x;
        const deltaY = event.clientY - this.resizeState.initialMousePosition.y;

        const newBounds = this.calculateNewBounds(
            this.resizeState.initialBounds,
            this.resizeState.handlePosition!,
            deltaX,
            deltaY,
            event.shiftKey
        );

        // Apply minimum size
        newBounds.width = Math.max(newBounds.width, this.minSize.width);
        newBounds.height = Math.max(newBounds.height, this.minSize.height);

        // Dispatch complete action
        this.dispatch(CompleteResizeAction.create(this.resizeState.elementId, newBounds));

        this.resizeState = { isResizing: false };
        this.updateHandlePositions();
    };

    /**
     * Calculate new bounds based on handle drag.
     */
    protected calculateNewBounds(
        initial: { x: number; y: number; width: number; height: number },
        handle: HandlePosition,
        deltaX: number,
        deltaY: number,
        lockAspectRatio: boolean
    ): { x: number; y: number; width: number; height: number } {
        let { x, y, width, height } = initial;
        const aspectRatio = initial.width / initial.height;

        switch (handle) {
            case 'n':
                y += deltaY;
                height -= deltaY;
                break;
            case 'ne':
                y += deltaY;
                height -= deltaY;
                width += deltaX;
                break;
            case 'e':
                width += deltaX;
                break;
            case 'se':
                width += deltaX;
                height += deltaY;
                break;
            case 's':
                height += deltaY;
                break;
            case 'sw':
                x += deltaX;
                width -= deltaX;
                height += deltaY;
                break;
            case 'w':
                x += deltaX;
                width -= deltaX;
                break;
            case 'nw':
                x += deltaX;
                y += deltaY;
                width -= deltaX;
                height -= deltaY;
                break;
        }

        // Lock aspect ratio if shift is held
        if (lockAspectRatio) {
            if (handle === 'n' || handle === 's') {
                width = height * aspectRatio;
            } else if (handle === 'e' || handle === 'w') {
                height = width / aspectRatio;
            } else {
                // Corner handles - use the larger delta
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    height = width / aspectRatio;
                } else {
                    width = height * aspectRatio;
                }
            }
        }

        return { x, y, width, height };
    }

    /**
     * Get element bounds.
     */
    protected getElementBounds(elementId: string): { x: number; y: number; width: number; height: number } | undefined {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return undefined;
        }

        const element = svgContainer.querySelector(`[id="${elementId}"]`);
        if (!element) {
            return undefined;
        }

        try {
            const bbox = (element as SVGGraphicsElement).getBBox();
            const ctm = (element as SVGGraphicsElement).getCTM();

            if (!ctm) {
                return {
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height,
                };
            }

            const svg = (element as SVGElement).ownerSVGElement;
            if (!svg) {
                return undefined;
            }

            const point = svg.createSVGPoint();
            point.x = bbox.x;
            point.y = bbox.y;
            const transformed = point.matrixTransform(ctm);

            // Adjust for container position
            const svgRect = svg.getBoundingClientRect();
            const parentRect = this.getParentContainer()?.getBoundingClientRect();

            if (parentRect) {
                return {
                    x: transformed.x + svgRect.left - parentRect.left,
                    y: transformed.y + svgRect.top - parentRect.top,
                    width: bbox.width,
                    height: bbox.height,
                };
            }

            return {
                x: transformed.x,
                y: transformed.y,
                width: bbox.width,
                height: bbox.height,
            };
        } catch (e) {
            return undefined;
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

    /**
     * Set minimum size.
     */
    setMinSize(width: number, height: number): void {
        this.minSize = { width, height };
    }

    /**
     * Set grid snap size.
     */
    setGridSnapSize(size: number): void {
        this.gridSnapSize = size;
    }

    /**
     * Check if currently resizing.
     */
    isResizing(): boolean {
        return this.resizeState.isResizing;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Update handle positions if model changes
        if (this.selectedElementId) {
            this.updateHandlePositions();
        }
    }
}
