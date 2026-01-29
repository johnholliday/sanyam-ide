/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Diagram Layout Storage Service
 *
 * Persists diagram layout positions to user profile storage.
 * Uses Theia's StorageService to store layouts keyed by file URI hash.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { createLogger } from '@sanyam/logger';
import { StorageService } from '@theia/core/lib/browser';

/**
 * Position and size for a diagram element.
 */
export interface ElementLayout {
    /** Element position */
    position: { x: number; y: number };
    /** Element size (optional) */
    size?: { width: number; height: number };
}

/**
 * Saved layout data for a diagram.
 */
export interface DiagramLayout {
    /** Version for future compatibility */
    version: 1;
    /** File URI this layout is for */
    uri: string;
    /** Timestamp when layout was saved */
    timestamp: number;
    /** Element positions keyed by element ID */
    elements: Record<string, ElementLayout>;
}

/**
 * Storage key prefix for diagram layouts.
 */
const LAYOUT_STORAGE_PREFIX = 'sanyam.diagram.layout:';

/**
 * Current layout schema version.
 * Increment when making breaking changes to the layout format.
 */
const CURRENT_LAYOUT_VERSION = 1;

/**
 * Service for persisting diagram layout positions.
 * Uses Theia's StorageService which stores data in the browser's local storage
 * or file-based storage depending on the platform.
 */
@injectable()
export class DiagramLayoutStorageService {
    protected readonly logger = createLogger({ name: 'LayoutStorage' });

    @inject(StorageService)
    protected readonly storageService: StorageService;

    /** Debounce timers for saving layouts */
    protected saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

    /** Debounce delay in milliseconds */
    protected readonly SAVE_DEBOUNCE_MS = 500;

    /**
     * Get the storage key for a URI.
     * Uses a simple hash of the URI to create a consistent key.
     */
    protected getStorageKey(uri: string): string {
        // Simple hash function for URI
        let hash = 0;
        for (let i = 0; i < uri.length; i++) {
            const char = uri.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `${LAYOUT_STORAGE_PREFIX}${Math.abs(hash).toString(16)}`;
    }

    /**
     * Load saved layout for a diagram.
     * T021: Handles version checking and migrations.
     * T075a: Includes performance logging (<100ms target).
     *
     * @param uri - The file URI
     * @returns The saved layout or undefined if none exists
     */
    async loadLayout(uri: string): Promise<DiagramLayout | undefined> {
        const startTime = performance.now();
        const key = this.getStorageKey(uri);
        try {
            const data = await this.storageService.getData<DiagramLayout>(key);
            if (!data || data.uri !== uri) {
                return undefined;
            }

            // T021: Version check and migration
            if (data.version !== CURRENT_LAYOUT_VERSION) {
                const migrated = this.migrateLayout(data);
                if (migrated) {
                    // Save migrated layout for future loads
                    await this.storageService.setData(key, migrated);
                    this.logger.info(`Migrated layout from v${data.version} to v${CURRENT_LAYOUT_VERSION}`);
                    return migrated;
                } else {
                    // Migration failed, discard old layout
                    this.logger.warn(`Discarding incompatible layout (v${data.version})`);
                    return undefined;
                }
            }

            // T075a: Log performance
            const duration = performance.now() - startTime;
            const elementCount = Object.keys(data.elements).length;
            if (duration > 100) {
                this.logger.warn(`Layout load took ${duration.toFixed(2)}ms for ${elementCount} elements (target: <100ms)`);
            } else {
                this.logger.debug(`Loaded layout in ${duration.toFixed(2)}ms: ${elementCount} elements`);
            }
            return data;
        } catch (error) {
            this.logger.warn({ err: error }, 'Failed to load layout');
        }
        return undefined;
    }

    /**
     * T021: Migrate layout from older version to current version.
     * Add migration logic here when incrementing CURRENT_LAYOUT_VERSION.
     *
     * @param layout - Layout with older version
     * @returns Migrated layout or undefined if migration not possible
     */
    protected migrateLayout(layout: DiagramLayout): DiagramLayout | undefined {
        // Future migration logic goes here
        // Example for migrating from v1 to v2:
        // if (layout.version === 1) {
        //     return {
        //         ...layout,
        //         version: 2,
        //         newField: 'defaultValue',
        //     };
        // }

        // Currently we only support version 1, so no migrations needed
        // If version is lower than 1 or unknown, return undefined
        if (layout.version < 1) {
            return undefined;
        }

        // For versions higher than current, also return undefined
        // (shouldn't happen, but defensive)
        if (layout.version > CURRENT_LAYOUT_VERSION) {
            this.logger.warn(`Layout version ${layout.version} is newer than supported ${CURRENT_LAYOUT_VERSION}`);
            return undefined;
        }

        return layout;
    }

    /**
     * Save layout for a diagram.
     * This saves immediately without debouncing.
     *
     * @param uri - The file URI
     * @param elements - Map of element ID to layout
     */
    async saveLayout(uri: string, elements: Record<string, ElementLayout>): Promise<void> {
        const key = this.getStorageKey(uri);
        const layout: DiagramLayout = {
            version: 1,
            uri,
            timestamp: Date.now(),
            elements,
        };

        try {
            await this.storageService.setData(key, layout);
            this.logger.debug({ uri, elementCount: Object.keys(elements).length }, 'Saved layout');
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to save layout');
        }
    }

    /**
     * Save layout with debouncing.
     * Multiple calls within the debounce period will be coalesced.
     *
     * @param uri - The file URI
     * @param elements - Map of element ID to layout
     */
    saveLayoutDebounced(uri: string, elements: Record<string, ElementLayout>): void {
        // Cancel any pending save for this URI
        const existingTimer = this.saveTimers.get(uri);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Schedule a new save
        const timer = setTimeout(() => {
            this.saveTimers.delete(uri);
            this.saveLayout(uri, elements).catch(error => {
                this.logger.error({ err: error }, 'Debounced save failed');
            });
        }, this.SAVE_DEBOUNCE_MS);

        this.saveTimers.set(uri, timer);
    }

    /**
     * Delete saved layout for a diagram.
     *
     * @param uri - The file URI
     */
    async deleteLayout(uri: string): Promise<void> {
        const key = this.getStorageKey(uri);
        try {
            await this.storageService.setData(key, undefined);
            this.logger.debug({ uri }, 'Deleted layout');
        } catch (error) {
            this.logger.warn({ err: error }, 'Failed to delete layout');
        }
    }

    /**
     * Check if a saved layout exists for a diagram.
     *
     * @param uri - The file URI
     * @returns True if a saved layout exists
     */
    async hasLayout(uri: string): Promise<boolean> {
        const layout = await this.loadLayout(uri);
        return layout !== undefined && Object.keys(layout.elements).length > 0;
    }

    /**
     * Extract positions from a saved layout.
     *
     * @param layout - The saved layout
     * @returns Map of element ID to position
     */
    extractPositions(layout: DiagramLayout): Map<string, { x: number; y: number }> {
        const positions = new Map<string, { x: number; y: number }>();
        for (const [id, elementLayout] of Object.entries(layout.elements)) {
            positions.set(id, elementLayout.position);
        }
        return positions;
    }

    /**
     * T019: Filter layout to only include elements that exist in the model.
     * Removes stale entries for elements that have been deleted from the model.
     *
     * @param layout - The saved layout
     * @param currentElementIds - Set of element IDs currently in the model
     * @returns Filtered layout with only existing elements
     */
    filterStaleEntries(layout: DiagramLayout, currentElementIds: Set<string>): DiagramLayout {
        const filteredElements: Record<string, ElementLayout> = {};
        let removedCount = 0;

        for (const [id, elementLayout] of Object.entries(layout.elements)) {
            if (currentElementIds.has(id)) {
                filteredElements[id] = elementLayout;
            } else {
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.logger.debug({ removedCount }, 'Removed stale layout entries');
        }

        return {
            ...layout,
            elements: filteredElements,
            timestamp: Date.now(),
        };
    }

    /**
     * T020: Merge current positions into existing layout, preserving saved positions
     * for existing elements and adding new elements.
     *
     * @param savedLayout - Previously saved layout (may be undefined)
     * @param currentElements - Current element layouts from the model
     * @param currentElementIds - Set of all element IDs in the current model
     * @returns Merged layout
     */
    mergeLayouts(
        savedLayout: DiagramLayout | undefined,
        currentElements: Record<string, ElementLayout>,
        currentElementIds: Set<string>
    ): Record<string, ElementLayout> {
        const merged: Record<string, ElementLayout> = {};

        // Start with saved positions for elements that still exist
        if (savedLayout) {
            for (const [id, layout] of Object.entries(savedLayout.elements)) {
                if (currentElementIds.has(id)) {
                    merged[id] = layout;
                }
            }
        }

        // Add/update with current positions (these take precedence)
        for (const [id, layout] of Object.entries(currentElements)) {
            merged[id] = layout;
        }

        return merged;
    }

    /**
     * T020: Get element IDs that are new (in model but not in saved layout).
     *
     * @param savedLayout - Previously saved layout
     * @param currentElementIds - Set of all element IDs in the current model
     * @returns Set of new element IDs that need layout
     */
    getNewElementIds(savedLayout: DiagramLayout | undefined, currentElementIds: Set<string>): Set<string> {
        const newIds = new Set<string>();

        if (!savedLayout) {
            // All elements are new if no saved layout exists
            return new Set(currentElementIds);
        }

        const savedIds = new Set(Object.keys(savedLayout.elements));
        for (const id of currentElementIds) {
            if (!savedIds.has(id)) {
                newIds.add(id);
            }
        }

        return newIds;
    }

    /**
     * Clean up pending save timers.
     */
    dispose(): void {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }
        this.saveTimers.clear();
    }
}
