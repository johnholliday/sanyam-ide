/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Layout Actions
 *
 * Defines actions for triggering automatic diagram layout.
 *
 * @packageDocumentation
 */

import type { Action } from 'sprotty-protocol';

/**
 * Action to request automatic layout of the diagram.
 */
export interface RequestLayoutAction extends Action {
    kind: typeof RequestLayoutAction.KIND;
    /** Optional layout algorithm to use */
    algorithm?: 'layered' | 'force' | 'box' | 'radial' | 'stress';
    /** Optional layout direction for layered algorithm */
    direction?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
}

export namespace RequestLayoutAction {
    export const KIND = 'requestLayout';

    export function create(options?: {
        algorithm?: RequestLayoutAction['algorithm'];
        direction?: RequestLayoutAction['direction'];
    }): RequestLayoutAction {
        return {
            kind: KIND,
            algorithm: options?.algorithm,
            direction: options?.direction,
        };
    }
}

/**
 * Action dispatched when layout is complete.
 */
export interface LayoutCompleteAction extends Action {
    kind: typeof LayoutCompleteAction.KIND;
    /** Whether the layout was successful */
    success: boolean;
    /** Error message if layout failed */
    error?: string;
}

export namespace LayoutCompleteAction {
    export const KIND = 'layoutComplete';

    export function create(success: boolean, error?: string): LayoutCompleteAction {
        return {
            kind: KIND,
            success,
            error,
        };
    }
}
