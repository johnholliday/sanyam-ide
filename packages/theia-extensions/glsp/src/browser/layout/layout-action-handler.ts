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

import { createLogger } from '@sanyam/logger';
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
    protected readonly logger = createLogger({ name: 'LayoutActions' });

    @inject(TYPES.IActionDispatcher) @optional()
    protected actionDispatcher?: IActionDispatcher;

    @inject(TYPES.ModelSource) @optional()
    protected modelSource?: LocalModelSource;

    handle(action: Action): void {
        if (action.kind === RequestLayoutAction.KIND) {
            // Handle asynchronously with error catching
            this.handleRequestLayout(action as RequestLayoutAction).catch(error => {
                this.logger.error({ err: error }, 'Unhandled error in layout');
            });
        }
    }

    protected async handleRequestLayout(action: RequestLayoutAction): Promise<void> {
        try {
            this.logger.info('Starting layout request...');

            if (!this.modelSource) {
                this.logger.warn('No model source available');
                this.dispatchComplete(false, 'No model source configured');
                return;
            }

            // Check if layout engine is available
            const layoutEngine = (this.modelSource as any).layoutEngine;
            this.logger.info({ available: !!layoutEngine, type: layoutEngine?.constructor?.name }, 'Layout engine status');

            this.logger.info('Triggering layout via model update...');

            // Get the current model and trigger an update
            // The LocalModelSource will automatically invoke the layout engine
            // when updating the model (if IModelLayoutEngine is bound)
            let currentModel;
            try {
                currentModel = this.modelSource.model;
                this.logger.info({ type: currentModel?.type, id: currentModel?.id, childrenCount: currentModel?.children?.length ?? 0 }, 'Current model');
            } catch (e) {
                this.logger.warn({ err: e }, 'Failed to get model');
                this.dispatchComplete(false, 'Failed to access model');
                return;
            }

            if (!currentModel) {
                this.logger.warn('No model available');
                this.dispatchComplete(false, 'No model available');
                return;
            }

            // Update the model - this triggers the layout engine
            try {
                this.logger.info('Calling updateModel...');

                // Check if layout engine is properly configured
                const modelSourceAny = this.modelSource as any;
                this.logger.info({ needsClientLayout: modelSourceAny.viewerOptions?.needsClientLayout, layoutEngineExists: !!modelSourceAny.layoutEngine }, 'Layout engine configuration');

                await this.modelSource.updateModel(currentModel);

                // Check if positions were updated
                const updatedModel = this.modelSource.model;
                if (updatedModel?.children) {
                    const firstChild = updatedModel.children[0] as any;
                    this.logger.info({ position: firstChild?.position }, 'First child position after layout');
                }

                this.logger.info('Layout complete');
                this.dispatchComplete(true);
            } catch (updateError) {
                this.logger.error({ err: updateError }, 'Model update failed');
                this.dispatchComplete(false, 'Model update failed');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({ err: error }, 'Layout failed');
            this.dispatchComplete(false, message);
        }
    }

    protected dispatchComplete(success: boolean, error?: string): void {
        if (!this.actionDispatcher) {
            this.logger.warn('No action dispatcher, cannot dispatch complete');
            return;
        }
        this.actionDispatcher.dispatch(LayoutCompleteAction.create(success, error)).catch(err => {
            this.logger.warn({ err }, 'Failed to dispatch complete action');
        });
    }
}
