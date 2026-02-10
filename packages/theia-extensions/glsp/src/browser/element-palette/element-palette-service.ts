/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Palette Service
 *
 * State management for the sidebar element palette widget.
 * Fetches element types from the language server and manages UI state.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common';
import { CommandService } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core';
import { createLogger } from '@sanyam/logger';
import {
    ElementCreationAction,
    ElementPaletteState,
    ElementCategory,
    ElementTypeItem,
    IElementPaletteService,
    ElementPaletteServiceSymbol,
} from './element-palette-types';
import { DiagramLanguageClient } from '../diagram-language-client';
import {
    GrammarOperationService,
    type GrammarOperationServiceInterface,
    type OperationExecutionResult,
} from '../grammar-operations/grammar-operation-service';

/**
 * Type guard for diagram editor widgets.
 * Uses duck-typing to avoid circular dependency with CompositeEditorWidget.
 */
function isDiagramEditorWidget(widget: unknown): widget is { uri?: { toString(): string } } {
    if (!widget || typeof widget !== 'object') {
        return false;
    }
    // Check for CompositeEditorWidget by constructor name to avoid circular import
    const constructorName = (widget as { constructor?: { name?: string } }).constructor?.name;
    return constructorName === 'CompositeEditorWidget';
}

export { ElementPaletteServiceSymbol };

/**
 * Element Palette Service.
 *
 * Manages state for the sidebar element palette including:
 * - Element type data from language server
 * - Category expand/collapse state
 * - Search filtering
 * - Active diagram tracking
 */
@injectable()
export class ElementPaletteService implements IElementPaletteService {
    protected readonly logger = createLogger({ name: 'ElementPalette' });

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    @inject(GrammarOperationService) @optional()
    protected readonly operationService?: GrammarOperationServiceInterface;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    protected readonly onStateChangedEmitter = new Emitter<ElementPaletteState>();

    /**
     * Cached reference to the active diagram editor widget.
     * Passed as argument when executing commands so that command handlers
     * can find the diagram even when the palette sidebar has focus.
     */
    protected activeDiagramWidget: unknown;

    protected _state: ElementPaletteState = {
        groups: [],
        expandedCategories: new Set<string>(),
        searchQuery: '',
        activeDiagramUri: null,
        isLoading: false,
        errorMessage: null,
    };

    /**
     * Current state.
     */
    get state(): ElementPaletteState {
        return this._state;
    }

    /**
     * Event fired when state changes.
     */
    get onStateChanged(): Event<ElementPaletteState> {
        return this.onStateChangedEmitter.event;
    }

    @postConstruct()
    protected init(): void {
        // Track active widget changes to refresh palette
        this.shell.onDidChangeCurrentWidget(event => {
            const widget = event.newValue;
            if (isDiagramEditorWidget(widget)) {
                this.activeDiagramWidget = widget;
                const uri = widget.uri?.toString();
                if (uri && uri !== this._state.activeDiagramUri) {
                    this.updateActiveDiagram(uri);
                }
            }
        });

        // Check if there's already an active diagram widget
        const currentWidget = this.shell.currentWidget;
        if (isDiagramEditorWidget(currentWidget)) {
            this.activeDiagramWidget = currentWidget;
            const uri = currentWidget.uri?.toString();
            if (uri) {
                this.updateActiveDiagram(uri);
            }
        }
    }

    /**
     * Update the active diagram and refresh palette.
     */
    protected async updateActiveDiagram(uri: string): Promise<void> {
        this.logger.info({ uri }, 'Active diagram changed');
        this._state = {
            ...this._state,
            activeDiagramUri: uri,
            isLoading: true,
            errorMessage: null,
        };
        this.onStateChangedEmitter.fire(this._state);

        await this.refresh();
    }

    /**
     * Refresh palette data for current diagram.
     */
    async refresh(): Promise<void> {
        const uri = this._state.activeDiagramUri;
        if (!uri) {
            this._state = {
                ...this._state,
                groups: [],
                isLoading: false,
            };
            this.onStateChangedEmitter.fire(this._state);
            return;
        }

        try {
            this._state = { ...this._state, isLoading: true, errorMessage: null };
            this.onStateChangedEmitter.fire(this._state);

            const palette = await this.diagramLanguageClient.getToolPalette(uri);
            const groups = this.convertToCategories(palette.groups);

            // Append client-side categories (layout commands, export actions)
            this.appendClientCategories(groups);

            // Expand all categories by default
            const expandedCategories = new Set<string>(groups.map(g => g.id));

            this._state = {
                ...this._state,
                groups,
                expandedCategories,
                isLoading: false,
            };
            this.onStateChangedEmitter.fire(this._state);

            this.logger.info({ groupCount: groups.length }, 'Palette loaded');
        } catch (error) {
            this.logger.error({ error }, 'Failed to load palette');
            this._state = {
                ...this._state,
                isLoading: false,
                errorMessage: 'Failed to load element types',
            };
            this.onStateChangedEmitter.fire(this._state);
        }
    }

    /**
     * Append client-side categories for layout commands and export actions.
     * These are not provided by the server but are useful diagram commands.
     */
    protected appendClientCategories(groups: ElementCategory[]): void {
        // LAYOUT section with edge routing commands
        const layoutCategory: ElementCategory = {
            id: 'client:layout',
            label: 'LAYOUT',
            icon: 'codicon codicon-layout',
            sortString: 'z1_layout',
            items: [
                {
                    id: 'cmd:edgeRouting.orthogonal',
                    label: 'Orthogonal Routing',
                    icon: 'codicon codicon-type-hierarchy',
                    description: 'Route edges with right-angle bends',
                    action: { kind: 'command', commandId: 'sanyam.diagram.edgeRouting.orthogonal' },
                },
                {
                    id: 'cmd:edgeRouting.straight',
                    label: 'Straight Routing',
                    icon: 'codicon codicon-type-hierarchy-sub',
                    description: 'Route edges as direct straight lines',
                    action: { kind: 'command', commandId: 'sanyam.diagram.edgeRouting.straight' },
                },
                {
                    id: 'cmd:edgeRouting.bezier',
                    label: 'Bezier Routing',
                    icon: 'codicon codicon-git-compare',
                    description: 'Route edges as smooth bezier curves',
                    action: { kind: 'command', commandId: 'sanyam.diagram.edgeRouting.bezier' },
                },
            ],
        };
        groups.push(layoutCategory);

        // EXPORT section with all export commands
        const exportCategory: ElementCategory = {
            id: 'client:export',
            label: 'EXPORT',
            icon: 'codicon codicon-desktop-download',
            sortString: 'z2_export',
            items: [
                {
                    id: 'cmd:exportSvg',
                    label: 'Export as SVG',
                    icon: 'codicon codicon-file-media',
                    description: 'Export the diagram as an SVG file',
                    action: { kind: 'command', commandId: 'sanyam.diagram.exportSvg' },
                },
                {
                    id: 'cmd:exportJson',
                    label: 'Export as JSON',
                    icon: 'codicon codicon-json',
                    description: 'Export the diagram model as a JSON file',
                    action: { kind: 'command', commandId: 'sanyam.diagram.exportJson' },
                },
                {
                    id: 'cmd:exportMarkdown',
                    label: 'Export as Markdown',
                    icon: 'codicon codicon-markdown',
                    description: 'Export a Markdown summary of diagram elements',
                    action: { kind: 'command', commandId: 'sanyam.diagram.exportMarkdown' },
                },
            ],
        };
        groups.push(exportCategory);
    }

    /**
     * Execute a command from a palette item with 'command' kind.
     *
     * @param commandId - The command ID to execute
     */
    async executeCommand(commandId: string): Promise<void> {
        try {
            // Pass the active diagram widget so command handlers can find the
            // diagram even though the palette sidebar currently has focus.
            await this.commandService.executeCommand(commandId, this.activeDiagramWidget);
        } catch (error) {
            this.logger.error({ error, commandId }, 'Failed to execute command from palette');
            this.messageService.error(`Failed to execute command: ${commandId}`);
        }
    }

    /**
     * Convert tool palette groups to element categories.
     * Server returns groups with 'children' array, not 'items'.
     */
    protected convertToCategories(groups: any[]): ElementCategory[] {
        return groups
            .filter(g => (g.children && g.children.length > 0) || (g.items && g.items.length > 0))
            .map(group => ({
                id: group.id,
                label: group.label,
                icon: group.icon,
                sortString: group.sortString,
                items: this.convertToItems(group.children || group.items || []),
            }));
    }

    /**
     * Convert tool palette items to element type items.
     *
     * Server uses 'action' (not 'toolAction') with kinds like 'create-node' (hyphenated).
     * Supports create-node, create-edge, delete, and custom (grammar operations).
     */
    protected convertToItems(items: any[]): ElementTypeItem[] {
        return items
            .filter(item => {
                const action = item.action || item.toolAction;
                if (!action) return false;
                const kind = action.kind;
                // Support create, delete, and custom (operation) kinds
                return kind === 'create-node' || kind === 'create-edge' ||
                       kind === 'createNode' || kind === 'createEdge' ||
                       kind === 'delete' || kind === 'custom';
            })
            .map(item => {
                const action = item.action || item.toolAction;
                return {
                    id: item.id,
                    label: item.label,
                    icon: item.icon,
                    description: action.args?.description || item.description,
                    sortString: item.sortString,
                    action: this.mapServerAction(action, item.id),
                };
            });
    }

    /**
     * Map a server-side tool action to a client-side element action.
     *
     * @param action - Server action with hyphenated kinds
     * @param itemId - Fallback element type ID
     * @returns Client-side ElementCreationAction
     */
    protected mapServerAction(action: any, itemId: string): ElementCreationAction {
        const kind = action.kind;

        if (kind === 'delete') {
            return { kind: 'delete' };
        }

        if (kind === 'custom') {
            return {
                kind: 'operation',
                operationId: action.args?.operationId,
                languageId: action.args?.languageId,
                args: action.args,
            };
        }

        const isNode = kind === 'create-node' || kind === 'createNode';
        return {
            kind: isNode ? 'createNode' : 'createEdge',
            elementTypeId: action.elementTypeId || itemId,
            args: action.args,
        };
    }

    /**
     * Execute a grammar operation from the palette.
     *
     * @param operationId - Operation identifier
     * @param languageId - Language identifier
     * @returns Result of the operation execution
     */
    async executeOperation(operationId: string, languageId: string): Promise<OperationExecutionResult | undefined> {
        if (!this.operationService) {
            this.logger.warn('Operation service not available');
            return undefined;
        }

        const uri = this._state.activeDiagramUri;
        if (!uri) {
            this.messageService.warn('No active diagram. Open a diagram to execute operations.');
            return undefined;
        }

        try {
            const result = await this.operationService.executeOperation({
                languageId,
                operationId,
                uri,
            });
            if (result.success) {
                this.messageService.info('Operation completed successfully.');
            } else {
                this.messageService.error(`Operation failed: ${result.error || 'Unknown error'}`);
            }
            return result;
        } catch (error) {
            this.logger.error({ error }, 'Failed to execute operation');
            this.messageService.error('Failed to execute operation.');
            return undefined;
        }
    }

    /**
     * Get filtered groups based on search query.
     */
    getFilteredGroups(): ElementCategory[] {
        const query = this._state.searchQuery.toLowerCase().trim();
        if (!query) {
            return this._state.groups;
        }

        return this._state.groups
            .map(group => ({
                ...group,
                items: group.items.filter(item =>
                    item.label.toLowerCase().includes(query) ||
                    item.description?.toLowerCase().includes(query)
                ),
            }))
            .filter(group => group.items.length > 0);
    }

    /**
     * Set the search filter.
     */
    setSearchFilter(query: string): void {
        this._state = { ...this._state, searchQuery: query };
        this.onStateChangedEmitter.fire(this._state);
    }

    /**
     * Toggle a category's expanded state.
     */
    toggleCategory(categoryId: string): void {
        const expandedCategories = new Set(this._state.expandedCategories);
        if (expandedCategories.has(categoryId)) {
            expandedCategories.delete(categoryId);
        } else {
            expandedCategories.add(categoryId);
        }
        this._state = { ...this._state, expandedCategories };
        this.onStateChangedEmitter.fire(this._state);
    }

    /**
     * Check if a category is expanded.
     */
    isCategoryExpanded(categoryId: string): boolean {
        return this._state.expandedCategories.has(categoryId);
    }

    /**
     * Subscribe to state changes.
     */
    onStateChangedCallback(callback: (state: ElementPaletteState) => void): { dispose(): void } {
        return this.onStateChangedEmitter.event(callback);
    }
}
