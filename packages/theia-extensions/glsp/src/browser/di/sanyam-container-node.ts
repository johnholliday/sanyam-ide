/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Container Node Model
 *
 * Extended SNode implementation for container nodes that support
 * expand/collapse via Sprotty's expandFeature.
 *
 * @packageDocumentation
 */

import { expandFeature } from 'sprotty';
import type { Expandable } from 'sprotty';
import { SanyamNodeImpl } from './sanyam-node-view';

/**
 * Container node implementation with expand/collapse support.
 *
 * Container nodes embed child nodes inside a body compartment and
 * provide an expand/collapse button in the header.
 *
 * Implements Sprotty's {@link Expandable} interface so the built-in
 * {@link ExpandButtonHandler} can toggle the `expanded` property.
 */
export class SanyamContainerNodeImpl extends SanyamNodeImpl implements Expandable {
    static override readonly DEFAULT_FEATURES = [
        ...SanyamNodeImpl.DEFAULT_FEATURES,
        expandFeature,
    ];

    /** Whether the container body is visible (default: collapsed) */
    expanded: boolean = false;
}
