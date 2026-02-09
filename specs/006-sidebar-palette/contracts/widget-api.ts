/**
 * Element Palette Widget API Contract
 *
 * Defines the interfaces for the sidebar Element Palette widget
 * and its integration with Theia's view system.
 *
 * @packageDocumentation
 */

import { Event } from '@theia/core';

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service symbol for the Element Palette widget.
 */
export const ElementPaletteWidgetSymbol = Symbol('ElementPaletteWidget');

/**
 * Element Palette widget interface.
 * Provides the sidebar view for browsing and dragging element types.
 */
export interface IElementPaletteWidget {
    /** Widget ID for Theia view registration */
    readonly id: string;

    /** Current element categories */
    readonly categories: ReadonlyArray<ElementCategory>;

    /** Current search filter */
    readonly searchFilter: string;

    /** Active diagram URI (null when no diagram is open) */
    readonly activeDiagramUri: string | null;

    /** Whether the palette is loading */
    readonly isLoading: boolean;

    /** Event fired when categories change */
    readonly onCategoriesChanged: Event<ReadonlyArray<ElementCategory>>;

    /** Event fired when active diagram changes */
    readonly onActiveDiagramChanged: Event<string | null>;

    /**
     * Set the search filter.
     * @param query - Filter query string
     */
    setSearchFilter(query: string): void;

    /**
     * Toggle a category's expanded state.
     * @param categoryId - Category ID to toggle
     */
    toggleCategory(categoryId: string): void;

    /**
     * Check if a category is expanded.
     * @param categoryId - Category ID to check
     * @returns true if expanded
     */
    isCategoryExpanded(categoryId: string): boolean;

    /**
     * Refresh the palette data for the current diagram.
     */
    refresh(): Promise<void>;
}

/**
 * Element category data.
 */
export interface ElementCategory {
    /** Unique category identifier */
    id: string;
    /** Display name */
    label: string;
    /** Icon class (codicon) */
    icon?: string;
    /** Element types in this category */
    items: ElementTypeItem[];
}

/**
 * Element type item data.
 */
export interface ElementTypeItem {
    /** Element type identifier (e.g., "node:igprogram") */
    id: string;
    /** Display name */
    label: string;
    /** Icon class (codicon) */
    icon?: string;
    /** SVG thumbnail preview */
    thumbnail?: string;
    /** Description for tooltip */
    description?: string;
    /** Creation action */
    action: ElementCreationAction;
}

/**
 * Element creation action.
 */
export interface ElementCreationAction {
    kind: 'createNode' | 'createEdge';
    elementTypeId: string;
    args?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW CONTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * View contribution widget options.
 */
export interface ElementPaletteViewOptions {
    /** Widget ID */
    widgetId: string;
    /** Display name in view menu */
    widgetName: string;
    /** Default widget placement */
    defaultWidgetOptions: {
        /** Panel area (left, right, bottom, main) */
        area: 'left' | 'right' | 'bottom' | 'main';
        /** Sort rank within area */
        rank: number;
    };
    /** Command ID to toggle visibility */
    toggleCommandId: string;
}

/**
 * Default view options.
 */
export const DEFAULT_ELEMENT_PALETTE_VIEW_OPTIONS: ElementPaletteViewOptions = {
    widgetId: 'element-palette',
    widgetName: 'Element Palette',
    defaultWidgetOptions: {
        area: 'left',
        rank: 200, // After file explorer (100)
    },
    toggleCommandId: 'elementPalette:toggle',
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG-AND-DROP PROTOCOL
// ═══════════════════════════════════════════════════════════════════════════════

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
