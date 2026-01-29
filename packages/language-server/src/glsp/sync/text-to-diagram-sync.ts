/**
 * Text to Diagram Synchronization (T087)
 *
 * Listens to LangiumDocument changes and regenerates GModel.
 * Ensures diagram views stay synchronized with text edits.
 *
 * @packageDocumentation
 */

import type { LangiumDocument } from 'langium';
import type { CancellationToken } from 'vscode-languageserver';
import type { GlspContext, RegisteredLanguage } from '@sanyam/types';
import { Emitter, Event, Disposable, CancellationToken as VsCancellationToken } from 'vscode-languageserver';
import { DisposableCollection } from '../../utils/disposable.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'TextToDiagramSync' });

/**
 * Document change event.
 */
export interface DocumentChangeEvent {
  /** Changed document URI */
  uri: string;
  /** Document version */
  version: number;
  /** Whether content changed */
  contentChanged: boolean;
}

/**
 * Model update event.
 */
export interface ModelUpdateEvent {
  /** Document URI */
  uri: string;
  /** Updated GModel (or undefined if document was closed) */
  gModel?: any;
  /** Whether this was triggered by a text change */
  fromTextChange: boolean;
  /** Change timestamp */
  timestamp: number;
}

/**
 * Sync options.
 */
export interface TextToDiagramSyncOptions {
  /** Debounce delay in ms (default: 100) */
  debounceDelay?: number;
  /** Whether to auto-sync on changes (default: true) */
  autoSync?: boolean;
  /** Cancellation token */
  cancellationToken?: CancellationToken;
}

/**
 * Text to diagram sync listener.
 *
 * Monitors text document changes and triggers GModel regeneration.
 * Implements debouncing to avoid excessive updates during typing.
 */
export class TextToDiagramSync implements Disposable {
  private readonly toDispose = new DisposableCollection();
  private readonly documentStates: Map<string, DocumentState> = new Map();
  private readonly pendingUpdates: Map<string, NodeJS.Timeout> = new Map();

  private readonly options: Required<TextToDiagramSyncOptions>;

  // Event emitters
  private readonly onModelUpdateEmitter = new Emitter<ModelUpdateEvent>();
  private readonly onSyncStartEmitter = new Emitter<{ uri: string }>();
  private readonly onSyncCompleteEmitter = new Emitter<{ uri: string; success: boolean }>();

  // Event accessors
  readonly onModelUpdate: Event<ModelUpdateEvent> = this.onModelUpdateEmitter.event;
  readonly onSyncStart: Event<{ uri: string }> = this.onSyncStartEmitter.event;
  readonly onSyncComplete: Event<{ uri: string; success: boolean }> = this.onSyncCompleteEmitter.event;

  constructor(
    private readonly astToGModelConverter: AstToGModelConverter,
    options?: TextToDiagramSyncOptions
  ) {
    this.options = {
      debounceDelay: options?.debounceDelay ?? 100,
      autoSync: options?.autoSync ?? true,
      cancellationToken: options?.cancellationToken ?? VsCancellationToken.None,
    };

    this.toDispose.push(this.onModelUpdateEmitter);
    this.toDispose.push(this.onSyncStartEmitter);
    this.toDispose.push(this.onSyncCompleteEmitter);
  }

  /**
   * Handle document change.
   *
   * Called when a LangiumDocument is modified.
   * Debounces the update to avoid excessive regeneration during typing.
   */
  onDocumentChanged(document: LangiumDocument): void {
    const uri = document.uri.toString();

    // Update document state
    let state = this.documentStates.get(uri);
    if (!state) {
      state = {
        uri,
        version: 0,
        lastSyncVersion: -1,
        pendingSync: false,
      };
      this.documentStates.set(uri, state);
    }

    state.version++;
    state.document = document;

    // Cancel pending update
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
    }

    // Schedule new update
    if (this.options.autoSync) {
      state.pendingSync = true;
      const timeout = setTimeout(() => {
        this.syncDocument(uri);
      }, this.options.debounceDelay);
      this.pendingUpdates.set(uri, timeout);
    }
  }

  /**
   * Handle document open.
   */
  onDocumentOpened(document: LangiumDocument): void {
    const uri = document.uri.toString();

    const state: DocumentState = {
      uri,
      version: 1,
      lastSyncVersion: 0,
      document,
      pendingSync: false,
    };

    this.documentStates.set(uri, state);

    // Initial sync
    if (this.options.autoSync) {
      this.syncDocument(uri);
    }
  }

  /**
   * Handle document close.
   */
  onDocumentClosed(uri: string): void {
    // Cancel pending updates
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }

    // Remove state
    this.documentStates.delete(uri);

    // Notify listeners
    this.onModelUpdateEmitter.fire({
      uri,
      gModel: undefined,
      fromTextChange: false,
      timestamp: Date.now(),
    });
  }

  /**
   * Synchronize a document.
   *
   * Regenerates the GModel from the current AST.
   */
  async syncDocument(uri: string): Promise<boolean> {
    const state = this.documentStates.get(uri);
    if (!state || !state.document) {
      return false;
    }

    // Check if cancellation was requested
    if (this.options.cancellationToken?.isCancellationRequested) {
      return false;
    }

    // Skip if already synced to this version
    if (state.lastSyncVersion === state.version) {
      return true;
    }

    try {
      this.onSyncStartEmitter.fire({ uri });
      state.pendingSync = true;

      // Convert AST to GModel
      const gModel = await this.astToGModelConverter.convert(state.document);

      // Check if document changed while we were converting
      if (state.version !== this.documentStates.get(uri)?.version) {
        // Document changed, skip this update
        return false;
      }

      // Update state
      state.lastSyncVersion = state.version;
      state.pendingSync = false;

      // Emit update event
      this.onModelUpdateEmitter.fire({
        uri,
        gModel,
        fromTextChange: true,
        timestamp: Date.now(),
      });

      this.onSyncCompleteEmitter.fire({ uri, success: true });
      return true;
    } catch (error) {
      logger.error({ err: error, uri }, 'Failed to sync document');
      state.pendingSync = false;
      this.onSyncCompleteEmitter.fire({ uri, success: false });
      return false;
    }
  }

  /**
   * Force sync a document immediately.
   */
  async forceSyncDocument(uri: string): Promise<boolean> {
    // Cancel pending debounced update
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }

    return this.syncDocument(uri);
  }

  /**
   * Check if a document has pending sync.
   */
  hasPendingSync(uri: string): boolean {
    return this.documentStates.get(uri)?.pendingSync ?? false;
  }

  /**
   * Get document state.
   */
  getDocumentState(uri: string): DocumentState | undefined {
    return this.documentStates.get(uri);
  }

  /**
   * Get all tracked documents.
   */
  getTrackedDocuments(): string[] {
    return Array.from(this.documentStates.keys());
  }

  /**
   * Set auto-sync enabled.
   */
  setAutoSync(enabled: boolean): void {
    (this.options as any).autoSync = enabled;
  }

  /**
   * Set debounce delay.
   */
  setDebounceDelay(delay: number): void {
    (this.options as any).debounceDelay = delay;
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    // Cancel all pending updates
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();
    this.documentStates.clear();
    this.toDispose.dispose();
  }
}

/**
 * Document state for tracking sync.
 */
interface DocumentState {
  uri: string;
  version: number;
  lastSyncVersion: number;
  document?: LangiumDocument;
  pendingSync: boolean;
}

/**
 * AST to GModel converter interface.
 */
export interface AstToGModelConverter {
  convert(document: LangiumDocument): Promise<any>;
}

/**
 * Create a text-to-diagram sync instance.
 *
 * @param converter - AST to GModel converter
 * @param options - Sync options
 * @returns TextToDiagramSync instance
 */
export function createTextToDiagramSync(
  converter: AstToGModelConverter,
  options?: TextToDiagramSyncOptions
): TextToDiagramSync {
  return new TextToDiagramSync(converter, options);
}

/**
 * Create a default AST to GModel converter.
 *
 * @param registered - Registered language with services and providers
 * @returns AstToGModelConverter
 */
export function createDefaultAstToGModelConverter(
  registered: RegisteredLanguage
): AstToGModelConverter {
  return {
    async convert(document: LangiumDocument): Promise<any> {
      const context: GlspContext = {
        document,
        services: registered.services,
        manifest: registered.contribution.manifest,
        root: document.parseResult?.value,
      };

      // Use the registered language's AST to GModel provider if available
      const provider = registered.mergedGlspProviders?.astToGModel;
      if (provider?.convert) {
        // Add diagram type to context
        const diagramTypes = registered.contribution.manifest.diagramTypes;
        (context as any).diagramType = diagramTypes?.[0];
        // Provider.convert now takes GlspContext as single argument
        return provider.convert(context);
      }

      // Return empty GModel root
      return {
        id: 'root',
        type: 'graph',
        children: [],
      };
    },
  };
}
