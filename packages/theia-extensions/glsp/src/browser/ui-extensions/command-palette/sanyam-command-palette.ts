/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Command Palette
 *
 * Quick command palette for diagram operations, accessible via Ctrl+Space.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import type { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';
import {
    CommandPaletteItem,
    CommandPaletteContext,
    CommandPaletteProvider,
    HideCommandPaletteAction,
    ExecuteCommandAction,
} from './command-palette-actions';
import { RequestLayoutAction } from '../../layout';

/**
 * Command Palette Extension ID.
 */
export const COMMAND_PALETTE_ID = 'sanyam-command-palette';

/**
 * CSS classes for command palette.
 */
export const CommandPaletteClasses = {
    CONTAINER: 'sanyam-command-palette',
    INPUT_CONTAINER: 'sanyam-command-palette-input-container',
    INPUT: 'sanyam-command-palette-input',
    RESULTS: 'sanyam-command-palette-results',
    RESULT_ITEM: 'sanyam-command-palette-item',
    RESULT_ITEM_SELECTED: 'selected',
    RESULT_ITEM_ICON: 'sanyam-command-palette-item-icon',
    RESULT_ITEM_CONTENT: 'sanyam-command-palette-item-content',
    RESULT_ITEM_LABEL: 'sanyam-command-palette-item-label',
    RESULT_ITEM_DESCRIPTION: 'sanyam-command-palette-item-description',
    RESULT_ITEM_SHORTCUT: 'sanyam-command-palette-item-shortcut',
    RESULT_CATEGORY: 'sanyam-command-palette-category',
    NO_RESULTS: 'sanyam-command-palette-no-results',
} as const;

/**
 * Sanyam Command Palette Extension.
 *
 * Provides quick access to diagram commands via a searchable palette.
 */
@injectable()
export class SanyamCommandPalette extends AbstractUIExtension {
    protected override readonly logger = createLogger({ name: 'CommandPalette' });

    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Command providers */
    protected providers: CommandPaletteProvider[] = [];

    /** All available items */
    protected allItems: CommandPaletteItem[] = [];

    /** Filtered items */
    protected filteredItems: CommandPaletteItem[] = [];

    /** Currently selected index */
    protected selectedIndex: number = 0;

    /** Current context */
    protected context: CommandPaletteContext = { selectedElementIds: [] };

    /** Input element */
    protected inputElement: HTMLInputElement | undefined;

    /** Results container */
    protected resultsContainer: HTMLElement | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return COMMAND_PALETTE_ID;
    }

    containerClass(): string {
        return CommandPaletteClasses.CONTAINER;
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
        // Position in center-top of diagram
        containerElement.style.position = 'absolute';
        containerElement.style.top = '50px';
        containerElement.style.left = '50%';
        containerElement.style.transform = 'translateX(-50%)';
        containerElement.style.zIndex = '2000';
        containerElement.style.minWidth = '400px';
        containerElement.style.maxWidth = '600px';

        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.className = CommandPaletteClasses.INPUT_CONTAINER;

        // Search input
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.placeholder = 'Type a command...';
        this.inputElement.className = CommandPaletteClasses.INPUT;
        this.inputElement.addEventListener('input', () => this.handleInput());
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        inputContainer.appendChild(this.inputElement);

        containerElement.appendChild(inputContainer);

        // Results container
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = CommandPaletteClasses.RESULTS;
        containerElement.appendChild(this.resultsContainer);

        // Handle click outside
        document.addEventListener('click', (e) => this.handleClickOutside(e));
    }

    /**
     * Register a command provider.
     */
    registerProvider(provider: CommandPaletteProvider): void {
        this.providers.push(provider);
    }

    /**
     * Unregister a command provider.
     */
    unregisterProvider(provider: CommandPaletteProvider): void {
        const index = this.providers.indexOf(provider);
        if (index !== -1) {
            this.providers.splice(index, 1);
        }
    }

    /**
     * Show the command palette.
     */
    showPalette(context: CommandPaletteContext = { selectedElementIds: [] }): void {
        this.context = context;

        // Collect items from all providers
        this.allItems = this.collectItems(context);

        // Add default items
        this.allItems = [...this.getDefaultItems(), ...this.allItems];

        // Sort by priority
        this.allItems.sort((a, b) => (a.sortPriority || 100) - (b.sortPriority || 100));

        // Reset state
        this.filteredItems = [...this.allItems];
        this.selectedIndex = 0;

        // Show and focus
        this.show();
        this.renderResults();

        setTimeout(() => {
            if (this.inputElement) {
                this.inputElement.value = '';
                this.inputElement.focus();
            }
        }, 0);
    }

    /**
     * Collect items from all providers.
     */
    protected collectItems(context: CommandPaletteContext): CommandPaletteItem[] {
        const items: CommandPaletteItem[] = [];
        for (const provider of this.providers) {
            items.push(...provider.getCommands(context));
        }
        return items;
    }

    /**
     * Get default command items.
     */
    protected getDefaultItems(): CommandPaletteItem[] {
        return [
            {
                id: 'selectAll',
                label: 'Select All',
                icon: 'codicon codicon-check-all',
                category: 'Selection',
                shortcut: 'Ctrl+A',
                action: { kind: 'allSelected', select: true } as Action,
                sortPriority: 10,
            },
            {
                id: 'deselectAll',
                label: 'Deselect All',
                icon: 'codicon codicon-close-all',
                category: 'Selection',
                shortcut: 'Escape',
                action: { kind: 'allSelected', select: false } as Action,
                sortPriority: 11,
            },
            {
                id: 'fitToScreen',
                label: 'Fit to Screen',
                icon: 'codicon codicon-screen-full',
                category: 'View',
                shortcut: 'Ctrl+Shift+F',
                action: { kind: 'fit', elementIds: [], padding: 20, animate: true } as Action,
                sortPriority: 20,
            },
            {
                id: 'center',
                label: 'Center Diagram',
                icon: 'codicon codicon-symbol-keyword',
                category: 'View',
                action: { kind: 'center', elementIds: [], animate: true, retainZoom: true } as Action,
                sortPriority: 21,
            },
            {
                id: 'zoomIn',
                label: 'Zoom In',
                icon: 'codicon codicon-zoom-in',
                category: 'View',
                shortcut: 'Ctrl++',
                action: { kind: 'viewport', elementId: 'graph', newViewport: { scroll: { x: 0, y: 0 }, zoom: 1.2 }, animate: true } as Action,
                sortPriority: 22,
            },
            {
                id: 'zoomOut',
                label: 'Zoom Out',
                icon: 'codicon codicon-zoom-out',
                category: 'View',
                shortcut: 'Ctrl+-',
                action: { kind: 'viewport', elementId: 'graph', newViewport: { scroll: { x: 0, y: 0 }, zoom: 0.8 }, animate: true } as Action,
                sortPriority: 23,
            },
            {
                id: 'layout',
                label: 'Auto Layout',
                icon: 'codicon codicon-layout',
                category: 'Layout',
                action: { kind: 'layout' },
                sortPriority: 30,
            },
            {
                id: 'exportSvg',
                label: 'Export as SVG',
                icon: 'codicon codicon-file-media',
                category: 'Export',
                action: { kind: 'requestExportSvg' },
                sortPriority: 40,
            },
        ];
    }

    /**
     * Handle input change.
     */
    protected handleInput(): void {
        const query = this.inputElement?.value.toLowerCase() || '';

        if (query.length === 0) {
            this.filteredItems = [...this.allItems];
        } else {
            this.filteredItems = this.allItems.filter(item =>
                item.label.toLowerCase().includes(query) ||
                (item.category && item.category.toLowerCase().includes(query)) ||
                (item.description && item.description.toLowerCase().includes(query))
            );
        }

        this.selectedIndex = 0;
        this.renderResults();
    }

    /**
     * Handle keyboard navigation.
     */
    protected handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectNext();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectPrevious();
                break;
            case 'Enter':
                event.preventDefault();
                this.executeSelected();
                break;
            case 'Escape':
                event.preventDefault();
                this.hidePalette();
                break;
        }
    }

    /**
     * Select next item.
     */
    protected selectNext(): void {
        if (this.filteredItems.length === 0) {
            return;
        }
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.updateSelection();
    }

    /**
     * Select previous item.
     */
    protected selectPrevious(): void {
        if (this.filteredItems.length === 0) {
            return;
        }
        this.selectedIndex = this.selectedIndex === 0
            ? this.filteredItems.length - 1
            : this.selectedIndex - 1;
        this.updateSelection();
    }

    /**
     * Execute the selected item.
     */
    protected executeSelected(): void {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
            const item = this.filteredItems[this.selectedIndex];
            this.executeItem(item);
        }
    }

    /**
     * Execute a command item.
     */
    protected executeItem(item: CommandPaletteItem): void {
        // Hide palette first
        this.hidePalette();

        // Dispatch the action with error handling
        try {
            this.dispatchSafeAction(item.action);
        } catch (error) {
            this.logger.warn({ actionKind: item.action.kind, err: error }, 'Failed to execute action');
        }

        // Also dispatch execute command action for logging/hooks
        this.dispatch(ExecuteCommandAction.create(item.id));
    }

    /**
     * Dispatch an action safely, handling common action types.
     */
    protected dispatchSafeAction(action: Action): void {
        switch (action.kind) {
            case 'layout':
                // Dispatch RequestLayoutAction which triggers the ELK layout engine
                this.logger.info('Dispatching layout action');
                this.dispatch(RequestLayoutAction.create());
                break;
            default:
                this.dispatch(action);
        }
    }

    /**
     * Hide the palette.
     */
    hidePalette(): void {
        this.hide();
        this.dispatch(HideCommandPaletteAction.create());
    }

    /**
     * Handle click outside the palette.
     */
    protected handleClickOutside(event: MouseEvent): void {
        if (this.isVisible() && this.containerElement) {
            const target = event.target as Node;
            if (!this.containerElement.contains(target)) {
                this.hidePalette();
            }
        }
    }

    /**
     * Render the results.
     */
    protected renderResults(): void {
        if (!this.resultsContainer) {
            return;
        }

        this.resultsContainer.innerHTML = '';

        if (this.filteredItems.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = CommandPaletteClasses.NO_RESULTS;
            noResults.textContent = 'No commands found';
            this.resultsContainer.appendChild(noResults);
            return;
        }

        // Group by category
        const grouped = this.groupByCategory(this.filteredItems);

        let globalIndex = 0;
        for (const [category, items] of grouped) {
            // Category header
            if (category) {
                const categoryHeader = document.createElement('div');
                categoryHeader.className = CommandPaletteClasses.RESULT_CATEGORY;
                categoryHeader.textContent = category;
                this.resultsContainer.appendChild(categoryHeader);
            }

            // Items
            for (const item of items) {
                const itemElement = this.createItemElement(item, globalIndex);
                this.resultsContainer.appendChild(itemElement);
                globalIndex++;
            }
        }
    }

    /**
     * Group items by category.
     */
    protected groupByCategory(items: CommandPaletteItem[]): Map<string, CommandPaletteItem[]> {
        const grouped = new Map<string, CommandPaletteItem[]>();

        for (const item of items) {
            const category = item.category || '';
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category)!.push(item);
        }

        return grouped;
    }

    /**
     * Create an item element.
     */
    protected createItemElement(item: CommandPaletteItem, index: number): HTMLElement {
        const element = document.createElement('div');
        element.className = CommandPaletteClasses.RESULT_ITEM;
        element.dataset.index = String(index);

        if (index === this.selectedIndex) {
            element.classList.add(CommandPaletteClasses.RESULT_ITEM_SELECTED);
        }

        // Icon
        if (item.icon) {
            const icon = document.createElement('span');
            icon.className = `${CommandPaletteClasses.RESULT_ITEM_ICON} ${item.icon}`;
            element.appendChild(icon);
        }

        // Content container
        const content = document.createElement('div');
        content.className = CommandPaletteClasses.RESULT_ITEM_CONTENT;

        // Label
        const label = document.createElement('span');
        label.className = CommandPaletteClasses.RESULT_ITEM_LABEL;
        label.textContent = item.label;
        content.appendChild(label);

        // Description
        if (item.description) {
            const description = document.createElement('span');
            description.className = CommandPaletteClasses.RESULT_ITEM_DESCRIPTION;
            description.textContent = item.description;
            content.appendChild(description);
        }

        element.appendChild(content);

        // Shortcut
        if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = CommandPaletteClasses.RESULT_ITEM_SHORTCUT;
            shortcut.textContent = item.shortcut;
            element.appendChild(shortcut);
        }

        // Event handlers
        element.addEventListener('click', () => {
            this.selectedIndex = index;
            this.executeItem(item);
        });

        element.addEventListener('mouseenter', () => {
            this.selectedIndex = index;
            this.updateSelection();
        });

        return element;
    }

    /**
     * Update the visual selection.
     */
    protected updateSelection(): void {
        if (!this.resultsContainer) {
            return;
        }

        const items = this.resultsContainer.querySelectorAll(`.${CommandPaletteClasses.RESULT_ITEM}`);
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add(CommandPaletteClasses.RESULT_ITEM_SELECTED);
                // Scroll into view
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove(CommandPaletteClasses.RESULT_ITEM_SELECTED);
            }
        });
    }

    /**
     * Add items programmatically.
     */
    addItems(items: CommandPaletteItem[]): void {
        this.allItems.push(...items);
        this.allItems.sort((a, b) => (a.sortPriority || 100) - (b.sortPriority || 100));
    }

    /**
     * Remove items by ID.
     */
    removeItems(itemIds: string[]): void {
        this.allItems = this.allItems.filter(item => !itemIds.includes(item.id));
    }

    /**
     * Called on model change.
     */
    override modelChanged(_model: SModelRootImpl): void {
        // Could update context-specific commands
    }
}
