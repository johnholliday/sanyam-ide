/**
 * GLSP Server Module (T080)
 *
 * Inversify module for GLSP server dependency injection.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import type { GlspContext, GlspFeatureProviders } from '@sanyam/types';

// Import providers
import { defaultAstToGModelProvider, createAstToGModelProvider } from './providers/ast-to-gmodel-provider.js';
import { defaultGModelToAstProvider, createGModelToAstProvider } from './providers/gmodel-to-ast-provider.js';
import { defaultToolPaletteProvider, createToolPaletteProvider } from './providers/tool-palette-provider.js';
import { defaultDiagramValidationProvider, createDiagramValidationProvider } from './providers/diagram-validation-provider.js';
import { defaultLayoutProvider, createLayoutProvider } from './providers/layout-provider.js';
import { defaultContextMenuProvider, createContextMenuProvider } from './providers/context-menu-provider.js';

// Import handlers
import { createNodeHandler, createCreateNodeHandler } from './handlers/create-node-handler.js';
import { deleteElementHandler, createDeleteElementHandler } from './handlers/delete-element-handler.js';
import { changeBoundsHandler, createChangeBoundsHandler } from './handlers/change-bounds-handler.js';
import { reconnectEdgeHandler, createReconnectEdgeHandler } from './handlers/reconnect-edge-handler.js';
import { createEdgeHandler, createCreateEdgeHandler } from './handlers/create-edge-handler.js';

// Import core components
import { GlspContextFactory, createGlspContextFactory } from './glsp-context-factory.js';
import { LangiumSourceModelStorage, createLangiumSourceModelStorage } from './langium-source-model-storage.js';
import { ManifestDrivenGModelFactory, createManifestDrivenGModelFactory } from './manifest-converter.js';

/**
 * Service identifiers for GLSP services.
 */
export const GLSP_TYPES = {
  // Core services
  ContextFactory: Symbol.for('GlspContextFactory'),
  SourceModelStorage: Symbol.for('LangiumSourceModelStorage'),
  GModelFactory: Symbol.for('ManifestDrivenGModelFactory'),

  // Providers
  AstToGModelProvider: Symbol.for('AstToGModelProvider'),
  GModelToAstProvider: Symbol.for('GModelToAstProvider'),
  ToolPaletteProvider: Symbol.for('ToolPaletteProvider'),
  DiagramValidationProvider: Symbol.for('DiagramValidationProvider'),
  LayoutProvider: Symbol.for('LayoutProvider'),
  ContextMenuProvider: Symbol.for('ContextMenuProvider'),

  // Handlers
  CreateNodeHandler: Symbol.for('CreateNodeHandler'),
  DeleteElementHandler: Symbol.for('DeleteElementHandler'),
  ChangeBoundsHandler: Symbol.for('ChangeBoundsHandler'),
  ReconnectEdgeHandler: Symbol.for('ReconnectEdgeHandler'),
  CreateEdgeHandler: Symbol.for('CreateEdgeHandler'),

  // Registry
  OperationHandlerRegistry: Symbol.for('OperationHandlerRegistry'),
  ProviderRegistry: Symbol.for('ProviderRegistry'),
};

/**
 * Operation handler interface.
 */
export interface OperationHandler<T = any, R = any> {
  canExecute(context: GlspContext, operation: T): boolean;
  execute(context: GlspContext, operation: T): R;
  undo?(context: GlspContext, result: R): boolean;
}

/**
 * Operation handler registry.
 */
export class OperationHandlerRegistry {
  private handlers: Map<string, OperationHandler> = new Map();

  /**
   * Register a handler for an operation kind.
   */
  register(kind: string, handler: OperationHandler): void {
    this.handlers.set(kind, handler);
  }

  /**
   * Get handler for an operation kind.
   */
  get(kind: string): OperationHandler | undefined {
    return this.handlers.get(kind);
  }

  /**
   * Check if handler exists for kind.
   */
  has(kind: string): boolean {
    return this.handlers.has(kind);
  }

  /**
   * Get all registered kinds.
   */
  getKinds(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Provider registry for GLSP providers.
 */
export class ProviderRegistry {
  private providers: Map<string, any> = new Map();

  /**
   * Register a provider.
   */
  register(name: string, provider: any): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a provider.
   */
  get<T>(name: string): T | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if provider exists.
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }
}

/**
 * Configuration for GLSP server module.
 */
export interface GlspServerModuleConfig {
  /** Custom providers to override defaults */
  providers?: Partial<GlspFeatureProviders>;
  /** Additional operation handlers */
  handlers?: Record<string, OperationHandler>;
}

/**
 * Create the GLSP server Inversify module.
 *
 * @param config - Optional configuration
 * @returns Inversify ContainerModule
 */
export function createGlspServerModule(config?: GlspServerModuleConfig): ContainerModule {
  return new ContainerModule((bind) => {
    // Bind registries
    bind(GLSP_TYPES.OperationHandlerRegistry)
      .to(OperationHandlerRegistry)
      .inSingletonScope();

    bind(GLSP_TYPES.ProviderRegistry)
      .to(ProviderRegistry)
      .inSingletonScope();

    // Bind default providers (or custom if provided)
    bind(GLSP_TYPES.AstToGModelProvider)
      .toConstantValue(config?.providers?.astToGModel ?? defaultAstToGModelProvider);

    bind(GLSP_TYPES.GModelToAstProvider)
      .toConstantValue(config?.providers?.gModelToAst ?? defaultGModelToAstProvider);

    bind(GLSP_TYPES.ToolPaletteProvider)
      .toConstantValue(config?.providers?.toolPalette ?? defaultToolPaletteProvider);

    bind(GLSP_TYPES.DiagramValidationProvider)
      .toConstantValue(config?.providers?.validation ?? defaultDiagramValidationProvider);

    bind(GLSP_TYPES.LayoutProvider)
      .toConstantValue(config?.providers?.layout ?? defaultLayoutProvider);

    bind(GLSP_TYPES.ContextMenuProvider)
      .toConstantValue(config?.providers?.contextMenu ?? defaultContextMenuProvider);

    // Bind default handlers
    bind(GLSP_TYPES.CreateNodeHandler)
      .toConstantValue(createNodeHandler);

    bind(GLSP_TYPES.DeleteElementHandler)
      .toConstantValue(deleteElementHandler);

    bind(GLSP_TYPES.ChangeBoundsHandler)
      .toConstantValue(changeBoundsHandler);

    bind(GLSP_TYPES.ReconnectEdgeHandler)
      .toConstantValue(reconnectEdgeHandler);

    bind(GLSP_TYPES.CreateEdgeHandler)
      .toConstantValue(createEdgeHandler);
  });
}

/**
 * Initialize the GLSP services after container is built.
 *
 * @param container - Inversify container
 */
export function initializeGlspServices(container: any): void {
  // Register handlers with registry
  const handlerRegistry = container.get(GLSP_TYPES.OperationHandlerRegistry);

  handlerRegistry.register('createNode', container.get(GLSP_TYPES.CreateNodeHandler));
  handlerRegistry.register('delete', container.get(GLSP_TYPES.DeleteElementHandler));
  handlerRegistry.register('changeBounds', container.get(GLSP_TYPES.ChangeBoundsHandler));
  handlerRegistry.register('reconnectEdge', container.get(GLSP_TYPES.ReconnectEdgeHandler));
  handlerRegistry.register('createEdge', container.get(GLSP_TYPES.CreateEdgeHandler));

  // Register providers with registry
  const providerRegistry = container.get(GLSP_TYPES.ProviderRegistry);

  providerRegistry.register('astToGModel', container.get(GLSP_TYPES.AstToGModelProvider));
  providerRegistry.register('gModelToAst', container.get(GLSP_TYPES.GModelToAstProvider));
  providerRegistry.register('toolPalette', container.get(GLSP_TYPES.ToolPaletteProvider));
  providerRegistry.register('validation', container.get(GLSP_TYPES.DiagramValidationProvider));
  providerRegistry.register('layout', container.get(GLSP_TYPES.LayoutProvider));
  providerRegistry.register('contextMenu', container.get(GLSP_TYPES.ContextMenuProvider));
}

/**
 * Get all default GLSP providers.
 */
export const allDefaultGlspProviders = {
  astToGModel: defaultAstToGModelProvider,
  gModelToAst: defaultGModelToAstProvider,
  toolPalette: defaultToolPaletteProvider,
  validation: defaultDiagramValidationProvider,
  layout: defaultLayoutProvider,
  contextMenu: defaultContextMenuProvider,
};

/**
 * Get all default GLSP handlers.
 */
export const allDefaultGlspHandlers = {
  createNode: createNodeHandler,
  deleteElement: deleteElementHandler,
  changeBounds: changeBoundsHandler,
  reconnectEdge: reconnectEdgeHandler,
  createEdge: createEdgeHandler,
};

// Re-export provider creators
export {
  createAstToGModelProvider,
  createGModelToAstProvider,
  createToolPaletteProvider,
  createDiagramValidationProvider,
  createLayoutProvider,
  createContextMenuProvider,
};

// Re-export handler creators
export {
  createCreateNodeHandler,
  createDeleteElementHandler,
  createChangeBoundsHandler,
  createReconnectEdgeHandler,
  createCreateEdgeHandler,
};
