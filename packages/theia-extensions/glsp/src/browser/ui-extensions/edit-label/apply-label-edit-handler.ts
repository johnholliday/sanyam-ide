/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Apply Label Edit Handler
 *
 * Handles label edit actions and coordinates with the language client.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import {
    EditLabelAction,
    ApplyLabelEditAction,
    CancelLabelEditAction,
    ValidateLabelEditAction,
    SetLabelValidationResultAction,
    EditLabelCompleteAction,
    LabelValidationResult,
} from './edit-label-actions';
import { SanyamEditLabelUI, EDIT_LABEL_ID } from './sanyam-edit-label-ui';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Symbol for label edit provider.
 */
export const LabelEditProvider = Symbol.for('LabelEditProvider');

/**
 * Interface for label edit provider.
 */
export interface ILabelEditProvider {
    applyLabelEdit(uri: string, labelId: string, newText: string): Promise<boolean>;
    validateLabel?(labelId: string, text: string): Promise<LabelValidationResult>;
}

/**
 * Apply Label Edit Handler.
 *
 * Handles label editing actions and coordinates with the language client.
 */
@injectable()
export class ApplyLabelEditHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'LabelEdit' });

    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    @inject(LabelEditProvider) @optional()
    protected readonly labelEditProvider?: ILabelEditProvider;

    @inject(TYPES.IActionDispatcher)
    protected readonly actionDispatcher: IActionDispatcher;

    /** Current document URI */
    protected currentUri: string = '';

    /** Listeners for label edit events */
    protected labelEditListeners: Array<(labelId: string, newText: string) => void> = [];

    /**
     * Handle an action.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case EditLabelAction.KIND:
                this.handleEditLabel(action as EditLabelAction);
                break;
            case ApplyLabelEditAction.KIND:
                this.handleApplyLabelEdit(action as ApplyLabelEditAction);
                break;
            case CancelLabelEditAction.KIND:
                this.handleCancelLabelEdit(action as CancelLabelEditAction);
                break;
            case ValidateLabelEditAction.KIND:
                this.handleValidateLabelEdit(action as ValidateLabelEditAction);
                break;
            case EditLabelCompleteAction.KIND:
                this.handleEditLabelComplete(action as EditLabelCompleteAction);
                break;
        }
    }

    /**
     * Handle edit label action - start editing.
     */
    protected handleEditLabel(action: EditLabelAction): void {
        const extension = this.getEditLabelExtension();
        if (extension) {
            extension.startEditing(action.labelId);
        }
    }

    /**
     * Handle apply label edit action.
     */
    protected async handleApplyLabelEdit(action: ApplyLabelEditAction): Promise<void> {
        const { labelId, newText } = action;

        // Apply via language client
        if (this.labelEditProvider) {
            try {
                const success = await this.labelEditProvider.applyLabelEdit(
                    this.currentUri,
                    labelId,
                    newText
                );

                if (success) {
                    // Notify listeners
                    this.notifyLabelEditListeners(labelId, newText);
                } else {
                    this.logger.warn({ labelId }, 'Failed to apply label edit');
                }
            } catch (error) {
                this.logger.error({ err: error }, 'Error applying label edit');
            }
        } else {
            // No provider - just notify listeners
            this.notifyLabelEditListeners(labelId, newText);
        }
    }

    /**
     * Handle cancel label edit action.
     */
    protected handleCancelLabelEdit(action: CancelLabelEditAction): void {
        // Cancel is handled by the UI extension
        this.logger.info({ labelId: action.labelId }, 'Label edit cancelled');
    }

    /**
     * Handle validate label edit action.
     */
    protected async handleValidateLabelEdit(action: ValidateLabelEditAction): Promise<void> {
        const { labelId, text } = action;

        let result: LabelValidationResult = { valid: true };

        if (this.labelEditProvider?.validateLabel) {
            try {
                result = await this.labelEditProvider.validateLabel(labelId, text);
            } catch (error) {
                this.logger.error({ err: error }, 'Validation error');
                result = {
                    valid: false,
                    message: 'Validation failed',
                    severity: 'error',
                };
            }
        } else {
            // Default validation
            result = this.defaultValidation(text);
        }

        // Update UI with result
        const extension = this.getEditLabelExtension();
        if (extension) {
            extension.setValidationResult(result);
        }

        // Dispatch result action
        await this.actionDispatcher.dispatch(
            SetLabelValidationResultAction.create(labelId, result)
        );
    }

    /**
     * Handle edit label complete action.
     */
    protected handleEditLabelComplete(action: EditLabelCompleteAction): void {
        this.logger.info({ labelId: action.labelId, applied: action.applied }, 'Edit complete');
    }

    /**
     * Default validation logic.
     */
    protected defaultValidation(text: string): LabelValidationResult {
        if (text.trim().length === 0) {
            return {
                valid: false,
                message: 'Label cannot be empty',
                severity: 'error',
            };
        }

        if (text.length > 100) {
            return {
                valid: true,
                message: 'Label is quite long',
                severity: 'warning',
            };
        }

        return { valid: true };
    }

    /**
     * Get the edit label UI extension.
     */
    protected getEditLabelExtension(): SanyamEditLabelUI | undefined {
        if (this.uiExtensionRegistry) {
            return this.uiExtensionRegistry.get(EDIT_LABEL_ID) as SanyamEditLabelUI | undefined;
        }
        return undefined;
    }

    /**
     * Set the current document URI.
     */
    setCurrentUri(uri: string): void {
        this.currentUri = uri;
    }

    /**
     * Check if currently editing a label.
     */
    isEditing(): boolean {
        const extension = this.getEditLabelExtension();
        return extension?.isEditing() ?? false;
    }

    /**
     * Get the currently edited label ID.
     */
    getCurrentLabelId(): string | undefined {
        const extension = this.getEditLabelExtension();
        return extension?.getCurrentLabelId();
    }

    /**
     * Programmatically start editing a label.
     */
    startEditing(labelId: string): void {
        this.actionDispatcher.dispatch(EditLabelAction.create(labelId));
    }

    /**
     * Add a label edit listener.
     */
    addLabelEditListener(listener: (labelId: string, newText: string) => void): void {
        this.labelEditListeners.push(listener);
    }

    /**
     * Remove a label edit listener.
     */
    removeLabelEditListener(listener: (labelId: string, newText: string) => void): void {
        const index = this.labelEditListeners.indexOf(listener);
        if (index !== -1) {
            this.labelEditListeners.splice(index, 1);
        }
    }

    /**
     * Notify label edit listeners.
     */
    protected notifyLabelEditListeners(labelId: string, newText: string): void {
        this.labelEditListeners.forEach(listener => listener(labelId, newText));
    }
}
