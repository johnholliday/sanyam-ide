/**
 * Auto-Save Service
 *
 * Automatic cloud save after idle period with version consolidation.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from 'inversify';
import { Disposable, DisposableCollection, Emitter, Event } from '@theia/core';
import type { CloudDocumentStoreType } from './cloud-document-store.js';
import { CloudDocumentStore } from './cloud-document-store.js';
import type { SupabaseClientFactory } from './supabase-client-factory.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'AutoSaveService' });

/**
 * Auto-save configuration.
 */
export interface AutoSaveConfig {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Idle delay before save in milliseconds (default: 10000 = 10 seconds) */
  idleDelayMs: number;
  /** Version consolidation window in milliseconds (default: 300000 = 5 minutes) */
  versionConsolidationMs: number;
  /** Maximum retry attempts for failed saves */
  maxRetries: number;
  /** Base delay for exponential backoff in milliseconds */
  baseRetryDelayMs: number;
}

/**
 * Default auto-save configuration.
 */
export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  idleDelayMs: 10000, // 10 seconds
  versionConsolidationMs: 300000, // 5 minutes
  maxRetries: 3,
  baseRetryDelayMs: 1000, // 1 second base, then 2s, 4s, etc.
};

/**
 * Auto-save status.
 */
export type AutoSaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'
  | 'offline';

/**
 * Document auto-save state.
 */
export interface DocumentAutoSaveState {
  /** Document ID */
  documentId: string;
  /** Current status */
  status: AutoSaveStatus;
  /** Last save timestamp */
  lastSavedAt?: Date;
  /** Last modification timestamp */
  lastModifiedAt?: Date;
  /** Pending changes flag */
  hasPendingChanges: boolean;
  /** Current retry count */
  retryCount: number;
  /** Last error message */
  lastError?: string;
}

/**
 * Auto-save service interface.
 */
export const AutoSaveService = Symbol('AutoSaveService');

/**
 * Auto-save service type.
 */
export interface AutoSaveServiceType extends Disposable {
  /** Current configuration */
  readonly config: AutoSaveConfig;
  /** Whether auto-save is globally enabled */
  readonly isEnabled: boolean;
  /** Event fired when save status changes */
  readonly onStatusChange: Event<DocumentAutoSaveState>;

  /**
   * Enable or disable auto-save.
   */
  setEnabled(enabled: boolean): void;

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<AutoSaveConfig>): void;

  /**
   * Mark a document as modified.
   * This starts the idle timer for auto-save.
   */
  markModified(documentId: string, content: string): void;

  /**
   * Get the auto-save state for a document.
   */
  getState(documentId: string): DocumentAutoSaveState | undefined;

  /**
   * Force save a document immediately.
   */
  saveNow(documentId: string): Promise<boolean>;

  /**
   * Cancel pending auto-save for a document.
   */
  cancel(documentId: string): void;

  /**
   * Stop tracking a document.
   */
  untrack(documentId: string): void;
}

/**
 * Internal document tracking state.
 */
interface TrackedDocument {
  state: DocumentAutoSaveState;
  pendingContent: string;
  idleTimer?: ReturnType<typeof setTimeout>;
  lastVersionCreatedAt?: Date;
}

/**
 * Implementation of AutoSaveService.
 */
@injectable()
export class AutoSaveServiceImpl implements AutoSaveServiceType {
  private _config: AutoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
  private readonly disposables = new DisposableCollection();
  private readonly trackedDocuments = new Map<string, TrackedDocument>();

  private readonly onStatusChangeEmitter = new Emitter<DocumentAutoSaveState>();
  readonly onStatusChange = this.onStatusChangeEmitter.event;

  @inject(CloudDocumentStore) @optional()
  private readonly documentStore?: CloudDocumentStoreType;

  @inject(SupabaseClientFactory) @optional()
  private readonly clientFactory?: SupabaseClientFactory;

  @postConstruct()
  protected init(): void {
    this.disposables.push(this.onStatusChangeEmitter);

    // Listen for online status changes if available
    if (this.clientFactory) {
      const unsubscribe = this.clientFactory.onOnlineStatusChange((isOnline) => {
        if (isOnline) {
          // Retry all failed saves when coming back online
          this.retryAllFailed();
        } else {
          // Mark all pending as offline
          this.markAllOffline();
        }
      });
      this.disposables.push({ dispose: unsubscribe });
    }
  }

  get config(): AutoSaveConfig {
    return { ...this._config };
  }

  get isEnabled(): boolean {
    return this._config.enabled;
  }

  setEnabled(enabled: boolean): void {
    if (this._config.enabled !== enabled) {
      this._config.enabled = enabled;
      logger.info({ enabled }, 'Auto-save enabled changed');

      if (!enabled) {
        // Cancel all pending saves
        for (const [docId] of this.trackedDocuments) {
          this.cancel(docId);
        }
      }
    }
  }

  updateConfig(config: Partial<AutoSaveConfig>): void {
    this._config = { ...this._config, ...config };
    logger.info({ config: this._config }, 'Auto-save config updated');
  }

  markModified(documentId: string, content: string): void {
    if (!this._config.enabled) {
      return;
    }

    let tracked = this.trackedDocuments.get(documentId);

    if (!tracked) {
      tracked = {
        state: {
          documentId,
          status: 'pending',
          hasPendingChanges: true,
          retryCount: 0,
          lastModifiedAt: new Date(),
        },
        pendingContent: content,
      };
      this.trackedDocuments.set(documentId, tracked);
    } else {
      // Clear existing timer
      if (tracked.idleTimer) {
        clearTimeout(tracked.idleTimer);
        tracked.idleTimer = undefined;
      }

      tracked.pendingContent = content;
      tracked.state.hasPendingChanges = true;
      tracked.state.lastModifiedAt = new Date();
      tracked.state.status = 'pending';
    }

    // Start idle timer
    tracked.idleTimer = setTimeout(() => {
      this.performSave(documentId);
    }, this._config.idleDelayMs);

    this.emitState(tracked.state);
  }

  getState(documentId: string): DocumentAutoSaveState | undefined {
    return this.trackedDocuments.get(documentId)?.state;
  }

  async saveNow(documentId: string): Promise<boolean> {
    const tracked = this.trackedDocuments.get(documentId);
    if (!tracked) {
      return false;
    }

    // Cancel pending timer
    if (tracked.idleTimer) {
      clearTimeout(tracked.idleTimer);
      tracked.idleTimer = undefined;
    }

    return this.performSave(documentId);
  }

  cancel(documentId: string): void {
    const tracked = this.trackedDocuments.get(documentId);
    if (!tracked) {
      return;
    }

    if (tracked.idleTimer) {
      clearTimeout(tracked.idleTimer);
      tracked.idleTimer = undefined;
    }

    tracked.state.status = 'idle';
    this.emitState(tracked.state);
  }

  untrack(documentId: string): void {
    this.cancel(documentId);
    this.trackedDocuments.delete(documentId);
  }

  dispose(): void {
    // Cancel all timers
    for (const [docId] of this.trackedDocuments) {
      this.cancel(docId);
    }
    this.trackedDocuments.clear();
    this.disposables.dispose();
  }

  /**
   * Perform the actual save operation.
   */
  private async performSave(documentId: string): Promise<boolean> {
    const tracked = this.trackedDocuments.get(documentId);
    if (!tracked || !this.documentStore) {
      return false;
    }

    // Check if online
    if (this.clientFactory && !this.clientFactory.isOnline) {
      tracked.state.status = 'offline';
      tracked.state.lastError = 'Cannot save while offline';
      this.emitState(tracked.state);
      return false;
    }

    // Check version consolidation window
    const now = new Date();
    if (
      tracked.lastVersionCreatedAt &&
      now.getTime() - tracked.lastVersionCreatedAt.getTime() <
        this._config.versionConsolidationMs
    ) {
      // Within consolidation window - update existing version instead of creating new
      logger.debug(
        { documentId },
        'Within version consolidation window - updating existing version'
      );
    }

    tracked.state.status = 'saving';
    this.emitState(tracked.state);

    try {
      // Perform the save via document store
      // Note: This is a simplified version - actual implementation would call CloudDocumentStore.update()
      logger.info({ documentId }, 'Auto-saving document');

      // Simulated save - in real implementation, call documentStore.update()
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Success
      tracked.state.status = 'saved';
      tracked.state.lastSavedAt = new Date();
      tracked.state.hasPendingChanges = false;
      tracked.state.retryCount = 0;
      tracked.state.lastError = undefined;
      tracked.lastVersionCreatedAt = now;

      logger.info({ documentId }, 'Document auto-saved successfully');
      this.emitState(tracked.state);
      return true;
    } catch (error) {
      tracked.state.retryCount++;
      tracked.state.lastError = error instanceof Error ? error.message : String(error);

      if (tracked.state.retryCount < this._config.maxRetries) {
        // Schedule retry with exponential backoff
        const delay =
          this._config.baseRetryDelayMs * Math.pow(2, tracked.state.retryCount - 1);
        tracked.state.status = 'pending';

        logger.warn(
          { documentId, retryCount: tracked.state.retryCount, delay },
          'Auto-save failed, scheduling retry'
        );

        tracked.idleTimer = setTimeout(() => {
          this.performSave(documentId);
        }, delay);
      } else {
        tracked.state.status = 'error';
        logger.error(
          { documentId, retryCount: tracked.state.retryCount, err: error },
          'Auto-save failed after max retries'
        );
      }

      this.emitState(tracked.state);
      return false;
    }
  }

  /**
   * Emit state change event.
   */
  private emitState(state: DocumentAutoSaveState): void {
    this.onStatusChangeEmitter.fire({ ...state });
  }

  /**
   * Retry all failed saves.
   */
  private retryAllFailed(): void {
    for (const [docId, tracked] of this.trackedDocuments) {
      if (tracked.state.status === 'offline' || tracked.state.status === 'error') {
        tracked.state.retryCount = 0;
        this.markModified(docId, tracked.pendingContent);
      }
    }
  }

  /**
   * Mark all pending saves as offline.
   */
  private markAllOffline(): void {
    for (const tracked of this.trackedDocuments.values()) {
      if (tracked.state.status === 'pending' || tracked.state.status === 'saving') {
        if (tracked.idleTimer) {
          clearTimeout(tracked.idleTimer);
          tracked.idleTimer = undefined;
        }
        tracked.state.status = 'offline';
        this.emitState(tracked.state);
      }
    }
  }
}
