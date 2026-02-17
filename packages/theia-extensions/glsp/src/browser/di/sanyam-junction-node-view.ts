/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Junction Node View
 *
 * Renders a small filled circle for edge bundling junction points.
 * Junction nodes serve as fan-out points where a single trunk edge
 * splits into multiple branch edges targeting different nodes.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { h } from 'snabbdom';
import type { VNode } from 'snabbdom';
import type { SNodeImpl, IView, RenderingContext } from 'sprotty';

/**
 * View that renders a junction node as a small filled circle (8x8).
 * No label or children are rendered.
 */
@injectable()
export class SanyamJunctionNodeView implements IView {
    render(node: Readonly<SNodeImpl>, context: RenderingContext): VNode {
        return h('g', [
            h('circle', {
                attrs: { cx: 4, cy: 4, r: 4 },
                class: { 'sanyam-junction-node': true },
            }),
        ]);
    }
}
