/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Popup Extension
 *
 * Provides hover tooltips/popups for diagram elements.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Popup Extension ID.
 */
export const POPUP_ID = 'sanyam-popup';

/**
 * CSS classes for popup.
 */
export const PopupClasses = {
    CONTAINER: 'sanyam-popup-container',
    POPUP: 'sanyam-popup',
    POPUP_HEADER: 'sanyam-popup-header',
    POPUP_ICON: 'sanyam-popup-icon',
    POPUP_TITLE: 'sanyam-popup-title',
    POPUP_CONTENT: 'sanyam-popup-content',
    POPUP_PROPERTY: 'sanyam-popup-property',
    POPUP_PROPERTY_NAME: 'sanyam-popup-property-name',
    POPUP_PROPERTY_VALUE: 'sanyam-popup-property-value',
    POPUP_ACTIONS: 'sanyam-popup-actions',
    POPUP_ACTION: 'sanyam-popup-action',
    POPUP_MARKERS: 'sanyam-popup-markers',
    POPUP_MARKER: 'sanyam-popup-marker',
    POPUP_PINNED: 'pinned',
} as const;

/**
 * Popup content.
 */
export interface PopupContent {
    /** Element ID this popup is for */
    elementId: string;
    /** Element type */
    elementType: string;
    /** Display title */
    title: string;
    /** Icon class */
    icon?: string;
    /** Properties to display */
    properties?: Array<{ name: string; value: string }>;
    /** Quick actions */
    actions?: Array<{ id: string; label: string; icon?: string }>;
    /** Validation markers */
    markers?: Array<{ severity: string; message: string }>;
}

/**
 * Popup content provider interface.
 */
export interface PopupContentProvider {
    getPopupContent(elementId: string, elementType: string): PopupContent | undefined;
}

/**
 * Show popup action.
 */
export interface ShowPopupAction extends Action {
    kind: 'showPopup';
    elementId: string;
    position: { x: number; y: number };
}

export namespace ShowPopupAction {
    export const KIND = 'showPopup';

    export function create(elementId: string, position: { x: number; y: number }): ShowPopupAction {
        return { kind: KIND, elementId, position };
    }
}

/**
 * Hide popup action.
 */
export interface HidePopupAction extends Action {
    kind: 'hidePopup';
}

export namespace HidePopupAction {
    export const KIND = 'hidePopup';

    export function create(): HidePopupAction {
        return { kind: KIND };
    }
}

/**
 * Pin popup action.
 */
export interface PinPopupAction extends Action {
    kind: 'pinPopup';
    pinned: boolean;
}

export namespace PinPopupAction {
    export const KIND = 'pinPopup';

    export function create(pinned: boolean): PinPopupAction {
        return { kind: KIND, pinned };
    }
}

/**
 * Sanyam Popup Extension.
 *
 * Provides hover tooltips showing:
 * - Element type and name
 * - Properties
 * - Validation issues
 * - Quick actions
 */
@injectable()
export class SanyamPopupExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Content providers */
    protected contentProviders: PopupContentProvider[] = [];

    /** Current popup element ID */
    protected currentElementId: string | undefined;

    /** Whether popup is pinned */
    protected isPinned: boolean = false;

    /** Hover delay in ms */
    protected hoverDelay: number = 500;

    /** Hover timer */
    protected hoverTimer: ReturnType<typeof setTimeout> | undefined;

    /** Popup element */
    protected popupElement: HTMLElement | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return POPUP_ID;
    }

    containerClass(): string {
        return PopupClasses.CONTAINER;
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
        containerElement.style.position = 'absolute';
        containerElement.style.top = '0';
        containerElement.style.left = '0';
        containerElement.style.width = '100%';
        containerElement.style.height = '100%';
        containerElement.style.pointerEvents = 'none';
        containerElement.style.overflow = 'visible';

        // Create popup element
        this.popupElement = document.createElement('div');
        this.popupElement.className = PopupClasses.POPUP;
        this.popupElement.style.display = 'none';
        this.popupElement.style.position = 'absolute';
        this.popupElement.style.pointerEvents = 'auto';
        this.popupElement.style.zIndex = '1000';

        containerElement.appendChild(this.popupElement);

        // Handle click on popup (for pinning)
        this.popupElement.addEventListener('click', () => this.togglePin());
    }

    /**
     * Register a content provider.
     */
    registerContentProvider(provider: PopupContentProvider): void {
        this.contentProviders.push(provider);
    }

    /**
     * Unregister a content provider.
     */
    unregisterContentProvider(provider: PopupContentProvider): void {
        const index = this.contentProviders.indexOf(provider);
        if (index !== -1) {
            this.contentProviders.splice(index, 1);
        }
    }

    /**
     * Schedule showing popup on hover.
     */
    scheduleShowPopup(elementId: string, position: { x: number; y: number }): void {
        // If pinned, don't change
        if (this.isPinned) {
            return;
        }

        // Cancel previous timer
        this.cancelScheduledPopup();

        // Schedule new popup
        this.hoverTimer = setTimeout(() => {
            this.showPopup(elementId, position);
        }, this.hoverDelay);
    }

    /**
     * Cancel scheduled popup.
     */
    cancelScheduledPopup(): void {
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = undefined;
        }
    }

    /**
     * Show popup for an element.
     */
    showPopup(elementId: string, position: { x: number; y: number }): void {
        // If pinned and showing different element, ignore
        if (this.isPinned && this.currentElementId !== elementId) {
            return;
        }

        // Get content from providers
        const content = this.getContentForElement(elementId);
        if (!content) {
            this.hidePopup();
            return;
        }

        this.currentElementId = elementId;
        this.renderPopupContent(content);
        this.positionPopup(position);

        if (this.popupElement) {
            this.popupElement.style.display = 'block';
        }

        this.show();
        this.dispatch(ShowPopupAction.create(elementId, position));
    }

    /**
     * Hide the popup.
     */
    hidePopup(): void {
        // Don't hide if pinned
        if (this.isPinned) {
            return;
        }

        this.cancelScheduledPopup();
        this.currentElementId = undefined;

        if (this.popupElement) {
            this.popupElement.style.display = 'none';
        }

        this.hide();
        this.dispatch(HidePopupAction.create());
    }

    /**
     * Toggle pin state.
     */
    togglePin(): void {
        this.isPinned = !this.isPinned;

        if (this.popupElement) {
            this.popupElement.classList.toggle(PopupClasses.POPUP_PINNED, this.isPinned);
        }

        this.dispatch(PinPopupAction.create(this.isPinned));
    }

    /**
     * Unpin the popup.
     */
    unpin(): void {
        this.isPinned = false;

        if (this.popupElement) {
            this.popupElement.classList.remove(PopupClasses.POPUP_PINNED);
        }

        this.hidePopup();
    }

    /**
     * Get content for an element from providers.
     */
    protected getContentForElement(elementId: string): PopupContent | undefined {
        const elementType = this.getElementType(elementId);
        if (!elementType) {
            return undefined;
        }

        for (const provider of this.contentProviders) {
            const content = provider.getPopupContent(elementId, elementType);
            if (content) {
                return content;
            }
        }

        // Default content
        return this.getDefaultContent(elementId, elementType);
    }

    /**
     * Get element type from SVG.
     */
    protected getElementType(elementId: string): string | undefined {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return undefined;
        }

        const element = svgContainer.querySelector(`[id="${elementId}"]`);
        if (!element) {
            return undefined;
        }

        // Try to get type from class or data attribute
        const svgElement = element as SVGElement;
        const classes = svgElement.className?.baseVal || (element.getAttribute('class') ?? '');
        if (classes.includes('node')) {
            return 'node';
        } else if (classes.includes('edge')) {
            return 'edge';
        } else if (classes.includes('label')) {
            return 'label';
        }

        return 'element';
    }

    /**
     * Get default content for an element.
     */
    protected getDefaultContent(elementId: string, elementType: string): PopupContent {
        return {
            elementId,
            elementType,
            title: elementId,
            icon: this.getIconForType(elementType),
            properties: [
                { name: 'Type', value: elementType },
                { name: 'ID', value: elementId },
            ],
        };
    }

    /**
     * Get icon for element type.
     */
    protected getIconForType(elementType: string): string {
        switch (elementType) {
            case 'node':
                return 'codicon codicon-symbol-class';
            case 'edge':
                return 'codicon codicon-arrow-right';
            case 'label':
                return 'codicon codicon-symbol-string';
            default:
                return 'codicon codicon-symbol-misc';
        }
    }

    /**
     * Render popup content.
     */
    protected renderPopupContent(content: PopupContent): void {
        if (!this.popupElement) {
            return;
        }

        this.popupElement.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = PopupClasses.POPUP_HEADER;

        if (content.icon) {
            const icon = document.createElement('span');
            icon.className = `${PopupClasses.POPUP_ICON} ${content.icon}`;
            header.appendChild(icon);
        }

        const title = document.createElement('span');
        title.className = PopupClasses.POPUP_TITLE;
        title.textContent = content.title;
        header.appendChild(title);

        this.popupElement.appendChild(header);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = PopupClasses.POPUP_CONTENT;

        // Properties
        if (content.properties && content.properties.length > 0) {
            for (const prop of content.properties) {
                const propDiv = document.createElement('div');
                propDiv.className = PopupClasses.POPUP_PROPERTY;

                const nameSpan = document.createElement('span');
                nameSpan.className = PopupClasses.POPUP_PROPERTY_NAME;
                nameSpan.textContent = `${prop.name}:`;
                propDiv.appendChild(nameSpan);

                const valueSpan = document.createElement('span');
                valueSpan.className = PopupClasses.POPUP_PROPERTY_VALUE;
                valueSpan.textContent = prop.value;
                propDiv.appendChild(valueSpan);

                contentDiv.appendChild(propDiv);
            }
        }

        // Markers
        if (content.markers && content.markers.length > 0) {
            const markersDiv = document.createElement('div');
            markersDiv.className = PopupClasses.POPUP_MARKERS;

            for (const marker of content.markers) {
                const markerDiv = document.createElement('div');
                markerDiv.className = `${PopupClasses.POPUP_MARKER} ${marker.severity}`;
                markerDiv.textContent = marker.message;
                markersDiv.appendChild(markerDiv);
            }

            contentDiv.appendChild(markersDiv);
        }

        this.popupElement.appendChild(contentDiv);

        // Actions
        if (content.actions && content.actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = PopupClasses.POPUP_ACTIONS;

            for (const action of content.actions) {
                const actionBtn = document.createElement('button');
                actionBtn.className = PopupClasses.POPUP_ACTION;
                actionBtn.title = action.label;

                if (action.icon) {
                    const icon = document.createElement('span');
                    icon.className = action.icon;
                    actionBtn.appendChild(icon);
                } else {
                    actionBtn.textContent = action.label;
                }

                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.executeAction(action.id, content.elementId);
                });

                actionsDiv.appendChild(actionBtn);
            }

            this.popupElement.appendChild(actionsDiv);
        }
    }

    /**
     * Position the popup near the element.
     */
    protected positionPopup(position: { x: number; y: number }): void {
        if (!this.popupElement) {
            return;
        }

        // Position below and to the right of cursor/element
        this.popupElement.style.left = `${position.x + 10}px`;
        this.popupElement.style.top = `${position.y + 10}px`;

        // TODO: Adjust if popup would go off screen
    }

    /**
     * Execute a quick action.
     */
    protected executeAction(actionId: string, elementId: string): void {
        this.dispatch({
            kind: 'executePopupAction',
            actionId,
            elementId,
        } as import('sprotty-protocol').Action);

        // Close popup after action
        if (!this.isPinned) {
            this.hidePopup();
        }
    }

    /**
     * Find the SVG container.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                return container.querySelector('svg.sprotty-graph') as SVGSVGElement;
            }
        }
        return undefined;
    }

    /**
     * Set hover delay.
     */
    setHoverDelay(delay: number): void {
        this.hoverDelay = delay;
    }

    /**
     * Check if popup is currently showing.
     */
    isShowing(): boolean {
        return this.currentElementId !== undefined;
    }

    /**
     * Check if popup is pinned.
     */
    isPinnedPopup(): boolean {
        return this.isPinned;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Update popup if current element changed
        if (this.currentElementId) {
            const content = this.getContentForElement(this.currentElementId);
            if (content) {
                this.renderPopupContent(content);
            } else {
                this.unpin();
                this.hidePopup();
            }
        }
    }

    override dispose(): void {
        this.cancelScheduledPopup();
        super.dispose();
    }
}
