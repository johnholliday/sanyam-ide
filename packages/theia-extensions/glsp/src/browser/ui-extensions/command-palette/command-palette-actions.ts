/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Command Palette Actions
 *
 * Actions for the diagram command palette.
 *
 * @packageDocumentation
 */

import { Action } from 'sprotty-protocol';

/**
 * Command palette item.
 */
export interface CommandPaletteItem {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Optional icon class */
    icon?: string;
    /** Optional category for grouping */
    category?: string;
    /** Optional keyboard shortcut */
    shortcut?: string;
    /** Action to execute */
    action: Action;
    /** Optional description */
    description?: string;
    /** Sort priority (lower = higher in list) */
    sortPriority?: number;
}

/**
 * Command palette provider interface.
 */
export interface CommandPaletteProvider {
    /** Get available commands */
    getCommands(context: CommandPaletteContext): CommandPaletteItem[];
}

/**
 * Context for command palette.
 */
export interface CommandPaletteContext {
    /** Currently selected element IDs */
    selectedElementIds: string[];
    /** Position where palette was invoked (if from right-click) */
    position?: { x: number; y: number };
    /** Current search query */
    query?: string;
}

/**
 * Show command palette action.
 */
export interface ShowCommandPaletteAction extends Action {
    kind: 'showCommandPalette';
    context?: CommandPaletteContext;
}

export namespace ShowCommandPaletteAction {
    export const KIND = 'showCommandPalette';

    export function create(context?: CommandPaletteContext): ShowCommandPaletteAction {
        return { kind: KIND, context };
    }
}

/**
 * Hide command palette action.
 */
export interface HideCommandPaletteAction extends Action {
    kind: 'hideCommandPalette';
}

export namespace HideCommandPaletteAction {
    export const KIND = 'hideCommandPalette';

    export function create(): HideCommandPaletteAction {
        return { kind: KIND };
    }
}

/**
 * Execute command action.
 */
export interface ExecuteCommandAction extends Action {
    kind: 'executeCommand';
    commandId: string;
    args?: Record<string, any>;
}

export namespace ExecuteCommandAction {
    export const KIND = 'executeCommand';

    export function create(commandId: string, args?: Record<string, any>): ExecuteCommandAction {
        return { kind: KIND, commandId, args };
    }
}

/**
 * Set command palette items action.
 */
export interface SetCommandPaletteItemsAction extends Action {
    kind: 'setCommandPaletteItems';
    items: CommandPaletteItem[];
}

export namespace SetCommandPaletteItemsAction {
    export const KIND = 'setCommandPaletteItems';

    export function create(items: CommandPaletteItem[]): SetCommandPaletteItemsAction {
        return { kind: KIND, items };
    }
}
