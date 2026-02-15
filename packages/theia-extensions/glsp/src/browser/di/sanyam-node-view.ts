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
import type { NodeShape, IconSvgData } from '@sanyam/types';
import { getSvgIcon } from './svg-icons';

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
    /** Codicon icon name from grammar manifest */
    icon?: string;
    /** Custom SVG icon data for diagram rendering (overrides built-in icon) */
    iconSvg?: IconSvgData;
}

/** Size of the node icon (px). */
const NODE_ICON_SIZE = 16;

/** Padding from the node edge to the icon (px). */
const NODE_ICON_PADDING = 8;

/**
 * Custom node view that renders different shapes based on the node's shape property.
 */
@injectable()
export class SanyamNodeView implements IView {
    render(node: SanyamNodeImpl, context: RenderingContext): VNode {
        const shape = node.shape || 'rectangle';
        const width = node.size?.width ?? 150;
        const height = node.size?.height ?? 75;

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

        // ── Resolve icon data ──
        // Resolution order: node.iconSvg → getSvgIcon(node.icon) → no icon.
        let iconData: IconSvgData | undefined;
        if (node.iconSvg) {
            iconData = node.iconSvg;
        } else if (node.icon) {
            iconData = getSvgIcon(node.icon);
        }

        // Render children (labels, compartments, etc.)
        // Labels are centered by ELK; the icon is positioned independently.
        const children = context.renderChildren(node);

        // Build the group element
        const groupAttrs: Record<string, string> = {
            'data-element-type': node.type,
            'data-shape': shape,
        };

        // ── Shape-dependent icon placement ──
        // The icon is positioned independently of the label. Labels stay centered
        // normally by ELK with no padding for the icon.
        //
        // Placement rules:
        //   rectangle, rounded, pill → top-left corner
        //   diamond, hexagon          → just inside the left "point"
        //   ellipse                   → left side, vertically centered
        if (iconData && iconData.paths.length > 0) {
            const iconVNode = this.renderIcon(iconData, shape, width, height);

            return h('g', {
                class: { 'sanyam-node': true },
                attrs: groupAttrs,
            }, [shapeElement, iconVNode, ...children]);
        }

        return h('g', {
            class: { 'sanyam-node': true },
            attrs: groupAttrs,
        }, [shapeElement, ...children]);
    }

    /**
     * Render the node icon as an SVG element positioned according to the shape.
     *
     * - Rectangular shapes (rectangle, rounded, pill): top-left corner
     * - Diamond / hexagon: just inside the left vertex
     * - Ellipse: left side, vertically centered
     */
    protected renderIcon(
        iconData: IconSvgData,
        shape: NodeShape,
        width: number,
        height: number,
    ): VNode {
        const pathVNodes = iconData.paths.map(seg => {
            const attrs: Record<string, string> = { d: seg.d };
            if (seg.fill) { attrs.fill = seg.fill; }
            if (seg.fillRule) { attrs['fill-rule'] = seg.fillRule; attrs['clip-rule'] = seg.fillRule; }
            if (seg.opacity !== undefined) { attrs.opacity = String(seg.opacity); }
            return h('path', { attrs });
        });

        let iconX: number;
        let iconY: number;

        switch (shape) {
            case 'diamond': {
                // Diamond left vertex at (0, H/2). Place icon just inside.
                // At the icon's top/bottom edges (±ICON_SIZE/2 from centre), the
                // diamond left boundary is at x = (ICON_SIZE/2) × (W/H).
                // Add a small padding so the icon sits comfortably inside.
                iconX = (NODE_ICON_SIZE / 2) * (width / height) + 4;
                iconY = (height - NODE_ICON_SIZE) / 2;
                break;
            }
            case 'hexagon': {
                // Hexagon left vertex at (0, H/2) with 20% inset at top/bottom.
                // Place icon just inside the left point.
                const inset = width * 0.2;
                iconX = inset / 2;
                iconY = (height - NODE_ICON_SIZE) / 2;
                break;
            }
            case 'ellipse': {
                // Ellipse: left side, vertically centered.
                // The leftmost edge is at x=0; the visible interior starts
                // around ~15% of width in from the edge.
                iconX = width * 0.15;
                iconY = (height - NODE_ICON_SIZE) / 2;
                break;
            }
            case 'rectangle':
            case 'rounded':
            case 'pill':
            default: {
                // Rectangular shapes: top-left corner with padding.
                iconX = NODE_ICON_PADDING;
                iconY = NODE_ICON_PADDING;
                break;
            }
        }

        return h('svg', {
            attrs: {
                x: iconX,
                y: iconY,
                width: NODE_ICON_SIZE,
                height: NODE_ICON_SIZE,
                viewBox: iconData.viewBox,
            },
            class: { 'sanyam-node-icon': true },
        }, pathVNodes);
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

/**
 * Maximum label width (in px) before word-wrapping occurs.
 */
const LABEL_MAX_WIDTH = 135;

/**
 * Approximate character width for word-wrap estimation (px per char at 18px font).
 */
const CHAR_WIDTH_ESTIMATE = 10;

/**
 * Line height for word-wrapped labels (px).
 */
const LINE_HEIGHT = 24;

/**
 * Custom label view that strips double quotes and supports word-wrapping (FR-008, FR-009).
 *
 * Labels are rendered as SVG `<text>` elements with multiple `<tspan>` rows
 * when the text exceeds the maximum label width.
 *
 * ## Vertical centering
 *
 * ELK positions the label bounding-box centered inside the parent node.
 * SVG `<text>` at y=0 places the **baseline** at y=0, so most of the glyph
 * renders *above* the bounding-box top — visually pushing labels upward.
 * We fix this with `dominant-baseline: central` and `y: LINE_HEIGHT/2`,
 * which aligns the glyph vertical centre with the bounding-box centre.
 *
 * Container heading labels (id ending `_header_label`) are excluded because
 * the container view positions them explicitly with a baseline-aware y.
 */
@injectable()
export class SanyamLabelView implements IView {
    render(label: SanyamLabelImpl, _context: RenderingContext): VNode {
        // FR-009: Strip surrounding double quotes from label text
        let text = label.text ?? '';
        if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
            text = text.slice(1, -1);
        }

        const cssClasses: Record<string, boolean> = {
            'sprotty-label': true,
        };
        if (label.cssClasses) {
            for (const cls of label.cssClasses) {
                cssClasses[cls] = true;
            }
        }

        // Container heading labels must not word-wrap — they are rendered inline
        // in the container header area with explicit positioning.
        // Detection by ID suffix because the model factory normalizes
        // 'label:heading' to 'label' for view lookup.
        if (label.id.endsWith('_header_label')) {
            return h('text', {
                class: cssClasses,
                attrs: { x: 0, y: 0 }
            }, text);
        }

        // ── Centering within ELK bounding box ──
        // ELK places the label's bounding-box centred inside the parent node.
        // We must centre the SVG text within that bounding-box:
        //
        // Horizontal: text-anchor: middle + x = boundingBoxWidth / 2
        //   → the glyph midpoint sits at the bounding-box centre, so even if
        //   the width estimate is slightly off, the text stays visually centred.
        //
        // Vertical: dominant-baseline: central + y = LINE_HEIGHT / 2
        //   → the glyph vertical centre (not baseline) aligns with the midpoint
        //   of each LINE_HEIGHT row.
        const centerX = (label.size?.width ?? 0) / 2;
        const baseAttrs: Record<string, string | number> = {
            'dominant-baseline': 'central',
            'text-anchor': 'middle',
            x: centerX,
            y: LINE_HEIGHT / 2,
        };

        // Word-wrap: split text into lines that fit within LABEL_MAX_WIDTH
        const lines = this.wrapText(text, LABEL_MAX_WIDTH);

        if (lines.length <= 1) {
            // Single line — standard rendering
            return h('text', { class: cssClasses, attrs: baseAttrs }, text);
        }

        // FR-008: Multi-line rendering using tspan elements.
        // Each tspan uses the same centred x so every line is individually centred.
        // First tspan dy=0 inherits y from the parent <text> element;
        // subsequent tspans shift down by LINE_HEIGHT.
        const tspans = lines.map((line, i) =>
            h('tspan', {
                attrs: {
                    x: centerX,
                    dy: i === 0 ? '0' : `${LINE_HEIGHT}`,
                },
            }, line)
        );

        // Update the label's size to accommodate wrapped text so node expands
        const requiredHeight = lines.length * LINE_HEIGHT;
        if (label.size && label.size.height < requiredHeight) {
            // Trigger Sprotty size recalculation by updating bounds
            (label as any).size = {
                width: Math.max(label.size.width, LABEL_MAX_WIDTH),
                height: requiredHeight,
            };
        }

        return h('text', { class: cssClasses, attrs: baseAttrs }, tspans);
    }

    /**
     * Split text into word-wrapped lines.
     */
    protected wrapText(text: string, maxWidth: number): string[] {
        const maxChars = Math.floor(maxWidth / CHAR_WIDTH_ESTIMATE);
        if (text.length <= maxChars) {
            return [text];
        }

        const words = text.split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length > maxChars && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }
}
