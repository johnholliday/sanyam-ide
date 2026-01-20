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

    /**
     * Called during application initialization, before widgets are created.
     * Converts the manifest map to an array for easier iteration.
     */
    initialize(): void {
        this._manifests = Object.freeze(Object.values(this.manifestMap));
        console.log('[GrammarRegistry] Initialized with', this._manifests.length, 'manifest(s)');
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
}
