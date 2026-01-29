/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Validation Action Handler
 *
 * Handles validation-related actions and coordinates with the validation UI extension.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import {
    RequestValidationAction,
    SetMarkersAction,
    ClearMarkersAction,
    ValidationCompletedAction,
    NavigateToMarkerAction,
    ShowMarkerDetailsAction,
    ValidationMarker,
    ValidationResult,
} from './validation-actions';
import { ValidationMarkersExtension, VALIDATION_MARKERS_ID } from './validation-markers-extension';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Symbol for validation provider.
 */
export const ValidationProvider = Symbol.for('ValidationProvider');

/**
 * Interface for validation data provider.
 */
export interface IValidationProvider {
    validateModel(uri: string): Promise<ValidationResult>;
}

/**
 * Validation Action Handler.
 *
 * Handles validation-related actions and coordinates with the server.
 */
@injectable()
export class ValidationActionHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'ValidationActions' });

    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    @inject(ValidationProvider) @optional()
    protected readonly validationProvider?: IValidationProvider;

    @inject(TYPES.IActionDispatcher)
    protected readonly actionDispatcher: IActionDispatcher;

    /** Current validation results by URI */
    protected validationResults: Map<string, ValidationResult> = new Map();

    /** Pending validation requests */
    protected pendingValidations: Map<string, Promise<ValidationResult>> = new Map();

    /** Listeners for validation events */
    protected validationListeners: Array<(uri: string, result: ValidationResult) => void> = [];

    /**
     * Handle an action.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case RequestValidationAction.KIND:
                this.handleRequestValidation(action as RequestValidationAction);
                break;
            case SetMarkersAction.KIND:
                this.handleSetMarkers(action as SetMarkersAction);
                break;
            case ClearMarkersAction.KIND:
                this.handleClearMarkers(action as ClearMarkersAction);
                break;
            case ValidationCompletedAction.KIND:
                this.handleValidationCompleted(action as ValidationCompletedAction);
                break;
            case NavigateToMarkerAction.KIND:
                this.handleNavigateToMarker(action as NavigateToMarkerAction);
                break;
            case ShowMarkerDetailsAction.KIND:
                this.handleShowMarkerDetails(action as ShowMarkerDetailsAction);
                break;
        }
    }

    /**
     * Handle request validation action.
     */
    protected async handleRequestValidation(action: RequestValidationAction): Promise<void> {
        const uri = action.uri;

        // Check for pending validation
        const pending = this.pendingValidations.get(uri);
        if (pending) {
            await pending;
            return;
        }

        // Perform validation
        const validationPromise = this.performValidation(uri);
        this.pendingValidations.set(uri, validationPromise);

        try {
            const result = await validationPromise;
            this.validationResults.set(uri, result);

            // Update markers in UI
            const extension = this.getValidationExtension();
            if (extension) {
                extension.setMarkers(result.markers, true);
                extension.show();
            }

            // Dispatch completion action
            await this.actionDispatcher.dispatch(
                ValidationCompletedAction.create(uri, result)
            );

            // Notify listeners
            this.notifyValidationListeners(uri, result);
        } finally {
            this.pendingValidations.delete(uri);
        }
    }

    /**
     * Perform validation using the provider.
     */
    protected async performValidation(uri: string): Promise<ValidationResult> {
        if (this.validationProvider) {
            try {
                return await this.validationProvider.validateModel(uri);
            } catch (error) {
                this.logger.error({ err: error }, 'Validation error');
                return {
                    isValid: false,
                    markers: [],
                    errorCount: 1,
                    warningCount: 0,
                    infoCount: 0,
                };
            }
        }

        // Return empty result if no provider
        return {
            isValid: true,
            markers: [],
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
        };
    }

    /**
     * Handle set markers action.
     */
    protected handleSetMarkers(action: SetMarkersAction): void {
        const extension = this.getValidationExtension();
        if (extension) {
            extension.setMarkers(action.markers, action.replace ?? true);
        }
    }

    /**
     * Handle clear markers action.
     */
    protected handleClearMarkers(action: ClearMarkersAction): void {
        const extension = this.getValidationExtension();
        if (extension) {
            extension.clearMarkers(action.elementIds);
        }
    }

    /**
     * Handle validation completed action.
     */
    protected handleValidationCompleted(action: ValidationCompletedAction): void {
        this.validationResults.set(action.uri, action.result);
    }

    /**
     * Handle navigate to marker action.
     */
    protected handleNavigateToMarker(action: NavigateToMarkerAction): void {
        // This should be handled by the diagram widget/composite editor
        // to navigate to the source location
        this.logger.info({ elementId: action.elementId }, 'Navigate to marker for element');
    }

    /**
     * Handle show marker details action.
     */
    protected handleShowMarkerDetails(action: ShowMarkerDetailsAction): void {
        // Could show a detailed popup or panel
        this.logger.info({ marker: action.marker }, 'Show marker details');
    }

    /**
     * Get the validation markers extension.
     */
    protected getValidationExtension(): ValidationMarkersExtension | undefined {
        if (this.uiExtensionRegistry) {
            return this.uiExtensionRegistry.get(VALIDATION_MARKERS_ID) as ValidationMarkersExtension | undefined;
        }
        return undefined;
    }

    /**
     * Get validation result for a URI.
     */
    getValidationResult(uri: string): ValidationResult | undefined {
        return this.validationResults.get(uri);
    }

    /**
     * Get all markers for a URI.
     */
    getMarkers(uri: string): ValidationMarker[] {
        const result = this.validationResults.get(uri);
        return result?.markers || [];
    }

    /**
     * Add a validation listener.
     */
    addValidationListener(listener: (uri: string, result: ValidationResult) => void): void {
        this.validationListeners.push(listener);
    }

    /**
     * Remove a validation listener.
     */
    removeValidationListener(listener: (uri: string, result: ValidationResult) => void): void {
        const index = this.validationListeners.indexOf(listener);
        if (index !== -1) {
            this.validationListeners.splice(index, 1);
        }
    }

    /**
     * Notify validation listeners.
     */
    protected notifyValidationListeners(uri: string, result: ValidationResult): void {
        this.validationListeners.forEach(listener => listener(uri, result));
    }
}
