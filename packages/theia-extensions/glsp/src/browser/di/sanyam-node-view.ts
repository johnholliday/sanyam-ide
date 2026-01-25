/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Node View
 *
 * Custom Sprotty view that renders different node shapes based on the
 * `shape` property. Supports: rectangle, rounded, ellipse, diamond, hexagon, pill.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { VNode, h } from 'snabbdom';
import {
    IView,
    RenderingContext,
    SNodeImpl,
    SLabelImpl,
} from 'sprotty';
import type { NodeShape } from '@sanyam/types';

/**
 * Extended SNode with Sanyam-specific properties.
 */
export class SanyamNodeImpl extends SNodeImpl {
    /** Visual shape for rendering */
    shape: NodeShape = 'rectangle';
    /** CSS classes for styling */
    cssClasses?: string[];
    /** Node type (for CSS targeting) */
    nodeType?: string;
    /** Trace back to AST node */
    trace?: string;
}

/**
 * Custom node view that renders different shapes based on the node's shape property.
 */
@injectable()
export class SanyamNodeView implements IView {
    render(node: SanyamNodeImpl, context: RenderingContext): VNode {
        console.log('[SanyamNodeView] render called for:', node.id, 'type:', node.type, 'position:', node.position, 'size:', node.size);
        const shape = node.shape || 'rectangle';
        const width = node.size?.width ?? 100;
        const height = node.size?.height ?? 50;

        // Create the shape element
        let shapeElement: VNode;
        switch (shape) {
            case 'ellipse':
                shapeElement = this.renderEllipse(width, height);
                break;
            case 'diamond':
                shapeElement = this.renderDiamond(width, height);
                break;
            case 'hexagon':
                shapeElement = this.renderHexagon(width, height);
                break;
            case 'pill':
                shapeElement = this.renderPill(width, height);
                break;
            case 'rounded':
                shapeElement = this.renderRoundedRect(width, height);
                break;
            case 'rectangle':
            default:
                shapeElement = this.renderRectangle(width, height);
                break;
        }

        // Build CSS classes for the shape
        const shapeClasses: Record<string, boolean> = {
            'sprotty-node': true,
            [`sanyam-shape-${shape}`]: true,
            'selected': node.selected ?? false,
            'mouseover': node.hoverFeedback ?? false,
        };

        // Add custom CSS classes
        if (node.cssClasses) {
            for (const cls of node.cssClasses) {
                shapeClasses[cls] = true;
            }
        }

        // Apply classes to shape element
        if (!shapeElement.data) {
            shapeElement.data = {};
        }
        shapeElement.data.class = shapeClasses;

        // Render children (labels, compartments, etc.)
        const children = context.renderChildren(node);

        // Build the group element
        const groupAttrs: Record<string, string> = {
            'data-element-type': node.type,
            'data-shape': shape,
        };

        return h('g', {
            class: { 'sanyam-node': true },
            attrs: groupAttrs,
        }, [shapeElement, ...children]);
    }

    protected renderRectangle(width: number, height: number): VNode {
        return h('rect', {
            attrs: {
                x: 0,
                y: 0,
                width,
                height,
            }
        });
    }

    protected renderRoundedRect(width: number, height: number): VNode {
        const radius = Math.min(width, height) * 0.15;
        return h('rect', {
            attrs: {
                x: 0,
                y: 0,
                width,
                height,
                rx: radius,
                ry: radius,
            }
        });
    }

    protected renderEllipse(width: number, height: number): VNode {
        return h('ellipse', {
            attrs: {
                cx: width / 2,
                cy: height / 2,
                rx: width / 2,
                ry: height / 2,
            }
        });
    }

    protected renderDiamond(width: number, height: number): VNode {
        const points = [
            `${width / 2},0`,
            `${width},${height / 2}`,
            `${width / 2},${height}`,
            `0,${height / 2}`,
        ].join(' ');
        return h('polygon', {
            attrs: { points }
        });
    }

    protected renderHexagon(width: number, height: number): VNode {
        const inset = width * 0.2;
        const points = [
            `${inset},0`,
            `${width - inset},0`,
            `${width},${height / 2}`,
            `${width - inset},${height}`,
            `${inset},${height}`,
            `0,${height / 2}`,
        ].join(' ');
        return h('polygon', {
            attrs: { points }
        });
    }

    protected renderPill(width: number, height: number): VNode {
        const radius = height / 2;
        return h('rect', {
            attrs: {
                x: 0,
                y: 0,
                width,
                height,
                rx: radius,
                ry: radius,
            }
        });
    }
}

/**
 * Extended SLabel with Sanyam-specific properties.
 */
export class SanyamLabelImpl extends SLabelImpl {
    cssClasses?: string[];
}
