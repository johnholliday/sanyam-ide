/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Palette Widget
 *
 * A Theia sidebar widget for browsing and dragging element types onto diagrams.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { injectable, inject, postConstruct } from 'inversify';
import { ReactWidget, Message } from '@theia/core/lib/browser';
import { createLogger } from '@sanyam/logger';
import { ElementPaletteService } from './element-palette-service';
import { ElementPaletteState, ElementCategory } from './element-palette-types';
import { ElementCategoryComponent } from './element-category';

/**
 * Element Palette Widget ID.
 */
export const ELEMENT_PALETTE_WIDGET_ID = 'element-palette';

/**
 * Element Palette Widget.
 *
 * Displays a categorized, searchable list of element types that can be
 * dragged onto the diagram canvas to create new elements.
 */
@injectable()
export class ElementPaletteWidget extends ReactWidget {
    static readonly ID = ELEMENT_PALETTE_WIDGET_ID;
    static readonly LABEL = 'Element Palette';

    protected readonly logger = createLogger({ name: 'ElementPaletteWidget' });

    @inject(ElementPaletteService)
    protected readonly service: ElementPaletteService;

    protected state: ElementPaletteState;
    protected searchInputRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor() {
        super();
        this.id = ElementPaletteWidget.ID;
        this.title.label = ElementPaletteWidget.LABEL;
        this.title.caption = ElementPaletteWidget.LABEL;
        this.title.iconClass = 'codicon codicon-symbol-misc';
        this.title.closable = true;
        this.addClass('sanyam-element-palette');
        this.state = {
            groups: [],
            expandedCategories: new Set(),
            searchQuery: '',
            activeDiagramUri: null,
            isLoading: false,
            errorMessage: null,
        };
    }

    @postConstruct()
    protected init(): void {
        this.state = this.service.state;
        this.service.onStateChanged(newState => {
            this.state = newState;
            this.update();
        });
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.searchInputRef.current?.focus();
    }

    /**
     * Handle search input change.
     */
    protected handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.service.setSearchFilter(event.target.value);
    };

    /**
     * Clear search filter.
     */
    protected handleClearSearch = (): void => {
        this.service.setSearchFilter('');
        this.searchInputRef.current?.focus();
    };

    /**
     * Toggle category expand/collapse.
     */
    protected handleToggleCategory = (categoryId: string): void => {
        this.service.toggleCategory(categoryId);
    };

    /**
     * Render the widget.
     */
    protected render(): React.ReactNode {
        const filteredGroups = this.service.getFilteredGroups();

        return (
            <div className="sanyam-element-palette">
                {this.renderHeader()}
                {this.renderContent(filteredGroups)}
            </div>
        );
    }

    /**
     * Render the header with search input.
     */
    protected renderHeader(): React.ReactNode {
        return (
            <div className="sanyam-element-palette-header">
                <div className="sanyam-element-palette-search">
                    <input
                        ref={this.searchInputRef}
                        type="text"
                        className="sanyam-element-palette-search-input"
                        placeholder="Search elements..."
                        value={this.state.searchQuery}
                        onChange={this.handleSearchChange}
                    />
                    {this.state.searchQuery && (
                        <span
                            className="sanyam-element-palette-search-clear codicon codicon-close"
                            onClick={this.handleClearSearch}
                            title="Clear search"
                        />
                    )}
                </div>
            </div>
        );
    }

    /**
     * Render the content area.
     */
    protected renderContent(groups: ElementCategory[]): React.ReactNode {
        if (this.state.isLoading) {
            return this.renderLoading();
        }

        if (this.state.errorMessage) {
            return this.renderError();
        }

        if (!this.state.activeDiagramUri) {
            return this.renderNoDiagram();
        }

        if (groups.length === 0) {
            return this.renderEmpty();
        }

        return (
            <div className="sanyam-element-palette-content">
                {groups.map(category => (
                    <ElementCategoryComponent
                        key={category.id}
                        category={category}
                        expanded={this.service.isCategoryExpanded(category.id)}
                        onToggle={this.handleToggleCategory}
                    />
                ))}
            </div>
        );
    }

    /**
     * Render loading state.
     */
    protected renderLoading(): React.ReactNode {
        return (
            <div className="sanyam-element-palette-loading">
                <span className="codicon codicon-loading codicon-modifier-spin" />
                <span style={{ marginLeft: 8 }}>Loading elements...</span>
            </div>
        );
    }

    /**
     * Render error state.
     */
    protected renderError(): React.ReactNode {
        return (
            <div className="sanyam-element-palette-empty">
                <span className="sanyam-element-palette-empty-icon codicon codicon-error" />
                <span>{this.state.errorMessage}</span>
            </div>
        );
    }

    /**
     * Render no diagram state.
     */
    protected renderNoDiagram(): React.ReactNode {
        return (
            <div className="sanyam-element-palette-empty">
                <span className="sanyam-element-palette-empty-icon codicon codicon-file" />
                <span>Open a diagram to see available elements</span>
            </div>
        );
    }

    /**
     * Render empty state (no matching elements).
     */
    protected renderEmpty(): React.ReactNode {
        if (this.state.searchQuery) {
            return (
                <div className="sanyam-element-palette-empty">
                    <span className="sanyam-element-palette-empty-icon codicon codicon-search" />
                    <span>No elements match "{this.state.searchQuery}"</span>
                </div>
            );
        }

        return (
            <div className="sanyam-element-palette-empty">
                <span className="sanyam-element-palette-empty-icon codicon codicon-info" />
                <span>No elements available</span>
            </div>
        );
    }
}
