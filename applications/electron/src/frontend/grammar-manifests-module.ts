/**
 * Grammar Manifest Contributions - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * Generated at: 2026-01-18T23:12:57.778Z
 * Packages: 1
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';

import { manifest as ecmlManifest } from '@sanyam-grammar/ecml/manifest';

/**
 * Frontend module that registers grammar manifests for sanyam-electron.
 *
 * This module binds each grammar's manifest as a GrammarManifestContribution,
 * making them available to the GrammarRegistry for UI features like the
 * Getting Started widget and About dialog.
 */
export default new ContainerModule((bind) => {
  bind(GrammarManifestContribution).toConstantValue({ manifest: ecmlManifest });
});
