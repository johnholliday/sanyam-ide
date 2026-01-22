/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Minimap Action Handler
 *
 * Handles minimap-related actions like toggle and viewport updates.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand, TYPES, IActionDispatcher } from 'sprotty';
import { Action, SetViewportAction } from 'sprotty-protocol';
import {
    MinimapUIExtension,
    ToggleMinimapAction,
    SetViewportFromMinimapAction,
    MINIMAP_ID,
} from './minimap-ui-extension';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Action handler for minimap operations.
 */
@injectable()
export class MinimapActionHandler implements IActionHandler {
    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    /**
     * Handle minimap actions.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case ToggleMinimapAction.KIND:
                this.handleToggleMinimap(action as ToggleMinimapAction);
                break;
            case SetViewportFromMinimapAction.KIND:
                this.handleSetViewportFromMinimap(action as SetViewportFromMinimapAction);
                break;
        }
    }

    /**
     * Get the minimap extension.
     */
    protected getMinimapExtension(): MinimapUIExtension | undefined {
        if (this.uiExtensionRegistry) {
            return this.uiExtensionRegistry.get(MINIMAP_ID) as MinimapUIExtension | undefined;
        }
        return undefined;
    }

    /**
     * Handle toggle minimap action.
     */
    protected handleToggleMinimap(action: ToggleMinimapAction): void {
        const minimap = this.getMinimapExtension();
        if (minimap) {
            console.info('[MinimapActionHandler] Toggling minimap');
            // Ensure the minimap has a parent container before toggling
            if (!minimap['parentContainerElement']) {
                // Try to find the diagram container
                const diagramContainer = document.querySelector('.sprotty-graph')?.parentElement?.parentElement;
                if (diagramContainer instanceof HTMLElement) {
                    console.info('[MinimapActionHandler] Setting parent container from DOM');
                    minimap.setParentContainer(diagramContainer);
                }
            }
            // Force an update after toggle
            minimap.toggleMinimap();
            minimap.updateMinimap();
        } else {
            console.warn('[MinimapActionHandler] Minimap extension not found');
        }
    }

    /**
     * Handle set viewport from minimap action.
     */
    protected handleSetViewportFromMinimap(action: SetViewportFromMinimapAction): void {
        console.info('[MinimapActionHandler] Setting viewport from minimap:', action.scroll, action.zoom);

        // Dispatch a Sprotty SetViewportAction to actually change the viewport
        const viewportAction = SetViewportAction.create('viewport', {
            scroll: action.scroll,
            zoom: action.zoom,
        }, { animate: true });

        this.actionDispatcher.dispatch(viewportAction);
    }
}
