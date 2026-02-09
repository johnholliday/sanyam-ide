/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Command Palette Action Providers
 *
 * Providers that supply context-aware commands to the command palette.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import type { Action } from 'sprotty-protocol';
import {
    CommandPaletteItem,
    CommandPaletteContext,
    CommandPaletteProvider,
} from './command-palette-actions';

/**
 * Tool palette item with action.
 */
export interface ToolPaletteItem {
    id: string;
    label: string;
    icon?: string;
    toolAction?: {
        kind: string;
        elementTypeId: string;
        args?: Record<string, unknown>;
    };
}

/**
 * Tool palette group containing items.
 */
export interface ToolPaletteGroup {
    id: string;
    label: string;
    items: ToolPaletteItem[];
}

/**
 * Symbol for tool palette data provider.
 */
export const ToolPaletteDataSource = Symbol.for('ToolPaletteDataSource');

/**
 * Interface for tool palette data source.
 */
export interface IToolPaletteDataSource {
    getGroups(): ToolPaletteGroup[];
}

/**
 * Create Node Action Provider.
 *
 * Provides node creation commands from the tool palette.
 */
@injectable()
export class CreateNodeActionProvider implements CommandPaletteProvider {
    @inject(ToolPaletteDataSource) @optional()
    protected readonly toolPaletteDataSource?: IToolPaletteDataSource;

    getCommands(context: CommandPaletteContext): CommandPaletteItem[] {
        const items: CommandPaletteItem[] = [];

        const groups = this.toolPaletteDataSource?.getGroups() || [];
        const nodeGroup = groups.find(g => g.id === 'nodes');

        if (nodeGroup) {
            for (const tool of nodeGroup.items) {
                if (tool.toolAction?.kind === 'createNode') {
                    items.push({
                        id: `create-${tool.id}`,
                        label: `Create ${tool.label}`,
                        icon: tool.icon || 'codicon codicon-symbol-class',
                        category: 'Create',
                        action: {
                            kind: 'enableCreationTool',
                            elementTypeId: tool.toolAction.elementTypeId,
                            toolKind: 'node',
                            args: tool.toolAction.args,
                        } as Action,
                        sortPriority: 50,
                    });
                }
            }
        }

        return items;
    }
}

/**
 * Create Edge Action Provider.
 *
 * Provides edge creation commands from the tool palette.
 */
@injectable()
export class CreateEdgeActionProvider implements CommandPaletteProvider {
    @inject(ToolPaletteDataSource) @optional()
    protected readonly toolPaletteDataSource?: IToolPaletteDataSource;

    getCommands(context: CommandPaletteContext): CommandPaletteItem[] {
        const items: CommandPaletteItem[] = [];

        const groups = this.toolPaletteDataSource?.getGroups() || [];
        const edgeGroup = groups.find(g => g.id === 'connections' || g.id === 'edges');

        if (edgeGroup) {
            for (const tool of edgeGroup.items) {
                if (tool.toolAction?.kind === 'createEdge') {
                    items.push({
                        id: `create-${tool.id}`,
                        label: `Create ${tool.label}`,
                        icon: tool.icon || 'codicon codicon-arrow-right',
                        category: 'Create',
                        action: {
                            kind: 'enableCreationTool',
                            elementTypeId: tool.toolAction.elementTypeId,
                            toolKind: 'edge',
                            args: tool.toolAction.args,
                        } as Action,
                        sortPriority: 51,
                    });
                }
            }
        }

        return items;
    }
}

/**
 * Navigation Action Provider.
 *
 * Provides navigation commands based on selection.
 */
@injectable()
export class NavigationActionProvider implements CommandPaletteProvider {
    getCommands(context: CommandPaletteContext): CommandPaletteItem[] {
        const items: CommandPaletteItem[] = [];

        if (context.selectedElementIds.length === 1) {
            const elementId = context.selectedElementIds[0];

            items.push({
                id: 'goToSource',
                label: 'Go to Source',
                icon: 'codicon codicon-go-to-file',
                category: 'Navigation',
                shortcut: 'F12',
                action: {
                    kind: 'navigateToElement',
                    elementId,
                } as Action,
                description: 'Navigate to the source definition',
                sortPriority: 60,
            });

            items.push({
                id: 'findReferences',
                label: 'Find References',
                icon: 'codicon codicon-references',
                category: 'Navigation',
                shortcut: 'Shift+F12',
                action: {
                    kind: 'findReferences',
                    elementId,
                } as Action,
                description: 'Find all references to this element',
                sortPriority: 61,
            });

            items.push({
                id: 'centerOnElement',
                label: 'Center on Element',
                icon: 'codicon codicon-symbol-keyword',
                category: 'Navigation',
                action: {
                    kind: 'center',
                    elementIds: [elementId],
                    animate: true,
                    retainZoom: true,
                } as Action,
                sortPriority: 62,
            });
        }

        return items;
    }
}

/**
 * Layout Action Provider.
 *
 * Provides layout-related commands.
 */
@injectable()
export class LayoutActionProvider implements CommandPaletteProvider {
    getCommands(_context: CommandPaletteContext): CommandPaletteItem[] {
        return [
            {
                id: 'layoutLayered',
                label: 'Layout: Layered',
                icon: 'codicon codicon-layout',
                category: 'Layout',
                action: {
                    kind: 'layout',
                    options: { algorithm: 'layered' },
                } as Action,
                description: 'Apply layered (hierarchical) layout',
                sortPriority: 70,
            },
            {
                id: 'layoutTree',
                label: 'Layout: Tree',
                icon: 'codicon codicon-list-tree',
                category: 'Layout',
                action: {
                    kind: 'layout',
                    options: { algorithm: 'tree' },
                } as Action,
                description: 'Apply tree layout',
                sortPriority: 71,
            },
            {
                id: 'layoutForce',
                label: 'Layout: Force-Directed',
                icon: 'codicon codicon-type-hierarchy',
                category: 'Layout',
                action: {
                    kind: 'layout',
                    options: { algorithm: 'force' },
                } as Action,
                description: 'Apply force-directed layout',
                sortPriority: 72,
            },
        ];
    }
}

/**
 * Edit Action Provider.
 *
 * Provides edit commands based on selection.
 */
@injectable()
export class EditActionProvider implements CommandPaletteProvider {
    getCommands(context: CommandPaletteContext): CommandPaletteItem[] {
        const items: CommandPaletteItem[] = [];

        if (context.selectedElementIds.length > 0) {
            items.push({
                id: 'deleteSelected',
                label: 'Delete Selected',
                icon: 'codicon codicon-trash',
                category: 'Edit',
                shortcut: 'Delete',
                action: {
                    kind: 'deleteElement',
                    elementIds: context.selectedElementIds,
                } as Action,
                sortPriority: 80,
            });

            if (context.selectedElementIds.length === 1) {
                items.push({
                    id: 'editLabel',
                    label: 'Edit Label',
                    icon: 'codicon codicon-edit',
                    category: 'Edit',
                    shortcut: 'F2',
                    action: {
                        kind: 'editLabel',
                        labelId: context.selectedElementIds[0],
                    } as Action,
                    sortPriority: 81,
                });
            }

            items.push({
                id: 'copySelected',
                label: 'Copy',
                icon: 'codicon codicon-copy',
                category: 'Edit',
                shortcut: 'Ctrl+C',
                action: {
                    kind: 'copy',
                    elementIds: context.selectedElementIds,
                } as Action,
                sortPriority: 82,
            });

            items.push({
                id: 'cutSelected',
                label: 'Cut',
                icon: 'codicon codicon-move',
                category: 'Edit',
                shortcut: 'Ctrl+X',
                action: {
                    kind: 'cut',
                    elementIds: context.selectedElementIds,
                } as Action,
                sortPriority: 83,
            });
        }

        items.push({
            id: 'paste',
            label: 'Paste',
            icon: 'codicon codicon-clippy',
            category: 'Edit',
            shortcut: 'Ctrl+V',
            action: {
                kind: 'paste',
                position: context.position,
            } as Action,
            sortPriority: 84,
        });

        items.push({
            id: 'undo',
            label: 'Undo',
            icon: 'codicon codicon-discard',
            category: 'Edit',
            shortcut: 'Ctrl+Z',
            action: { kind: 'undo' },
            sortPriority: 85,
        });

        items.push({
            id: 'redo',
            label: 'Redo',
            icon: 'codicon codicon-redo',
            category: 'Edit',
            shortcut: 'Ctrl+Y',
            action: { kind: 'redo' },
            sortPriority: 86,
        });

        return items;
    }
}
