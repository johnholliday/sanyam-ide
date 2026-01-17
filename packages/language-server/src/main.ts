/**
 * Unified Language Server Entry Point
 *
 * Main entry point for the unified LSP/GLSP language server.
 * Initializes shared services, loads language contributions,
 * and starts the server.
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
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import type { LspFeatureProviders, GlspFeatureProviders, LanguageContribution } from '@sanyam/types';
import { languageRegistry, LanguageRegistry } from './language-registry.js';
import { loadFromGeneratedRegistry } from './discovery/contribution-loader.js';

// Import GLSP server components
import { GlspServer, createGlspServer } from './glsp/glsp-server.js';
import type { Operation, OperationResult } from './glsp/glsp-server.js';

// Import Model API components
import { AstServer, createAstServer } from './model/ast-server.js';
import type { ModelQuery, GetModelOptions, SubscriptionOptions } from '@sanyam/types';

// Import generated registry (will be generated at build time)
// This import will fail until the registry is generated
// eslint-disable-next-line @typescript-eslint/no-require-imports
let GRAMMAR_REGISTRY: { GRAMMAR_REGISTRY: readonly import('@sanyam/types').LanguageContributionInterface[] };
try {
  // Dynamic import to handle case where registry hasn't been generated yet
  GRAMMAR_REGISTRY = await import('./generated/grammar-registry.js');
} catch {
  console.warn('Grammar registry not found. Run `npm run generate:registry` first.');
  GRAMMAR_REGISTRY = { GRAMMAR_REGISTRY: [] };
}

/**
 * Create the LSP connection.
 *
 * In a real server, this creates a connection over stdio or sockets.
 */
const connection = createConnection(ProposedFeatures.all);

/**
 * Document manager for text documents.
 */
const documents = new TextDocuments(TextDocument);

/**
 * Whether the server has been initialized.
 */
let initialized = false;

/**
 * GLSP server instance for diagram operations.
 *
 * This is initialized during server startup and provides:
 * - AST to GModel conversion
 * - Diagram operations (create, delete, move, connect)
 * - Bidirectional synchronization with text documents
 */
let glspServer: GlspServer | null = null;

/**
 * AST Server instance for Model API.
 *
 * Provides programmatic access to AST models with:
 * - getModel: Retrieve current model state
 * - subscribe/unsubscribe: Change notifications
 * - Query support for partial model retrieval
 */
let astServer: AstServer | null = null;

/**
 * Default LSP providers (will be populated with actual implementations).
 *
 * These are placeholders that will be implemented in later phases.
 */
function createDefaultLspProviders(): Required<LspFeatureProviders> {
  // Return empty implementations as placeholders
  // These will be replaced with actual default providers in Phase 3
  return {} as Required<LspFeatureProviders>;
}

/**
 * Default GLSP providers.
 *
 * Returns the default GLSP providers from the glsp-server-module.
 * These can be overridden by language contributions.
 */
function createDefaultGlspProviders(): Required<GlspFeatureProviders> {
  // Import the default providers from glsp-server-module
  // These provide manifest-driven AST to GModel conversion
  const { allDefaultGlspProviders } = require('./glsp/glsp-server-module.js');
  return allDefaultGlspProviders as Required<GlspFeatureProviders>;
}

/**
 * Initialize the GLSP server.
 *
 * Creates a GLSP server instance that handles diagram operations
 * for all registered languages.
 *
 * @param langiumServices - Langium core services for document handling
 */
function initializeGlspServer(langiumServices: any): void {
  glspServer = createGlspServer(langiumServices, {
    autoLayout: true,
    validation: true,
  });

  console.log('GLSP server initialized with auto-layout and validation.');
}

/**
 * Register a language contribution with the GLSP server.
 *
 * @param contribution - Language contribution to register
 */
function registerLanguageWithGlsp(contribution: LanguageContribution): void {
  if (!glspServer) {
    console.warn('GLSP server not initialized. Skipping language registration.');
    return;
  }

  glspServer.registerLanguage(contribution);
  console.log(`Registered language '${contribution.languageId}' with GLSP server.`);
}

/**
 * Initialize the AST Server (Model API).
 *
 * Creates an AST server instance that provides programmatic access
 * to AST models with change notifications.
 *
 * @param langiumServices - Langium shared services
 */
function initializeAstServer(langiumServices: any): void {
  astServer = createAstServer(langiumServices, {
    subscriptionConfig: {
      defaultDebounceMs: 100,
      maxDebounceMs: 500, // SC-009: 500ms delivery target
    },
    logApiCalls: false,
  });

  console.log('AST Server (Model API) initialized.');
}

/**
 * Initialize the language server.
 */
connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  console.log('Initializing Sanyam Language Server...');
  console.log(`Workspace: ${params.workspaceFolders?.[0]?.uri ?? 'none'}`);

  try {
    // Load all language contributions
    const loadResult = await loadFromGeneratedRegistry(
      GRAMMAR_REGISTRY,
      languageRegistry,
      {
        context: { connection, ...NodeFileSystem },
        defaultLspProviders: createDefaultLspProviders(),
        defaultGlspProviders: createDefaultGlspProviders(),
      }
    );

    if (loadResult.errors.length > 0) {
      console.error('Errors loading languages:');
      for (const error of loadResult.errors) {
        console.error(`  - ${error}`);
      }
    }

    console.log(`Loaded ${loadResult.loadedCount} language(s):`);
    for (const langId of languageRegistry.getAllLanguageIds()) {
      console.log(`  - ${langId}`);
    }

    // Initialize GLSP server with Langium services
    // The GLSP server needs access to Langium's document management
    // for AST to GModel conversion and bidirectional synchronization
    try {
      // Create a minimal Langium services object for GLSP
      const langiumServices = {
        shared: {
          workspace: {
            LangiumDocuments: {
              // Document access will be provided through the registry
              getDocument: (uri: string | import('langium').URI) => {
                const uriStr = typeof uri === 'string' ? uri : uri.toString();
                const contribution = languageRegistry.getByUri(uriStr);
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
      for (const langId of languageRegistry.getAllLanguageIds()) {
        const contribution = languageRegistry.getByLanguageId(langId);
        if (contribution) {
          registerLanguageWithGlsp(contribution as unknown as LanguageContribution);
        }
      }
    } catch (glspError) {
      console.error('Failed to initialize GLSP server:', glspError);
      // Continue without GLSP - LSP features will still work
    }

    // Initialize AST Server (Model API)
    try {
      // Create a minimal Langium services object for AST Server
      const langiumSharedServices = {
        workspace: {
          LangiumDocuments: {
            getDocument: (uri: any) => {
              const uriStr = typeof uri === 'string' ? uri : uri?.toString?.() ?? '';
              const contribution = languageRegistry.getByUri(uriStr);
              return contribution?.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(uri);
            },
            all: [] as any[],
          },
        },
      };

      initializeAstServer(langiumSharedServices);
    } catch (astError) {
      console.error('Failed to initialize AST Server:', astError);
      // Continue without Model API - LSP/GLSP features will still work
    }

    initialized = true;

    // Return capabilities
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,

        // Completion
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', ':', '<', '"', "'", '/'],
        },

        // Hover
        hoverProvider: true,

        // Navigation
        definitionProvider: true,
        declarationProvider: true,
        typeDefinitionProvider: true,
        implementationProvider: true,
        referencesProvider: true,

        // Symbols
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        documentHighlightProvider: true,

        // Code actions
        codeActionProvider: {
          codeActionKinds: [
            'quickfix',
            'refactor',
            'refactor.extract',
            'refactor.inline',
            'refactor.rewrite',
            'source',
            'source.organizeImports',
          ],
        },

        // Rename
        renameProvider: {
          prepareProvider: true,
        },

        // Formatting
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,

        // Folding
        foldingRangeProvider: true,

        // Selection
        selectionRangeProvider: true,

        // Semantic tokens
        semanticTokensProvider: {
          legend: {
            tokenTypes: [
              'namespace', 'type', 'class', 'enum', 'interface',
              'struct', 'typeParameter', 'parameter', 'variable',
              'property', 'enumMember', 'event', 'function',
              'method', 'macro', 'keyword', 'modifier', 'comment',
              'string', 'number', 'regexp', 'operator', 'decorator',
            ],
            tokenModifiers: [
              'declaration', 'definition', 'readonly', 'static',
              'deprecated', 'abstract', 'async', 'modification',
              'documentation', 'defaultLibrary',
            ],
          },
          full: {
            delta: true,
          },
          range: true,
        },

        // Call hierarchy
        callHierarchyProvider: true,

        // Type hierarchy
        typeHierarchyProvider: true,

        // Inlay hints
        inlayHintProvider: {
          resolveProvider: true,
        },

        // Code lens
        codeLensProvider: {
          resolveProvider: true,
        },

        // Links
        documentLinkProvider: {
          resolveProvider: true,
        },

        // Signature help
        signatureHelpProvider: {
          triggerCharacters: ['(', ','],
          retriggerCharacters: [')'],
        },

        // Linked editing
        linkedEditingRangeProvider: true,
      },
    };
  } catch (error) {
    console.error('Failed to initialize server:', error);
    throw error;
  }
});

/**
 * Server initialized notification.
 */
connection.onInitialized(() => {
  console.log('Sanyam Language Server initialized.');
});

/**
 * Handle shutdown.
 */
connection.onShutdown(() => {
  console.log('Shutting down Sanyam Language Server...');

  // Clean up AST server (Model API)
  if (astServer) {
    astServer.dispose();
    astServer = null;
  }
});

/**
 * Handle exit.
 */
connection.onExit(() => {
  console.log('Sanyam Language Server exited.');
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LSP Request Handlers (Placeholders)
// These will be implemented in Phase 3 (User Story 1)
// ═══════════════════════════════════════════════════════════════════════════════

connection.onCompletion(async (params) => {
  if (!initialized) return null;
  const language = languageRegistry.getByUri(params.textDocument.uri);
  if (!language) return null;
  // TODO: Implement completion handling
  return null;
});

connection.onCompletionResolve(async (item) => {
  // TODO: Implement completion resolve
  return item;
});

connection.onHover(async (params) => {
  if (!initialized) return null;
  const language = languageRegistry.getByUri(params.textDocument.uri);
  if (!language) return null;
  // TODO: Implement hover handling
  return null;
});

connection.onDefinition(async (params) => {
  if (!initialized) return null;
  const language = languageRegistry.getByUri(params.textDocument.uri);
  if (!language) return null;
  // TODO: Implement definition handling
  return null;
});

connection.onReferences(async (params) => {
  if (!initialized) return null;
  const language = languageRegistry.getByUri(params.textDocument.uri);
  if (!language) return null;
  // TODO: Implement references handling
  return null;
});

connection.onDocumentSymbol(async (params) => {
  if (!initialized) return null;
  const language = languageRegistry.getByUri(params.textDocument.uri);
  if (!language) return null;
  // TODO: Implement document symbol handling
  return null;
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLSP Request Handlers
// These handle diagram operations via custom JSON-RPC methods
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GLSP request types for diagram operations.
 */
interface GlspDiagramRequest {
  uri: string;
}

interface GlspLoadModelRequest extends GlspDiagramRequest { }

interface GlspOperationRequest extends GlspDiagramRequest {
  operation: Operation;
}

interface GlspValidateRequest extends GlspDiagramRequest { }

interface GlspLayoutRequest extends GlspDiagramRequest {
  options?: {
    algorithm?: 'grid' | 'tree' | 'force-directed';
    spacing?: number;
  };
}

interface GlspToolPaletteRequest extends GlspDiagramRequest { }

interface GlspContextMenuRequest extends GlspDiagramRequest {
  selectedIds: string[];
  position?: { x: number; y: number };
}

interface GlspSaveModelRequest extends GlspDiagramRequest { }

/**
 * Load diagram model for a document.
 *
 * Converts the AST to GModel representation for rendering.
 */
connection.onRequest('glsp/loadModel', async (params: GlspLoadModelRequest) => {
  if (!initialized || !glspServer) {
    return { success: false, error: 'Server not initialized' };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
    if (!contribution) {
      return { success: false, error: `No language registered for URI: ${params.uri}` };
    }

    // Get Langium document from contribution
    const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
    if (!langiumDoc) {
      return { success: false, error: `Document not found: ${params.uri}` };
    }

    // Load model through GLSP server
    const context = await glspServer.loadModel(langiumDoc, CancellationToken.None);

    return {
      success: true,
      gModel: context.gModel,
      metadata: {
        positions: context.metadata?.positions ? Object.fromEntries(context.metadata.positions) : {},
        sizes: context.metadata?.sizes ? Object.fromEntries(context.metadata.sizes) : {},
      },
    };
  } catch (error) {
    console.error('Error loading diagram model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Execute a diagram operation.
 *
 * Handles create, delete, move, and connect operations.
 */
connection.onRequest('glsp/executeOperation', async (params: GlspOperationRequest) => {
  if (!initialized || !glspServer) {
    return { success: false, error: 'Server not initialized' };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
    if (!contribution) {
      return { success: false, error: `No language registered for URI: ${params.uri}` };
    }

    const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(params.uri));
    if (!langiumDoc) {
      return { success: false, error: `Document not found: ${params.uri}` };
    }

    // Create context and execute operation
    const context = glspServer.createContext(langiumDoc, CancellationToken.None);
    const result = glspServer.executeOperation(context, params.operation);

    return result;
  } catch (error) {
    console.error('Error executing diagram operation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Validate diagram model.
 *
 * Returns validation markers for the diagram.
 */
connection.onRequest('glsp/validate', async (params: GlspValidateRequest) => {
  if (!initialized || !glspServer) {
    return { markers: [], isValid: true, errorCount: 0, warningCount: 0 };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
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
    console.error('Error validating diagram:', error);
    return {
      markers: [],
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Apply layout to diagram.
 *
 * Calculates positions for diagram elements.
 */
connection.onRequest('glsp/layout', async (params: GlspLayoutRequest) => {
  if (!initialized || !glspServer) {
    return { positions: {}, bounds: { width: 0, height: 0 } };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
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
    console.error('Error applying layout:', error);
    return {
      positions: {},
      bounds: { width: 0, height: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Get tool palette for diagram.
 *
 * Returns available tools for creating elements.
 */
connection.onRequest('glsp/toolPalette', async (params: GlspToolPaletteRequest) => {
  if (!initialized || !glspServer) {
    return { groups: [] };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
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
    console.error('Error getting tool palette:', error);
    return {
      groups: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Get context menu for selected elements.
 *
 * Returns available actions for the selection.
 */
connection.onRequest('glsp/contextMenu', async (params: GlspContextMenuRequest) => {
  if (!initialized || !glspServer) {
    return { items: [] };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
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
    console.error('Error getting context menu:', error);
    return {
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Save diagram model.
 *
 * Persists diagram metadata (positions, sizes, routing points).
 */
connection.onRequest('glsp/saveModel', async (params: GlspSaveModelRequest) => {
  if (!initialized || !glspServer) {
    return { success: false, error: 'Server not initialized' };
  }

  try {
    const contribution = languageRegistry.getByUri(params.uri);
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
    console.error('Error saving diagram model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Get supported operations for a language.
 */
connection.onRequest('glsp/supportedOperations', async (params: GlspDiagramRequest) => {
  if (!initialized || !glspServer) {
    return { operations: [] };
  }

  return {
    operations: glspServer.getSupportedOperations(),
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Model API Request Handlers
// These provide programmatic access to AST models via custom JSON-RPC methods
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Model API request types.
 */
interface ModelApiGetModelRequest {
  uri: string;
  options?: GetModelOptions;
}

interface ModelApiGetModelPartialRequest {
  uri: string;
  query: ModelQuery;
}

interface ModelApiSubscribeRequest {
  uri: string;
  options?: SubscriptionOptions;
}

interface ModelApiUnsubscribeRequest {
  subscriptionId: string;
}

/**
 * Active subscriptions mapped by subscription ID.
 * Stores callback functions for JSON-RPC notification delivery.
 */
const activeSubscriptions = new Map<string, { uri: string; clientId?: string }>();

/**
 * Get the full model for a document.
 *
 * Returns the serialized AST model for programmatic access.
 */
connection.onRequest('model/getModel', async (params: ModelApiGetModelRequest) => {
  if (!initialized || !astServer) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
  }

  return astServer.getModel(params.uri, params.options);
});

/**
 * Get partial model data based on a query.
 *
 * Supports queries by node ID, node type, or path.
 */
connection.onRequest('model/getModelPartial', async (params: ModelApiGetModelPartialRequest) => {
  if (!initialized || !astServer) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
  }

  return astServer.getModelPartial(params.uri, params.query);
});

/**
 * Subscribe to model changes.
 *
 * Returns a subscription ID that can be used to unsubscribe.
 * Changes are delivered via 'model/changed' notifications.
 */
connection.onRequest('model/subscribe', async (params: ModelApiSubscribeRequest) => {
  if (!initialized || !astServer) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
  }

  try {
    const handle = await astServer.subscribe(
      params.uri,
      (event) => {
        // Send change notification to client
        connection.sendNotification('model/changed', event);
      },
      params.options
    );

    // Track subscription for cleanup
    activeSubscriptions.set(handle.id, {
      uri: params.uri,
      clientId: params.options?.clientId,
    });

    return {
      success: true,
      data: {
        subscriptionId: handle.id,
        uri: handle.uri,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
});

/**
 * Unsubscribe from model changes.
 */
connection.onRequest('model/unsubscribe', async (params: ModelApiUnsubscribeRequest) => {
  if (!initialized || !astServer) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server not initialized' } };
  }

  try {
    await astServer.unsubscribeById(params.subscriptionId);
    activeSubscriptions.delete(params.subscriptionId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
});

/**
 * Get active subscription count for monitoring.
 */
connection.onRequest('model/subscriptionCount', async () => {
  if (!initialized || !astServer) {
    return { count: 0 };
  }

  return { count: astServer.getSubscriptionCount() };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Document Change Events for GLSP Synchronization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle document changes for GLSP and Model API synchronization.
 *
 * When a text document changes, notify both the GLSP server and AST server
 * so they can update their internal state and trigger notifications.
 */
documents.onDidChangeContent((change) => {
  if (!initialized) return;

  const contribution = languageRegistry.getByUri(change.document.uri);
  if (!contribution) return;

  const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(change.document.uri));
  if (langiumDoc) {
    // Notify GLSP server (T127)
    if (glspServer) {
      glspServer.onDocumentChanged(langiumDoc);
    }

    // Notify AST server for Model API subscriptions (T127)
    if (astServer) {
      astServer.onDocumentChanged(langiumDoc);
    }
  }
});

/**
 * Handle document save for Model API notifications.
 */
documents.onDidSave?.((event) => {
  if (!initialized) return;

  const contribution = languageRegistry.getByUri(event.document.uri);
  if (!contribution) return;

  const langiumDoc = contribution.services?.shared?.workspace?.LangiumDocuments?.getDocument?.(URI.parse(event.document.uri));
  if (langiumDoc && astServer) {
    astServer.onDocumentSaved(langiumDoc);
  }
});

/**
 * Handle document close for GLSP and Model API cleanup.
 */
documents.onDidClose((event) => {
  if (!initialized) return;

  // Notify GLSP server
  if (glspServer) {
    glspServer.onDocumentClosed(event.document.uri);
  }

  // Notify AST server (T127)
  if (astServer) {
    astServer.onDocumentClosed(event.document.uri);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Start the server
// ═══════════════════════════════════════════════════════════════════════════════

// Listen for document events
documents.listen(connection);

// Start listening
connection.listen();

console.log('Sanyam Language Server started.');

export { connection, documents, languageRegistry, glspServer, astServer };
