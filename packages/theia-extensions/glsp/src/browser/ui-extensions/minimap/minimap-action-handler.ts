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
            default:
                console.warn('[MinimapActionHandler] Unknown action kind:', action.kind);
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
            // Ensure the minimap has a parent container before toggling
            if (!minimap['parentContainerElement']) {
                // Try multiple selectors to find the diagram container
                const containerSelectors = [
                    '.sanyam-diagram-svg-container',
                    '.sprotty-graph',
                    '[class*="diagram-container"]',
                ];

                for (const selector of containerSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        // Get the parent widget container
                        let container = element.parentElement;
                        while (container && !container.classList.contains('theia-widget') && container.parentElement) {
                            container = container.parentElement;
                        }
                        if (container instanceof HTMLElement) {
                            minimap.setParentContainer(container);
                            break;
                        }
                    }
                }
            }

            // Toggle and force update
            minimap.toggleMinimap();

            // Force update after a delay to ensure DOM is ready
            setTimeout(() => {
                if ('forceUpdate' in minimap) {
                    (minimap as MinimapUIExtension).forceUpdate();
                } else if ('updateMinimap' in minimap) {
                    (minimap as MinimapUIExtension).updateMinimap();
                }
            }, 100);
        } else {
            console.warn('[MinimapActionHandler] Minimap extension not found');
        }
    }

    /**
     * Handle set viewport from minimap action.
     */
    protected handleSetViewportFromMinimap(action: SetViewportFromMinimapAction): void {
        // Find the Sprotty model root element ID
        const elementId = this.findSprottyRootId();
        if (!elementId) {
            console.warn('[MinimapActionHandler] Could not find Sprotty root element ID');
            return;
        }

        // Dispatch a Sprotty SetViewportAction to actually change the viewport
        const viewportAction = SetViewportAction.create(elementId, {
            scroll: action.scroll,
            zoom: action.zoom,
        }, { animate: true });

        this.actionDispatcher.dispatch(viewportAction);
    }

    /**
     * Find the Sprotty model root element ID.
     */
    protected findSprottyRootId(): string | undefined {
        // Try to find the SVG element with sprotty-graph class
        const svg = document.querySelector('svg.sprotty-graph');
        if (svg) {
            // The SVG ID typically contains the root element ID
            // Format: sprotty-{widget-id}_root_{uri}
            const svgId = svg.id;
            if (svgId) {
                // Extract the part after the last underscore-separated segment that contains 'root'
                const rootMatch = svgId.match(/^(.+_root)/);
                if (rootMatch) {
                    return rootMatch[1];
                }
                // If no 'root' in ID, use the SVG ID directly
                return svgId;
            }
        }

        // Try to find by looking for the main graph group
        const graphGroup = document.querySelector('g[id$="_root"]') as SVGGElement;
        if (graphGroup?.id) {
            return graphGroup.id;
        }

        // Fallback: look for any element with sprotty in the ID ending with _root
        const rootElement = document.querySelector('[id*="sprotty"][id$="_root"]');
        if (rootElement?.id) {
            return rootElement.id;
        }

        return undefined;
    }
}
