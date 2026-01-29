/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Edit Label UI
 *
 * UI extension for inline label editing with Theia-styled input.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';
import {
    ApplyLabelEditAction,
    CancelLabelEditAction,
    EditLabelCompleteAction,
    LabelValidationResult,
} from './edit-label-actions';

/**
 * Edit Label Extension ID.
 */
export const EDIT_LABEL_ID = 'sanyam-edit-label';

/**
 * CSS classes for edit label UI.
 */
export const EditLabelClasses = {
    CONTAINER: 'sanyam-edit-label-container',
    INPUT: 'sanyam-edit-label-input',
    INPUT_ERROR: 'has-error',
    INPUT_WARNING: 'has-warning',
    VALIDATION_MESSAGE: 'sanyam-edit-label-validation',
    ACTIVE: 'editing',
} as const;

/**
 * Edit label UI state.
 */
interface EditLabelState {
    isEditing: boolean;
    labelId: string;
    originalText: string;
    currentText: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    validationResult?: LabelValidationResult;
}

/**
 * Sanyam Edit Label UI Extension.
 *
 * Provides inline editing for labels with:
 * - Theia-styled input field
 * - Inline validation feedback
 * - Keyboard handling (Enter to apply, Escape to cancel)
 */
@injectable()
export class SanyamEditLabelUI extends AbstractUIExtension {
    protected override readonly logger = createLogger({ name: 'EditLabelUi' });

    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Current edit label state */
    protected editLabelState: EditLabelState = {
        isEditing: false,
        labelId: '',
        originalText: '',
        currentText: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 24 },
    };

    /** Input element */
    protected inputElement: HTMLInputElement | undefined;

    /** Validation message element */
    protected validationElement: HTMLElement | undefined;

    /** Current model reference */
    protected model: SModelRootImpl | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    /** Validation debounce timer */
    protected validationTimer: ReturnType<typeof setTimeout> | undefined;

    id(): string {
        return EDIT_LABEL_ID;
    }

    containerClass(): string {
        return EditLabelClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        if (this.parentContainerElement) {
            return this.parentContainerElement;
        }

        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container?.parentElement) {
                return container.parentElement;
            }
        }

        return undefined;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // Position absolutely over the label
        containerElement.style.position = 'absolute';
        containerElement.style.display = 'none';
        containerElement.style.zIndex = '1000';

        // Create input element
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.className = EditLabelClasses.INPUT;
        this.inputElement.addEventListener('input', () => this.handleInput());
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.inputElement.addEventListener('blur', () => this.handleBlur());
        containerElement.appendChild(this.inputElement);

        // Create validation message element
        this.validationElement = document.createElement('div');
        this.validationElement.className = EditLabelClasses.VALIDATION_MESSAGE;
        this.validationElement.style.display = 'none';
        containerElement.appendChild(this.validationElement);
    }

    /**
     * Start editing a label.
     */
    startEditing(labelId: string): void {
        // Find the label element
        const labelElement = this.findLabelElement(labelId);
        if (!labelElement) {
            this.logger.warn({ labelId }, 'Label element not found');
            return;
        }

        // Get label text and position
        const text = this.getLabelText(labelElement);
        const position = this.getLabelPosition(labelElement);
        const size = this.getLabelSize(labelElement);

        // Update state
        this.editLabelState = {
            isEditing: true,
            labelId,
            originalText: text,
            currentText: text,
            position,
            size,
        };

        // Position and show the input
        this.positionInput(position, size);

        // Set input value and show
        if (this.inputElement) {
            this.inputElement.value = text;
            this.inputElement.style.fontFamily = this.getLabelFontFamily(labelElement);
            this.inputElement.style.fontSize = this.getLabelFontSize(labelElement);
        }

        this.show();

        // Focus and select all
        setTimeout(() => {
            if (this.inputElement) {
                this.inputElement.focus();
                this.inputElement.select();
            }
        }, 0);
    }

    /**
     * Find the SVG label element.
     */
    protected findLabelElement(labelId: string): SVGTextElement | undefined {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            this.logger.debug('SVG container not found');
            return undefined;
        }

        // Try multiple selectors to find the text element
        // 1. Direct text element with the ID
        let element = svgContainer.querySelector(`text#${CSS.escape(labelId)}`) as SVGTextElement | null;
        if (element) {
            return element;
        }

        // 2. Text element inside an element with the ID (common Sprotty pattern)
        element = svgContainer.querySelector(`#${CSS.escape(labelId)} text`) as SVGTextElement | null;
        if (element) {
            return element;
        }

        // 3. Group element with the ID containing text
        element = svgContainer.querySelector(`g#${CSS.escape(labelId)} text`) as SVGTextElement | null;
        if (element) {
            return element;
        }

        // 4. Any element with ID containing 'label' and the labelId
        element = svgContainer.querySelector(`[id*="${labelId}"] text`) as SVGTextElement | null;
        if (element) {
            return element;
        }

        this.logger.debug({ labelId }, 'Could not find text element for label');
        return undefined;
    }

    /**
     * Find the SVG container.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                // Try to find any SVG element in the container
                const svg = container.querySelector('svg') as SVGSVGElement;
                if (svg) {
                    return svg;
                }
            }
        }

        // Fallback: search in parent container
        const parent = this.getParentContainer();
        if (parent) {
            const svg = parent.querySelector('svg') as SVGSVGElement;
            if (svg) {
                return svg;
            }
        }

        return undefined;
    }

    /**
     * Get the text content of a label.
     */
    protected getLabelText(element: SVGTextElement): string {
        return element.textContent || '';
    }

    /**
     * Get the position of a label.
     */
    protected getLabelPosition(element: SVGTextElement): { x: number; y: number } {
        try {
            const bbox = element.getBBox();
            const ctm = element.getCTM();
            const svg = element.ownerSVGElement;

            if (!ctm || !svg) {
                return { x: bbox.x, y: bbox.y };
            }

            const point = svg.createSVGPoint();
            point.x = bbox.x;
            point.y = bbox.y;
            const transformed = point.matrixTransform(ctm);

            // Adjust for SVG container position
            const svgRect = svg.getBoundingClientRect();
            const parentRect = this.getParentContainer()?.getBoundingClientRect();

            if (parentRect) {
                return {
                    x: transformed.x + svgRect.left - parentRect.left,
                    y: transformed.y + svgRect.top - parentRect.top,
                };
            }

            return { x: transformed.x, y: transformed.y };
        } catch (e) {
            this.logger.warn({ err: e }, 'Could not get label position');
            return { x: 0, y: 0 };
        }
    }

    /**
     * Get the size of a label.
     */
    protected getLabelSize(element: SVGTextElement): { width: number; height: number } {
        try {
            const bbox = element.getBBox();
            return {
                width: Math.max(bbox.width + 20, 100), // Minimum width with padding
                height: Math.max(bbox.height + 4, 24), // Minimum height
            };
        } catch (e) {
            return { width: 100, height: 24 };
        }
    }

    /**
     * Get the font family of a label.
     */
    protected getLabelFontFamily(element: SVGTextElement): string {
        const computed = getComputedStyle(element);
        return computed.fontFamily || 'var(--theia-ui-font-family)';
    }

    /**
     * Get the font size of a label.
     */
    protected getLabelFontSize(element: SVGTextElement): string {
        const computed = getComputedStyle(element);
        return computed.fontSize || '12px';
    }

    /**
     * Position the input over the label.
     */
    protected positionInput(position: { x: number; y: number }, size: { width: number; height: number }): void {
        if (!this.containerElement) {
            return;
        }

        this.containerElement.style.left = `${position.x}px`;
        this.containerElement.style.top = `${position.y}px`;

        if (this.inputElement) {
            this.inputElement.style.width = `${size.width}px`;
            this.inputElement.style.height = `${size.height}px`;
        }
    }

    /**
     * Handle input change.
     */
    protected handleInput(): void {
        if (!this.inputElement) {
            return;
        }

        this.editLabelState.currentText = this.inputElement.value;

        // Debounced validation
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }

        this.validationTimer = setTimeout(() => {
            this.validateInput();
        }, 300);
    }

    /**
     * Handle key down events.
     */
    protected handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.applyEdit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelEdit();
        }
    }

    /**
     * Handle blur event.
     */
    protected handleBlur(): void {
        // Delay to allow button clicks to process
        setTimeout(() => {
            if (this.editLabelState.isEditing) {
                this.applyEdit();
            }
        }, 100);
    }

    /**
     * Validate the input.
     */
    protected validateInput(): void {
        const text = this.editLabelState.currentText;

        // Basic validation - can be extended
        let result: LabelValidationResult = { valid: true };

        if (text.trim().length === 0) {
            result = {
                valid: false,
                message: 'Label cannot be empty',
                severity: 'error',
            };
        }

        this.setValidationResult(result);
    }

    /**
     * Set the validation result.
     */
    setValidationResult(result: LabelValidationResult): void {
        this.editLabelState.validationResult = result;
        this.updateValidationUI();
    }

    /**
     * Update the validation UI.
     */
    protected updateValidationUI(): void {
        if (!this.inputElement || !this.validationElement) {
            return;
        }

        const result = this.editLabelState.validationResult;

        // Clear previous state
        this.inputElement.classList.remove(EditLabelClasses.INPUT_ERROR, EditLabelClasses.INPUT_WARNING);

        if (result && !result.valid) {
            // Show validation error/warning
            if (result.severity === 'error') {
                this.inputElement.classList.add(EditLabelClasses.INPUT_ERROR);
            } else if (result.severity === 'warning') {
                this.inputElement.classList.add(EditLabelClasses.INPUT_WARNING);
            }

            if (result.message) {
                this.validationElement.textContent = result.message;
                this.validationElement.className = `${EditLabelClasses.VALIDATION_MESSAGE} ${result.severity || 'error'}`;
                this.validationElement.style.display = 'block';
            }
        } else {
            this.validationElement.style.display = 'none';
        }
    }

    /**
     * Apply the edit.
     */
    applyEdit(): void {
        if (!this.editLabelState.isEditing) {
            return;
        }

        const { labelId, originalText, currentText, validationResult } = this.editLabelState;

        // Check validation
        if (validationResult && !validationResult.valid && validationResult.severity === 'error') {
            // Don't apply if there's a validation error
            return;
        }

        // Only apply if text changed
        if (currentText !== originalText) {
            this.dispatch(ApplyLabelEditAction.create(labelId, currentText));
        }

        this.completeEdit(true, currentText);
    }

    /**
     * Cancel the edit.
     */
    cancelEdit(): void {
        if (!this.editLabelState.isEditing) {
            return;
        }

        this.dispatch(CancelLabelEditAction.create(this.editLabelState.labelId));
        this.completeEdit(false);
    }

    /**
     * Complete the editing session.
     */
    protected completeEdit(applied: boolean, newText?: string): void {
        const labelId = this.editLabelState.labelId;

        // Reset state
        this.editLabelState = {
            isEditing: false,
            labelId: '',
            originalText: '',
            currentText: '',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 24 },
        };

        // Hide UI
        this.hide();

        // Clear validation
        if (this.inputElement) {
            this.inputElement.classList.remove(EditLabelClasses.INPUT_ERROR, EditLabelClasses.INPUT_WARNING);
        }
        if (this.validationElement) {
            this.validationElement.style.display = 'none';
        }

        // Dispatch completion
        this.dispatch(EditLabelCompleteAction.create(labelId, applied, newText));
    }

    /**
     * Check if currently editing.
     */
    isEditing(): boolean {
        return this.editLabelState.isEditing;
    }

    /**
     * Get the current label being edited.
     */
    getCurrentLabelId(): string | undefined {
        return this.editLabelState.isEditing ? this.editLabelState.labelId : undefined;
    }

    /**
     * Called on model change.
     */
    override modelChanged(model: SModelRootImpl): void {
        this.model = model;

        // Cancel editing if the edited label is removed
        if (this.editLabelState.isEditing) {
            const labelElement = this.findLabelElement(this.editLabelState.labelId);
            if (!labelElement) {
                this.cancelEdit();
            }
        }
    }

    /**
     * Dispose the extension.
     */
    override dispose(): void {
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }
        super.dispose();
    }
}
