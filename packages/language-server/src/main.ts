/**
 * Unified Language Server Entry Point
 *
 * Default entry point for the unified LSP/GLSP language server.
 * This module starts a server with no pre-configured grammars.
 *
 * For applications that want to include specific grammars, use the
 * server-factory module instead and pass the desired contributions:
 *
 * @example
 * ```typescript
 * import { createLanguageServer } from 'sanyam-language-server/server-factory';
 * import { contribution as ecml } from '@sanyam-grammar/ecml/contribution';
 *
 * const server = await createLanguageServer({
 *   contributions: [ecml],
 * });
 *
 * server.start();
 * ```
 *
 * @packageDocumentation
 */

import { createLanguageServer, type LanguageContributionInterface } from './server-factory.js';

/**
 * Start the language server.
 *
 * This default entry point starts the server with no grammars loaded.
 * Applications should use the server-factory directly to specify their
 * grammar contributions.
 */
async function main(): Promise<void> {
  console.log('Starting Sanyam Language Server...');
  console.log('NOTE: No grammars configured. Use server-factory to specify contributions.');
  console.log('');

  // Start with empty contributions
  // Applications should use createLanguageServer directly with their grammars
  const contributions: LanguageContributionInterface[] = [];

  const server = await createLanguageServer({
    contributions,
  });

  server.start();
}

// Start the server
main().catch((error) => {
  console.error('Failed to start language server:', error);
  process.exit(1);
});

// Re-export the server factory for programmatic use
export { createLanguageServer, type CreateServerOptions, type LanguageServerInstance } from './server-factory.js';
export { LanguageRegistry } from './language-registry.js';
export { loadContributions, type ContributionLoaderOptions, type LoadResult } from './discovery/contribution-loader.js';
