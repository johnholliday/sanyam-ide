/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Edit Label Actions
 *
 * Actions for inline label editing in diagrams.
 *
 * @packageDocumentation
 */

import { Action } from 'sprotty-protocol';

/**
 * Edit label action.
 * Activates inline editing for a label.
 */
export interface EditLabelAction extends Action {
    kind: 'editLabel';
    labelId: string;
}

export namespace EditLabelAction {
    export const KIND = 'editLabel';

    export function create(labelId: string): EditLabelAction {
        return { kind: KIND, labelId };
    }
}

/**
 * Apply label edit action.
 * Applies the edited label value.
 */
export interface ApplyLabelEditAction extends Action {
    kind: 'applyLabelEdit';
    labelId: string;
    newText: string;
}

export namespace ApplyLabelEditAction {
    export const KIND = 'applyLabelEdit';

    export function create(labelId: string, newText: string): ApplyLabelEditAction {
        return { kind: KIND, labelId, newText };
    }
}

/**
 * Cancel label edit action.
 * Cancels the current label editing.
 */
export interface CancelLabelEditAction extends Action {
    kind: 'cancelLabelEdit';
    labelId: string;
}

export namespace CancelLabelEditAction {
    export const KIND = 'cancelLabelEdit';

    export function create(labelId: string): CancelLabelEditAction {
        return { kind: KIND, labelId };
    }
}

/**
 * Validation result for label edit.
 */
export interface LabelValidationResult {
    valid: boolean;
    message?: string;
    severity?: 'error' | 'warning' | 'info';
}

/**
 * Validate label edit action.
 * Validates the label value during editing.
 */
export interface ValidateLabelEditAction extends Action {
    kind: 'validateLabelEdit';
    labelId: string;
    text: string;
}

export namespace ValidateLabelEditAction {
    export const KIND = 'validateLabelEdit';

    export function create(labelId: string, text: string): ValidateLabelEditAction {
        return { kind: KIND, labelId, text };
    }
}

/**
 * Set label validation result action.
 */
export interface SetLabelValidationResultAction extends Action {
    kind: 'setLabelValidationResult';
    labelId: string;
    result: LabelValidationResult;
}

export namespace SetLabelValidationResultAction {
    export const KIND = 'setLabelValidationResult';

    export function create(labelId: string, result: LabelValidationResult): SetLabelValidationResultAction {
        return { kind: KIND, labelId, result };
    }
}

/**
 * Edit label complete action.
 * Fired when label editing is complete (applied or cancelled).
 */
export interface EditLabelCompleteAction extends Action {
    kind: 'editLabelComplete';
    labelId: string;
    applied: boolean;
    newText?: string;
}

export namespace EditLabelCompleteAction {
    export const KIND = 'editLabelComplete';

    export function create(labelId: string, applied: boolean, newText?: string): EditLabelCompleteAction {
        return { kind: KIND, labelId, applied, newText };
    }
}
