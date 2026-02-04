/**
 * Authentication Middleware
 *
 * Configurable authentication for REST API.
 * Supports: none, API key, and Supabase Auth.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import type { OperationUser } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'AuthMiddleware' });

/**
 * Authentication mode.
 */
export type AuthMode = 'none' | 'api-key' | 'supabase';

/**
 * Authentication configuration.
 */
export interface AuthConfig {
  /** Authentication mode */
  mode: AuthMode;

  /** API keys (for api-key mode) */
  apiKeys?: string[];

  /** Supabase URL (for supabase mode) */
  supabaseUrl?: string;

  /** Supabase anon key (for supabase mode) */
  supabaseAnonKey?: string;

  /** Paths to exclude from auth (e.g., ['/health', '/ready']) */
  excludePaths?: string[];
}

/**
 * Header for API key authentication.
 */
const API_KEY_HEADER = 'X-API-Key';

/**
 * Authentication middleware factory.
 *
 * @param config - Authentication configuration
 * @returns Hono middleware
 */
export function authMiddleware(config: AuthConfig) {
  const excludePaths = new Set(config.excludePaths ?? ['/health', '/ready', '/version']);

  return createMiddleware(async (c, next) => {
    // Check if path is excluded
    const path = c.req.path;
    if (excludePaths.has(path)) {
      await next();
      return;
    }

    // Handle based on auth mode
    switch (config.mode) {
      case 'none':
        await next();
        return;

      case 'api-key':
        await handleApiKeyAuth(c, config, next);
        return;

      case 'supabase':
        await handleSupabaseAuth(c, config, next);
        return;

      default:
        logger.warn({ mode: config.mode }, 'Unknown auth mode, allowing request');
        await next();
    }
  });
}

/**
 * Handle API key authentication.
 */
async function handleApiKeyAuth(
  c: any,
  config: AuthConfig,
  next: () => Promise<void>
): Promise<void> {
  const apiKey = c.req.header(API_KEY_HEADER) ?? c.req.query('api_key');

  if (!apiKey) {
    const correlationId = c.get('correlationId') ?? 'unknown';
    c.status(401);
    return c.json({
      success: false,
      error: 'Missing API key',
      correlationId,
    });
  }

  if (!config.apiKeys?.includes(apiKey)) {
    const correlationId = c.get('correlationId') ?? 'unknown';
    logger.warn({ correlationId }, 'Invalid API key');
    c.status(401);
    return c.json({
      success: false,
      error: 'Invalid API key',
      correlationId,
    });
  }

  // API key is valid - create a basic user
  const user: OperationUser = {
    id: 'api-key-user',
    email: 'api@local',
    tier: 'enterprise', // API key users get full access
  };

  c.set('user', user);
  await next();
}

/**
 * Handle Supabase authentication.
 */
async function handleSupabaseAuth(
  c: any,
  config: AuthConfig,
  next: () => Promise<void>
): Promise<void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    const correlationId = c.get('correlationId') ?? 'unknown';
    c.status(401);
    return c.json({
      success: false,
      error: 'Missing or invalid Authorization header',
      correlationId,
    });
  }

  const token = authHeader.slice(7);

  // Verify token with Supabase
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    logger.error('Supabase auth configured but missing URL or anon key');
    c.status(500);
    return c.json({
      success: false,
      error: 'Authentication configuration error',
    });
  }

  try {
    // Call Supabase to verify token
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey,
      },
    });

    if (!response.ok) {
      const correlationId = c.get('correlationId') ?? 'unknown';
      logger.warn({ correlationId, status: response.status }, 'Supabase auth failed');
      c.status(401);
      return c.json({
        success: false,
        error: 'Invalid or expired token',
        correlationId,
      });
    }

    const userData = await response.json() as { id: string; email?: string; app_metadata?: { tier?: string } };

    // Create user from Supabase response
    const user: OperationUser = {
      id: userData.id,
      email: userData.email ?? 'unknown',
      tier: userData.app_metadata?.tier ?? 'free',
    };

    c.set('user', user);
    await next();
  } catch (error) {
    logger.error({ err: error }, 'Supabase auth error');
    c.status(500);
    return c.json({
      success: false,
      error: 'Authentication service error',
    });
  }
}

/**
 * Create auth config from environment variables.
 */
export function createAuthConfigFromEnv(): AuthConfig {
  const mode = (process.env['SANYAM_AUTH_MODE'] ?? 'none') as AuthMode;

  return {
    mode,
    apiKeys: process.env['SANYAM_API_KEYS']?.split(',').map((k) => k.trim()),
    supabaseUrl: process.env['SUPABASE_URL'],
    supabaseAnonKey: process.env['SUPABASE_ANON_KEY'],
    excludePaths: ['/health', '/ready', '/version'],
  };
}
