/**
 * API Key Authentication Middleware
 *
 * Middleware for authenticating requests via API keys.
 *
 * @packageDocumentation
 */

import type { Context, Next } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv, ApiKeyContext } from '../types.js';
import { ApiErrors } from './error-handler.js';
import type { ApiScope } from '../routes/api-keys.schemas.js';

const logger = createLogger({ name: 'ApiKeyAuthMiddleware' });

/**
 * API key header name.
 */
export const API_KEY_HEADER = 'X-API-Key';

// Re-export ApiKeyContext for convenience
export type { ApiKeyContext } from '../types.js';

/**
 * Dependencies for API key auth middleware.
 */
export interface ApiKeyAuthDependencies {
  /** Function to create admin Supabase client */
  createAdminClient: () => SupabaseClient;
}

/**
 * Hash an API key for storage/comparison.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key.
 * Format: sanyam_<32 random hex chars>
 */
export function generateApiKey(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sanyam_${hex}`;
}

/**
 * Create API key authentication middleware.
 *
 * @param deps - Middleware dependencies
 * @param requiredScopes - Scopes required for the protected route
 * @returns Hono middleware function
 */
export function createApiKeyAuthMiddleware(
  deps: ApiKeyAuthDependencies,
  requiredScopes?: ApiScope[]
) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const apiKey = c.req.header(API_KEY_HEADER);

    if (!apiKey) {
      // No API key provided - continue to next middleware (might use JWT auth)
      return next();
    }

    // Validate API key format
    if (!apiKey.startsWith('sanyam_') || apiKey.length !== 39) {
      return ApiErrors.unauthorized('Invalid API key format');
    }

    try {
      const client = deps.createAdminClient();
      const keyHash = hashApiKey(apiKey);

      // Look up the API key
      const { data: keyRecord, error } = await client
        .from('api_keys')
        .select('id, user_id, name, scopes, expires_at, revoked_at')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single();

      if (error || !keyRecord) {
        logger.warn({ keyPrefix: apiKey.slice(0, 12) }, 'Invalid API key');
        return ApiErrors.unauthorized('Invalid or revoked API key');
      }

      // Check expiration
      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        logger.warn({ keyId: keyRecord.id }, 'Expired API key');
        return ApiErrors.unauthorized('API key has expired');
      }

      // Check required scopes
      if (requiredScopes && requiredScopes.length > 0) {
        const grantedScopes = new Set(keyRecord.scopes as ApiScope[]);
        const missingScopes = requiredScopes.filter((s) => !grantedScopes.has(s));

        if (missingScopes.length > 0) {
          logger.warn(
            { keyId: keyRecord.id, missingScopes },
            'API key missing required scopes'
          );
          return ApiErrors.forbidden(`Missing required scopes: ${missingScopes.join(', ')}`);
        }
      }

      // Update last_used_at
      await client
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyRecord.id);

      // Set API key context
      const apiKeyContext: ApiKeyContext = {
        id: keyRecord.id,
        userId: keyRecord.user_id,
        scopes: keyRecord.scopes as ApiScope[],
        name: keyRecord.name,
      };

      c.set('apiKey', apiKeyContext);

      // Also set user context for RLS
      // Note: API key auth sets minimal user context; full profile lookup happens elsewhere
      c.set('user', {
        id: keyRecord.user_id,
        email: '', // Not available from API key context
        tier: 'free', // Default, actual tier would need to be looked up
      });

      logger.debug({ keyId: keyRecord.id }, 'API key authenticated');
      return next();
    } catch (err) {
      // Re-throw ApiException to let error handler handle it
      if (err instanceof Error && err.name === 'ApiException') {
        throw err;
      }
      logger.error({ err }, 'API key authentication error');
      return ApiErrors.internal('Authentication error');
    }
  };
}

/**
 * Middleware to require API key authentication (no fallback to JWT).
 */
export function requireApiKey(deps: ApiKeyAuthDependencies, requiredScopes?: ApiScope[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const apiKey = c.req.header(API_KEY_HEADER);

    if (!apiKey) {
      return ApiErrors.unauthorized(`${API_KEY_HEADER} header required`);
    }

    return createApiKeyAuthMiddleware(deps, requiredScopes)(c, next);
  };
}

/**
 * Check if request was authenticated via API key.
 */
export function isApiKeyAuth(c: Context<HonoEnv>): boolean {
  return c.get('apiKey') !== undefined;
}

/**
 * Get API key context from request.
 */
export function getApiKeyContext(c: Context<HonoEnv>): ApiKeyContext | undefined {
  return c.get('apiKey');
}
