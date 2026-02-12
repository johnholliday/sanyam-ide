/**
 * Available scopes for API keys.
 */
export type ApiScope =
  | 'documents:read'
  | 'documents:write'
  | 'documents:delete'
  | 'versions:read'
  | 'shares:read'
  | 'shares:write';

/**
 * All available API scopes.
 */
export const ALL_API_SCOPES: readonly ApiScope[] = [
  'documents:read',
  'documents:write',
  'documents:delete',
  'versions:read',
  'shares:read',
  'shares:write',
] as const;

/**
 * An API key for programmatic access.
 * Note: The key_hash is never exposed; only key_prefix is visible after creation.
 */
export interface ApiKey {
  /** Unique key identifier (UUID) */
  readonly id: string;

  /** Owner's user profile ID */
  readonly user_id: string;

  /** Human-readable name for identification */
  readonly name: string;

  /** First 8 characters for display (e.g., "sanyam_a1") */
  readonly key_prefix: string;

  /** Granted permissions */
  readonly scopes: ApiScope[];

  /** Last usage timestamp */
  readonly last_used_at: string | null;

  /** Total usage count */
  readonly usage_count: number;

  /** Expiration timestamp (null for no expiration) */
  readonly expires_at: string | null;

  /** Revocation timestamp (null if active) */
  readonly revoked_at: string | null;

  /** Creation timestamp */
  readonly created_at: string;
}

/**
 * Request to create a new API key.
 */
export interface CreateApiKeyRequest {
  /** Human-readable name for the key */
  readonly name: string;

  /** Permissions to grant */
  readonly scopes: ApiScope[];

  /** Days until expiration (optional) */
  readonly expires_in_days?: number;
}

/**
 * Response when creating an API key.
 * Includes the full key which is only shown once.
 */
export interface CreateApiKeyResponse {
  /** API key metadata */
  readonly data: ApiKey & {
    /**
     * Full API key secret.
     * SAVE THIS NOW - it will not be shown again.
     * Format: sanyam_XXXXXXXXXXXXXXXXXXXXXXXX
     */
    readonly key: string;
  };
}

/**
 * API key prefix used for generation.
 */
export const API_KEY_PREFIX = 'sanyam_';
