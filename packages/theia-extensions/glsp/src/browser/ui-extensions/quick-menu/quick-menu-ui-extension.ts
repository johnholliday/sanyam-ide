/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Quick Menu UI Extension
 *
 * A Sprotty UI extension that renders the quick menu popup when
 * the user double-clicks on empty canvas space.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { IActionDispatcher, TYPES } from 'sprotty';
import { Point } from 'sprotty-protocol';
import { createLogger } from '@sanyam/logger';
import { AbstractUIExtension } from '../base-ui-extension';
import {
    HideQuickMenuAction,
    SelectQuickMenuItemAction,
} from './quick-menu-actions';

/**
 * Quick Menu UI Extension ID.
 */
export const QUICK_MENU_ID = 'quick-menu';

/**
 * Quick menu item data.
 */
export interface QuickMenuItem {
    id: string;
    label: string;
    icon?: string;
    elementTypeId: string;
}

/**
 * Quick Menu UI Extension.
 *
 * Renders a floating menu at the double-click position with a list
 * of element types that can be created. Supports:
 * - Keyboard navigation (up/down arrows)
 * - Search filtering (type to filter)
 * - Enter to select, Escape to close
 * - Click outside to close
 */
@injectable()
export class QuickMenuUIExtension extends AbstractUIExtension {
    protected readonly logger = createLogger({ name: 'QuickMenu' });
    static readonly ID = QUICK_MENU_ID;

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    /** Menu container element */
    protected menuContainer: HTMLDivElement | null = null;

    /** Search input element */
    protected searchInput: HTMLInputElement | null = null;

    /** Items list element */
    protected itemsList: HTMLDivElement | null = null;

    /** Current model position for element creation */
    protected modelPosition: Point = { x: 0, y: 0 };

    /** Available items to display */
    protected items: QuickMenuItem[] = [];

    /** Filtered items based on search */
    protected filteredItems: QuickMenuItem[] = [];

    /** Currently selected item index */
    protected selectedIndex: number = 0;

    /** Current search query */
    protected searchQuery: string = '';

    /** Bound event handlers for cleanup */
    protected boundKeyHandler: ((event: KeyboardEvent) => void) | null = null;
    protected boundClickOutsideHandler: ((event: MouseEvent) => void) | null = null;

    /** Parent container element */
    protected parentContainerElement: HTMLElement | undefined;

    override id(): string {
        return QuickMenuUIExtension.ID;
    }

    override containerClass(): string {
        return 'sanyam-quick-menu-container';
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        return this.parentContainerElement;
    }

    /**
     * Set the available items for the quick menu.
     * Should be called with tool palette data.
     */
    setItems(items: QuickMenuItem[]): void {
        this.items = items;
        this.filteredItems = items;
        this.selectedIndex = 0;
    }

    /**
     * Show the quick menu at the specified position.
     */
    showAt(modelPosition: Point, screenPosition: Point): void {
        this.modelPosition = modelPosition;
        this.searchQuery = '';
        this.filteredItems = this.items;
        this.selectedIndex = 0;

        this.show();

        // Position the menu at screen coordinates
        if (this.menuContainer) {
            this.menuContainer.style.left = `${screenPosition.x}px`;
            this.menuContainer.style.top = `${screenPosition.y}px`;

            // Render content
            this.renderMenu();

            // Focus search input
            setTimeout(() => {
                this.searchInput?.focus();
            }, 10);
        }

        // Add event listeners
        this.addGlobalListeners();
    }

    override hide(): void {
        super.hide();
        this.removeGlobalListeners();
    }

    protected override initializeContents(containerElement: HTMLElement): void {
        this.menuContainer = document.createElement('div');
        this.menuContainer.className = 'sanyam-quick-menu';
        containerElement.appendChild(this.menuContainer);
    }

    /**
     * Render the menu contents.
     */
    protected renderMenu(): void {
        if (!this.menuContainer) {
            return;
        }

        this.menuContainer.innerHTML = '';

        // Search input
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'sanyam-quick-menu-search';
        this.searchInput.placeholder = 'Search elements...';
        this.searchInput.value = this.searchQuery;
        this.searchInput.addEventListener('input', this.handleSearchInput);
        this.menuContainer.appendChild(this.searchInput);

        // Items list
        this.itemsList = document.createElement('div');
        this.itemsList.className = 'sanyam-quick-menu-items';
        this.menuContainer.appendChild(this.itemsList);

        this.renderItems();
    }

    /**
     * Render the item list.
     */
    protected renderItems(): void {
        if (!this.itemsList) {
            return;
        }

        this.itemsList.innerHTML = '';

        if (this.filteredItems.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'sanyam-quick-menu-empty';
            emptyState.textContent = this.searchQuery ? 'No matching elements' : 'No elements available';
            this.itemsList.appendChild(emptyState);
            return;
        }

        this.filteredItems.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'sanyam-quick-menu-item';
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }

            // Icon
            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = `sanyam-quick-menu-item-icon codicon codicon-${item.icon}`;
                itemElement.appendChild(icon);
            } else {
                const icon = document.createElement('span');
                icon.className = 'sanyam-quick-menu-item-icon codicon codicon-symbol-misc';
                itemElement.appendChild(icon);
            }

            // Label
            const label = document.createElement('span');
            label.className = 'sanyam-quick-menu-item-label';
            label.textContent = item.label;
            itemElement.appendChild(label);

            // Keyboard hint for first item
            if (index === 0) {
                const hint = document.createElement('span');
                hint.className = 'sanyam-quick-menu-item-hint';
                hint.textContent = 'Enter';
                itemElement.appendChild(hint);
            }

            // Click handler
            itemElement.addEventListener('click', () => this.selectItem(item));
            itemElement.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.itemsList?.appendChild(itemElement);
        });
    }

    /**
     * Update the visual selection.
     */
    protected updateSelection(): void {
        if (!this.itemsList) {
            return;
        }

        const items = this.itemsList.querySelectorAll('.sanyam-quick-menu-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Handle search input changes.
     */
    protected handleSearchInput = (event: Event): void => {
        const target = event.target as HTMLInputElement;
        this.searchQuery = target.value.toLowerCase().trim();

        if (this.searchQuery) {
            this.filteredItems = this.items.filter(item =>
                item.label.toLowerCase().includes(this.searchQuery)
            );
        } else {
            this.filteredItems = this.items;
        }

        this.selectedIndex = 0;
        this.renderItems();
    };

    /**
     * Handle keyboard events.
     */
    protected handleKeyDown = (event: KeyboardEvent): void => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                this.close();
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.navigateDown();
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.navigateUp();
                break;

            case 'Enter':
                event.preventDefault();
                this.selectCurrentItem();
                break;
        }
    };

    /**
     * Handle clicks outside the menu.
     */
    protected handleClickOutside = (event: MouseEvent): void => {
        const target = event.target as Node;
        if (this.menuContainer && !this.menuContainer.contains(target)) {
            this.close();
        }
    };

    /**
     * Navigate selection down.
     */
    protected navigateDown(): void {
        if (this.filteredItems.length === 0) {
            return;
        }
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.updateSelection();
    }

    /**
     * Navigate selection up.
     */
    protected navigateUp(): void {
        if (this.filteredItems.length === 0) {
            return;
        }
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.updateSelection();
    }

    /**
     * Select the currently highlighted item.
     */
    protected selectCurrentItem(): void {
        if (this.filteredItems.length > 0 && this.selectedIndex < this.filteredItems.length) {
            this.selectItem(this.filteredItems[this.selectedIndex]);
        }
    }

    /**
     * Select an item and create the element.
     */
    protected selectItem(item: QuickMenuItem): void {
        this.logger.info({ elementTypeId: item.elementTypeId, position: this.modelPosition }, 'Selecting quick menu item');

        // Dispatch action to create element
        this.actionDispatcher.dispatch(SelectQuickMenuItemAction.create(item.elementTypeId));

        // Close the menu
        this.close();
    }

    /**
     * Close the quick menu.
     */
    protected close(): void {
        this.actionDispatcher.dispatch(HideQuickMenuAction.create());
    }

    /**
     * Add global event listeners.
     */
    protected addGlobalListeners(): void {
        const keyHandler = this.handleKeyDown.bind(this);
        const clickHandler = this.handleClickOutside.bind(this);

        this.boundKeyHandler = keyHandler;
        this.boundClickOutsideHandler = clickHandler;

        document.addEventListener('keydown', keyHandler, true);
        // Delay click outside handler to avoid immediate close
        setTimeout(() => {
            document.addEventListener('mousedown', clickHandler, true);
        }, 100);
    }

    /**
     * Remove global event listeners.
     */
    protected removeGlobalListeners(): void {
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler, true);
            this.boundKeyHandler = null;
        }
        if (this.boundClickOutsideHandler) {
            document.removeEventListener('mousedown', this.boundClickOutsideHandler, true);
            this.boundClickOutsideHandler = null;
        }
    }

    /**
     * Get the current model position for element creation.
     */
    getModelPosition(): Point {
        return this.modelPosition;
    }
}
