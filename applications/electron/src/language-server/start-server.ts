/**
 * Language Server Entry Point for Electron Application
 *
 * This file starts the unified language server with the grammars
 * configured for this application.
 *
 * @packageDocumentation
 */

import { createLanguageServer } from 'sanyam-language-server/server-factory';
import { ENABLED_GRAMMARS, getEnabledLanguageIds } from './grammars.js';

/**
 * Start the language server with the application's configured grammars.
 */
async function main(): Promise<void> {
  const grammarNames = getEnabledLanguageIds();
  console.log('Starting Sanyam Language Server for Electron...');
  console.log(`Enabled grammars: ${grammarNames.join(', ') || 'none'}`);
  console.log('');

  const server = await createLanguageServer({
    contributions: ENABLED_GRAMMARS,
  });

  server.start();
}

// Start the server
main().catch((error) => {
  console.error('Failed to start language server:', error);
  process.exit(1);
});
