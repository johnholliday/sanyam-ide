/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Quick Menu Actions
 *
 * Actions for the canvas double-click quick menu interactions.
 *
 * @packageDocumentation
 */

import { Action, Point } from 'sprotty-protocol';

/**
 * Action to show the quick menu at a specific position.
 * Triggered by double-clicking on empty canvas area.
 */
export interface ShowQuickMenuAction extends Action {
    kind: 'showQuickMenu';
    /** Model coordinates where element will be created */
    modelPosition: Point;
    /** Screen coordinates for menu positioning */
    screenPosition: Point;
}

export namespace ShowQuickMenuAction {
    export const KIND = 'showQuickMenu';

    export function create(modelPosition: Point, screenPosition: Point): ShowQuickMenuAction {
        return {
            kind: KIND,
            modelPosition,
            screenPosition,
        };
    }
}

/**
 * Action to hide the quick menu.
 * Triggered by Escape key, clicking outside, or after element creation.
 */
export interface HideQuickMenuAction extends Action {
    kind: 'hideQuickMenu';
}

export namespace HideQuickMenuAction {
    export const KIND = 'hideQuickMenu';

    export function create(): HideQuickMenuAction {
        return { kind: KIND };
    }
}

/**
 * Action to filter quick menu items.
 * Triggered by typing in the quick menu.
 */
export interface FilterQuickMenuAction extends Action {
    kind: 'filterQuickMenu';
    /** Filter query string */
    query: string;
}

export namespace FilterQuickMenuAction {
    export const KIND = 'filterQuickMenu';

    export function create(query: string): FilterQuickMenuAction {
        return { kind: KIND, query };
    }
}

/**
 * Action to navigate quick menu selection.
 * Triggered by arrow keys.
 */
export interface NavigateQuickMenuAction extends Action {
    kind: 'navigateQuickMenu';
    /** Direction to move selection */
    direction: 'up' | 'down';
}

export namespace NavigateQuickMenuAction {
    export const KIND = 'navigateQuickMenu';

    export function create(direction: 'up' | 'down'): NavigateQuickMenuAction {
        return { kind: KIND, direction };
    }
}

/**
 * Action to select the currently highlighted quick menu item.
 * Triggered by Enter key or click on item.
 */
export interface SelectQuickMenuItemAction extends Action {
    kind: 'selectQuickMenuItem';
    /** Element type ID to create */
    elementTypeId: string;
}

export namespace SelectQuickMenuItemAction {
    export const KIND = 'selectQuickMenuItem';

    export function create(elementTypeId: string): SelectQuickMenuItemAction {
        return { kind: KIND, elementTypeId };
    }
}
