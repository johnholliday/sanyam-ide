/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Layout Action Handler
 *
 * Handles layout actions by invoking the ELK layout engine.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler, TYPES, IActionDispatcher, LocalModelSource } from 'sprotty';
import type { Action } from 'sprotty-protocol';
import { RequestLayoutAction, LayoutCompleteAction } from './layout-actions';

/**
 * Layout Action Handler.
 *
 * Handles RequestLayoutAction by triggering a model update which
 * invokes the ELK layout engine automatically.
 */
@injectable()
export class LayoutActionHandler implements IActionHandler {
    @inject(TYPES.IActionDispatcher) @optional()
    protected actionDispatcher?: IActionDispatcher;

    @inject(TYPES.ModelSource) @optional()
    protected modelSource?: LocalModelSource;

    handle(action: Action): void {
        if (action.kind === RequestLayoutAction.KIND) {
            // Handle asynchronously with error catching
            this.handleRequestLayout(action as RequestLayoutAction).catch(error => {
                console.error('[LayoutActionHandler] Unhandled error in layout:', error);
            });
        }
    }

    protected async handleRequestLayout(action: RequestLayoutAction): Promise<void> {
        try {
            console.info('[LayoutActionHandler] Starting layout request...');

            if (!this.modelSource) {
                console.warn('[LayoutActionHandler] No model source available');
                this.dispatchComplete(false, 'No model source configured');
                return;
            }

            // Check if layout engine is available
            const layoutEngine = (this.modelSource as any).layoutEngine;
            console.info('[LayoutActionHandler] Layout engine available:', !!layoutEngine);
            if (layoutEngine) {
                console.info('[LayoutActionHandler] Layout engine type:', layoutEngine.constructor?.name);
            }

            console.info('[LayoutActionHandler] Triggering layout via model update...');

            // Get the current model and trigger an update
            // The LocalModelSource will automatically invoke the layout engine
            // when updating the model (if IModelLayoutEngine is bound)
            let currentModel;
            try {
                currentModel = this.modelSource.model;
                console.info('[LayoutActionHandler] Current model:', {
                    type: currentModel?.type,
                    id: currentModel?.id,
                    childrenCount: currentModel?.children?.length ?? 0,
                });
            } catch (e) {
                console.warn('[LayoutActionHandler] Failed to get model:', e);
                this.dispatchComplete(false, 'Failed to access model');
                return;
            }

            if (!currentModel) {
                console.warn('[LayoutActionHandler] No model available');
                this.dispatchComplete(false, 'No model available');
                return;
            }

            // Update the model - this triggers the layout engine
            try {
                console.info('[LayoutActionHandler] Calling updateModel...');
                await this.modelSource.updateModel(currentModel);
                console.info('[LayoutActionHandler] Layout complete');
                this.dispatchComplete(true);
            } catch (updateError) {
                console.error('[LayoutActionHandler] Model update failed:', updateError);
                if (updateError instanceof Error) {
                    console.error('[LayoutActionHandler] Error stack:', updateError.stack);
                }
                this.dispatchComplete(false, 'Model update failed');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[LayoutActionHandler] Layout failed:', error);
            if (error instanceof Error) {
                console.error('[LayoutActionHandler] Error stack:', error.stack);
            }
            this.dispatchComplete(false, message);
        }
    }

    protected dispatchComplete(success: boolean, error?: string): void {
        if (!this.actionDispatcher) {
            console.warn('[LayoutActionHandler] No action dispatcher, cannot dispatch complete');
            return;
        }
        this.actionDispatcher.dispatch(LayoutCompleteAction.create(success, error)).catch(err => {
            console.warn('[LayoutActionHandler] Failed to dispatch complete action:', err);
        });
    }
}
