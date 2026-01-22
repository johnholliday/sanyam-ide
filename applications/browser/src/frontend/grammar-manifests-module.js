/**
 * Grammar Manifests Map - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * This module is imported by the product extension via webpack alias (@app/grammar-manifests).
 *
 * Generated at: 2026-01-22T13:42:32.932Z
 * Packages: 1
 */

import { manifest as spdevkitManifest } from '@sanyam-grammar/spdevkit/manifest';

/**
 * Map of language IDs to grammar manifests for sanyam-browser.
 *
 * These manifests are automatically discovered from @sanyam-grammar/* package.json dependencies.
 * The product extension imports this map and registers it with the GrammarRegistry.
 * @type {Record<string, import('@sanyam/types').GrammarManifest>}
 */
export const grammarManifests = {
  [spdevkitManifest.languageId]: spdevkitManifest,
};
