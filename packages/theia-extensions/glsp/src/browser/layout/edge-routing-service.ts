/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Edge Routing Service
 *
 * Central service for managing the global edge routing mode.
 * Maps between UI mode names, ELK layout options, and sprotty router kinds.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';

/**
 * Available edge routing modes.
 */
export type EdgeRoutingMode = 'orthogonal' | 'straight' | 'bezier';

/**
 * Service identifier for EdgeRoutingService.
 */
export const EdgeRoutingServiceSymbol = Symbol.for('EdgeRoutingService');

/**
 * Central service holding the current edge routing mode.
 *
 * Injected into the layout configurator, command handler, and toolbar contribution
 * to coordinate edge routing across ELK layout and sprotty rendering.
 */
@injectable()
export class EdgeRoutingService {
    private _currentMode: EdgeRoutingMode = 'orthogonal';

    /**
     * Get the current edge routing mode.
     */
    get currentMode(): EdgeRoutingMode {
        return this._currentMode;
    }

    /**
     * Set the edge routing mode.
     *
     * @param mode - The new routing mode
     * @returns The mode that was set
     */
    setMode(mode: EdgeRoutingMode): EdgeRoutingMode {
        this._currentMode = mode;
        return mode;
    }

    /**
     * Get the ELK `elk.edgeRouting` value for the current mode.
     */
    getElkEdgeRouting(): string {
        switch (this._currentMode) {
            case 'orthogonal':
                return 'ORTHOGONAL';
            case 'straight':
                return 'POLYLINE';
            case 'bezier':
                return 'SPLINES';
        }
    }

    private _edgeJumpsEnabled = false;

    /**
     * Get whether edge jumps (line bridges) are enabled.
     */
    get edgeJumpsEnabled(): boolean {
        return this._edgeJumpsEnabled;
    }

    /**
     * Set whether edge jumps (line bridges) are enabled.
     *
     * @param enabled - Whether to enable edge jumps
     */
    setEdgeJumpsEnabled(enabled: boolean): void {
        this._edgeJumpsEnabled = enabled;
    }

    private _arrowheadsVisible = true;

    /**
     * Get whether edge arrowheads are visible.
     */
    get arrowheadsVisible(): boolean {
        return this._arrowheadsVisible;
    }

    /**
     * Set whether edge arrowheads are visible.
     *
     * @param visible - Whether arrowheads should be displayed
     */
    setArrowheadsVisible(visible: boolean): void {
        this._arrowheadsVisible = visible;
    }

    /**
     * Get the sprotty `routerKind` value for the current mode.
     */
    getSprottyRouterKind(): string {
        switch (this._currentMode) {
            case 'orthogonal':
                return 'manhattan';
            case 'straight':
                return 'polyline';
            case 'bezier':
                return 'bezier';
        }
    }
}
