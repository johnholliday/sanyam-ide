/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Item Component
 *
 * A draggable element type item in the sidebar palette.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { ElementTypeItem } from './element-palette-types';
import { ELEMENT_PALETTE_DRAG_MIME_TYPE, encodeDragData } from './drag-drop-actions';

/**
 * Props for ElementItemComponent.
 */
export interface ElementItemProps {
    /** The element type item to render */
    item: ElementTypeItem;
    /** Callback when an operation item is clicked */
    onOperationClick?: (operationId: string, languageId: string) => void;
}

/**
 * State for ElementItemComponent.
 */
interface ElementItemState {
    isDragging: boolean;
    showTooltip: boolean;
    tooltipPosition: { x: number; y: number };
}

/**
 * Element Item Component.
 *
 * Renders a single element type that can be dragged onto the canvas.
 */
export class ElementItemComponent extends React.Component<ElementItemProps, ElementItemState> {
    private tooltipTimeout: number | null = null;
    private itemRef = React.createRef<HTMLDivElement>();

    constructor(props: ElementItemProps) {
        super(props);
        this.state = {
            isDragging: false,
            showTooltip: false,
            tooltipPosition: { x: 0, y: 0 },
        };
    }

    componentWillUnmount(): void {
        if (this.tooltipTimeout) {
            window.clearTimeout(this.tooltipTimeout);
        }
    }

    /**
     * Whether this item supports drag-and-drop (only for element creation).
     */
    private get isDraggable(): boolean {
        const kind = this.props.item.action.kind;
        return kind === 'createNode' || kind === 'createEdge';
    }

    /**
     * Handle drag start - encode element data for DataTransfer.
     * Only fires for createNode/createEdge items.
     */
    private handleDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
        if (!this.isDraggable) {
            event.preventDefault();
            return;
        }

        const { item } = this.props;

        // Set drag data
        const dragData = encodeDragData({
            elementTypeId: item.action.elementTypeId!,
            label: item.label,
            icon: item.icon,
        });
        event.dataTransfer.setData(ELEMENT_PALETTE_DRAG_MIME_TYPE, dragData);
        event.dataTransfer.effectAllowed = 'copy';

        this.setState({ isDragging: true });
    };

    /**
     * Handle drag end.
     */
    private handleDragEnd = (): void => {
        this.setState({ isDragging: false });
    };

    /**
     * Handle click for operation/delete items.
     */
    private handleClick = (): void => {
        const { item, onOperationClick } = this.props;
        const { kind } = item.action;

        if (kind === 'operation' && item.action.operationId && item.action.languageId && onOperationClick) {
            onOperationClick(item.action.operationId, item.action.languageId);
        }
    };

    /**
     * Handle mouse enter - show tooltip after delay.
     */
    private handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>): void => {
        const rect = this.itemRef.current?.getBoundingClientRect();
        if (rect) {
            this.tooltipTimeout = window.setTimeout(() => {
                this.setState({
                    showTooltip: true,
                    tooltipPosition: {
                        x: rect.right + 8,
                        y: rect.top,
                    },
                });
            }, 500); // 500ms delay before showing tooltip
        }
    };

    /**
     * Handle mouse leave - hide tooltip.
     */
    private handleMouseLeave = (): void => {
        if (this.tooltipTimeout) {
            window.clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
        this.setState({ showTooltip: false });
    };

    /**
     * Render the item.
     */
    render(): React.ReactNode {
        const { item } = this.props;
        const { isDragging, showTooltip, tooltipPosition } = this.state;

        const isActionItem = item.action.kind === 'operation' || item.action.kind === 'delete';
        const className = [
            'sanyam-element-palette-item',
            isDragging ? 'dragging' : '',
            isActionItem ? 'action-item' : '',
        ].filter(Boolean).join(' ');

        return (
            <>
                <div
                    ref={this.itemRef}
                    className={className}
                    draggable={this.isDraggable}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onClick={isActionItem ? this.handleClick : undefined}
                    onMouseEnter={this.handleMouseEnter}
                    onMouseLeave={this.handleMouseLeave}
                    title={item.description || item.label}
                >
                    {item.thumbnail ? (
                        <div
                            className="sanyam-element-palette-item-thumbnail"
                            dangerouslySetInnerHTML={{ __html: item.thumbnail }}
                        />
                    ) : item.icon ? (
                        <span className={`sanyam-element-palette-item-icon codicon codicon-${item.icon}`} />
                    ) : (
                        <span className="sanyam-element-palette-item-icon codicon codicon-symbol-misc" />
                    )}
                    <span className="sanyam-element-palette-item-label">{item.label}</span>
                </div>
                {showTooltip && item.description && (
                    <div
                        className="sanyam-element-palette-tooltip"
                        style={{
                            left: tooltipPosition.x,
                            top: tooltipPosition.y,
                        }}
                    >
                        {item.description}
                    </div>
                )}
            </>
        );
    }
}
