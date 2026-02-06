/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Category Component
 *
 * A collapsible category of element types in the sidebar palette.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { ElementCategory } from './element-palette-types';
import { ElementItemComponent } from './element-item';

/**
 * Props for ElementCategoryComponent.
 */
export interface ElementCategoryProps {
    /** The category to render */
    category: ElementCategory;
    /** Whether the category is expanded */
    expanded: boolean;
    /** Callback when expand/collapse is toggled */
    onToggle: (categoryId: string) => void;
    /** Callback when an operation item is clicked */
    onOperationClick?: (operationId: string, languageId: string) => void;
}

/**
 * Element Category Component.
 *
 * Renders a collapsible category header with a list of element items.
 */
export class ElementCategoryComponent extends React.Component<ElementCategoryProps> {
    private itemsRef = React.createRef<HTMLDivElement>();

    /**
     * Handle header click to toggle expand/collapse.
     */
    private handleHeaderClick = (): void => {
        this.props.onToggle(this.props.category.id);
    };

    /**
     * Handle keyboard navigation.
     */
    private handleKeyDown = (event: React.KeyboardEvent): void => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.props.onToggle(this.props.category.id);
        }
    };

    /**
     * Render the category.
     */
    render(): React.ReactNode {
        const { category, expanded } = this.props;
        const itemCount = category.items.length;

        return (
            <div className="sanyam-element-palette-category">
                <div
                    className="sanyam-element-palette-category-header"
                    onClick={this.handleHeaderClick}
                    onKeyDown={this.handleKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expanded}
                    aria-controls={`category-items-${category.id}`}
                >
                    <span
                        className={`sanyam-element-palette-category-chevron codicon codicon-chevron-down ${
                            expanded ? '' : 'collapsed'
                        }`}
                    />
                    {category.icon && (
                        <span className={`sanyam-element-palette-category-icon codicon codicon-${category.icon}`} />
                    )}
                    <span className="sanyam-element-palette-category-label">{category.label}</span>
                    <span className="sanyam-element-palette-category-count">{itemCount}</span>
                </div>
                <div
                    ref={this.itemsRef}
                    id={`category-items-${category.id}`}
                    className={`sanyam-element-palette-category-items ${expanded ? '' : 'collapsed'}`}
                    style={{ maxHeight: expanded ? `${itemCount * 36}px` : '0' }}
                >
                    {category.items.map(item => (
                        <ElementItemComponent
                            key={item.id}
                            item={item}
                            onOperationClick={this.props.onOperationClick}
                        />
                    ))}
                </div>
            </div>
        );
    }
}
