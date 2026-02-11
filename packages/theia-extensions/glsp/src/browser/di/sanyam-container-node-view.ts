/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Container Node View
 *
 * Custom Sprotty view for rendering container nodes with:
 * - Header bar (darker shade) with expand/collapse button and label
 * - Separator line between header and body
 * - Body area for nested child nodes
 * - Collapsed state showing only the header
 *
 * Because `needsClientLayout: false` disables Sprotty's hbox/vbox layouters,
 * this view explicitly positions header elements (button, label) using SVG
 * `<g transform>` wrappers instead of relying on compartment layout.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { VNode, h } from 'snabbdom';
import type { IView, RenderingContext } from 'sprotty';
import { SParentElementImpl } from 'sprotty';
import type { SanyamContainerNodeImpl } from './sanyam-container-node';

/** Height of the header bar (px). */
const HEADER_HEIGHT = 32;

/** Corner radius for the container's rounded rect. */
const CORNER_RADIUS = 6;

/** Horizontal padding on both sides of the header. */
const HEADER_PADDING_X = 8;

/** Size of the node icon (left) and expand/collapse button (right). */
const ICON_SIZE = 16;

/** Gap between icon/button and label. */
const ELEMENT_GAP = 6;

/**
 * Codicon name → Unicode character mapping for SVG rendering.
 * Only the icons used in grammar manifests need to be listed here.
 */
const CODICON_CHARS: Record<string, string> = {
    'person': '\uEA67',
    'checklist': '\uEAB3',
    'tasklist': '\uEB67',
    'file': '\uEA7B',
    'shield': '\uEB53',
    'key': '\uEB11',
    'clock': '\uEA82',
    'warning': '\uEA6C',
    'git-merge': '\uEAFE',
    'book': '\uEAA4',
};

/**
 * View for container nodes.
 *
 * Renders:
 * - Outer rounded rect (full container body)
 * - Header background rect (darker shade)
 * - Separator line between header and body
 * - Header elements (button + label) at explicit positions
 * - Body children (nested nodes with ELK-computed positions)
 * - Ports
 *
 * When collapsed, height shrinks to the header only.
 */
@injectable()
export class SanyamContainerNodeView implements IView {
    render(node: SanyamContainerNodeImpl, context: RenderingContext): VNode {
        const width = node.size?.width ?? 280;
        const height = node.size?.height ?? 180;
        const isCollapsed = !node.expanded;

        // Effective height: header-only when collapsed
        const effectiveHeight = isCollapsed ? HEADER_HEIGHT : height;

        // Build CSS class map
        const classMap: Record<string, boolean> = {
            'sanyam-container-node': true,
            'sprotty-node': true,
            'selected': node.selected ?? false,
            'mouseover': node.hoverFeedback ?? false,
            'collapsed': isCollapsed,
            'expanded': !isCollapsed,
        };

        // Add custom CSS classes from the model
        if (node.cssClasses) {
            for (const cls of node.cssClasses) {
                classMap[cls] = true;
            }
        }

        // Outer container rect
        const outerRect = h('rect.sanyam-container-body', {
            attrs: {
                x: 0,
                y: 0,
                width,
                height: effectiveHeight,
                rx: CORNER_RADIUS,
                ry: CORNER_RADIUS,
            },
        });

        // Header background rect
        const headerBg = h('rect.sanyam-container-header-bg', {
            attrs: {
                x: 0,
                y: 0,
                width,
                height: HEADER_HEIGHT,
                rx: CORNER_RADIUS,
                ry: CORNER_RADIUS,
            },
        });

        // If not collapsed, add a small rect to square off the bottom of the header
        // (since the header rounds the bottom corners but the body continues below)
        const headerSquareOff = !isCollapsed
            ? h('rect.sanyam-container-header-bg', {
                attrs: {
                    x: 0,
                    y: HEADER_HEIGHT - CORNER_RADIUS,
                    width,
                    height: CORNER_RADIUS,
                },
            })
            : undefined;

        // Separator line between header and body
        const separator = !isCollapsed
            ? h('line.sanyam-container-separator', {
                attrs: {
                    x1: 0,
                    y1: HEADER_HEIGHT,
                    x2: width,
                    y2: HEADER_HEIGHT,
                },
            })
            : undefined;

        // ── Render children explicitly ──────────────────────────────────────
        // With needsClientLayout: false, Sprotty's hbox/vbox layouters don't
        // run, so compartment layout properties are meaningless. We position
        // header elements manually and let ELK-positioned body children render
        // at their computed positions.
        //
        // Header layout (left to right):
        //   [pad] [icon 16px] [gap] [label ...] [gap] [button 16px] [pad]

        const iconX = HEADER_PADDING_X;
        const labelX = HEADER_PADDING_X + ICON_SIZE + ELEMENT_GAP;
        const buttonX = width - HEADER_PADDING_X - ICON_SIZE;

        const headerVNodes: VNode[] = [];
        const bodyVNodes: VNode[] = [];
        const portVNodes: VNode[] = [];

        // ── Node icon (top-left) ──
        const iconName = node.icon ?? '';
        const iconChar = CODICON_CHARS[iconName] ?? '';
        if (iconChar) {
            // Inline font-family ensures codicon renders even if CSS specificity fails in SVG
            headerVNodes.push(h('text.sanyam-container-icon', {
                attrs: {
                    x: iconX + ICON_SIZE / 2,
                    y: 22,
                    'text-anchor': 'middle',
                    'font-family': 'codicon',
                    'font-size': '16',
                },
            }, iconChar));
        }

        for (const child of node.children) {
            if (child.id.endsWith('_header') && child instanceof SParentElementImpl) {
                // Header compartment: render button and label at explicit positions.
                // We bypass the compartment view entirely.
                for (const headerChild of child.children) {
                    if (headerChild.type.startsWith('button')) {
                        // Expand/collapse button (top-right): render via Sprotty
                        // pipeline (ExpandButtonView) but reset position to prevent
                        // LocationPostprocessor offset.
                        if ('position' in headerChild) {
                            (headerChild as any).position = { x: 0, y: 0 };
                        }
                        if ('alignment' in headerChild) {
                            (headerChild as any).alignment = { x: 0, y: 0 };
                        }
                        const vnode = context.renderElement(headerChild);
                        if (!vnode) continue;
                        // Position at top-right, vertically centered in header
                        headerVNodes.push(h('g', {
                            attrs: { transform: `translate(${buttonX}, ${(HEADER_HEIGHT - ICON_SIZE) / 2})` },
                        }, [vnode]));
                    } else {
                        // Heading label: render as raw SVG <text> directly without wrapper
                        let labelText = (headerChild as any).text ?? '';
                        if (labelText.startsWith('"') && labelText.endsWith('"') && labelText.length >= 2) {
                            labelText = labelText.slice(1, -1);
                        }
                        // SVG <text> y is the BASELINE, not the top.  For 14px
                        // text in a 32px header, baseline ≈ 22 centers visually.
                        headerVNodes.push(h('text.sprotty-label', {
                            attrs: { x: labelX, y: 22, 'text-anchor': 'start' }
                        }, labelText));
                    }
                }
            } else if (child.id.endsWith('_body') && child instanceof SParentElementImpl) {
                // Body compartment: render children at their model positions.
                // Positions are relative to the container origin; children in
                // the body area start at ~(12, 40) per padding config.
                bodyVNodes.push(...context.renderChildren(child));
            } else if (child.type.startsWith('port')) {
                // Ports: render at their model positions
                const vnode = context.renderElement(child);
                if (vnode) {
                    portVNodes.push(vnode);
                }
            }
            // Ignore other children (e.g., bare compartments without matching suffix)
        }

        // Build the SVG elements array
        const svgChildren: VNode[] = [outerRect, headerBg];
        if (headerSquareOff) {
            svgChildren.push(headerSquareOff);
        }
        if (separator) {
            svgChildren.push(separator);
        }
        svgChildren.push(...headerVNodes);
        if (!isCollapsed) {
            svgChildren.push(...bodyVNodes);
        }
        svgChildren.push(...portVNodes);

        // Let Sprotty's LocationPostprocessor apply the position transform.
        // DO NOT manually set transform attribute - it will conflict with the postprocessor.

        return h('g', {
            class: classMap,
            attrs: {
                'data-element-type': node.type,
                'data-expanded': String(!isCollapsed),
            },
        }, svgChildren);
    }
}
