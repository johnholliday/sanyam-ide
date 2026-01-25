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
 * Service for persisting diagram layout positions.
 * Uses Theia's StorageService which stores data in the browser's local storage
 * or file-based storage depending on the platform.
 */
@injectable()
export class DiagramLayoutStorageService {
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
     *
     * @param uri - The file URI
     * @returns The saved layout or undefined if none exists
     */
    async loadLayout(uri: string): Promise<DiagramLayout | undefined> {
        const key = this.getStorageKey(uri);
        try {
            const data = await this.storageService.getData<DiagramLayout>(key);
            if (data && data.uri === uri && data.version === 1) {
                console.log(`[DiagramLayoutStorageService] Loaded layout for ${uri}:`, Object.keys(data.elements).length, 'elements');
                return data;
            }
        } catch (error) {
            console.warn('[DiagramLayoutStorageService] Failed to load layout:', error);
        }
        return undefined;
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
            console.log(`[DiagramLayoutStorageService] Saved layout for ${uri}:`, Object.keys(elements).length, 'elements');
        } catch (error) {
            console.error('[DiagramLayoutStorageService] Failed to save layout:', error);
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
                console.error('[DiagramLayoutStorageService] Debounced save failed:', error);
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
            console.log(`[DiagramLayoutStorageService] Deleted layout for ${uri}`);
        } catch (error) {
            console.warn('[DiagramLayoutStorageService] Failed to delete layout:', error);
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
     * Clean up pending save timers.
     */
    dispose(): void {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }
        this.saveTimers.clear();
    }
}
