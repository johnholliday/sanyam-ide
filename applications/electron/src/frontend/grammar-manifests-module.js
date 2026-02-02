/**
 * Grammar Manifests Map - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * This module is imported by the product extension via webpack alias (@app/grammar-manifests).
 *
 * Generated at: 2026-02-02T10:15:54.597Z
 * Packages: 1
 */

import { manifest as ecmlManifest } from '@sanyam-grammar/ecml/manifest';

/**
 * Map of language IDs to grammar manifests for sanyam-electron.
 *
 * These manifests are automatically discovered from @sanyam-grammar/* package.json dependencies.
 * The product extension imports this map and registers it with the GrammarRegistry.
 * @type {Record<string, import('@sanyam/types').GrammarManifest>}
 */
export const grammarManifests = {
  [ecmlManifest.languageId]: ecmlManifest,
};
