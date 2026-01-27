/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Snap Grid Action Handler
 *
 * Handles snap-to-grid actions dispatched from commands.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { SnapGridTool, SNAP_GRID_TOOL_ID } from './snap-grid-tool';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';
import type { ToggleSnapToGridAction, UpdateSnapGridConfigAction, ToggleGridVisibilityAction } from './snap-grid-types';

/**
 * Action kinds for snap-to-grid.
 */
export const ToggleSnapToGridActionKind = 'toggleSnapToGrid';
export const UpdateSnapGridConfigActionKind = 'updateSnapGridConfig';
export const ToggleGridVisibilityActionKind = 'toggleGridVisibility';

/**
 * Action handler for snap-to-grid actions.
 */
@injectable()
export class SnapGridActionHandler implements IActionHandler {
    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly registry?: UIExtensionRegistry;

    @inject(SnapGridTool) @optional()
    protected readonly snapGridTool?: SnapGridTool;

    /**
     * Handle snap-to-grid actions.
     */
    handle(action: Action): void | ICommand | Action {
        console.log('[SnapGridActionHandler] Received action:', action.kind);

        switch (action.kind) {
            case ToggleSnapToGridActionKind:
                this.handleToggleSnapToGrid(action as ToggleSnapToGridAction);
                break;
            case UpdateSnapGridConfigActionKind:
                this.handleUpdateConfig(action as UpdateSnapGridConfigAction);
                break;
            case ToggleGridVisibilityActionKind:
                this.handleToggleGridVisibility(action as ToggleGridVisibilityAction);
                break;
            default:
                console.log('[SnapGridActionHandler] Unknown action kind:', action.kind);
        }
    }

    /**
     * Get the SnapGridTool instance.
     */
    protected getSnapGridTool(): SnapGridTool | undefined {
        // Try direct injection first
        if (this.snapGridTool) {
            return this.snapGridTool;
        }

        // Fall back to registry
        if (this.registry) {
            const extension = this.registry.get(SNAP_GRID_TOOL_ID);
            if (extension instanceof SnapGridTool) {
                return extension;
            }
        }

        console.warn('[SnapGridActionHandler] SnapGridTool not found');
        return undefined;
    }

    /**
     * Handle toggle snap-to-grid action.
     */
    protected handleToggleSnapToGrid(action: ToggleSnapToGridAction): void {
        const tool = this.getSnapGridTool();
        if (!tool) {
            console.warn('[SnapGridActionHandler] Cannot toggle snap-to-grid - tool not available');
            return;
        }

        if (action.enabled !== undefined) {
            if (action.enabled) {
                tool.enable();
            } else {
                tool.disable();
            }
        } else {
            const newState = tool.toggle();
            console.info('[SnapGridActionHandler] Snap-to-grid toggled:', newState ? 'enabled' : 'disabled');
        }
    }

    /**
     * Handle update config action.
     */
    protected handleUpdateConfig(action: UpdateSnapGridConfigAction): void {
        const tool = this.getSnapGridTool();
        if (!tool) {
            console.warn('[SnapGridActionHandler] Cannot update config - tool not available');
            return;
        }

        tool.setConfig(action.config);
        console.info('[SnapGridActionHandler] Config updated:', action.config);
    }

    /**
     * Handle toggle grid visibility action.
     */
    protected handleToggleGridVisibility(action: ToggleGridVisibilityAction): void {
        const tool = this.getSnapGridTool();
        if (!tool) {
            console.warn('[SnapGridActionHandler] Cannot toggle grid visibility - tool not available');
            return;
        }

        if (action.visible !== undefined) {
            tool.setConfig({ showGrid: action.visible });
        } else {
            const newState = tool.toggleGridVisibility();
            console.info('[SnapGridActionHandler] Grid visibility toggled:', newState ? 'visible' : 'hidden');
        }
    }
}
