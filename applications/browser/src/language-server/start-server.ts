/**
 * Language Server Entry Point for Browser Application
 *
 * This file starts the unified language server with the grammars
 * configured for this application.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { createLanguageServer } from 'sanyam-language-server/server-factory';
import { ENABLED_GRAMMARS, getEnabledLanguageIds } from './grammars.js';

const logger = createLogger({ name: 'BrowserServer' });

/**
 * Start the language server with the application's configured grammars.
 */
async function main(): Promise<void> {
  const grammarNames = getEnabledLanguageIds();
  logger.info('Starting Sanyam Language Server for Browser...');
  logger.info({ grammars: grammarNames }, `Enabled grammars: ${grammarNames.join(', ') || 'none'}`);

  const server = await createLanguageServer({
    contributions: ENABLED_GRAMMARS,
  });

  server.start();
}

// Start the server
main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start language server');
  process.exit(1);
});
