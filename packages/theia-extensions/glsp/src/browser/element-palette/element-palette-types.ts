/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Palette Types
 *
 * Type definitions for the sidebar element palette widget.
 *
 * @packageDocumentation
 */

/**
 * Action data for an element palette item.
 *
 * Supports element creation (drag-and-drop), delete, and grammar operations (click).
 */
export interface ElementCreationAction {
    /** Action type */
    kind: 'createNode' | 'createEdge' | 'delete' | 'operation' | 'command';
    /** GLSP element type ID (required for createNode/createEdge) */
    elementTypeId?: string;
    /** Grammar operation ID (required for operation kind) */
    operationId?: string;
    /** Language ID for operation execution */
    languageId?: string;
    /** Command ID to execute (required for command kind) */
    commandId?: string;
    /** Additional parameters */
    args?: Record<string, unknown>;
}

/**
 * A single creatable element type.
 */
export interface ElementTypeItem {
    /** Unique element type identifier (e.g., "node:igprogram") */
    id: string;
    /** Display name shown in palette */
    label: string;
    /** Icon class for fallback display */
    icon?: string;
    /** SVG thumbnail preview (generated from shape config) */
    thumbnail?: string;
    /** Description shown in tooltip */
    description?: string;
    /** Creation action details */
    action: ElementCreationAction;
    /** Sort order within category */
    sortString?: string;
}

/**
 * A grouping of related element types.
 */
export interface ElementCategory {
    /** Unique category identifier */
    id: string;
    /** Display name for category header */
    label: string;
    /** Optional icon class (codicon) */
    icon?: string;
    /** Element types in this category */
    items: ElementTypeItem[];
    /** Sort order */
    sortString?: string;
}

/**
 * State managed by the Element Palette sidebar widget.
 */
export interface ElementPaletteState {
    /** Current groups of element types (from server) */
    groups: ElementCategory[];
    /** Currently expanded category IDs */
    expandedCategories: Set<string>;
    /** Current search filter query */
    searchQuery: string;
    /** Active diagram URI (determines which grammar's elements to show) */
    activeDiagramUri: string | null;
    /** Loading state */
    isLoading: boolean;
    /** Error message if palette load failed */
    errorMessage: string | null;
}

/**
 * Service symbol for ElementPaletteService.
 */
export const ElementPaletteServiceSymbol = Symbol('ElementPaletteService');

/**
 * Element Palette Service interface.
 */
export interface IElementPaletteService {
    /** Current state */
    readonly state: ElementPaletteState;

    /** Get filtered groups based on search query */
    getFilteredGroups(): ElementCategory[];

    /** Set the search filter */
    setSearchFilter(query: string): void;

    /** Toggle a category's expanded state */
    toggleCategory(categoryId: string): void;

    /** Check if a category is expanded */
    isCategoryExpanded(categoryId: string): boolean;

    /** Refresh palette data for current diagram */
    refresh(): Promise<void>;

    /** Execute a command from a palette item */
    executeCommand?(commandId: string): Promise<void>;

    /** Subscribe to state changes */
    onStateChanged(callback: (state: ElementPaletteState) => void): { dispose(): void };
}
