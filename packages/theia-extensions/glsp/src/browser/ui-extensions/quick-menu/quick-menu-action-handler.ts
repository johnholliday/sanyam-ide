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

/**
 * Symbol for quick menu data provider (bound in Theia container).
 */
export const QuickMenuDataProvider = Symbol.for('QuickMenuDataProvider');

/**
 * Interface for providing quick menu data.
 */
export interface IQuickMenuDataProvider {
    getItems(): QuickMenuItem[];
    createElementAt(elementTypeId: string, position: { x: number; y: number }): Promise<void>;
}

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

    @inject(QuickMenuDataProvider) @optional()
    protected readonly dataProvider?: IQuickMenuDataProvider;

    /** Cached element items for quick menu */
    protected cachedItems: QuickMenuItem[] = [];

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

        // Get items from data provider if available
        if (this.dataProvider) {
            this.cachedItems = this.dataProvider.getItems();
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
    protected async handleSelectItem(action: SelectQuickMenuItemAction): Promise<void> {
        const extension = this.getQuickMenuExtension();
        if (!extension) {
            this.logger.warn('Quick menu extension not found for item selection');
            return;
        }

        const modelPosition = extension.getModelPosition();
        this.logger.info({ elementTypeId: action.elementTypeId, position: modelPosition }, 'Creating element from quick menu');

        // Create element via data provider if available
        if (this.dataProvider) {
            try {
                await this.dataProvider.createElementAt(action.elementTypeId, modelPosition);
            } catch (error) {
                this.logger.error({ error }, 'Failed to create element from quick menu');
            }
        } else {
            this.logger.warn('No data provider available for element creation');
        }
    }

    /**
     * Get the quick menu UI extension.
     */
    protected getQuickMenuExtension(): QuickMenuUIExtension | undefined {
        return this.uiExtensionRegistry?.get(QUICK_MENU_ID) as QuickMenuUIExtension | undefined;
    }
}
