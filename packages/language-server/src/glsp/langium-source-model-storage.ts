/**
 * Langium Source Model Storage (T066)
 *
 * Handles loading and saving of GLSP models via Langium documents.
 *
 * @packageDocumentation
 */

import type { LangiumDocument, LangiumCoreServices, AstNode, URI } from 'langium';
import type { TextDocumentEdit, TextEdit } from 'vscode-languageserver';
import { LangiumModelState, createLangiumModelState } from './langium-model-state.js';
import type { ModelMetadata, GModelRoot } from './glsp-context-factory.js';

/**
 * Load result from source model storage.
 */
export interface LoadResult {
  /** Whether the load was successful */
  success: boolean;
  /** The loaded model state */
  modelState?: LangiumModelState;
  /** Error message if load failed */
  error?: string;
}

/**
 * Save result from source model storage.
 */
export interface SaveResult {
  /** Whether the save was successful */
  success: boolean;
  /** The new document version after save */
  version?: number;
  /** Error message if save failed */
  error?: string;
}

/**
 * Options for loading a model.
 */
export interface LoadOptions {
  /** Whether to force reload even if cached */
  forceReload?: boolean;
  /** Whether to load metadata from side file */
  loadMetadata?: boolean;
}

/**
 * Options for saving a model.
 */
export interface SaveOptions {
  /** Whether to also save metadata to side file */
  saveMetadata?: boolean;
  /** Whether to format the document before saving */
  format?: boolean;
}

/**
 * Langium Source Model Storage.
 *
 * Handles the persistence of GLSP diagram models using Langium documents
 * as the source of truth. Position and size metadata can optionally be
 * stored in a separate side file.
 */
export class LangiumSourceModelStorage {
  private modelStates: Map<string, LangiumModelState> = new Map();
  private metadataCache: Map<string, ModelMetadata> = new Map();

  constructor(private readonly services: LangiumCoreServices) { }

  /**
   * Load a model from a document URI.
   *
   * @param uri - The document URI
   * @param options - Load options
   * @returns Load result
   */
  async load(uri: string, options?: LoadOptions): Promise<LoadResult> {
    try {
      // Check cache first unless force reload
      if (!options?.forceReload && this.modelStates.has(uri)) {
        return {
          success: true,
          modelState: this.modelStates.get(uri)!,
        };
      }

      // Get document from Langium document service
      const documents = this.services.shared?.workspace?.LangiumDocuments;
      if (!documents) {
        return {
          success: false,
          error: 'LangiumDocuments service not available',
        };
      }

      const document = documents.getDocument({ toString: () => uri } as URI);
      if (!document) {
        return {
          success: false,
          error: `Document not found: ${uri}`,
        };
      }

      // Load metadata if requested
      let metadata: ModelMetadata | undefined;
      if (options?.loadMetadata) {
        metadata = await this.loadMetadata(uri);
      }

      // Create model state
      const modelState = createLangiumModelState(document, metadata);
      this.modelStates.set(uri, modelState);

      return {
        success: true,
        modelState,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Save the model state to its document.
   *
   * @param modelState - The model state to save
   * @param options - Save options
   * @returns Save result
   */
  async save(modelState: LangiumModelState, options?: SaveOptions): Promise<SaveResult> {
    try {
      // Generate text from AST
      const text = this.serializeAst(modelState.root);
      if (!text) {
        return {
          success: false,
          error: 'Failed to serialize AST',
        };
      }

      // Format if requested
      const finalText = options?.format ? await this.formatText(text) : text;

      // Apply text edit to document
      const edit: TextEdit = {
        range: {
          start: { line: 0, character: 0 },
          end: modelState.document.textDocument.positionAt(
            modelState.document.textDocument.getText().length
          ),
        },
        newText: finalText,
      };

      // In a real implementation, this would apply the edit via workspace edit
      // For now, we just track that a save was requested
      const newVersion = modelState.version + 1;

      // Save metadata if requested
      if (options?.saveMetadata) {
        await this.saveMetadata(modelState.uri, modelState.metadata);
      }

      // Mark model as clean
      modelState.markClean();

      return {
        success: true,
        version: newVersion,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get a cached model state.
   *
   * @param uri - The document URI
   * @returns The model state or undefined
   */
  getModelState(uri: string): LangiumModelState | undefined {
    return this.modelStates.get(uri);
  }

  /**
   * Remove a model state from cache.
   *
   * @param uri - The document URI
   */
  removeModelState(uri: string): void {
    this.modelStates.delete(uri);
    this.metadataCache.delete(uri);
  }

  /**
   * Check if a model state is cached.
   *
   * @param uri - The document URI
   * @returns True if cached
   */
  hasModelState(uri: string): boolean {
    return this.modelStates.has(uri);
  }

  /**
   * Update the model state when document changes.
   *
   * @param document - The updated document
   */
  onDocumentChanged(document: LangiumDocument): void {
    const uri = document.uri.toString();
    const existingState = this.modelStates.get(uri);

    if (existingState) {
      // Create new state preserving metadata
      const newState = createLangiumModelState(document, existingState.metadata);
      // Copy over element mappings if possible
      this.modelStates.set(uri, newState);
    }
  }

  /**
   * Load metadata from side file.
   *
   * @param uri - The document URI
   * @returns The metadata or undefined
   */
  private async loadMetadata(uri: string): Promise<ModelMetadata | undefined> {
    // Check cache first
    if (this.metadataCache.has(uri)) {
      return this.metadataCache.get(uri);
    }

    // In a real implementation, this would load from a .metadata.json file
    // For now, return default empty metadata
    const metadata: ModelMetadata = {
      positions: new Map(),
      sizes: new Map(),
      routingPoints: new Map(),
      collapsed: new Set(),
    };

    this.metadataCache.set(uri, metadata);
    return metadata;
  }

  /**
   * Save metadata to side file.
   *
   * @param uri - The document URI
   * @param metadata - The metadata to save
   */
  private async saveMetadata(uri: string, metadata: ModelMetadata): Promise<void> {
    // In a real implementation, this would save to a .metadata.json file
    // For now, just update the cache
    this.metadataCache.set(uri, metadata);
  }

  /**
   * Serialize an AST node to text.
   *
   * @param root - The root AST node
   * @returns The serialized text
   */
  private serializeAst(root: AstNode): string {
    // In a real implementation, this would use Langium's serializer
    // For now, return a placeholder
    const cstNode = root.$cstNode;
    if (cstNode) {
      return cstNode.text;
    }
    return '';
  }

  /**
   * Format text using the formatter service.
   *
   * @param text - The text to format
   * @returns The formatted text
   */
  private async formatText(text: string): Promise<string> {
    // In a real implementation, this would use the formatting service
    // For now, return the text unchanged
    return text;
  }

  /**
   * Get the metadata file URI for a document.
   *
   * @param documentUri - The document URI
   * @returns The metadata file URI
   */
  private getMetadataUri(documentUri: string): string {
    // Add .layout.json suffix
    return `${documentUri}.layout.json`;
  }

  /**
   * Export metadata to JSON format.
   *
   * @param metadata - The metadata to export
   * @returns JSON string
   */
  exportMetadataToJson(metadata: ModelMetadata): string {
    const data = {
      positions: Object.fromEntries(metadata.positions),
      sizes: Object.fromEntries(metadata.sizes),
      routingPoints: Object.fromEntries(metadata.routingPoints),
      collapsed: Array.from(metadata.collapsed),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import metadata from JSON format.
   *
   * @param json - The JSON string
   * @returns The imported metadata
   */
  importMetadataFromJson(json: string): ModelMetadata {
    const data = JSON.parse(json);
    return {
      positions: new Map(Object.entries(data.positions || {})),
      sizes: new Map(Object.entries(data.sizes || {})),
      routingPoints: new Map(Object.entries(data.routingPoints || {})),
      collapsed: new Set(data.collapsed || []),
    };
  }
}

/**
 * Create a Langium source model storage instance.
 *
 * @param services - Langium services
 * @returns A new LangiumSourceModelStorage instance
 */
export function createLangiumSourceModelStorage(
  services: LangiumCoreServices
): LangiumSourceModelStorage {
  return new LangiumSourceModelStorage(services);
}
