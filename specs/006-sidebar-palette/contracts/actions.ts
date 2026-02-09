/**
 * Sidebar Element Palette Actions Contract
 *
 * Defines the action interfaces for sidebar palette and quick menu interactions.
 * These actions flow through Sprotty's action dispatcher.
 *
 * @packageDocumentation
 */

import { Action, Point } from 'sprotty-protocol';

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK MENU ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Action to show the quick menu at a specific position.
 * Triggered by double-clicking on empty canvas area.
 */
export interface ShowQuickMenuAction extends Action {
    kind: 'showQuickMenu';
    /** Model coordinates where element will be created */
    modelPosition: Point;
    /** Screen coordinates for menu positioning */
    screenPosition: Point;
}

export namespace ShowQuickMenuAction {
    export const KIND = 'showQuickMenu';

    export function create(modelPosition: Point, screenPosition: Point): ShowQuickMenuAction {
        return {
            kind: KIND,
            modelPosition,
            screenPosition,
        };
    }
}

/**
 * Action to hide the quick menu.
 * Triggered by Escape key, clicking outside, or after element creation.
 */
export interface HideQuickMenuAction extends Action {
    kind: 'hideQuickMenu';
}

export namespace HideQuickMenuAction {
    export const KIND = 'hideQuickMenu';

    export function create(): HideQuickMenuAction {
        return { kind: KIND };
    }
}

/**
 * Action to filter quick menu items.
 * Triggered by typing in the quick menu.
 */
export interface FilterQuickMenuAction extends Action {
    kind: 'filterQuickMenu';
    /** Filter query string */
    query: string;
}

export namespace FilterQuickMenuAction {
    export const KIND = 'filterQuickMenu';

    export function create(query: string): FilterQuickMenuAction {
        return { kind: KIND, query };
    }
}

/**
 * Action to navigate quick menu selection.
 * Triggered by arrow keys.
 */
export interface NavigateQuickMenuAction extends Action {
    kind: 'navigateQuickMenu';
    /** Direction to move selection */
    direction: 'up' | 'down';
}

export namespace NavigateQuickMenuAction {
    export const KIND = 'navigateQuickMenu';

    export function create(direction: 'up' | 'down'): NavigateQuickMenuAction {
        return { kind: KIND, direction };
    }
}

/**
 * Action to select the currently highlighted quick menu item.
 * Triggered by Enter key or click on item.
 */
export interface SelectQuickMenuItemAction extends Action {
    kind: 'selectQuickMenuItem';
    /** Element type ID to create */
    elementTypeId: string;
}

export namespace SelectQuickMenuItemAction {
    export const KIND = 'selectQuickMenuItem';

    export function create(elementTypeId: string): SelectQuickMenuItemAction {
        return { kind: KIND, elementTypeId };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG-AND-DROP ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR SYNCHRONIZATION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Action to request element palette data for the active diagram.
 * Dispatched when sidebar needs to refresh for a new diagram context.
 *
 * Note: Reuses existing RequestToolPaletteAction from tool-palette-actions.ts.
 * This action is documented here for completeness of the sidebar contract.
 */
export interface RequestElementPaletteAction extends Action {
    kind: 'requestToolPalette';
    /** URI of the active diagram */
    uri?: string;
}

/**
 * Action when element palette data is received.
 *
 * Note: Reuses existing SetToolPaletteAction from tool-palette-actions.ts.
 * This action is documented here for completeness of the sidebar contract.
 */
export interface SetElementPaletteAction extends Action {
    kind: 'setToolPalette';
    /** Element categories with items */
    groups: ElementCategory[];
}

/**
 * Element category (same as ToolPaletteGroup).
 */
export interface ElementCategory {
    id: string;
    label: string;
    icon?: string;
    items: ElementTypeItem[];
    sortString?: string;
}

/**
 * Element type item (extended ToolPaletteItem).
 */
export interface ElementTypeItem {
    id: string;
    label: string;
    icon?: string;
    thumbnail?: string;
    description?: string;
    toolAction?: {
        kind: 'createNode' | 'createEdge';
        elementTypeId: string;
        args?: Record<string, unknown>;
    };
    sortString?: string;
}
