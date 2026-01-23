/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Validation Actions
 *
 * Actions for diagram validation and marker display.
 *
 * @packageDocumentation
 */

import { Action } from 'sprotty-protocol';

/**
 * Marker severity levels.
 */
export type MarkerSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Validation marker for a diagram element.
 */
export interface ValidationMarker {
    /** Element ID the marker is attached to */
    elementId: string;
    /** Marker severity */
    severity: MarkerSeverity;
    /** Marker message */
    message: string;
    /** Optional code for the marker (e.g., error code) */
    code?: string;
    /** Optional source (e.g., validator name) */
    source?: string;
}

/**
 * Request validation action.
 * Triggers validation of the diagram model.
 */
export interface RequestValidationAction extends Action {
    kind: 'requestValidation';
    uri: string;
}

export namespace RequestValidationAction {
    export const KIND = 'requestValidation';

    export function create(uri: string): RequestValidationAction {
        return { kind: KIND, uri };
    }
}

/**
 * Set markers action.
 * Sets validation markers on diagram elements.
 */
export interface SetMarkersAction extends Action {
    kind: 'setMarkers';
    markers: ValidationMarker[];
    /** If true, replaces all existing markers; if false, merges */
    replace?: boolean;
}

export namespace SetMarkersAction {
    export const KIND = 'setMarkers';

    export function create(markers: ValidationMarker[], replace: boolean = true): SetMarkersAction {
        return { kind: KIND, markers, replace };
    }

    export function clear(): SetMarkersAction {
        return { kind: KIND, markers: [], replace: true };
    }
}

/**
 * Clear markers action.
 * Clears all validation markers.
 */
export interface ClearMarkersAction extends Action {
    kind: 'clearMarkers';
    /** Optional: only clear markers for specific elements */
    elementIds?: string[];
}

export namespace ClearMarkersAction {
    export const KIND = 'clearMarkers';

    export function create(elementIds?: string[]): ClearMarkersAction {
        return { kind: KIND, elementIds };
    }
}

/**
 * Validation result.
 */
export interface ValidationResult {
    isValid: boolean;
    markers: ValidationMarker[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
}

/**
 * Validation completed action.
 * Sent when validation is complete.
 */
export interface ValidationCompletedAction extends Action {
    kind: 'validationCompleted';
    uri: string;
    result: ValidationResult;
}

export namespace ValidationCompletedAction {
    export const KIND = 'validationCompleted';

    export function create(uri: string, result: ValidationResult): ValidationCompletedAction {
        return { kind: KIND, uri, result };
    }
}

/**
 * Navigate to marker action.
 * Navigates to a specific marker location.
 */
export interface NavigateToMarkerAction extends Action {
    kind: 'navigateToMarker';
    elementId: string;
    markerId?: string;
}

export namespace NavigateToMarkerAction {
    export const KIND = 'navigateToMarker';

    export function create(elementId: string, markerId?: string): NavigateToMarkerAction {
        return { kind: KIND, elementId, markerId };
    }
}

/**
 * Show marker details action.
 * Shows detailed information about a marker.
 */
export interface ShowMarkerDetailsAction extends Action {
    kind: 'showMarkerDetails';
    marker: ValidationMarker;
    position: { x: number; y: number };
}

export namespace ShowMarkerDetailsAction {
    export const KIND = 'showMarkerDetails';

    export function create(marker: ValidationMarker, position: { x: number; y: number }): ShowMarkerDetailsAction {
        return { kind: KIND, marker, position };
    }
}
