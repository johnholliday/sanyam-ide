/**
 * Local-Only Document Store
 *
 * Fallback document store for offline mode or unconfigured cloud.
 * Saves documents to local workspace storage only.
 *
 * @packageDocumentation
 */

import { injectable } from '@theia/core/shared/inversify';
import type { CloudDocument } from '@sanyam/types';

/**
 * Local-only document store interface.
 */
export const LocalOnlyDocumentStore = Symbol('LocalOnlyDocumentStore');

/**
 * Local-only document store type.
 */
export interface LocalOnlyDocumentStoreType {
  /** Indicates this is the local-only fallback */
  readonly isLocalOnly: true;
  /** Indicates cloud is not available */
  readonly isCloudAvailable: false;

  /**
   * Get document metadata stored locally.
   */
  getLocalDocument(uri: string): LocalDocumentMetadata | undefined;

  /**
   * Save document metadata locally.
   */
  saveLocalDocument(uri: string, metadata: LocalDocumentMetadata): void;

  /**
   * List all locally tracked documents.
   */
  listLocalDocuments(): LocalDocumentMetadata[];

  /**
   * Remove local document tracking.
   */
  removeLocalDocument(uri: string): void;
}

/**
 * Local document metadata.
 */
export interface LocalDocumentMetadata {
  /** Local file URI */
  uri: string;
  /** Document name */
  name: string;
  /** Last modified timestamp */
  modifiedAt: Date;
  /** File size in bytes */
  sizeBytes: number;
  /** Language ID */
  languageId?: string;
  /** Pending cloud sync flag */
  pendingSync?: boolean;
}

/**
 * Implementation of local-only document store.
 */
@injectable()
export class LocalOnlyDocumentStoreImpl implements LocalOnlyDocumentStoreType {
  readonly isLocalOnly = true as const;
  readonly isCloudAvailable = false as const;

  private readonly localDocuments = new Map<string, LocalDocumentMetadata>();

  getLocalDocument(uri: string): LocalDocumentMetadata | undefined {
    return this.localDocuments.get(uri);
  }

  saveLocalDocument(uri: string, metadata: LocalDocumentMetadata): void {
    this.localDocuments.set(uri, metadata);
  }

  listLocalDocuments(): LocalDocumentMetadata[] {
    return Array.from(this.localDocuments.values());
  }

  removeLocalDocument(uri: string): void {
    this.localDocuments.delete(uri);
  }
}

/**
 * Check if a document store is local-only.
 */
export function isLocalOnlyStore(store: unknown): store is LocalOnlyDocumentStoreType {
  return (store as LocalOnlyDocumentStoreType)?.isLocalOnly === true;
}
