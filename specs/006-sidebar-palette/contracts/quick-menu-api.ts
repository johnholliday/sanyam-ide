/**
 * Quick Menu API Contract
 *
 * Defines the interfaces for the canvas double-click quick menu
 * used for rapid element creation.
 *
 * @packageDocumentation
 */

import { Point } from 'sprotty-protocol';

// ═══════════════════════════════════════════════════════════════════════════════
// UI EXTENSION INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick Menu UI Extension ID.
 */
export const QUICK_MENU_ID = 'sanyam-quick-menu';

/**
 * Quick Menu UI Extension interface.
 * Provides the positioned popup for rapid element creation.
 */
export interface IQuickMenuExtension {
    /** Extension ID */
    readonly id: string;

    /** Whether the menu is currently visible */
    readonly isVisible: boolean;

    /** Current filter query */
    readonly filterQuery: string;

    /** Currently selected item index */
    readonly selectedIndex: number;

    /**
     * Show the quick menu at the specified position.
     * @param modelPosition - Where to create the element (model coordinates)
     * @param screenPosition - Where to render the menu (screen coordinates)
     * @param items - Available element types to show
     */
    show(modelPosition: Point, screenPosition: Point, items: QuickMenuItem[]): void;

    /**
     * Hide the quick menu.
     */
    hide(): void;

    /**
     * Set the filter query.
     * @param query - Filter string
     */
    setFilter(query: string): void;

    /**
     * Navigate selection up or down.
     * @param direction - Navigation direction
     */
    navigate(direction: 'up' | 'down'): void;

    /**
     * Select the currently highlighted item.
     * @returns The selected element type ID, or null if nothing selected
     */
    selectCurrent(): string | null;
}

/**
 * Quick menu item data.
 */
export interface QuickMenuItem {
    /** Element type ID */
    id: string;
    /** Display label */
    label: string;
    /** Icon class */
    icon?: string;
    /** Category for grouping (optional) */
    category?: string;
    /** Creation action */
    action: {
        kind: 'createNode' | 'createEdge';
        elementTypeId: string;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Keyboard shortcuts for quick menu.
 */
export const QUICK_MENU_KEYBOARD = {
    /** Close menu */
    CLOSE: 'Escape',
    /** Move selection up */
    UP: 'ArrowUp',
    /** Move selection down */
    DOWN: 'ArrowDown',
    /** Select current item */
    SELECT: 'Enter',
    /** Alternative select */
    SELECT_ALT: 'Tab',
} as const;

/**
 * Quick menu keyboard handler interface.
 */
export interface IQuickMenuKeyboardHandler {
    /**
     * Handle a keyboard event.
     * @param event - The keyboard event
     * @returns true if the event was handled
     */
    handleKeyDown(event: KeyboardEvent): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CSS classes for quick menu styling.
 */
export const QuickMenuClasses = {
    /** Main container */
    CONTAINER: 'sanyam-quick-menu',
    /** Search input container */
    SEARCH: 'sanyam-quick-menu-search',
    /** Search input field */
    SEARCH_INPUT: 'sanyam-quick-menu-search-input',
    /** Items list container */
    ITEMS: 'sanyam-quick-menu-items',
    /** Single item */
    ITEM: 'sanyam-quick-menu-item',
    /** Item icon */
    ITEM_ICON: 'sanyam-quick-menu-item-icon',
    /** Item label */
    ITEM_LABEL: 'sanyam-quick-menu-item-label',
    /** Item category badge */
    ITEM_CATEGORY: 'sanyam-quick-menu-item-category',
    /** Selected/highlighted item */
    ITEM_SELECTED: 'selected',
    /** Empty state message */
    EMPTY: 'sanyam-quick-menu-empty',
    /** Visible state */
    VISIBLE: 'visible',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick menu configuration options.
 */
export interface QuickMenuConfig {
    /** Maximum number of items to show without scrolling */
    maxVisibleItems: number;
    /** Minimum width in pixels */
    minWidth: number;
    /** Maximum width in pixels */
    maxWidth: number;
    /** Auto-close delay after selection (ms), 0 to disable */
    autoCloseDelay: number;
    /** Show category badges on items */
    showCategories: boolean;
    /** Show icons on items */
    showIcons: boolean;
}

/**
 * Default quick menu configuration.
 */
export const DEFAULT_QUICK_MENU_CONFIG: QuickMenuConfig = {
    maxVisibleItems: 8,
    minWidth: 200,
    maxWidth: 400,
    autoCloseDelay: 0,
    showCategories: true,
    showIcons: true,
};
