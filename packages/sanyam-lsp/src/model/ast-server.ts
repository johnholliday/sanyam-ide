/**
 * AST Server (T125)
 *
 * Model API server providing programmatic access to AST models.
 * Features:
 * - getModel: Retrieve current model state
 * - getModelPartial: Query specific nodes
 * - subscribe/unsubscribe: Change notifications
 *
 * @packageDocumentation
 */

import type { LangiumDocument, LangiumSharedCoreServices } from 'langium';
import type {
  ModelApiResponse,
  AstModelData,
  ModelQuery,
  GetModelOptions,
  SubscriptionHandle,
  SubscriptionOptions,
  NodeChange,
  ChangeType,
} from '@sanyam/types';
import {
  ModelConverter,
  createModelConverter,
  findNodeById,
  findNodesByType,
  getNodeByPath,
} from './model-converter.js';
import {
  SubscriptionService,
  createSubscriptionService,
  type ChangeCallback,
  type SubscriptionServiceConfig,
} from './subscription-service.js';

/**
 * AST Server configuration.
 */
export interface AstServerConfig {
  /** Subscription service configuration */
  subscriptionConfig?: SubscriptionServiceConfig;
  /** Whether to log API calls */
  logApiCalls?: boolean;
}

/**
 * AST Server for Model API.
 */
export class AstServer {
  private converter: ModelConverter;
  private subscriptionService: SubscriptionService;
  private config: AstServerConfig;

  constructor(
    private readonly services: LangiumSharedCoreServices,
    config?: AstServerConfig
  ) {
    this.config = config ?? {};
    this.converter = createModelConverter();

    // Create subscription service with content provider
    this.subscriptionService = createSubscriptionService({
      ...this.config.subscriptionConfig,
      contentProvider: (uri) => this.getModelContent(uri),
    });
  }

  /**
   * Get the full model for a document.
   *
   * @param uri - Document URI
   * @param options - Optional retrieval options
   * @returns Model data or error response
   */
  async getModel(
    uri: string,
    options?: GetModelOptions
  ): Promise<ModelApiResponse<AstModelData>> {
    this.log(`getModel: ${uri}`);

    // Validate URI
    if (!this.isValidUri(uri)) {
      return {
        success: false,
        error: { code: 'INVALID_URI', message: 'Invalid URI format' },
      };
    }

    // Get document
    const document = this.getDocument(uri);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: `Document not found: ${uri}` },
      };
    }

    // Convert AST
    const ast = document.parseResult?.value;
    if (!ast) {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Document has no parsed AST' },
      };
    }

    const converted = this.converter.convert(ast);
    const hasErrors = (document.parseResult?.parserErrors?.length ?? 0) > 0;

    const data: AstModelData = {
      uri,
      version: document.textDocument?.version ?? 1,
      languageId: document.textDocument?.languageId ?? 'unknown',
      root: converted.data,
      hasErrors,
    };

    if (options?.includeDiagnostics) {
      data.diagnostics = document.diagnostics ?? [];
    }

    return { success: true, data };
  }

  /**
   * Get partial model data based on a query.
   *
   * @param uri - Document URI
   * @param query - Query parameters
   * @returns Partial model data or error response
   */
  async getModelPartial(
    uri: string,
    query: ModelQuery
  ): Promise<ModelApiResponse<{ node?: unknown; nodes?: unknown[] }>> {
    this.log(`getModelPartial: ${uri}, query: ${JSON.stringify(query)}`);

    // Validate URI
    if (!this.isValidUri(uri)) {
      return {
        success: false,
        error: { code: 'INVALID_URI', message: 'Invalid URI format' },
      };
    }

    // Get document
    const document = this.getDocument(uri);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: `Document not found: ${uri}` },
      };
    }

    const ast = document.parseResult?.value;
    if (!ast) {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Document has no parsed AST' },
      };
    }

    // Convert full AST for querying
    const converted = this.converter.convert(ast);

    // Find by node ID
    if (query.nodeId) {
      const node = findNodeById(converted.data, query.nodeId);
      if (!node) {
        return {
          success: false,
          error: { code: 'NODE_NOT_FOUND', message: `Node not found: ${query.nodeId}` },
        };
      }
      return { success: true, data: { node } };
    }

    // Find by node type
    if (query.nodeType) {
      const nodes = findNodesByType(converted.data, query.nodeType);
      return { success: true, data: { nodes } };
    }

    // Find by path
    if (query.path) {
      const node = getNodeByPath(converted.data, query.path);
      if (node === undefined) {
        return {
          success: false,
          error: { code: 'NODE_NOT_FOUND', message: `Path not found: ${query.path}` },
        };
      }
      return { success: true, data: { node } };
    }

    return {
      success: false,
      error: { code: 'INVALID_QUERY', message: 'No valid query parameters provided' },
    };
  }

  /**
   * Subscribe to model changes.
   *
   * @param uri - Document URI to subscribe to
   * @param callback - Function to call when changes occur
   * @param options - Subscription options
   * @returns Subscription handle
   */
  async subscribe(
    uri: string,
    callback: ChangeCallback,
    options?: SubscriptionOptions
  ): Promise<SubscriptionHandle> {
    this.log(`subscribe: ${uri}`);
    return this.subscriptionService.subscribe(uri, callback, options);
  }

  /**
   * Unsubscribe from model changes.
   *
   * @param handle - Subscription handle
   */
  async unsubscribe(handle: SubscriptionHandle): Promise<void> {
    this.log(`unsubscribe: ${handle.id}`);
    await this.subscriptionService.unsubscribe(handle);
  }

  /**
   * Unsubscribe by subscription ID.
   *
   * @param id - Subscription ID
   */
  async unsubscribeById(id: string): Promise<void> {
    this.log(`unsubscribeById: ${id}`);
    await this.subscriptionService.unsubscribeById(id);
  }

  /**
   * Handle document change - notify subscribers.
   *
   * @param document - Changed document
   * @param changes - Node-level changes (if available)
   */
  onDocumentChanged(
    document: LangiumDocument,
    changes: NodeChange[] = []
  ): void {
    const uri = document.uri.toString();
    const version = document.textDocument?.version ?? 1;

    this.log(`onDocumentChanged: ${uri} v${version}`);

    this.subscriptionService.notifyChange(uri, 'update', version, changes);
  }

  /**
   * Handle document save.
   *
   * @param document - Saved document
   */
  onDocumentSaved(document: LangiumDocument): void {
    const uri = document.uri.toString();
    const version = document.textDocument?.version ?? 1;

    this.log(`onDocumentSaved: ${uri}`);

    this.subscriptionService.notifyChange(uri, 'saved', version, []);
  }

  /**
   * Handle document close.
   *
   * @param uri - Closed document URI
   */
  onDocumentClosed(uri: string): void {
    this.log(`onDocumentClosed: ${uri}`);

    this.subscriptionService.notifyChange(uri, 'closed', 0, []);
  }

  /**
   * Handle client disconnect.
   *
   * @param clientId - Disconnected client ID
   */
  onClientDisconnect(clientId: string): void {
    this.log(`onClientDisconnect: ${clientId}`);

    this.subscriptionService.onClientDisconnect(clientId);
  }

  /**
   * Get active subscriptions for monitoring.
   */
  getActiveSubscriptions(): SubscriptionHandle[] {
    return this.subscriptionService.getActiveSubscriptions();
  }

  /**
   * Get subscription count.
   */
  getSubscriptionCount(): number {
    return this.subscriptionService.getSubscriptionCount();
  }

  /**
   * Dispose the server and clean up resources.
   */
  dispose(): void {
    this.subscriptionService.dispose();
  }

  /**
   * Get model content for a URI (used by subscription service).
   */
  private async getModelContent(uri: string): Promise<unknown> {
    const document = this.getDocument(uri);
    if (!document?.parseResult?.value) {
      return undefined;
    }

    const converted = this.converter.convert(document.parseResult.value);
    return converted.data;
  }

  /**
   * Get a document from the document store.
   */
  private getDocument(uri: string): LangiumDocument | undefined {
    try {
      const documents = this.services.workspace.LangiumDocuments;
      return documents.getDocument({ path: uri, scheme: 'file' } as any) ??
             documents.getDocument({ toString: () => uri } as any);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if URI is valid.
   */
  private isValidUri(uri: string): boolean {
    return uri.startsWith('file://') || uri.startsWith('untitled:');
  }

  /**
   * Log a message if logging is enabled.
   */
  private log(message: string): void {
    if (this.config.logApiCalls) {
      console.log(`[AstServer] ${message}`);
    }
  }
}

/**
 * Create a new AstServer instance.
 *
 * @param services - Langium shared services
 * @param config - Optional configuration
 * @returns New AstServer instance
 */
export function createAstServer(
  services: LangiumSharedCoreServices,
  config?: AstServerConfig
): AstServer {
  return new AstServer(services, config);
}
