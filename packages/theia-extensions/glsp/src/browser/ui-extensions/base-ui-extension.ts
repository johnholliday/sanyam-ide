/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Base UI Extension
 *
 * Abstract base class for Sprotty UI extensions, providing common functionality
 * for tool palette, validation markers, command palette, and other UI components.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject } from 'inversify';
import { TYPES, IActionDispatcher, SModelRootImpl } from 'sprotty';
import { Action } from 'sprotty-protocol';

/**
 * Symbol for UI Extension registry.
 */
export const UI_EXTENSION_REGISTRY = Symbol.for('UIExtensionRegistry');

/**
 * Symbol for diagram container element ID.
 */
export const DIAGRAM_CONTAINER_ID = Symbol.for('DiagramContainerId');

/**
 * UI Extension lifecycle state.
 */
export enum UIExtensionState {
    HIDDEN = 'hidden',
    VISIBLE = 'visible',
    INITIALIZED = 'initialized',
}

/**
 * Options for showing a UI extension.
 */
export interface ShowUIExtensionOptions {
    /** Additional CSS classes to add */
    cssClasses?: string[];
    /** Position relative to a DOM element */
    positionRelativeTo?: HTMLElement;
    /** Absolute position */
    position?: { x: number; y: number };
}

/**
 * Interface for UI Extension actions.
 */
export interface SetUIExtensionVisibilityAction extends Action {
    kind: 'setUIExtensionVisibility';
    extensionId: string;
    visible: boolean;
    options?: ShowUIExtensionOptions;
}

export namespace SetUIExtensionVisibilityAction {
    export const KIND = 'setUIExtensionVisibility';

    export function show(extensionId: string, options?: ShowUIExtensionOptions): SetUIExtensionVisibilityAction {
        return { kind: KIND, extensionId, visible: true, options };
    }

    export function hide(extensionId: string): SetUIExtensionVisibilityAction {
        return { kind: KIND, extensionId, visible: false };
    }
}

/**
 * Abstract base class for UI extensions.
 *
 * UI extensions are visual components that appear on top of the diagram canvas,
 * such as tool palettes, context menus, command palettes, etc.
 */
@injectable()
export abstract class AbstractUIExtension {
    protected readonly logger = createLogger({ name: 'BaseUiExtension' });

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    protected containerElement: HTMLElement | undefined;
    protected state: UIExtensionState = UIExtensionState.HIDDEN;

    /**
     * Get the unique identifier for this extension.
     */
    abstract id(): string;

    /**
     * Get the CSS class for the extension container.
     */
    abstract containerClass(): string;

    /**
     * Initialize the contents of the extension.
     * Called once when the extension is first shown.
     *
     * @param containerElement - The container element to populate
     */
    protected abstract initializeContents(containerElement: HTMLElement): void;

    /**
     * Get the parent container element (usually the diagram SVG container).
     */
    protected abstract getParentContainer(): HTMLElement | undefined;

    /**
     * Initialize the extension.
     * Creates the container element and initializes contents.
     */
    initialize(): void {
        if (this.state !== UIExtensionState.HIDDEN) {
            return;
        }

        const parent = this.getParentContainer();
        if (!parent) {
            this.logger.warn({ extensionId: this.id() }, 'Parent container not found');
            return;
        }

        // Create container element
        this.containerElement = document.createElement('div');
        this.containerElement.id = this.id();
        this.containerElement.className = this.containerClass();
        this.containerElement.style.display = 'none';

        // Initialize contents
        this.initializeContents(this.containerElement);

        // Append to parent
        parent.appendChild(this.containerElement);

        this.state = UIExtensionState.INITIALIZED;
        this.logger.info({ extensionId: this.id() }, 'Initialized');
    }

    /**
     * Show the extension.
     */
    show(options?: ShowUIExtensionOptions): void {
        if (this.state === UIExtensionState.HIDDEN) {
            this.initialize();
        }

        if (!this.containerElement) {
            return;
        }

        // Apply additional CSS classes
        if (options?.cssClasses) {
            options.cssClasses.forEach(cls => this.containerElement!.classList.add(cls));
        }

        // Apply positioning
        if (options?.position) {
            this.containerElement.style.left = `${options.position.x}px`;
            this.containerElement.style.top = `${options.position.y}px`;
        }

        this.containerElement.style.display = '';
        this.state = UIExtensionState.VISIBLE;
        this.onShow(options);
    }

    /**
     * Hide the extension.
     */
    hide(): void {
        if (this.containerElement) {
            this.containerElement.style.display = 'none';
        }
        this.state = UIExtensionState.HIDDEN;
        this.onHide();
    }

    /**
     * Toggle the extension visibility.
     */
    toggle(options?: ShowUIExtensionOptions): void {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show(options);
        }
    }

    /**
     * Check if the extension is currently visible.
     */
    isVisible(): boolean {
        return this.state === UIExtensionState.VISIBLE;
    }

    /**
     * Called when the extension is shown.
     * Override to add custom behavior.
     */
    protected onShow(_options?: ShowUIExtensionOptions): void {
        // Override in subclasses
    }

    /**
     * Called when the extension is hidden.
     * Override to add custom behavior.
     */
    protected onHide(): void {
        // Override in subclasses
    }

    /**
     * Called when the model changes.
     * Override to update the extension contents.
     */
    modelChanged(model: SModelRootImpl): void {
        // Override in subclasses
    }

    /**
     * Dispatch an action.
     * Handles errors gracefully to prevent crashes.
     */
    protected dispatch(action: Action): Promise<void> {
        if (!this.actionDispatcher) {
            this.logger.warn({ extensionId: this.id(), actionKind: action.kind }, 'Action dispatcher not available, cannot dispatch');
            return Promise.resolve();
        }
        return this.actionDispatcher.dispatch(action).catch(error => {
            this.logger.warn({ extensionId: this.id(), actionKind: action.kind, err: error }, 'Error dispatching action');
        });
    }

    /**
     * Dispose the extension.
     */
    dispose(): void {
        if (this.containerElement && this.containerElement.parentElement) {
            this.containerElement.parentElement.removeChild(this.containerElement);
        }
        this.containerElement = undefined;
        this.state = UIExtensionState.HIDDEN;
    }
}

/**
 * Registry for UI extensions.
 */
@injectable()
export class UIExtensionRegistry {
    protected readonly extensions = new Map<string, AbstractUIExtension>();

    /**
     * Register a UI extension.
     */
    register(extension: AbstractUIExtension): void {
        this.extensions.set(extension.id(), extension);
    }

    /**
     * Get a UI extension by ID.
     */
    get(id: string): AbstractUIExtension | undefined {
        return this.extensions.get(id);
    }

    /**
     * Get all registered extensions.
     */
    getAll(): AbstractUIExtension[] {
        return Array.from(this.extensions.values());
    }

    /**
     * Show a UI extension by ID.
     */
    show(id: string, options?: ShowUIExtensionOptions): void {
        const extension = this.extensions.get(id);
        if (extension) {
            extension.show(options);
        }
    }

    /**
     * Hide a UI extension by ID.
     */
    hide(id: string): void {
        const extension = this.extensions.get(id);
        if (extension) {
            extension.hide();
        }
    }

    /**
     * Hide all UI extensions.
     */
    hideAll(): void {
        this.extensions.forEach(ext => ext.hide());
    }

    /**
     * Notify all extensions of a model change.
     */
    modelChanged(model: SModelRootImpl): void {
        this.extensions.forEach(ext => ext.modelChanged(model));
    }

    /**
     * Dispose all extensions.
     */
    dispose(): void {
        this.extensions.forEach(ext => ext.dispose());
        this.extensions.clear();
    }
}
