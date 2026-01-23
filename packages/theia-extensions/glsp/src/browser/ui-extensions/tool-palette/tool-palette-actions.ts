/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Tool Palette Actions
 *
 * Actions for tool palette operations including requesting, setting, and selecting tools.
 *
 * @packageDocumentation
 */

import { Action } from 'sprotty-protocol';

/**
 * Tool item in the palette.
 */
export interface ToolPaletteItem {
    /** Unique identifier for the tool */
    id: string;
    /** Display label */
    label: string;
    /** Icon class (codicon or font-awesome) */
    icon?: string;
    /** Sort order key */
    sortString?: string;
    /** Tool action to execute (createNode, createEdge, action) */
    toolAction?: ToolAction;
}

/**
 * Tool action types.
 */
export type ToolAction =
    | CreateNodeToolAction
    | CreateEdgeToolAction
    | TriggerActionToolAction;

/**
 * Create node tool action.
 */
export interface CreateNodeToolAction {
    kind: 'createNode';
    elementTypeId: string;
    args?: Record<string, any>;
}

/**
 * Create edge tool action.
 */
export interface CreateEdgeToolAction {
    kind: 'createEdge';
    elementTypeId: string;
    args?: Record<string, any>;
}

/**
 * Trigger action tool action.
 */
export interface TriggerActionToolAction {
    kind: 'triggerAction';
    actionKind: string;
    args?: Record<string, any>;
}

/**
 * Tool group in the palette.
 */
export interface ToolPaletteGroup {
    /** Unique identifier for the group */
    id: string;
    /** Display label */
    label: string;
    /** Icon class */
    icon?: string;
    /** Items in the group */
    items: ToolPaletteItem[];
    /** Whether the group is expanded */
    expanded?: boolean;
    /** Sort order key */
    sortString?: string;
}

/**
 * Request tool palette action.
 * Sent to request the tool palette from the server.
 */
export interface RequestToolPaletteAction extends Action {
    kind: 'requestToolPalette';
    uri?: string;
}

export namespace RequestToolPaletteAction {
    export const KIND = 'requestToolPalette';

    export function create(uri?: string): RequestToolPaletteAction {
        return { kind: KIND, uri };
    }
}

/**
 * Set tool palette action.
 * Sent from the server with the tool palette data.
 */
export interface SetToolPaletteAction extends Action {
    kind: 'setToolPalette';
    groups: ToolPaletteGroup[];
}

export namespace SetToolPaletteAction {
    export const KIND = 'setToolPalette';

    export function create(groups: ToolPaletteGroup[]): SetToolPaletteAction {
        return { kind: KIND, groups };
    }
}

/**
 * Tool selection action.
 * Sent when a tool is selected from the palette.
 */
export interface ToolSelectionAction extends Action {
    kind: 'toolSelection';
    toolId: string;
    toolAction?: ToolAction;
}

export namespace ToolSelectionAction {
    export const KIND = 'toolSelection';

    export function create(toolId: string, toolAction?: ToolAction): ToolSelectionAction {
        return { kind: KIND, toolId, toolAction };
    }

    export function deselect(): ToolSelectionAction {
        return { kind: KIND, toolId: '' };
    }
}

/**
 * Enable default tools action.
 * Resets to the default selection/move tool.
 */
export interface EnableDefaultToolsAction extends Action {
    kind: 'enableDefaultTools';
}

export namespace EnableDefaultToolsAction {
    export const KIND = 'enableDefaultTools';

    export function create(): EnableDefaultToolsAction {
        return { kind: KIND };
    }
}

/**
 * Enable creation tool action.
 * Activates a node or edge creation tool.
 */
export interface EnableCreationToolAction extends Action {
    kind: 'enableCreationTool';
    elementTypeId: string;
    toolKind: 'node' | 'edge';
    args?: Record<string, any>;
}

export namespace EnableCreationToolAction {
    export const KIND = 'enableCreationTool';

    export function createNodeTool(elementTypeId: string, args?: Record<string, any>): EnableCreationToolAction {
        return { kind: KIND, elementTypeId, toolKind: 'node', args };
    }

    export function createEdgeTool(elementTypeId: string, args?: Record<string, any>): EnableCreationToolAction {
        return { kind: KIND, elementTypeId, toolKind: 'edge', args };
    }
}

/**
 * Toggle tool palette group expansion.
 */
export interface ToggleToolPaletteGroupAction extends Action {
    kind: 'toggleToolPaletteGroup';
    groupId: string;
    expanded?: boolean;
}

export namespace ToggleToolPaletteGroupAction {
    export const KIND = 'toggleToolPaletteGroup';

    export function create(groupId: string, expanded?: boolean): ToggleToolPaletteGroupAction {
        return { kind: KIND, groupId, expanded };
    }
}

/**
 * Search tool palette action.
 */
export interface SearchToolPaletteAction extends Action {
    kind: 'searchToolPalette';
    query: string;
}

export namespace SearchToolPaletteAction {
    export const KIND = 'searchToolPalette';

    export function create(query: string): SearchToolPaletteAction {
        return { kind: KIND, query };
    }
}

/**
 * Create element action.
 * Dispatched when a user clicks to create a node or completes an edge connection.
 */
export interface CreateElementAction extends Action {
    kind: 'createElement';
    elementTypeId: string;
    elementKind: 'node' | 'edge';
    /** For nodes: the position to create at */
    position?: { x: number; y: number };
    /** For edges: the source element ID */
    sourceId?: string;
    /** For edges: the target element ID */
    targetId?: string;
    /** Additional arguments */
    args?: Record<string, any>;
}

export namespace CreateElementAction {
    export const KIND = 'createElement';

    export function createNode(
        elementTypeId: string,
        position: { x: number; y: number },
        args?: Record<string, any>
    ): CreateElementAction {
        return {
            kind: KIND,
            elementTypeId,
            elementKind: 'node',
            position,
            args,
        };
    }

    export function createEdge(
        elementTypeId: string,
        sourceId: string,
        targetId: string,
        args?: Record<string, any>
    ): CreateElementAction {
        return {
            kind: KIND,
            elementTypeId,
            elementKind: 'edge',
            sourceId,
            targetId,
            args,
        };
    }
}
