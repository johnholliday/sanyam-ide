/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import type { GrammarManifest, GrammarManifestMap } from '@sanyam/types';

/**
 * Injection token for the grammar manifest map.
 * The map is provided by each application via webpack alias.
 */
export const GrammarManifestMapToken = Symbol('GrammarManifestMap');

/**
 * Registry service that provides access to grammar manifests.
 *
 * The grammar manifests are provided by the application at build time via
 * webpack alias (@app/grammar-manifests), making them available to UI
 * components like the Getting Started widget and About dialog.
 *
 * @example
 * ```typescript
 * @inject(GrammarRegistry)
 * protected readonly grammarRegistry: GrammarRegistry;
 *
 * // Access manifests
 * const manifests = this.grammarRegistry.manifests;
 * const ecmlManifest = this.grammarRegistry.getManifest('ecml');
 * ```
 */
@injectable()
export class GrammarRegistry implements FrontendApplicationContribution {

    @inject(GrammarManifestMapToken)
    protected readonly manifestMap: GrammarManifestMap;

    protected _manifests: readonly GrammarManifest[] = [];
    protected _extensionToManifest: Map<string, GrammarManifest> = new Map();

    /**
     * Called during application initialization, before widgets are created.
     * Converts the manifest map to an array for easier iteration and builds
     * the extension-to-manifest lookup.
     */
    initialize(): void {
        this._manifests = Object.freeze(Object.values(this.manifestMap));
        this.buildExtensionLookup();
        console.log('[GrammarRegistry] Initialized with', this._manifests.length, 'manifest(s)');
    }

    /**
     * Build the extension-to-manifest lookup map.
     * Maps file extensions (including compound extensions like .task.spdk) to manifests.
     */
    protected buildExtensionLookup(): void {
        this._extensionToManifest.clear();
        for (const manifest of this._manifests) {
            // Map the primary file extension
            this._extensionToManifest.set(manifest.fileExtension, manifest);

            // Map compound extensions from rootTypes (e.g., .task.spdk)
            for (const rootType of manifest.rootTypes) {
                const compoundExt = `${rootType.fileSuffix}${manifest.baseExtension}`;
                this._extensionToManifest.set(compoundExt, manifest);
            }
        }
    }

    /**
     * Get all registered grammar manifests.
     */
    get manifests(): readonly GrammarManifest[] {
        return this._manifests;
    }

    /**
     * Get a manifest by language ID.
     *
     * @param languageId - The unique language identifier
     * @returns The manifest if found, undefined otherwise
     */
    getManifest(languageId: string): GrammarManifest | undefined {
        return this.manifestMap[languageId];
    }

    /**
     * Check if a grammar is registered.
     *
     * @param languageId - The unique language identifier
     * @returns True if the grammar is registered
     */
    hasGrammar(languageId: string): boolean {
        return languageId in this.manifestMap;
    }

    /**
     * Get a manifest by file extension.
     *
     * Supports both simple extensions (.spdk) and compound extensions (.task.spdk).
     * For filenames, extracts the relevant extension parts to find a match.
     *
     * @param extension - The file extension (e.g., '.spdk', '.task.spdk') or filename
     * @returns The manifest if found, undefined otherwise
     *
     * @example
     * ```typescript
     * // Direct extension lookup
     * const manifest = registry.getManifestByExtension('.spdk');
     *
     * // Compound extension lookup
     * const manifest = registry.getManifestByExtension('.task.spdk');
     *
     * // From filename (extracts extension)
     * const manifest = registry.getManifestByExtension('myfile.task.spdk');
     * ```
     */
    getManifestByExtension(extension: string): GrammarManifest | undefined {
        // Normalize: ensure it starts with a dot if it looks like an extension
        let ext = extension;
        if (!ext.startsWith('.')) {
            // It might be a filename, extract extension(s)
            const lastDotIndex = ext.lastIndexOf('.');
            if (lastDotIndex >= 0) {
                ext = ext.substring(lastDotIndex);
            } else {
                return undefined;
            }
        }

        // Try direct lookup first (handles simple extensions like .spdk)
        if (this._extensionToManifest.has(ext)) {
            return this._extensionToManifest.get(ext);
        }

        // Try to find compound extension matches
        // For a file like "myfile.task.spdk", ext is ".spdk"
        // We need to check if any manifest handles this base extension
        // and then look for compound patterns
        for (const [mapExt, manifest] of this._extensionToManifest) {
            if (ext === manifest.fileExtension || ext === manifest.baseExtension) {
                return manifest;
            }
            // Check if the extension ends with the manifest's base extension
            if (mapExt.endsWith(ext) && mapExt !== ext) {
                return manifest;
            }
        }

        return undefined;
    }

    /**
     * Get manifest for a file path by analyzing its extension(s).
     *
     * This method handles compound extensions by checking multiple extension
     * patterns (e.g., for "file.task.spdk" it checks ".task.spdk" then ".spdk").
     *
     * @param filePath - The full file path or filename
     * @returns The manifest if found, undefined otherwise
     */
    getManifestByFilePath(filePath: string): GrammarManifest | undefined {
        // Extract filename from path
        const fileName = filePath.includes('/') || filePath.includes('\\')
            ? filePath.substring(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1)
            : filePath;

        // Try compound extensions first (most specific)
        // For "file.task.spdk", try ".task.spdk" first, then ".spdk"
        const parts = fileName.split('.');
        if (parts.length > 2) {
            // Try compound extension
            const compoundExt = '.' + parts.slice(-2).join('.');
            const manifest = this._extensionToManifest.get(compoundExt);
            if (manifest) {
                return manifest;
            }
        }

        // Try simple extension
        if (parts.length >= 2) {
            const simpleExt = '.' + parts[parts.length - 1];
            return this._extensionToManifest.get(simpleExt);
        }

        return undefined;
    }
}
