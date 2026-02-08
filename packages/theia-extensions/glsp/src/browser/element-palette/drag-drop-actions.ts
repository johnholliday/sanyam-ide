/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Drag-Drop Actions
 *
 * Actions for drag-and-drop from the sidebar element palette to the canvas.
 *
 * @packageDocumentation
 */

import { Action, Point } from 'sprotty-protocol';

/**
 * MIME type for element palette drag data.
 */
export const ELEMENT_PALETTE_DRAG_MIME_TYPE = 'application/sanyam-element';

/**
 * Data transferred during drag-and-drop.
 */
export interface ElementDragData {
    /** Element type ID to create */
    elementTypeId: string;
    /** Display label for drag feedback */
    label: string;
    /** Optional icon for drag image */
    icon?: string;
    /** Operation kind (createNode or createEdge) */
    kind?: 'createNode' | 'createEdge';
}

/**
 * Encode drag data for DataTransfer.
 */
export function encodeDragData(data: ElementDragData): string {
    return JSON.stringify(data);
}

/**
 * Decode drag data from DataTransfer.
 */
export function decodeDragData(encoded: string): ElementDragData | null {
    try {
        return JSON.parse(encoded) as ElementDragData;
    } catch {
        return null;
    }
}

/**
 * Action when a drag operation starts from the sidebar.
 * Used to track drag state and provide visual feedback.
 */
export interface StartDragFromPaletteAction extends Action {
    kind: 'startDragFromPalette';
    /** Element type being dragged */
    elementTypeId: string;
    /** Display label for drag feedback */
    label: string;
}

export namespace StartDragFromPaletteAction {
    export const KIND = 'startDragFromPalette';

    export function create(elementTypeId: string, label: string): StartDragFromPaletteAction {
        return { kind: KIND, elementTypeId, label };
    }
}

/**
 * Action when a drag operation enters the canvas.
 * Used to show drop preview.
 */
export interface DragEnterCanvasAction extends Action {
    kind: 'dragEnterCanvas';
    /** Current screen position */
    screenPosition: Point;
}

export namespace DragEnterCanvasAction {
    export const KIND = 'dragEnterCanvas';

    export function create(screenPosition: Point): DragEnterCanvasAction {
        return { kind: KIND, screenPosition };
    }
}

/**
 * Action when a drag operation leaves the canvas.
 * Used to hide drop preview.
 */
export interface DragLeaveCanvasAction extends Action {
    kind: 'dragLeaveCanvas';
}

export namespace DragLeaveCanvasAction {
    export const KIND = 'dragLeaveCanvas';

    export function create(): DragLeaveCanvasAction {
        return { kind: KIND };
    }
}

/**
 * Action when an element is dropped on the canvas from the sidebar.
 * Triggers element creation at drop position.
 */
export interface DropOnCanvasAction extends Action {
    kind: 'dropOnCanvas';
    /** Element type to create */
    elementTypeId: string;
    /** Model coordinates for element placement */
    modelPosition: Point;
}

export namespace DropOnCanvasAction {
    export const KIND = 'dropOnCanvas';

    export function create(elementTypeId: string, modelPosition: Point): DropOnCanvasAction {
        return { kind: KIND, elementTypeId, modelPosition };
    }
}
