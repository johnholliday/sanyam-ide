/**
 * ECML Grammar Package
 *
 * Enterprise Content Modeling Language grammar for SANYAM.
 *
 * @packageDocumentation
 */

// Export manifest
export { ECML_MANIFEST } from '../manifest.js';
export type { GrammarManifest } from '@sanyam/types';

// Export contribution
export { createContribution } from './contribution.js';
export type { LanguageContribution, ContributionContext } from '@sanyam/types';

// Re-export generated module (uncomment after langium generate)
// export * from './generated/module.js';
// export * from './generated/ast.js';
