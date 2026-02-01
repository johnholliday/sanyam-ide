/**
 * Server Factory - Consumer-Driven Grammar Selection API
 *
 * Provides a factory function that allows applications to create a language server
 * with their selected grammar contributions. This enables the "consumer-driven"
 * architecture where applications (electron, browser) decide which grammars to include.
 *
 * @packageDocumentation
 */

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  type Connection,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import type {
  LspFeatureProviders,
  GlspFeatureProviders,
  LanguageContribution,
  LanguageContributionInterface,
} from '@sanyam/types';
import { LanguageRegistry } from './language-registry.js';
import { loadContributions } from './discovery/contribution-loader.js';
import { createLogger } from '@sanyam/logger';

// Import GLSP server components
import { GlspServer, createGlspServer } from './glsp/glsp-server.js';
import type { Operation } from './glsp/glsp-server.js';

// Import Model API components
import { AstServer, createAstServer } from './model/ast-server.js';
import type { ModelQuery, GetModelOptions, SubscriptionOptions } from '@sanyam/types';

const logger = createLogger({ name: 'ServerFactory' });

/**
 * Options for creating a language server.
 */
export interface CreateServerOptions {
  /**
   * Language contributions to load.
   * Each contribution provides a grammar with LSP/GLSP support.
   */
  contributions: LanguageContributionInterface[];

  /**
   * Optional existing connection. If not provided, a new connection
   * is created using stdio.
   */
  connection?: Connection;
}

/**
 * Result of creating a language server.
 */
export interface LanguageServerInstance {
  /**
   * The language registry containing all loaded languages.
   */
  registry: LanguageRegistry;

  /**
   * The LSP connection.
   */
  connection: Connection;

  /**
   * Document manager for text documents.
   */
  documents: TextDocuments<TextDocument>;

  /**
   * Start the server and begin listening for requests.
   */
  start: () => void;

  /**
   * The GLSP server instance (available after initialization).
   */
  glspServer: GlspServer | null;

  /**
   * The AST server instance for Model API (available after initialization).
   */
  astServer: AstServer | null;
}

/**
 * Default LSP providers (will be populated with actual implementations).
 *
 * These are placeholders that will be implemented in later phases.
 */
function createDefaultLspProviders(): Required<LspFeatureProviders> {
  return {} as Required<LspFeatureProviders>;
}

/**
 * Default GLSP providers.
 *
 * Returns the default GLSP providers from the glsp-server-module.
 * These can be overridden by language contributions.
 */
function createDefaultGlspProviders(): Required<GlspFeatureProviders> {
  const { allDefaultGlspProviders } = require('./glsp/glsp-server-module.js');
  return allDefaultGlspProviders as Required<GlspFeatureProviders>;
}

/**
 * Create a language server with the specified contributions.
 *
 * This is the main factory function that applications use to create
 * a language server with their selected grammars.
 *
 * @example
 * ```typescript
 * import { createLanguageServer } from 'sanyam-language-server/server-factory';
 * import { contribution as ecml } from '@sanyam-grammar/ecml/contribution';
 * import { contribution as spdevkit } from '@sanyam-grammar/spdevkit/contribution';
 *
 * const server = await createLanguageServer({
 *   contributions: [ecml, spdevkit],
 * });
 *
 * server.start();
 * ```
 *
 * @param options - Server creation options
 * @returns A promise that resolves to the language server instance
 */
export async function createLanguageServer(
  options: CreateServerOptions
): Promise<LanguageServerInstance> {
  const connection = options.connection ?? createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);
  const registry = new LanguageRegistry();

  let glspServer: GlspServer | null = null;
  let astServer: AstServer | null = null;
  let initialized = false;

  /**
   * Initialize the GLSP server.
   */
  function initializeGlspServer(langiumServices: any): void {
    glspServer = createGlspServer(langiumServices, {
      autoLayout: true,
      validation: true,
    });
    logger.info('GLSP server initialized with auto-layout and validation');
  }

  /**
   * Register a language contribution with the GLSP server.
   */
  function registerLanguageWithGlsp(contribution: LanguageContribution): void {
    if (!glspServer) {
      logger.warn('GLSP server not initialized, skipping language registration');
      return;
    }
    glspServer.registerLanguage(contribution);
    logger.info({ languageId: contribution.languageId }, 'Language registered with GLSP server');
  }

  /**
   * Initialize the AST Server (Model API).
   */
  function initializeAstServer(langiumServices: any): void {
    astServer = createAstServer(langiumServices, {
      subscriptionConfig: {
        defaultDebounceMs: 100,
        maxDebounceMs: 500,
      },
    });
    logger.info('AST Server (Model API) initialized');
  }

  /**
   * Initialize handler.
   */
  connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
    logger.info({
      workspace: params.workspaceFolders?.[0]?.uri ?? 'none',
      contributionCount: options.contributions.length,
    }, 'Initializing Sanyam Language Server');

    try {
      // Load all language contributions
      const loadResult = await loadContributions(
        options.contributions,
        registry,
        {
          context: { connection, ...NodeFileSystem },
          defaultLspProviders: createDefaultLspProviders(),
          defaultGlspProviders: createDefaultGlspProviders(),
        }
      );

      if (loadResult.errors.length > 0) {
        logger.error({ errors: loadResult.errors }, 'Errors loading languages');
      }

      logger.info({ languages: Array.from(registry.getAllLanguageIds()), count: loadResult.loadedCount }, 'Languages loaded');

      // Initialize GLSP server with Langium services
      try {
        const langiumServices = {
          shared: {
            workspace: {
              LangiumDocuments: {
                getDocument: (uri: string | import('langium').URI) => {
                  const uriStr = typeof uri === 'string' ? uri : uri.toString();
                  const contribution = registry.getByUri(uriStr);
                  const parsedUri = typeof uri === 'string' ? URI.parse(uri) : uri;
                  return contribution?.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(parsedUri);
                },
                all: [] as any[],
              },
            },
          },
        };

        initializeGlspServer(langiumServices);

        // Register all loaded languages with GLSP server
        for (const langId of registry.getAllLanguageIds()) {
          const registered = registry.getByLanguageId(langId);
          if (registered?.contribution) {
            registerLanguageWithGlsp(registered.contribution);
          }
        }
      } catch (glspError) {
        logger.error({ err: glspError }, 'Failed to initialize GLSP server');
      }

      // Initialize AST Server (Model API)
      try {
        const langiumSharedServices = {
          workspace: {
            LangiumDocuments: {
              getDocument: (uri: any) => {
                const uriStr = typeof uri === 'string' ? uri : uri?.toString?.() ?? '';
                const contribution = registry.getByUri(uriStr);
                return contribution?.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(uri);
              },
              all: [] as any[],
            },
          },
        };

        initializeAstServer(langiumSharedServices);
      } catch (astError) {
        logger.error({ err: astError }, 'Failed to initialize AST Server');
      }

      initialized = true;

      // Return capabilities
      // Only advertise capabilities that have registered handlers
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: ['.', ':', '<', '"', "'", '/'],
          },
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          // Note: The following capabilities are not yet implemented
          // and are commented out to avoid "Unhandled method" errors:
          // - declarationProvider
          // - typeDefinitionProvider
          // - implementationProvider
          // - workspaceSymbolProvider
          // - documentHighlightProvider
          // - codeActionProvider
          // - renameProvider
          // - documentFormattingProvider
          // - documentRangeFormattingProvider
          // - foldingRangeProvider
          // - selectionRangeProvider
          // - semanticTokensProvider
          // - callHierarchyProvider
          // - typeHierarchyProvider
          // - inlayHintProvider
          // - codeLensProvider
          // - documentLinkProvider
          // - signatureHelpProvider
          // - linkedEditingRangeProvider
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize server');
      throw error;
    }
  });

  connection.onInitialized(() => {
    logger.info('Sanyam Language Server initialized');
  });

  connection.onShutdown(() => {
    logger.info('Shutting down Sanyam Language Server');
    if (astServer) {
      astServer.dispose();
      astServer = null;
    }
  });

  connection.onExit(() => {
    logger.info('Sanyam Language Server exited');
    process.exit(0);
  });

  // LSP Request Handlers (Placeholders)
  connection.onCompletion(async (params) => {
    if (!initialized) return null;
    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;
    return null;
  });

  connection.onCompletionResolve(async (item) => item);

  connection.onHover(async (params) => {
    if (!initialized) return null;
    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;
    return null;
  });

  connection.onDefinition(async (params) => {
    if (!initialized) return null;
    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;
    return null;
  });

  connection.onReferences(async (params) => {
    if (!initialized) return null;
    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;
    return null;
  });

  connection.onDocumentSymbol(async (params, token) => {
    if (!initialized) return null;
    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const symbolProvider = language.services.lsp?.DocumentSymbolProvider;
    if (!symbolProvider) return null;

    const shared = registry.sharedServices;
    if (!shared) return null;

    const uri = URI.parse(params.textDocument.uri);
    const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(uri, token);
    if (!document) return null;

    try {
      const result = await symbolProvider.getSymbols(document, params, token);
      return result ?? null;
    } catch (err) {
      logger.error({ err }, 'Error in document symbol handler');
      return null;
    }
  });

  // GLSP Request Handlers
  interface GlspDiagramRequest { uri: string; }
  interface GlspOperationRequest extends GlspDiagramRequest { operation: Operation; }
  interface GlspLayoutRequest extends GlspDiagramRequest { options?: { algorithm?: 'grid' | 'tree' | 'force-directed'; spacing?: number; }; }
  interface GlspContextMenuRequest extends GlspDiagramRequest { selectedIds: string[]; position?: { x: number; y: number }; }

  connection.onRequest('glsp/loadModel', async (params: GlspDiagramRequest) => {
    if (!initialized || !glspServer) {
      return { success: false, error: 'Server not initialized' };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { success: false, error: `No language registered for URI: ${params.uri}` };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { success: false, error: `Document not found: ${params.uri}` };
      }
      const context = await glspServer.loadModel(langiumDoc, CancellationToken.None);
      const idRegistryData = (context as any).idRegistryData;
      return {
        success: true,
        gModel: context.gModel,
        metadata: {
          positions: context.metadata?.positions ? Object.fromEntries(context.metadata.positions) : {},
          sizes: context.metadata?.sizes ? Object.fromEntries(context.metadata.sizes) : {},
          sourceRanges: context.metadata?.sourceRanges ? Object.fromEntries(context.metadata.sourceRanges) : {},
          idMap: idRegistryData?.idMap,
          fingerprints: idRegistryData?.fingerprints,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Error loading diagram model');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/executeOperation', async (params: GlspOperationRequest) => {
    if (!initialized || !glspServer) {
      return { success: false, error: 'Server not initialized' };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { success: false, error: `No language registered for URI: ${params.uri}` };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { success: false, error: `Document not found: ${params.uri}` };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      return glspServer.executeOperation(context, params.operation);
    } catch (error) {
      logger.error({ err: error }, 'Error executing diagram operation');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/validate', async (params: GlspDiagramRequest) => {
    if (!initialized || !glspServer) {
      return { markers: [], isValid: true, errorCount: 0, warningCount: 0 };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { markers: [], isValid: false, errorCount: 1, warningCount: 0, error: 'No language registered' };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { markers: [], isValid: false, errorCount: 1, warningCount: 0, error: 'Document not found' };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      return glspServer.validate(context);
    } catch (error) {
      logger.error({ err: error }, 'Error validating diagram');
      return { markers: [], isValid: false, errorCount: 1, warningCount: 0, error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/layout', async (params: GlspLayoutRequest) => {
    if (!initialized || !glspServer) {
      return { positions: {}, bounds: { width: 0, height: 0 } };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { positions: {}, bounds: { width: 0, height: 0 }, error: 'No language registered' };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { positions: {}, bounds: { width: 0, height: 0 }, error: 'Document not found' };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      const result = glspServer.applyLayout(context, params.options);
      return {
        positions: Object.fromEntries(result.positions),
        routingPoints: Object.fromEntries(result.routingPoints),
        bounds: result.bounds,
      };
    } catch (error) {
      logger.error({ err: error }, 'Error applying layout');
      return { positions: {}, bounds: { width: 0, height: 0 }, error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/toolPalette', async (params: GlspDiagramRequest) => {
    if (!initialized || !glspServer) {
      return { groups: [] };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { groups: [], error: 'No language registered' };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { groups: [], error: 'Document not found' };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      return glspServer.getToolPalette(context);
    } catch (error) {
      logger.error({ err: error }, 'Error getting tool palette');
      return { groups: [], error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/contextMenu', async (params: GlspContextMenuRequest) => {
    if (!initialized || !glspServer) {
      return { items: [] };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { items: [], error: 'No language registered' };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { items: [], error: 'Document not found' };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      return glspServer.getContextMenu(context, params.selectedIds, params.position);
    } catch (error) {
      logger.error({ err: error }, 'Error getting context menu');
      return { items: [], error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/saveModel', async (params: GlspDiagramRequest) => {
    if (!initialized || !glspServer) {
      return { success: false, error: 'Server not initialized' };
    }
    try {
      const contribution = registry.getByUri(params.uri);
      if (!contribution) {
        return { success: false, error: 'No language registered' };
      }
      const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
      if (!langiumDoc) {
        return { success: false, error: 'Document not found' };
      }
      const context = glspServer.createContext(langiumDoc, CancellationToken.None);
      const success = await glspServer.saveModel(context);
      return { success };
    } catch (error) {
      logger.error({ err: error }, 'Error saving diagram model');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  connection.onRequest('glsp/supportedOperations', async () => {
    if (!initialized || !glspServer) {
      return { operations: [] };
    }
    return { operations: glspServer.getSupportedOperations() };
  });

  // Model API Request Handlers
  interface ModelApiGetModelRequest { uri: string; options?: GetModelOptions; }
  interface ModelApiGetModelPartialRequest { uri: string; query: ModelQuery; }
  interface ModelApiSubscribeRequest { uri: string; options?: SubscriptionOptions; }
  interface ModelApiUnsubscribeRequest { subscriptionId: string; }

  const activeSubscriptions = new Map<string, { uri: string; clientId?: string }>();

  connection.onRequest('model/getModel', async (params: ModelApiGetModelRequest) => {
    if (!initialized || !astServer) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
    }
    return astServer.getModel(params.uri, params.options);
  });

  connection.onRequest('model/getModelPartial', async (params: ModelApiGetModelPartialRequest) => {
    if (!initialized || !astServer) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
    }
    return astServer.getModelPartial(params.uri, params.query);
  });

  connection.onRequest('model/subscribe', async (params: ModelApiSubscribeRequest) => {
    if (!initialized || !astServer) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
    }
    try {
      const handle = await astServer.subscribe(
        params.uri,
        (event) => {
          connection.sendNotification('model/changed', event);
        },
        params.options
      );
      activeSubscriptions.set(handle.id, { uri: params.uri, clientId: params.options?.clientId });
      return { success: true, data: { subscriptionId: handle.id, uri: handle.uri } };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) } };
    }
  });

  connection.onRequest('model/unsubscribe', async (params: ModelApiUnsubscribeRequest) => {
    if (!initialized || !astServer) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
    }
    try {
      await astServer.unsubscribeById(params.subscriptionId);
      activeSubscriptions.delete(params.subscriptionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) } };
    }
  });

  connection.onRequest('model/subscriptionCount', async () => {
    if (!initialized || !astServer) {
      return { count: 0 };
    }
    return { count: astServer.getSubscriptionCount() };
  });

  // Debounce map for document change notifications
  const diagramUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const DIAGRAM_UPDATE_DEBOUNCE_MS = 300;

  // Document change handlers for GLSP and Model API synchronization
  documents.onDidChangeContent((change) => {
    if (!initialized) return;
    const contribution = registry.getByUri(change.document.uri);
    if (!contribution) return;
    const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(change.document.uri));
    if (langiumDoc) {
      if (glspServer) {
        glspServer.onDocumentChanged(langiumDoc);

        // Debounce diagram model updates
        const existingTimer = diagramUpdateTimers.get(change.document.uri);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          diagramUpdateTimers.delete(change.document.uri);
          if (!glspServer) return;
          try {
            // Reload the diagram model and send notification
            const context = await glspServer.loadModel(langiumDoc, CancellationToken.None);
            if (context.gModel) {
              const updateIdRegistryData = (context as any).idRegistryData;
              connection.sendNotification('glsp/modelUpdated', {
                uri: change.document.uri,
                gModel: context.gModel,
                metadata: {
                  positions: context.metadata?.positions ? Object.fromEntries(context.metadata.positions) : {},
                  sizes: context.metadata?.sizes ? Object.fromEntries(context.metadata.sizes) : {},
                  sourceRanges: context.metadata?.sourceRanges ? Object.fromEntries(context.metadata.sourceRanges) : {},
                  idMap: updateIdRegistryData?.idMap,
                  fingerprints: updateIdRegistryData?.fingerprints,
                },
              });
            }
          } catch (error) {
            logger.error({ err: error }, 'Error sending diagram model update');
          }
        }, DIAGRAM_UPDATE_DEBOUNCE_MS);

        diagramUpdateTimers.set(change.document.uri, timer);
      }
      if (astServer) {
        astServer.onDocumentChanged(langiumDoc);
      }
    }
  });

  documents.onDidSave?.((event) => {
    if (!initialized) return;
    const contribution = registry.getByUri(event.document.uri);
    if (!contribution) return;
    const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(event.document.uri));
    if (langiumDoc && astServer) {
      astServer.onDocumentSaved(langiumDoc);
    }
  });

  documents.onDidClose((event) => {
    if (!initialized) return;
    if (glspServer) {
      glspServer.onDocumentClosed(event.document.uri);
    }
    if (astServer) {
      astServer.onDocumentClosed(event.document.uri);
    }
  });

  // Listen for document events
  documents.listen(connection);

  return {
    registry,
    connection,
    documents,
    get glspServer() { return glspServer; },
    get astServer() { return astServer; },
    start: () => {
      connection.listen();
      logger.info('Sanyam Language Server started');
    },
  };
}

/**
 * Re-export types that consumers need.
 */
export type { LanguageContributionInterface } from '@sanyam/types';
export { LanguageRegistry } from './language-registry.js';

// Re-export GLSP server for backend integration
export { GlspServer, createGlspServer } from './glsp/glsp-server.js';
export type { GlspServerConfig } from './glsp/glsp-server.js';
