/**
 * VS Code Extension Entry Point
 *
 * Activates the language client to connect to the unified language server.
 * This file is the entry point when the extension is loaded in VS Code.
 *
 * @packageDocumentation
 */

import * as path from 'node:path';
import type { ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node.js';
import { DOCUMENT_SELECTOR } from './generated/vsix-config.js';

/**
 * The language client instance.
 */
let client: LanguageClient | undefined;

/**
 * Activate the extension.
 *
 * Called when VS Code activates this extension (based on activation events).
 *
 * @param context - Extension context
 */
export async function activate(context: ExtensionContext): Promise<void> {
  console.log('Activating Sanyam Language Extension...');

  // Path to the server module (bundled by esbuild as CommonJS)
  const serverModule = context.asAbsolutePath(
    path.join('out', 'main.js')
  );

  // Server options - run the server as a Node.js module
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  };

  // Client options - configure which documents the client handles
  // DOCUMENT_SELECTOR is generated from application grammar dependencies
  const clientOptions: LanguageClientOptions = {
    documentSelector: DOCUMENT_SELECTOR,
    synchronize: {
      fileEvents: [],
    },
    outputChannelName: 'Sanyam Language Server',
  };

  // Create the language client
  client = new LanguageClient(
    'sanyam-language-server',
    'Sanyam Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client (also starts the server)
  await client.start();

  console.log('Sanyam Language Extension activated.');
}

/**
 * Deactivate the extension.
 *
 * Called when VS Code deactivates this extension.
 */
export async function deactivate(): Promise<void> {
  console.log('Deactivating Sanyam Language Extension...');

  if (client) {
    await client.stop();
    client = undefined;
  }

  console.log('Sanyam Language Extension deactivated.');
}

/**
 * Get the current language client.
 *
 * Useful for other parts of the extension that need to communicate
 * with the language server.
 *
 * @returns The language client or undefined if not active
 */
export function getClient(): LanguageClient | undefined {
  return client;
}
