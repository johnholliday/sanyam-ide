/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Tool Palette Action Handler
 *
 * Handles tool palette actions including fetching palette data from the server
 * and managing tool selection state.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand, CommandExecutionContext, SModelRootImpl } from 'sprotty';
import { Action } from 'sprotty-protocol';
import {
    RequestToolPaletteAction,
    SetToolPaletteAction,
    ToolSelectionAction,
    EnableDefaultToolsAction,
    EnableCreationToolAction,
    ToggleToolPaletteGroupAction,
    SearchToolPaletteAction,
    ToolPaletteGroup,
    ToolAction,
} from './tool-palette-actions';
import { ToolPaletteUIExtension, TOOL_PALETTE_ID } from './tool-palette-ui-extension';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Symbol for diagram language client provider.
 */
export const DiagramLanguageClientProvider = Symbol.for('DiagramLanguageClientProvider');

/**
 * Interface for providing tool palette data.
 */
export interface ToolPaletteDataProvider {
    getToolPalette(uri: string): Promise<{ groups: ToolPaletteGroup[] }>;
}

/**
 * Current creation tool state.
 */
export interface CreationToolState {
    isActive: boolean;
    toolKind?: 'node' | 'edge';
    elementTypeId?: string;
    args?: Record<string, any>;
}

/**
 * Tool Palette Action Handler.
 *
 * Handles all tool palette related actions and coordinates with the UI extension.
 */
@injectable()
export class ToolPaletteActionHandler implements IActionHandler {
    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    @inject(DiagramLanguageClientProvider) @optional()
    protected readonly languageClientProvider?: ToolPaletteDataProvider;

    /** Current document URI */
    protected currentUri: string = '';

    /** Current creation tool state */
    protected creationToolState: CreationToolState = { isActive: false };

    /** Callbacks for tool state changes */
    protected toolStateListeners: Array<(state: CreationToolState) => void> = [];

    /**
     * Handle an action.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case RequestToolPaletteAction.KIND:
                this.handleRequestToolPalette(action as RequestToolPaletteAction);
                break;
            case SetToolPaletteAction.KIND:
                this.handleSetToolPalette(action as SetToolPaletteAction);
                break;
            case ToolSelectionAction.KIND:
                this.handleToolSelection(action as ToolSelectionAction);
                break;
            case EnableDefaultToolsAction.KIND:
                this.handleEnableDefaultTools();
                break;
            case EnableCreationToolAction.KIND:
                this.handleEnableCreationTool(action as EnableCreationToolAction);
                break;
            case ToggleToolPaletteGroupAction.KIND:
                this.handleToggleGroup(action as ToggleToolPaletteGroupAction);
                break;
            case SearchToolPaletteAction.KIND:
                this.handleSearch(action as SearchToolPaletteAction);
                break;
        }
    }

    /**
     * Handle request for tool palette data.
     */
    protected async handleRequestToolPalette(action: RequestToolPaletteAction): Promise<void> {
        this.currentUri = action.uri || '';

        let groups: ToolPaletteGroup[] = [];

        if (this.languageClientProvider) {
            try {
                const response = await this.languageClientProvider.getToolPalette(this.currentUri);
                groups = response.groups;
            } catch (error) {
                console.error('[ToolPaletteActionHandler] Error fetching tool palette:', error);
                // Use default palette on error
                groups = this.getDefaultPalette();
            }
        } else {
            // Use default palette when no language client
            groups = this.getDefaultPalette();
        }

        // Update the UI extension
        const extension = this.getToolPaletteExtension();
        if (extension) {
            extension.setGroups(groups);
            extension.show();
        }
    }

    /**
     * Handle set tool palette action.
     */
    protected handleSetToolPalette(action: SetToolPaletteAction): void {
        const extension = this.getToolPaletteExtension();
        if (extension) {
            extension.setGroups(action.groups);
        }
    }

    /**
     * Handle tool selection.
     */
    protected handleToolSelection(action: ToolSelectionAction): void {
        if (!action.toolId) {
            // Deselection
            this.creationToolState = { isActive: false };
        } else if (action.toolAction) {
            // Update creation tool state based on tool action
            this.updateCreationToolState(action.toolAction);
        }

        this.notifyToolStateListeners();
    }

    /**
     * Update creation tool state from tool action.
     */
    protected updateCreationToolState(toolAction: ToolAction): void {
        switch (toolAction.kind) {
            case 'createNode':
                this.creationToolState = {
                    isActive: true,
                    toolKind: 'node',
                    elementTypeId: toolAction.elementTypeId,
                    args: toolAction.args,
                };
                break;
            case 'createEdge':
                this.creationToolState = {
                    isActive: true,
                    toolKind: 'edge',
                    elementTypeId: toolAction.elementTypeId,
                    args: toolAction.args,
                };
                break;
            case 'triggerAction':
                // Actions are one-shot, don't maintain state
                this.creationToolState = { isActive: false };
                break;
        }
    }

    /**
     * Handle enable default tools action.
     */
    protected handleEnableDefaultTools(): void {
        this.creationToolState = { isActive: false };
        this.notifyToolStateListeners();

        const extension = this.getToolPaletteExtension();
        if (extension) {
            // Pass false to prevent dispatching actions again (would cause infinite loop)
            extension.selectDefaultTool(false);
        }
    }

    /**
     * Handle enable creation tool action.
     */
    protected handleEnableCreationTool(action: EnableCreationToolAction): void {
        this.creationToolState = {
            isActive: true,
            toolKind: action.toolKind,
            elementTypeId: action.elementTypeId,
            args: action.args,
        };
        this.notifyToolStateListeners();
    }

    /**
     * Handle toggle group action.
     */
    protected handleToggleGroup(_action: ToggleToolPaletteGroupAction): void {
        // State is already managed by the UI extension
        // Could persist user preferences here
    }

    /**
     * Handle search action.
     */
    protected handleSearch(_action: SearchToolPaletteAction): void {
        // Search is handled by the UI extension
        // Could add analytics or history here
    }

    /**
     * Get the tool palette UI extension.
     */
    protected getToolPaletteExtension(): ToolPaletteUIExtension | undefined {
        if (this.uiExtensionRegistry) {
            return this.uiExtensionRegistry.get(TOOL_PALETTE_ID) as ToolPaletteUIExtension | undefined;
        }
        return undefined;
    }

    /**
     * Get default tool palette for fallback.
     */
    protected getDefaultPalette(): ToolPaletteGroup[] {
        return [
            {
                id: 'nodes',
                label: 'Nodes',
                icon: 'codicon codicon-symbol-class',
                expanded: true,
                items: [
                    {
                        id: 'createNode',
                        label: 'Node',
                        icon: 'codicon codicon-symbol-class',
                        toolAction: {
                            kind: 'createNode',
                            elementTypeId: 'node:default',
                        },
                    },
                    {
                        id: 'createEntity',
                        label: 'Entity',
                        icon: 'codicon codicon-symbol-interface',
                        toolAction: {
                            kind: 'createNode',
                            elementTypeId: 'node:entity',
                        },
                    },
                    {
                        id: 'createComponent',
                        label: 'Component',
                        icon: 'codicon codicon-symbol-method',
                        toolAction: {
                            kind: 'createNode',
                            elementTypeId: 'node:component',
                        },
                    },
                ],
            },
            {
                id: 'connections',
                label: 'Connections',
                icon: 'codicon codicon-git-merge',
                expanded: true,
                items: [
                    {
                        id: 'createEdge',
                        label: 'Connection',
                        icon: 'codicon codicon-arrow-right',
                        toolAction: {
                            kind: 'createEdge',
                            elementTypeId: 'edge:default',
                        },
                    },
                    {
                        id: 'createInheritance',
                        label: 'Inheritance',
                        icon: 'codicon codicon-type-hierarchy-sub',
                        toolAction: {
                            kind: 'createEdge',
                            elementTypeId: 'edge:inheritance',
                        },
                    },
                    {
                        id: 'createComposition',
                        label: 'Composition',
                        icon: 'codicon codicon-symbol-namespace',
                        toolAction: {
                            kind: 'createEdge',
                            elementTypeId: 'edge:composition',
                        },
                    },
                ],
            },
            // Note: Action buttons (zoom, layout, minimap, etc.) are now exclusively
            // on the editor toolbar via GlspDiagramToolbarContribution
        ];
    }

    /**
     * Get the current creation tool state.
     */
    getCreationToolState(): CreationToolState {
        return { ...this.creationToolState };
    }

    /**
     * Check if a creation tool is currently active.
     */
    isCreationToolActive(): boolean {
        return this.creationToolState.isActive;
    }

    /**
     * Add a listener for tool state changes.
     */
    addToolStateListener(listener: (state: CreationToolState) => void): void {
        this.toolStateListeners.push(listener);
    }

    /**
     * Remove a tool state listener.
     */
    removeToolStateListener(listener: (state: CreationToolState) => void): void {
        const index = this.toolStateListeners.indexOf(listener);
        if (index !== -1) {
            this.toolStateListeners.splice(index, 1);
        }
    }

    /**
     * Notify all tool state listeners.
     */
    protected notifyToolStateListeners(): void {
        const state = this.getCreationToolState();
        this.toolStateListeners.forEach(listener => listener(state));
    }

    /**
     * Set the current document URI.
     */
    setCurrentUri(uri: string): void {
        this.currentUri = uri;
    }
}

/**
 * Tool palette action handler command.
 * Wraps the action handler as a command for integration.
 */
export class ToolPaletteCommand implements ICommand {
    constructor(
        protected readonly handler: ToolPaletteActionHandler,
        protected readonly action: Action
    ) {}

    execute(context: CommandExecutionContext): SModelRootImpl {
        this.handler.handle(this.action);
        return context.root;
    }

    undo(context: CommandExecutionContext): SModelRootImpl {
        // Tool palette actions are not undoable
        return context.root;
    }

    redo(context: CommandExecutionContext): SModelRootImpl {
        this.handler.handle(this.action);
        return context.root;
    }
}
