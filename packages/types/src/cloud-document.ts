/**
 * A DSL document stored in the cloud.
 */
export interface CloudDocument {
  /** Unique document identifier (UUID) */
  readonly id: string;

  /** Owner's user profile ID */
  readonly owner_id: string;

  /** Document display name */
  readonly name: string;

  /** Language identifier (e.g., 'ecml', 'garp') */
  readonly language_id: string;

  /** Document content (DSL source text) */
  readonly content: string;

  /** Computed content size in bytes */
  readonly content_size_bytes: number;

  /** Optimistic locking version number */
  readonly version: number;

  /** Soft delete timestamp (null if not deleted) */
  readonly deleted_at: string | null;

  /** Creation timestamp */
  readonly created_at: string;

  /** Last update timestamp */
  readonly updated_at: string;
}

/**
 * Request to create a new cloud document.
 */
export interface CreateDocumentRequest {
  /** Document display name */
  readonly name: string;

  /** Language identifier */
  readonly language_id: string;

  /** Initial content (defaults to empty string) */
  readonly content?: string;
}

/**
 * Request to update an existing cloud document.
 */
export interface UpdateDocumentRequest {
  /** Updated document name (optional) */
  readonly name?: string;

  /** Updated content (optional) */
  readonly content?: string;
}

/**
 * A historical snapshot of document content.
 */
export interface DocumentVersion {
  /** Unique version identifier (UUID) */
  readonly id: string;

  /** Parent document ID */
  readonly document_id: string;

  /** Sequential version number within the document */
  readonly version_number: number;

  /** Content at this version */
  readonly content: string;

  /** Computed content size in bytes */
  readonly content_size_bytes: number;

  /** User who created this version (null for system-created) */
  readonly created_by: string | null;

  /** Version creation timestamp */
  readonly created_at: string;
}

/**
 * Permission levels for document sharing.
 */
export type SharePermission = 'view' | 'edit' | 'admin';

/**
 * A permission grant for document sharing.
 */
export interface DocumentShare {
  /** Unique share identifier (UUID) */
  readonly id: string;

  /** Document being shared */
  readonly document_id: string;

  /** User receiving the share */
  readonly shared_with_id: string;

  /** Permission level granted */
  readonly permission: SharePermission;

  /** User who created the share */
  readonly created_by: string;

  /** Share creation timestamp */
  readonly created_at: string;
}

/**
 * Request to share a document with another user.
 */
export interface CreateShareRequest {
  /** Email of user to share with */
  readonly email: string;

  /** Permission level to grant */
  readonly permission: SharePermission;
}

/**
 * Cloud document URI scheme prefix.
 */
export const SANYAM_URI_SCHEME = 'sanyam';

/**
 * Reserved path segment for future binary assets.
 */
export const ASSETS_PATH_SEGMENT = 'assets';
