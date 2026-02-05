/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Quick Menu Action Handler
 *
 * Handles quick menu actions including showing/hiding the menu
 * and creating elements from item selection.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { createLogger } from '@sanyam/logger';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';
import {
    ShowQuickMenuAction,
    HideQuickMenuAction,
    FilterQuickMenuAction,
    NavigateQuickMenuAction,
    SelectQuickMenuItemAction,
} from './quick-menu-actions';
import { QuickMenuUIExtension, QUICK_MENU_ID, QuickMenuItem } from './quick-menu-ui-extension';
import { CreateElementAction } from '../tool-palette/tool-palette-actions';
import { DiagramLanguageClientProvider, ToolPaletteDataProvider } from '../tool-palette/tool-palette-action-handler';

/**
 * Quick Menu Action Handler.
 *
 * Handles all quick menu related actions:
 * - ShowQuickMenuAction: Shows the menu at the click position
 * - HideQuickMenuAction: Hides the menu
 * - SelectQuickMenuItemAction: Creates an element at the stored position
 */
@injectable()
export class QuickMenuActionHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'QuickMenuHandler' });

    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    @inject(TYPES.IActionDispatcher)
    protected readonly actionDispatcher: IActionDispatcher;

    @inject(DiagramLanguageClientProvider) @optional()
    protected readonly languageClientProvider?: ToolPaletteDataProvider;

    /** Current document URI */
    protected currentUri: string = '';

    /** Cached element items for quick menu */
    protected cachedItems: QuickMenuItem[] = [];

    /**
     * Set the current document URI for fetching palette data.
     */
    setCurrentUri(uri: string): void {
        this.currentUri = uri;
        // Refresh items when URI changes
        this.refreshItems();
    }

    /**
     * Handle an action.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case ShowQuickMenuAction.KIND:
                this.handleShowQuickMenu(action as ShowQuickMenuAction);
                break;
            case HideQuickMenuAction.KIND:
                this.handleHideQuickMenu();
                break;
            case SelectQuickMenuItemAction.KIND:
                this.handleSelectItem(action as SelectQuickMenuItemAction);
                break;
            case FilterQuickMenuAction.KIND:
                // Handled directly by QuickMenuUIExtension
                break;
            case NavigateQuickMenuAction.KIND:
                // Handled directly by QuickMenuUIExtension
                break;
        }
    }

    /**
     * Handle show quick menu action.
     */
    protected async handleShowQuickMenu(action: ShowQuickMenuAction): Promise<void> {
        const extension = this.getQuickMenuExtension();
        if (!extension) {
            this.logger.warn('Quick menu extension not found');
            return;
        }

        // Ensure we have items
        if (this.cachedItems.length === 0) {
            await this.refreshItems();
        }

        // Set items and show menu
        extension.setItems(this.cachedItems);
        extension.showAt(action.modelPosition, action.screenPosition);

        this.logger.info({ position: action.screenPosition }, 'Showing quick menu');
    }

    /**
     * Handle hide quick menu action.
     */
    protected handleHideQuickMenu(): void {
        const extension = this.getQuickMenuExtension();
        if (extension) {
            extension.hide();
            this.logger.debug('Quick menu hidden');
        }
    }

    /**
     * Handle item selection - create the element.
     */
    protected handleSelectItem(action: SelectQuickMenuItemAction): void {
        const extension = this.getQuickMenuExtension();
        if (!extension) {
            this.logger.warn('Quick menu extension not found for item selection');
            return;
        }

        const modelPosition = extension.getModelPosition();
        this.logger.info({ elementTypeId: action.elementTypeId, position: modelPosition }, 'Creating element from quick menu');

        // Dispatch create element action
        this.actionDispatcher.dispatch(
            CreateElementAction.createNode(action.elementTypeId, modelPosition)
        );
    }

    /**
     * Refresh the cached items from the language client.
     */
    protected async refreshItems(): Promise<void> {
        if (!this.languageClientProvider || !this.currentUri) {
            // Use fallback items if no provider
            this.cachedItems = this.getDefaultItems();
            return;
        }

        try {
            const response = await this.languageClientProvider.getToolPalette(this.currentUri);
            this.cachedItems = this.convertToQuickMenuItems(response.groups);
            this.logger.debug({ itemCount: this.cachedItems.length }, 'Refreshed quick menu items');
        } catch (error) {
            this.logger.error({ error }, 'Failed to fetch tool palette for quick menu');
            this.cachedItems = this.getDefaultItems();
        }
    }

    /**
     * Convert tool palette groups to quick menu items.
     * Server uses 'children' (not 'items') and 'action' (not 'toolAction').
     */
    protected convertToQuickMenuItems(groups: any[]): QuickMenuItem[] {
        const items: QuickMenuItem[] = [];

        for (const group of groups) {
            const children = group.children || group.items;
            if (!children) {
                continue;
            }

            for (const item of children) {
                const action = item.action || item.toolAction;
                // Only include items that create nodes (not edges)
                // Support both hyphenated (server) and camelCase formats
                if (action?.kind === 'create-node' || action?.kind === 'createNode') {
                    items.push({
                        id: item.id,
                        label: item.label,
                        icon: item.icon,
                        elementTypeId: action.elementTypeId || item.id,
                    });
                }
            }
        }

        return items;
    }

    /**
     * Get default items when no language client is available.
     */
    protected getDefaultItems(): QuickMenuItem[] {
        // Return empty - no default items without grammar context
        return [];
    }

    /**
     * Get the quick menu UI extension.
     */
    protected getQuickMenuExtension(): QuickMenuUIExtension | undefined {
        return this.uiExtensionRegistry?.get(QUICK_MENU_ID) as QuickMenuUIExtension | undefined;
    }
}
