/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Tool Palette UI Extension
 *
 * Renders the tool palette with collapsible groups for node and edge creation tools.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl } from 'sprotty';
import {
    AbstractUIExtension,
    ShowUIExtensionOptions,
    DIAGRAM_CONTAINER_ID,
} from '../base-ui-extension';
import {
    ToolPaletteGroup,
    ToolPaletteItem,
    ToolSelectionAction,
    EnableCreationToolAction,
    EnableDefaultToolsAction,
    SearchToolPaletteAction,
    ToggleToolPaletteGroupAction,
} from './tool-palette-actions';
import {
    ZoomInAction,
    ZoomOutAction,
    ResetZoomAction,
    CenterDiagramAction,
    FitDiagramAction,
} from './viewport-action-handler';
import { RequestLayoutAction } from '../../layout';

/**
 * Tool Palette Extension ID.
 */
export const TOOL_PALETTE_ID = 'sanyam-tool-palette';

/**
 * CSS classes for the tool palette.
 */
export const ToolPaletteClasses = {
    CONTAINER: 'sanyam-tool-palette',
    HEADER: 'sanyam-tool-palette-header',
    SEARCH: 'sanyam-tool-palette-search',
    SEARCH_INPUT: 'sanyam-tool-palette-search-input',
    CONTENT: 'sanyam-tool-palette-content',
    GROUP: 'sanyam-tool-palette-group',
    GROUP_HEADER: 'sanyam-tool-palette-group-header',
    GROUP_ICON: 'sanyam-tool-palette-group-icon',
    GROUP_LABEL: 'sanyam-tool-palette-group-label',
    GROUP_TOGGLE: 'sanyam-tool-palette-group-toggle',
    GROUP_ITEMS: 'sanyam-tool-palette-group-items',
    GROUP_COLLAPSED: 'collapsed',
    ITEM: 'sanyam-tool-palette-item',
    ITEM_ICON: 'sanyam-tool-palette-item-icon',
    ITEM_LABEL: 'sanyam-tool-palette-item-label',
    ITEM_SELECTED: 'selected',
    ITEM_HIDDEN: 'hidden',
    DEFAULT_TOOL: 'sanyam-tool-palette-default-tool',
} as const;

/**
 * Tool Palette UI Extension.
 *
 * Displays a sidebar with collapsible tool groups for diagram editing.
 * Supports node creation, edge creation, and action tools.
 */
@injectable()
export class ToolPaletteUIExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    /** Current tool groups */
    protected groups: ToolPaletteGroup[] = [];

    /** Currently selected tool ID */
    protected selectedToolId: string = '';

    /** Search query */
    protected searchQuery: string = '';

    /** Search input element */
    protected searchInput: HTMLInputElement | undefined;

    /** Content container element */
    protected contentContainer: HTMLElement | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return TOOL_PALETTE_ID;
    }

    containerClass(): string {
        return ToolPaletteClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        // First try the explicitly set parent container
        if (this.parentContainerElement) {
            return this.parentContainerElement;
        }

        // Then try to find by diagram container ID
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container?.parentElement) {
                return container.parentElement;
            }
        }

        return undefined;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // Create header with search
        const header = this.createHeader();
        containerElement.appendChild(header);

        // Create content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = ToolPaletteClasses.CONTENT;
        containerElement.appendChild(this.contentContainer);

        // Add default selection tool
        this.addDefaultTool();

        // Render initial groups
        this.renderGroups();
    }

    /**
     * Create the header with search input.
     */
    protected createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = ToolPaletteClasses.HEADER;

        // Search container
        const searchContainer = document.createElement('div');
        searchContainer.className = ToolPaletteClasses.SEARCH;

        // Search input
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search tools...';
        this.searchInput.className = ToolPaletteClasses.SEARCH_INPUT;
        this.searchInput.addEventListener('input', () => this.handleSearchInput());
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        searchContainer.appendChild(this.searchInput);
        header.appendChild(searchContainer);

        return header;
    }

    /**
     * Add the default selection/move tool.
     */
    protected addDefaultTool(): void {
        if (!this.contentContainer) {
            return;
        }

        const defaultTool = document.createElement('div');
        defaultTool.className = `${ToolPaletteClasses.DEFAULT_TOOL} ${ToolPaletteClasses.ITEM} ${ToolPaletteClasses.ITEM_SELECTED}`;
        defaultTool.title = 'Select & Move (Esc)';
        defaultTool.innerHTML = `
            <span class="${ToolPaletteClasses.ITEM_ICON} codicon codicon-move"></span>
            <span class="${ToolPaletteClasses.ITEM_LABEL}">Select</span>
        `;
        defaultTool.addEventListener('click', () => this.selectDefaultTool());

        this.contentContainer.appendChild(defaultTool);
    }

    /**
     * Render tool groups.
     */
    protected renderGroups(): void {
        if (!this.contentContainer) {
            return;
        }

        // Remove existing groups (keep default tool)
        const existingGroups = this.contentContainer.querySelectorAll(`.${ToolPaletteClasses.GROUP}`);
        existingGroups.forEach(g => g.remove());

        // Render each group
        for (const group of this.groups) {
            const groupElement = this.createGroupElement(group);
            this.contentContainer.appendChild(groupElement);
        }
    }

    /**
     * Create a group element.
     */
    protected createGroupElement(group: ToolPaletteGroup): HTMLElement {
        const groupElement = document.createElement('div');
        groupElement.className = ToolPaletteClasses.GROUP;
        groupElement.dataset.groupId = group.id;

        if (group.expanded === false) {
            groupElement.classList.add(ToolPaletteClasses.GROUP_COLLAPSED);
        }

        // Group header
        const header = document.createElement('div');
        header.className = ToolPaletteClasses.GROUP_HEADER;
        header.addEventListener('click', () => this.toggleGroup(group.id));

        // Toggle icon
        const toggle = document.createElement('span');
        toggle.className = `${ToolPaletteClasses.GROUP_TOGGLE} codicon codicon-chevron-down`;
        header.appendChild(toggle);

        // Group icon (optional)
        if (group.icon) {
            const icon = document.createElement('span');
            icon.className = `${ToolPaletteClasses.GROUP_ICON} ${group.icon}`;
            header.appendChild(icon);
        }

        // Group label
        const label = document.createElement('span');
        label.className = ToolPaletteClasses.GROUP_LABEL;
        label.textContent = group.label;
        header.appendChild(label);

        groupElement.appendChild(header);

        // Group items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = ToolPaletteClasses.GROUP_ITEMS;

        for (const item of group.items) {
            const itemElement = this.createItemElement(item);
            itemsContainer.appendChild(itemElement);
        }

        groupElement.appendChild(itemsContainer);

        return groupElement;
    }

    /**
     * Create an item element.
     */
    protected createItemElement(item: ToolPaletteItem): HTMLElement {
        const itemElement = document.createElement('div');
        itemElement.className = ToolPaletteClasses.ITEM;
        itemElement.dataset.itemId = item.id;
        itemElement.title = item.label;

        if (this.selectedToolId === item.id) {
            itemElement.classList.add(ToolPaletteClasses.ITEM_SELECTED);
        }

        // Apply search filter
        if (this.searchQuery && !this.matchesSearch(item)) {
            itemElement.classList.add(ToolPaletteClasses.ITEM_HIDDEN);
        }

        // Item icon
        const icon = document.createElement('span');
        icon.className = `${ToolPaletteClasses.ITEM_ICON} ${item.icon || 'codicon codicon-symbol-misc'}`;
        itemElement.appendChild(icon);

        // Item label
        const label = document.createElement('span');
        label.className = ToolPaletteClasses.ITEM_LABEL;
        label.textContent = item.label;
        itemElement.appendChild(label);

        // Click handler
        itemElement.addEventListener('click', () => this.selectTool(item));

        return itemElement;
    }

    /**
     * Check if an item matches the search query.
     */
    protected matchesSearch(item: ToolPaletteItem): boolean {
        if (!this.searchQuery) {
            return true;
        }
        const query = this.searchQuery.toLowerCase();
        return item.label.toLowerCase().includes(query) ||
               item.id.toLowerCase().includes(query);
    }

    /**
     * Handle search input.
     */
    protected handleSearchInput(): void {
        this.searchQuery = this.searchInput?.value || '';
        this.dispatch(SearchToolPaletteAction.create(this.searchQuery));
        this.applySearchFilter();
    }

    /**
     * Clear the search.
     */
    protected clearSearch(): void {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.searchQuery = '';
        this.applySearchFilter();
    }

    /**
     * Apply the search filter to items.
     */
    protected applySearchFilter(): void {
        if (!this.contentContainer) {
            return;
        }

        const items = this.contentContainer.querySelectorAll(`.${ToolPaletteClasses.ITEM}`);
        items.forEach(item => {
            const itemElement = item as HTMLElement;
            const itemId = itemElement.dataset.itemId;
            if (!itemId) {
                return; // Skip default tool
            }

            const paletteItem = this.findItemById(itemId);
            if (paletteItem && this.matchesSearch(paletteItem)) {
                itemElement.classList.remove(ToolPaletteClasses.ITEM_HIDDEN);
            } else if (paletteItem) {
                itemElement.classList.add(ToolPaletteClasses.ITEM_HIDDEN);
            }
        });

        // Auto-expand groups with visible items when searching
        if (this.searchQuery) {
            const groups = this.contentContainer.querySelectorAll(`.${ToolPaletteClasses.GROUP}`);
            groups.forEach(group => {
                const groupElement = group as HTMLElement;
                const visibleItems = groupElement.querySelectorAll(
                    `.${ToolPaletteClasses.ITEM}:not(.${ToolPaletteClasses.ITEM_HIDDEN})`
                );
                if (visibleItems.length > 0) {
                    groupElement.classList.remove(ToolPaletteClasses.GROUP_COLLAPSED);
                }
            });
        }
    }

    /**
     * Find an item by ID across all groups.
     */
    protected findItemById(itemId: string): ToolPaletteItem | undefined {
        for (const group of this.groups) {
            const item = group.items.find(i => i.id === itemId);
            if (item) {
                return item;
            }
        }
        return undefined;
    }

    /**
     * Toggle a group's expansion state.
     */
    protected toggleGroup(groupId: string): void {
        if (!this.contentContainer) {
            return;
        }

        const groupElement = this.contentContainer.querySelector(`[data-group-id="${groupId}"]`);
        if (groupElement) {
            const isCollapsed = groupElement.classList.toggle(ToolPaletteClasses.GROUP_COLLAPSED);
            this.dispatch(ToggleToolPaletteGroupAction.create(groupId, !isCollapsed));

            // Update internal state
            const group = this.groups.find(g => g.id === groupId);
            if (group) {
                group.expanded = !isCollapsed;
            }
        }
    }

    /**
     * Select a tool.
     */
    protected selectTool(item: ToolPaletteItem): void {
        this.selectedToolId = item.id;
        this.updateSelection();

        // Dispatch appropriate action based on tool type
        if (item.toolAction) {
            switch (item.toolAction.kind) {
                case 'createNode':
                    this.dispatch(EnableCreationToolAction.createNodeTool(
                        item.toolAction.elementTypeId,
                        item.toolAction.args
                    ));
                    break;
                case 'createEdge':
                    this.dispatch(EnableCreationToolAction.createEdgeTool(
                        item.toolAction.elementTypeId,
                        item.toolAction.args
                    ));
                    break;
                case 'triggerAction':
                    // Dispatch the action directly with error handling
                    try {
                        this.dispatchTriggerAction(item.toolAction.actionKind, item.toolAction.args);
                    } catch (error) {
                        console.warn(`[ToolPalette] Failed to execute action '${item.toolAction.actionKind}':`, error);
                    }
                    // Reset to default tool after action
                    this.selectDefaultTool();
                    return;
            }
        }

        this.dispatch(ToolSelectionAction.create(item.id, item.toolAction));
    }

    /**
     * Dispatch a trigger action with proper handling.
     * Handles common actions like layout, fit, center, zoom with proper Sprotty actions.
     */
    protected dispatchTriggerAction(actionKind: string, args?: Record<string, unknown>): void {
        try {
            switch (actionKind) {
                case 'layout':
                    // Dispatch RequestLayoutAction which will be handled by LayoutActionHandler
                    // This triggers the ELK layout engine
                    console.info('[ToolPalette] Dispatching layout action');
                    this.dispatch(RequestLayoutAction.create({
                        algorithm: args?.algorithm as RequestLayoutAction['algorithm'],
                        direction: args?.direction as RequestLayoutAction['direction'],
                    }));
                    break;
                case 'fit':
                    // Use the custom FitDiagramAction which properly handles element IDs
                    console.info('[ToolPalette] Dispatching fit diagram action');
                    this.dispatch(FitDiagramAction.create(
                        args?.elementIds as string[] | undefined,
                        (args?.padding as number) ?? 20,
                        (args?.animate as boolean) ?? true
                    ));
                    break;
                case 'center':
                    // Use the custom CenterDiagramAction which properly handles element IDs
                    console.info('[ToolPalette] Dispatching center diagram action');
                    this.dispatch(CenterDiagramAction.create(
                        args?.elementIds as string[] | undefined,
                        (args?.animate as boolean) ?? true
                    ));
                    break;
                case 'zoomIn':
                    // Use the custom ZoomInAction which properly handles relative zoom
                    console.info('[ToolPalette] Dispatching zoom in action');
                    this.dispatch(ZoomInAction.create(1.2));
                    break;
                case 'zoomOut':
                    // Use the custom ZoomOutAction which properly handles relative zoom
                    console.info('[ToolPalette] Dispatching zoom out action');
                    this.dispatch(ZoomOutAction.create(1.2));
                    break;
                case 'zoomReset':
                    // Use the custom ResetZoomAction
                    console.info('[ToolPalette] Dispatching reset zoom action');
                    this.dispatch(ResetZoomAction.create());
                    break;
                case 'toggleMinimap':
                    console.info('[ToolPalette] Dispatching toggle minimap action');
                    this.dispatch({ kind: 'toggleMinimap' } as import('sprotty-protocol').Action);
                    break;
                case 'enableMarqueeSelect':
                    console.info('[ToolPalette] Enabling marquee selection mode');
                    this.dispatch({ kind: 'enableMarqueeSelect' } as import('sprotty-protocol').Action);
                    break;
                default:
                    // For other actions, dispatch as-is with a warning if it fails
                    console.debug(`[ToolPalette] Dispatching action: ${actionKind}`);
                    this.dispatch({
                        kind: actionKind,
                        ...args,
                    } as import('sprotty-protocol').Action);
            }
        } catch (error) {
            console.error(`[ToolPalette] Error dispatching trigger action '${actionKind}':`, error);
        }
    }

    /**
     * Select the default selection/move tool.
     * @param dispatchAction - Whether to dispatch the action (set to false when called from action handler)
     */
    selectDefaultTool(dispatchAction: boolean = true): void {
        this.selectedToolId = '';
        this.updateSelection();
        if (dispatchAction) {
            this.dispatch(EnableDefaultToolsAction.create());
            this.dispatch(ToolSelectionAction.deselect());
        }
    }

    /**
     * Update the visual selection state.
     */
    protected updateSelection(): void {
        if (!this.contentContainer) {
            return;
        }

        // Remove selection from all items
        const items = this.contentContainer.querySelectorAll(`.${ToolPaletteClasses.ITEM}`);
        items.forEach(item => item.classList.remove(ToolPaletteClasses.ITEM_SELECTED));

        // Add selection to the correct item
        if (this.selectedToolId) {
            const selectedItem = this.contentContainer.querySelector(`[data-item-id="${this.selectedToolId}"]`);
            if (selectedItem) {
                selectedItem.classList.add(ToolPaletteClasses.ITEM_SELECTED);
            }
        } else {
            // Select default tool
            const defaultTool = this.contentContainer.querySelector(`.${ToolPaletteClasses.DEFAULT_TOOL}`);
            if (defaultTool) {
                defaultTool.classList.add(ToolPaletteClasses.ITEM_SELECTED);
            }
        }
    }

    /**
     * Set the tool palette groups.
     */
    setGroups(groups: ToolPaletteGroup[]): void {
        this.groups = groups;
        this.renderGroups();
    }

    /**
     * Get the current groups.
     */
    getGroups(): ToolPaletteGroup[] {
        return [...this.groups];
    }

    /**
     * Get the currently selected tool ID.
     */
    getSelectedToolId(): string {
        return this.selectedToolId;
    }

    /**
     * Called when shown.
     */
    protected onShow(options?: ShowUIExtensionOptions): void {
        super.onShow(options);
        if (this.searchInput) {
            // Focus search input on show
            this.searchInput.focus();
        }
    }

    /**
     * Called on model change.
     */
    modelChanged(_model: SModelRootImpl): void {
        // Could refresh palette based on model state
    }
}
