/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ContributionProvider } from '@theia/core/lib/common';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import type { GrammarManifest } from '@sanyam/types';
import { GrammarManifestContribution } from '@sanyam/types';

/**
 * Registry service that collects all registered grammar manifests.
 *
 * This service uses Theia's ContributionProvider pattern to gather
 * grammar manifest contributions during application initialization,
 * ensuring all manifests are available before widgets render.
 *
 * @example
 * ```typescript
 * @inject(GrammarRegistry)
 * protected readonly grammarRegistry: GrammarRegistry;
 *
 * // Access manifests
 * const manifests = this.grammarRegistry.manifests;
 * ```
 */
@injectable()
export class GrammarRegistry implements FrontendApplicationContribution {

    @inject(ContributionProvider) @named(GrammarManifestContribution)
    protected readonly contributionProvider: ContributionProvider<GrammarManifestContribution>;

    protected _manifests: readonly GrammarManifest[] = [];

    /**
     * Called during application initialization, before widgets are created.
     * Collects all grammar manifest contributions.
     */
    initialize(): void {
        this._manifests = Object.freeze(
            this.contributionProvider.getContributions().map(c => c.manifest)
        );
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
        return this._manifests.find(m => m.languageId === languageId);
    }

    /**
     * Check if a grammar is registered.
     *
     * @param languageId - The unique language identifier
     * @returns True if the grammar is registered
     */
    hasGrammar(languageId: string): boolean {
        return this._manifests.some(m => m.languageId === languageId);
    }
}
