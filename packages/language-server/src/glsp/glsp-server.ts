/**
 * GLSP Server (T081, T113)
 *
 * Main GLSP server implementation for diagram operations.
 * Uses the provider resolver pattern for consistent handling of:
 * - Disabled feature checks
 * - Custom provider resolution
 * - Deep merge for partial overrides
 *
 * @packageDocumentation
 */

import type { LangiumCoreServices, LangiumDocument } from 'langium';
import type { CancellationToken } from 'vscode-languageserver';
import type { GlspContext, LanguageContribution, GlspFeatureProviders } from '@sanyam/types';
import { GlspContextFactory, createGlspContextFactory } from './glsp-context-factory.js';
import { LangiumSourceModelStorage, createLangiumSourceModelStorage } from './langium-source-model-storage.js';
import type { IdRegistryLayoutData, ElementIdRegistry } from './element-id-registry.js';
import {
  OperationHandlerRegistry,
  ProviderRegistry,
  allDefaultGlspHandlers,
  allDefaultGlspProviders,
} from './glsp-server-module.js';
import {
  GlspProviderResolver,
  createGlspProviderResolver,
  type GlspProviderResolverOptions,
} from './provider-resolver.js';
import type { CreateNodeOperation, CreateNodeResult } from './handlers/create-node-handler.js';
import type { DeleteElementOperation, DeleteElementResult } from './handlers/delete-element-handler.js';
import type { ChangeBoundsOperation, ChangeBoundsResult } from './handlers/change-bounds-handler.js';
import type { ReconnectEdgeOperation, ReconnectEdgeResult } from './handlers/reconnect-edge-handler.js';
import type { CreateEdgeOperation, CreateEdgeResult } from './handlers/create-edge-handler.js';
import type { LayoutResult, LayoutOptions } from './providers/layout-provider.js';
import type { ValidationResult } from './providers/diagram-validation-provider.js';
import type { ToolPalette } from './providers/tool-palette-provider.js';
import type { ContextMenu } from './providers/context-menu-provider.js';
import {
  PropertyProvider,
  createPropertyProvider,
  type PropertyExtractionResult,
  type PropertyUpdateResult,
} from './providers/property-provider.js';

/**
 * Operation type union.
 */
export type Operation =
  | CreateNodeOperation
  | DeleteElementOperation
  | ChangeBoundsOperation
  | ReconnectEdgeOperation
  | CreateEdgeOperation;

/**
 * Operation result type union.
 */
export type OperationResult =
  | CreateNodeResult
  | DeleteElementResult
  | ChangeBoundsResult
  | ReconnectEdgeResult
  | CreateEdgeResult;

/**
 * GLSP server configuration.
 */
export interface GlspServerConfig {
  /** Custom providers */
  providers?: Partial<GlspFeatureProviders>;
  /** Whether to enable auto-layout */
  autoLayout?: boolean;
  /** Whether to enable validation */
  validation?: boolean;
  /** Provider resolver options */
  resolverOptions?: Partial<GlspProviderResolverOptions>;
}

/**
 * GLSP Server for diagram operations.
 *
 * Uses the provider resolver pattern to resolve providers based on
 * language contributions, supporting:
 * - Custom provider overrides
 * - Deep merge for partial overrides
 * - Disabled feature handling
 * - Resolution logging
 */
export class GlspServer {
  private contextFactory: GlspContextFactory;
  private sourceModelStorage: LangiumSourceModelStorage;
  private handlerRegistry: OperationHandlerRegistry;
  private providerRegistry: ProviderRegistry;
  private providerResolver: GlspProviderResolver;
  private propertyProvider: PropertyProvider;
  private languageContributions: Map<string, LanguageContribution> = new Map();
  private config: GlspServerConfig;

  /**
   * Persistent idRegistry cache keyed by document URI.
   * The sourceModelStorage may fail to create model states when the
   * constructor receives LangiumSharedServices instead of LangiumCoreServices.
   * This cache ensures the idRegistry created during loadModel() is available
   * to subsequent createContext() / getProperties() calls.
   */
  private idRegistries: Map<string, ElementIdRegistry> = new Map();

  constructor(
    private readonly services: LangiumCoreServices,
    config?: GlspServerConfig
  ) {
    this.config = config ?? {};
    // Cast to LangiumServices - the GLSP context factory uses a subset of services
    this.contextFactory = createGlspContextFactory(services as any);
    this.sourceModelStorage = createLangiumSourceModelStorage(services);
    // Initialize registries
    this.handlerRegistry = new OperationHandlerRegistry();
    this.providerRegistry = new ProviderRegistry();

    // T027: Initialize property provider
    this.propertyProvider = createPropertyProvider();

    // Initialize provider resolver
    this.providerResolver = createGlspProviderResolver({
      deepMerge: true,
      ...this.config.resolverOptions,
    });

    // Register default handlers
    this.registerDefaultHandlers();

    // Register default providers and set them in the resolver
    this.registerDefaultProviders();
  }

  /**
   * Register default operation handlers.
   */
  private registerDefaultHandlers(): void {
    this.handlerRegistry.register('createNode', allDefaultGlspHandlers.createNode);
    this.handlerRegistry.register('delete', allDefaultGlspHandlers.deleteElement);
    this.handlerRegistry.register('changeBounds', allDefaultGlspHandlers.changeBounds);
    this.handlerRegistry.register('reconnectEdge', allDefaultGlspHandlers.reconnectEdge);
    this.handlerRegistry.register('createEdge', allDefaultGlspHandlers.createEdge);
  }

  /**
   * Register default providers.
   */
  private registerDefaultProviders(): void {
    const customProviders = this.config.providers ?? {};

    // Register in provider registry for backward compatibility
    this.providerRegistry.register(
      'astToGModel',
      customProviders.astToGModel ?? allDefaultGlspProviders.astToGModel
    );
    this.providerRegistry.register(
      'gmodelToAst',
      customProviders.gmodelToAst ?? allDefaultGlspProviders.gmodelToAst
    );
    this.providerRegistry.register(
      'toolPalette',
      customProviders.toolPalette ?? allDefaultGlspProviders.toolPalette
    );
    this.providerRegistry.register(
      'validation',
      customProviders.validation ?? allDefaultGlspProviders.validation
    );
    this.providerRegistry.register(
      'layout',
      customProviders.layout ?? allDefaultGlspProviders.layout
    );
    this.providerRegistry.register(
      'contextMenu',
      customProviders.contextMenu ?? allDefaultGlspProviders.contextMenu
    );

    // Set defaults in the provider resolver for language-specific resolution
    this.providerResolver.setDefaultProviders(allDefaultGlspProviders as unknown as GlspFeatureProviders);
  }

  /**
   * Register a language contribution.
   */
  registerLanguage(contribution: LanguageContribution): void {
    this.languageContributions.set(contribution.languageId, contribution);

  }

  /**
   * Get language contribution for a document.
   */
  private getContribution(document: LangiumDocument): LanguageContribution | undefined {
    const languageId = document.textDocument.languageId;
    return this.languageContributions.get(languageId);
  }

  /**
   * Create a GLSP context for a document.
   */
  createContext(
    document: LangiumDocument,
    token: CancellationToken
  ): GlspContext {
    const context = this.contextFactory.createContext(document, token, {
      autoLayout: this.config.autoLayout,
      validation: this.config.validation,
    });

    // Add contribution to context
    const contribution = this.getContribution(document);
    if (contribution) {
      (context as any).manifest = contribution.manifest;
    }

    // Wire the element ID registry into every context for UUID→AST lookups.
    // Try sourceModelStorage first, fall back to the persistent cache.
    const uri = document.uri.toString();
    const modelState = this.sourceModelStorage.getModelState(uri);
    if (modelState) {
      (context as any).idRegistry = modelState.idRegistry;
    } else if (this.idRegistries.has(uri)) {
      (context as any).idRegistry = this.idRegistries.get(uri);
    }

    return context;
  }

  /**
   * Load a diagram model for a document.
   */
  async loadModel(
    document: LangiumDocument,
    token: CancellationToken
  ): Promise<GlspContext> {
    // Update the cached model state with the fresh document before creating context,
    // otherwise createContext returns stale cached AST data
    this.contextFactory.updateModelState(document);

    // Create context
    const context = this.createContext(document, token);
    const contribution = this.getContribution(document);

    // Load from storage, always forcing reload so we use the freshly-parsed document
    await this.sourceModelStorage.load(document.uri.toString(), {
      loadMetadata: true,
      forceReload: true,
    });

    // Wire the element ID registry into the context for the converter
    const modelState = this.sourceModelStorage.getModelState(document.uri.toString());
    if (modelState) {
      (context as any).idRegistry = modelState.idRegistry;
    }

    // Convert AST to GModel using resolver if contribution exists
    const astToGModel = this.getResolvedProvider('astToGModel', contribution);
    if (astToGModel?.convert) {
      // Pass the full context to the converter - it expects GlspContext with document, root, etc.
      const gModelResult = astToGModel.convert(context);
      // Handle both sync and async results
      const gModel = gModelResult instanceof Promise ? await gModelResult : gModelResult;
      context.gModel = gModel;
    }

    // Persist the idRegistry so subsequent createContext() / getProperties() calls
    // can resolve UUIDs back to AST nodes. The converter may have created a fresh
    // registry on the context if sourceModelStorage.load() failed.
    const uri = document.uri.toString();
    const contextIdRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    if (contextIdRegistry) {
      this.idRegistries.set(uri, contextIdRegistry);
    }

    // Export id registry data into context metadata for client consumption
    const idRegistryForExport = contextIdRegistry ?? modelState?.idRegistry;
    if (idRegistryForExport) {
      (context as any).idRegistryData = idRegistryForExport.exportToLayoutData();
    }

    // Apply auto-layout if enabled and no positions exist
    if (this.config.autoLayout && context.metadata?.positions?.size === 0) {
      this.applyLayout(context, undefined, contribution);
    }

    return context;
  }

  /**
   * Get a resolved provider for a feature.
   *
   * Uses the provider resolver when a contribution is available,
   * otherwise falls back to the provider registry.
   */
  private getResolvedProvider<K extends keyof GlspFeatureProviders>(
    featureName: K,
    contribution?: LanguageContribution
  ): GlspFeatureProviders[K] | undefined {
    if (contribution) {
      // Use resolver for language-specific resolution
      const { provider, isDisabled } = this.providerResolver.resolve(featureName, contribution);
      if (isDisabled) {
        return undefined;
      }
      return provider;
    }

    // Fall back to provider registry
    return this.providerRegistry.get<GlspFeatureProviders[K]>(featureName);
  }

  /**
   * Execute a diagram operation.
   */
  executeOperation(context: GlspContext, operation: Operation): OperationResult {
    const handler = this.handlerRegistry.get(operation.kind);
    if (!handler) {
      return {
        success: false,
        error: `Unknown operation kind: ${operation.kind}`,
      } as OperationResult;
    }

    if (!handler.canExecute(context, operation)) {
      return {
        success: false,
        error: `Cannot execute operation: ${operation.kind}`,
      } as OperationResult;
    }

    return handler.execute(context, operation);
  }

  /**
   * Undo an operation.
   */
  undoOperation(context: GlspContext, result: OperationResult, operation: Operation): boolean {
    const handler = this.handlerRegistry.get(operation.kind);
    if (!handler?.undo) {
      return false;
    }

    return handler.undo(context, result);
  }

  /**
   * Validate the diagram model.
   *
   * Uses the provider resolver to get the validation provider,
   * respecting disabled features and custom overrides.
   */
  validate(context: GlspContext, contribution?: LanguageContribution): ValidationResult {
    const validation = this.getResolvedProvider('validation', contribution);
    if (!validation) {
      return { markers: [], isValid: true, errorCount: 0, warningCount: 0 };
    }
    return (validation as any).validate(context);
  }

  /**
   * Apply layout to the diagram.
   *
   * Uses the provider resolver to get the layout provider,
   * respecting disabled features and custom overrides.
   */
  applyLayout(
    context: GlspContext,
    options?: Partial<LayoutOptions>,
    contribution?: LanguageContribution
  ): LayoutResult {
    const layout = this.getResolvedProvider('layout', contribution);
    if (!layout) {
      return {
        positions: new Map(),
        routingPoints: new Map(),
        bounds: { width: 0, height: 0 },
      };
    }
    return (layout as any).layout(context, options);
  }

  /**
   * Get the tool palette.
   *
   * Uses the provider resolver to get the tool palette provider,
   * respecting disabled features and custom overrides.
   */
  getToolPalette(context: GlspContext, contribution?: LanguageContribution): ToolPalette {
    const toolPalette = this.getResolvedProvider('toolPalette', contribution);
    if (!toolPalette) {
      return { groups: [] };
    }
    return (toolPalette as any).getToolPalette(context);
  }

  /**
   * Get context menu for selected elements.
   *
   * Uses the provider resolver to get the context menu provider,
   * respecting disabled features and custom overrides.
   */
  getContextMenu(
    context: GlspContext,
    selectedIds: string[],
    position?: { x: number; y: number },
    contribution?: LanguageContribution
  ): ContextMenu {
    const contextMenu = this.getResolvedProvider('contextMenu', contribution);
    if (!contextMenu) {
      return { items: [] };
    }
    return (contextMenu as any).getContextMenu(context, selectedIds, position);
  }

  /**
   * Check if a GLSP feature is enabled for a language.
   */
  isFeatureEnabled(
    featureName: keyof GlspFeatureProviders,
    contribution?: LanguageContribution
  ): boolean {
    if (!contribution) {
      return this.providerRegistry.get(featureName) !== undefined;
    }
    return this.providerResolver.isEnabled(featureName, contribution);
  }

  /**
   * Save the diagram model.
   */
  async saveModel(context: GlspContext): Promise<boolean> {
    const modelState = (context as any).modelState;
    if (!modelState) {
      return false;
    }

    const result = await this.sourceModelStorage.save(modelState, {
      saveMetadata: true,
    });

    return result.success;
  }

  /**
   * Handle document change event.
   */
  onDocumentChanged(document: LangiumDocument): void {
    this.contextFactory.updateModelState(document);
    this.sourceModelStorage.onDocumentChanged(document);
  }

  /**
   * Handle document close event.
   */
  onDocumentClosed(uri: string): void {
    this.contextFactory.removeModelState(uri);
    this.sourceModelStorage.removeModelState(uri);
    this.idRegistries.delete(uri);
  }

  /**
   * Get registered operation kinds.
   */
  getSupportedOperations(): string[] {
    return this.handlerRegistry.getKinds();
  }

  /**
   * Register a custom operation handler.
   */
  registerHandler(kind: string, handler: any): void {
    this.handlerRegistry.register(kind, handler);
  }

  /**
   * Register a custom provider.
   */
  registerProvider(name: string, provider: any): void {
    this.providerRegistry.register(name, provider);
  }

  /**
   * T030: Get properties for selected elements (FR-009, FR-010).
   *
   * Extracts editable properties from AST nodes for the properties panel.
   * For multi-select, returns only properties common to all selected elements.
   *
   * @param context - GLSP context
   * @param elementIds - IDs of selected elements
   * @param contribution - Optional language contribution for manifest overrides
   * @returns Property extraction result
   */
  getProperties(
    context: GlspContext,
    elementIds: string[],
    contribution?: LanguageContribution
  ): PropertyExtractionResult {
    // Ensure idRegistry's uuidToAstNode map is populated for the current AST.
    // After document reparses, the registry is recreated with preserved fingerprints
    // but reconcile() has not been called yet, leaving UUID→AST lookups empty.
    const idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    if (idRegistry && context.root) {
      idRegistry.reconcile(context.root, context.document);
    }

    return this.propertyProvider.extractProperties(
      context,
      elementIds,
      contribution?.manifest
    );
  }

  /**
   * T031: Update a property value (FR-012).
   *
   * Modifies property values on AST nodes.
   * For multi-select, applies the change to all selected elements.
   *
   * @param context - GLSP context
   * @param elementIds - IDs of elements to update
   * @param propertyName - Property name to update
   * @param value - New value
   * @returns Update result
   */
  updateProperty(
    context: GlspContext,
    elementIds: string[],
    propertyName: string,
    value: unknown
  ): PropertyUpdateResult {
    // Ensure idRegistry's uuidToAstNode map is populated (same rationale as getProperties)
    const idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    if (idRegistry && context.root) {
      idRegistry.reconcile(context.root, context.document);
    }

    return this.propertyProvider.updateProperty(
      context,
      elementIds,
      propertyName,
      value
    );
  }
}

/**
 * Create a GLSP server instance.
 *
 * @param services - Langium services
 * @param config - Optional configuration
 * @returns A new GlspServer instance
 */
export function createGlspServer(
  services: LangiumCoreServices,
  config?: GlspServerConfig
): GlspServer {
  return new GlspServer(services, config);
}
