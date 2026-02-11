/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Collapse/Expand Action Handler
 *
 * Handles Sprotty's {@link CollapseExpandAction} dispatched by the built-in
 * {@link ExpandButtonHandler} when the user clicks an expand/collapse button.
 *
 * Uses the same imperative callback pattern as {@link SelectionChangeActionHandler}
 * to avoid the Inversify singleton timing race with container rebinding.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import type { IActionHandler } from 'sprotty';
import type { Action } from 'sprotty-protocol';
import { CollapseExpandAction } from 'sprotty-protocol';
import { createLogger } from '@sanyam/logger';

/**
 * Callback invoked when a container node is expanded or collapsed.
 *
 * @param elementId - The ID of the container element
 * @param collapsed - Whether the element is now collapsed
 */
export type CollapseExpandCallback = (elementId: string, collapsed: boolean) => void;

/**
 * Action handler for CollapseExpandAction.
 *
 * Intercepts Sprotty's CollapseExpandAction (dispatched by ExpandButtonHandler)
 * and routes it to a callback set by the DiagramWidget. The callback sends
 * an RPC request to the backend to toggle the collapsed state and regenerate
 * the model.
 *
 * NOTE: The callback is set imperatively via {@link setCallback} (same pattern as
 * SelectionChangeActionHandler) to avoid Inversify singleton timing races.
 */
@injectable()
export class CollapseExpandActionHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'CollapseExpand' });
    protected callback: CollapseExpandCallback = () => {};

    /**
     * Set the callback invoked when a container is expanded or collapsed.
     */
    setCallback(cb: CollapseExpandCallback): void {
        this.callback = cb;
    }

    handle(action: Action): void {
        if (action.kind === CollapseExpandAction.KIND) {
            const collapseExpand = action as CollapseExpandAction;

            // Handle expand requests
            for (const id of collapseExpand.expandIds) {
                this.logger.debug({ elementId: id }, 'Expanding container');
                this.callback(id, false);
            }

            // Handle collapse requests
            for (const id of collapseExpand.collapseIds) {
                this.logger.debug({ elementId: id }, 'Collapsing container');
                this.callback(id, true);
            }
        }
    }
}
