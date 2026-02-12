/**
 * API Keys Routes
 *
 * REST endpoints for API key management.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';
import {
  validateJson,
  validateParam,
  validateQuery,
  getValidatedJson,
  getValidatedParam,
  getValidatedQuery,
} from '../middleware/validation.js';
import { ApiErrors } from '../middleware/error-handler.js';
import { generateApiKey, hashApiKey } from '../middleware/api-key-auth.js';
import {
  apiKeyIdParamSchema,
  listApiKeysQuerySchema,
  createApiKeySchema,
  type ApiKeyIdParams,
  type ListApiKeysQuery,
  type CreateApiKeyInput,
} from './api-keys.schemas.js';

const logger = createLogger({ name: 'ApiKeysRoutes' });

/**
 * Dependencies for API key routes.
 */
export interface ApiKeyRouteDependencies {
  /** Function to create user-scoped Supabase client */
  createClient: (accessToken: string) => SupabaseClient;
}

/**
 * Tiers that can access API key management.
 */
const ALLOWED_TIERS = ['pro', 'enterprise'];

/**
 * Create API key routes.
 *
 * @param deps - Route dependencies
 * @returns Hono app with API key routes
 */
export function createApiKeyRoutes(deps: ApiKeyRouteDependencies): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  /**
   * Check tier access.
   */
  const checkTierAccess = (tier: string): boolean => {
    return ALLOWED_TIERS.includes(tier);
  };

  /**
   * GET /api-keys - List user's API keys
   */
  app.get('/', validateQuery(listApiKeysQuerySchema), async (c) => {
    const user = c.get('user');
    if (!user) {
      return ApiErrors.unauthorized();
    }

    const query = getValidatedQuery<ListApiKeysQuery>(c);
    const accessToken = c.req.header('Authorization')?.slice(7);
    if (!accessToken) {
      return ApiErrors.unauthorized();
    }

    const client = deps.createClient(accessToken);

    try {
      // Check user's tier
      const { data: profile, error: profileError } = await client
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return ApiErrors.forbidden('Unable to verify subscription tier');
      }

      if (!checkTierAccess(profile.subscription_tier)) {
        return ApiErrors.forbidden(
          'API key management requires a Pro or Enterprise subscription'
        );
      }

      // List API keys (excluding sensitive key_hash)
      let keysQuery = client
        .from('api_keys')
        .select('id, name, scopes, created_at, expires_at, last_used_at, revoked_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(query.limit);

      if (!query.includeRevoked) {
        keysQuery = keysQuery.is('revoked_at', null);
      }

      const { data: keys, error: keysError } = await keysQuery;

      if (keysError) {
        logger.error({ err: keysError }, 'Failed to list API keys');
        return ApiErrors.internal(keysError.message);
      }

      return c.json(keys);
    } catch (err) {
      logger.error({ err }, 'Error listing API keys');
      return ApiErrors.internal();
    }
  });

  /**
   * POST /api-keys - Create a new API key
   */
  app.post('/', validateJson(createApiKeySchema), async (c) => {
    const user = c.get('user');
    if (!user) {
      return ApiErrors.unauthorized();
    }

    const input = getValidatedJson<CreateApiKeyInput>(c);
    const accessToken = c.req.header('Authorization')?.slice(7);
    if (!accessToken) {
      return ApiErrors.unauthorized();
    }

    const client = deps.createClient(accessToken);

    try {
      // Check user's tier
      const { data: profile, error: profileError } = await client
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return ApiErrors.forbidden('Unable to verify subscription tier');
      }

      if (!checkTierAccess(profile.subscription_tier)) {
        return ApiErrors.forbidden(
          'API key management requires a Pro or Enterprise subscription'
        );
      }

      // Check API key limit (based on tier_limits table)
      const { data: limits, error: limitsError } = await client
        .from('tier_limits')
        .select('api_keys_allowed, max_api_keys')
        .eq('tier', profile.subscription_tier)
        .single();

      if (limitsError || !limits) {
        logger.error({ err: limitsError }, 'Failed to get tier limits');
        return ApiErrors.internal('Unable to check API key limits');
      }

      if (!limits.api_keys_allowed) {
        return ApiErrors.forbidden('API keys are not available for your subscription tier');
      }

      // Count existing keys
      const { count, error: countError } = await client
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('revoked_at', null);

      if (countError) {
        logger.error({ err: countError }, 'Failed to count API keys');
        return ApiErrors.internal('Unable to verify key limit');
      }

      if (count !== null && count >= limits.max_api_keys) {
        return ApiErrors.quotaExceeded(
          `Maximum ${limits.max_api_keys} API keys allowed for your tier`
        );
      }

      // Generate new API key
      const plainKey = generateApiKey();
      const keyHash = hashApiKey(plainKey);

      // Create API key record
      const { data: newKey, error: createError } = await client
        .from('api_keys')
        .insert({
          user_id: user.id,
          name: input.name,
          key_hash: keyHash,
          scopes: input.scopes,
          expires_at: input.expiresAt ?? null,
        })
        .select('id, name, scopes, created_at, expires_at')
        .single();

      if (createError) {
        logger.error({ err: createError }, 'Failed to create API key');
        return ApiErrors.internal(createError.message);
      }

      logger.info({ keyId: newKey.id, userId: user.id }, 'API key created');

      // Return the key with the plain secret (only time it's shown)
      return c.json(
        {
          ...newKey,
          key: plainKey,
          message: 'Store this key securely - it will not be shown again',
        },
        201
      );
    } catch (err) {
      logger.error({ err }, 'Error creating API key');
      return ApiErrors.internal();
    }
  });

  /**
   * GET /api-keys/:id - Get API key details
   */
  app.get('/:id', validateParam(apiKeyIdParamSchema), async (c) => {
    const user = c.get('user');
    if (!user) {
      return ApiErrors.unauthorized();
    }

    const params = getValidatedParam<ApiKeyIdParams>(c);
    const accessToken = c.req.header('Authorization')?.slice(7);
    if (!accessToken) {
      return ApiErrors.unauthorized();
    }

    const client = deps.createClient(accessToken);

    try {
      const { data: key, error } = await client
        .from('api_keys')
        .select('id, name, scopes, created_at, expires_at, last_used_at, revoked_at')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return ApiErrors.notFound('API key', params.id);
        }
        logger.error({ err: error }, 'Failed to get API key');
        return ApiErrors.internal(error.message);
      }

      return c.json(key);
    } catch (err) {
      logger.error({ err }, 'Error getting API key');
      return ApiErrors.internal();
    }
  });

  /**
   * DELETE /api-keys/:id - Revoke an API key
   */
  app.delete('/:id', validateParam(apiKeyIdParamSchema), async (c) => {
    const user = c.get('user');
    if (!user) {
      return ApiErrors.unauthorized();
    }

    const params = getValidatedParam<ApiKeyIdParams>(c);
    const accessToken = c.req.header('Authorization')?.slice(7);
    if (!accessToken) {
      return ApiErrors.unauthorized();
    }

    const client = deps.createClient(accessToken);

    try {
      // Soft revoke the key
      const { data: key, error } = await client
        .from('api_keys')
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .is('revoked_at', null) // Only revoke if not already revoked
        .select('id')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return ApiErrors.notFound('API key', params.id);
        }
        logger.error({ err: error }, 'Failed to revoke API key');
        return ApiErrors.internal(error.message);
      }

      logger.info({ keyId: params.id, userId: user.id }, 'API key revoked');

      return c.json({ message: 'API key revoked', id: key.id });
    } catch (err) {
      logger.error({ err }, 'Error revoking API key');
      return ApiErrors.internal();
    }
  });

  return app;
}
