/**
 * {{languageId}} Grammar Package
 *
 * Main entry point for the grammar package.
 *
 * @packageDocumentation
 */

// Export manifest
export { manifest } from './manifest.js';
export type { GrammarManifest } from '@sanyam/types';

// Export contribution
export { createContribution } from './contribution.js';
export type { LanguageContribution, ContributionContext } from '@sanyam/types';

// Re-export generated module (after langium generate)
// export * from './generated/module.js';
// export * from './generated/ast.js';
