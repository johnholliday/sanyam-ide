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

import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser';
import { createLogger } from '@sanyam/logger';
import {
    ElementPaletteState,
    ElementCategory,
    ElementTypeItem,
    IElementPaletteService,
    ElementPaletteServiceSymbol,
} from './element-palette-types';
import { DiagramLanguageClient } from '../diagram-language-client';
import { CompositeEditorWidget } from '../composite-editor-widget';

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

    protected readonly onStateChangedEmitter = new Emitter<ElementPaletteState>();

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
            if (widget instanceof CompositeEditorWidget) {
                const uri = widget.uri?.toString();
                if (uri && uri !== this._state.activeDiagramUri) {
                    this.updateActiveDiagram(uri);
                }
            }
        });

        // Check if there's already an active diagram widget
        const currentWidget = this.shell.currentWidget;
        if (currentWidget instanceof CompositeEditorWidget) {
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
     * Server uses 'action' (not 'toolAction') with kinds like 'create-node' (hyphenated).
     */
    protected convertToItems(items: any[]): ElementTypeItem[] {
        return items
            .filter(item => {
                const action = item.action || item.toolAction;
                if (!action) return false;
                const kind = action.kind;
                // Support both hyphenated (server) and camelCase formats
                return kind === 'create-node' || kind === 'create-edge' ||
                       kind === 'createNode' || kind === 'createEdge';
            })
            .map(item => {
                const action = item.action || item.toolAction;
                const isNode = action.kind === 'create-node' || action.kind === 'createNode';
                return {
                    id: item.id,
                    label: item.label,
                    icon: item.icon,
                    description: item.description,
                    sortString: item.sortString,
                    action: {
                        kind: isNode ? 'createNode' : 'createEdge',
                        elementTypeId: action.elementTypeId || item.id,
                        args: action.args,
                    },
                };
            });
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
