/**
 * GLSP Context Factory (T064)
 *
 * Creates GLSP context objects for diagram operations.
 *
 * @packageDocumentation
 */

import type { LangiumDocument, LangiumCoreServices, AstNode, CancellationToken } from 'langium';
import type { GlspContext, GlspFeatureProviders } from '@sanyam/types';

/**
 * Model state interface for GLSP operations.
 */
export interface ModelState {
  /** The source document */
  readonly document: LangiumDocument;
  /** The root AST node */
  readonly root: AstNode;
  /** The GModel representation */
  gModel: GModelRoot;
  /** Whether the model is dirty (has unsaved changes) */
  isDirty: boolean;
  /** Model metadata (positions, sizes, etc.) */
  metadata: ModelMetadata;
}

/**
 * GModel root element.
 */
export interface GModelRoot {
  id: string;
  type: string;
  children: GModelElement[];
  revision?: number;
}

/**
 * Base GModel element.
 */
export interface GModelElement {
  id: string;
  type: string;
  children?: GModelElement[];
}

/**
 * GModel node element.
 */
export interface GModelNode extends GModelElement {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  layoutOptions?: Record<string, any>;
}

/**
 * GModel edge element.
 */
export interface GModelEdge extends GModelElement {
  sourceId: string;
  targetId: string;
  routingPoints?: { x: number; y: number }[];
}

/**
 * GModel label element.
 */
export interface GModelLabel extends GModelElement {
  text: string;
  alignment?: { x: number; y: number };
}

/**
 * Model metadata storage.
 */
export interface ModelMetadata {
  /** Node positions by ID */
  positions: Map<string, { x: number; y: number }>;
  /** Node sizes by ID */
  sizes: Map<string, { width: number; height: number }>;
  /** Edge routing points by ID */
  routingPoints: Map<string, { x: number; y: number }[]>;
  /** Collapsed state by ID */
  collapsed: Set<string>;
}

/**
 * Configuration for GLSP context creation.
 */
export interface GlspContextConfig {
  /** Custom feature providers to override defaults */
  providers?: Partial<GlspFeatureProviders>;
  /** Whether to enable automatic layout */
  autoLayout?: boolean;
  /** Whether to enable validation */
  validation?: boolean;
}

/**
 * Create a new model state from a Langium document.
 *
 * @param document - The source Langium document
 * @returns A new ModelState instance
 */
export function createModelState(document: LangiumDocument): ModelState {
  const root = document.parseResult?.value;
  if (!root) {
    throw new Error('Document has no parsed content');
  }

  return {
    document,
    root,
    gModel: createEmptyGModel(document.uri.toString()),
    isDirty: false,
    metadata: {
      positions: new Map(),
      sizes: new Map(),
      routingPoints: new Map(),
      collapsed: new Set(),
    },
  };
}

/**
 * Create an empty GModel root.
 *
 * @param id - The model ID
 * @returns An empty GModelRoot
 */
export function createEmptyGModel(id: string): GModelRoot {
  return {
    id: `root_${id}`,
    type: 'graph',
    children: [],
    revision: 0,
  };
}

/**
 * Create a GLSP context for a diagram operation.
 *
 * @param modelState - The current model state
 * @param services - Langium services
 * @param token - Cancellation token
 * @param config - Optional configuration
 * @returns A GlspContext instance
 */
export function createGlspContext(
  modelState: ModelState,
  services: LangiumCoreServices,
  token: CancellationToken,
  config?: GlspContextConfig
): GlspContext {
  return {
    modelState,
    services,
    token,
    document: modelState.document,
    root: modelState.root,
    gModel: modelState.gModel,
    metadata: modelState.metadata,
    config: {
      autoLayout: config?.autoLayout ?? true,
      validation: config?.validation ?? true,
      ...config,
    },
  };
}

/**
 * Factory for creating GLSP contexts.
 */
export class GlspContextFactory {
  private modelStates: Map<string, ModelState> = new Map();

  constructor(private readonly services: LangiumCoreServices) {}

  /**
   * Get or create a model state for a document.
   *
   * @param document - The Langium document
   * @returns The model state
   */
  getOrCreateModelState(document: LangiumDocument): ModelState {
    const uri = document.uri.toString();
    let state = this.modelStates.get(uri);

    if (!state) {
      state = createModelState(document);
      this.modelStates.set(uri, state);
    }

    return state;
  }

  /**
   * Create a context for a diagram operation.
   *
   * @param document - The source document
   * @param token - Cancellation token
   * @param config - Optional configuration
   * @returns A GlspContext instance
   */
  createContext(
    document: LangiumDocument,
    token: CancellationToken,
    config?: GlspContextConfig
  ): GlspContext {
    const modelState = this.getOrCreateModelState(document);
    return createGlspContext(modelState, this.services, token, config);
  }

  /**
   * Update the model state for a document.
   *
   * @param document - The updated document
   */
  updateModelState(document: LangiumDocument): void {
    const uri = document.uri.toString();
    const existingState = this.modelStates.get(uri);

    if (existingState) {
      // Preserve metadata when updating
      const newState = createModelState(document);
      newState.metadata = existingState.metadata;
      newState.gModel.revision = (existingState.gModel.revision ?? 0) + 1;
      this.modelStates.set(uri, newState);
    }
  }

  /**
   * Remove the model state for a document.
   *
   * @param uri - The document URI
   */
  removeModelState(uri: string): void {
    this.modelStates.delete(uri);
  }

  /**
   * Get all active model states.
   *
   * @returns Iterator over model states
   */
  getAllModelStates(): IterableIterator<ModelState> {
    return this.modelStates.values();
  }

  /**
   * Check if a model state exists for a URI.
   *
   * @param uri - The document URI
   * @returns True if model state exists
   */
  hasModelState(uri: string): boolean {
    return this.modelStates.has(uri);
  }
}

/**
 * Create a GlspContextFactory instance.
 *
 * @param services - Langium services
 * @returns A new GlspContextFactory
 */
export function createGlspContextFactory(services: LangiumCoreServices): GlspContextFactory {
  return new GlspContextFactory(services);
}
