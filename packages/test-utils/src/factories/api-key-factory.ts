/**
 * Factory functions for creating test API key data.
 */

/**
 * Request payload for creating an API key.
 */
export interface CreateApiKeyRequest {
  /** Human-readable name for the key */
  name: string;
  /** Permission scopes for the key */
  scopes: string[];
  /** Optional expiration timestamp */
  expires_at?: string;
}

/**
 * API key entity structure.
 */
export interface ApiKey {
  /** Unique API key ID */
  id: string;
  /** Owner user ID */
  user_id: string;
  /** Human-readable name */
  name: string;
  /** First 8 characters of the key for identification */
  key_prefix: string;
  /** SHA-256 hash of the full key */
  key_hash: string;
  /** Permission scopes */
  scopes: string[];
  /** Creation timestamp */
  created_at: string;
  /** Expiration timestamp (null if no expiration) */
  expires_at: string | null;
  /** Revocation timestamp (null if active) */
  revoked_at: string | null;
  /** Last usage timestamp (null if never used) */
  last_used_at: string | null;
}

/**
 * Builds a CreateApiKeyRequest with sensible defaults.
 *
 * @param overrides - Partial values to override defaults
 * @returns CreateApiKeyRequest
 *
 * @example
 * ```typescript
 * const request = buildCreateApiKeyRequest({ name: 'CI/CD Key' });
 * // { name: 'CI/CD Key', scopes: ['read:documents'] }
 * ```
 */
export function buildCreateApiKeyRequest(
  overrides?: Partial<CreateApiKeyRequest>
): CreateApiKeyRequest {
  return {
    name: 'Test API Key',
    scopes: ['read:documents'],
    ...overrides,
  };
}

/**
 * Builds an ApiKey with sensible defaults.
 *
 * @param overrides - Partial values to override defaults
 * @returns ApiKey
 *
 * @example
 * ```typescript
 * const key = buildApiKey({ name: 'Production Key', scopes: ['read:documents', 'write:documents'] });
 * ```
 */
export function buildApiKey(overrides?: Partial<ApiKey>): ApiKey {
  const now = new Date().toISOString();
  const keyPrefix = 'sk_test_';

  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    name: 'Test API Key',
    key_prefix: keyPrefix,
    key_hash: 'sha256_placeholder_hash_for_testing',
    scopes: ['read:documents'],
    created_at: now,
    expires_at: null,
    revoked_at: null,
    last_used_at: null,
    ...overrides,
  };
}
