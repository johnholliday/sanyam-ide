/**
 * Example Minimal Grammar Package
 *
 * @packageDocumentation
 */

// Export manifest
export { manifest } from './manifest.js';
export type { GrammarManifest } from '@sanyam/types';

// Export contribution
export { contribution } from './contribution.js';
export type { LanguageContributionInterface } from '@sanyam/types';

// Re-export generated module (uncomment after langium generate)
// export * from './generated/module.js';
// export * from './generated/ast.js';
