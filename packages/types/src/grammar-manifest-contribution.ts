/**
 * @sanyam/types - Grammar Manifest Contribution
 *
 * This file defines the contribution interface for grammar packages
 * to register their manifests with the SANYAM platform.
 *
 * Uses Theia's ContributionProvider pattern to ensure type-safe,
 * race-condition-free grammar registration.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from './grammar-manifest.js';

/**
 * Symbol used for dependency injection binding.
 *
 * @example
 * ```typescript
 * import { ContainerModule } from '@theia/core/shared/inversify';
 * import { GrammarManifestContribution } from '@sanyam/types';
 * import { MY_MANIFEST } from './manifest';
 *
 * export default new ContainerModule(bind => {
 *     bind(GrammarManifestContribution).toConstantValue({
 *         manifest: MY_MANIFEST
 *     });
 * });
 * ```
 */
export const GrammarManifestContribution = Symbol('GrammarManifestContribution');

/**
 * Contribution interface for grammar packages.
 *
 * Grammar packages implement this interface to register their manifest
 * with the platform's GrammarRegistry. The manifest is read during
 * application initialization before widgets are created, ensuring
 * no race conditions.
 *
 * @example
 * ```typescript
 * // In grammar frontend module
 * bind(GrammarManifestContribution).toConstantValue({
 *     manifest: SPDEVKIT_MANIFEST
 * });
 * ```
 */
export interface GrammarManifestContribution {
  /**
   * The grammar manifest containing all configuration for platform integration.
   */
  readonly manifest: GrammarManifest;
}
