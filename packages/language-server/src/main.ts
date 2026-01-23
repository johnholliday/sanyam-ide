/**
 * Unified Language Server Entry Point
 *
 * Default entry point for the unified LSP/GLSP language server.
 * When built with build-vsix.ts, this loads grammar contributions from
 * the generated server-contributions.ts file.
 *
 * For applications that want to include specific grammars programmatically,
 * use the server-factory module instead and pass the desired contributions:
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
import { GRAMMAR_CONTRIBUTIONS } from './generated/server-contributions.js';

/**
 * Start the language server.
 *
 * Loads grammar contributions from the generated server-contributions.ts file.
 * The contributions are determined at build time by build-vsix.ts based on
 * the application's grammar dependencies.
 */
async function main(): Promise<void> {
  console.log('Starting Sanyam Language Server...');

  const contributions: LanguageContributionInterface[] = GRAMMAR_CONTRIBUTIONS;

  if (contributions.length === 0) {
    console.log('NOTE: No grammars configured. Use server-factory to specify contributions.');
  } else {
    console.log(`Loading ${contributions.length} grammar contribution(s) from VSIX bundle...`);
  }
  console.log('');

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
