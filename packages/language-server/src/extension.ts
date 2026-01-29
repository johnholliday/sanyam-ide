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
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node.js';
import { DOCUMENT_SELECTOR } from './generated/vsix-config.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'Extension' });

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
  logger.info('Activating Sanyam Language Extension');

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

  // Register GLSP commands for diagram operations
  registerGlspCommands(context);

  logger.info('Sanyam Language Extension activated');
}

/**
 * Register GLSP-related commands that can be called from the Theia frontend.
 */
function registerGlspCommands(context: ExtensionContext): void {
  // Command to load diagram model
  context.subscriptions.push(
    vscode.commands.registerCommand('sanyam.glsp.loadModel', async (uri: string) => {
      if (!client) {
        return { success: false, error: 'Language client not initialized' };
      }
      try {
        const response = await client.sendRequest('glsp/loadModel', { uri });
        return response;
      } catch (error) {
        logger.error({ err: error }, 'Error loading diagram model');
        return { success: false, error: String(error) };
      }
    })
  );

  // Command to execute diagram operation
  context.subscriptions.push(
    vscode.commands.registerCommand('sanyam.glsp.executeOperation', async (uri: string, operation: any) => {
      if (!client) {
        return { success: false, error: 'Language client not initialized' };
      }
      try {
        const response = await client.sendRequest('glsp/executeOperation', { uri, operation });
        return response;
      } catch (error) {
        logger.error({ err: error }, 'Error executing diagram operation');
        return { success: false, error: String(error) };
      }
    })
  );

  // Command to request layout
  context.subscriptions.push(
    vscode.commands.registerCommand('sanyam.glsp.requestLayout', async (uri: string, options?: any) => {
      if (!client) {
        return { positions: {}, bounds: { width: 0, height: 0 }, error: 'Language client not initialized' };
      }
      try {
        const response = await client.sendRequest('glsp/layout', { uri, options });
        return response;
      } catch (error) {
        logger.error({ err: error }, 'Error requesting layout');
        return { positions: {}, bounds: { width: 0, height: 0 }, error: String(error) };
      }
    })
  );

  // Command to get tool palette
  context.subscriptions.push(
    vscode.commands.registerCommand('sanyam.glsp.getToolPalette', async (uri: string) => {
      if (!client) {
        return { groups: [], error: 'Language client not initialized' };
      }
      try {
        const response = await client.sendRequest('glsp/toolPalette', { uri });
        return response;
      } catch (error) {
        logger.error({ err: error }, 'Error getting tool palette');
        return { groups: [], error: String(error) };
      }
    })
  );

  // Command to validate model
  context.subscriptions.push(
    vscode.commands.registerCommand('sanyam.glsp.validate', async (uri: string) => {
      if (!client) {
        return { markers: [], isValid: true, errorCount: 0, warningCount: 0 };
      }
      try {
        const response = await client.sendRequest('glsp/validate', { uri });
        return response;
      } catch (error) {
        logger.error({ err: error }, 'Error validating model');
        return { markers: [], isValid: false, errorCount: 1, warningCount: 0 };
      }
    })
  );

  logger.info('GLSP commands registered');
}

/**
 * Deactivate the extension.
 *
 * Called when VS Code deactivates this extension.
 */
export async function deactivate(): Promise<void> {
  logger.info('Deactivating Sanyam Language Extension');

  if (client) {
    await client.stop();
    client = undefined;
  }

  logger.info('Sanyam Language Extension deactivated');
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
