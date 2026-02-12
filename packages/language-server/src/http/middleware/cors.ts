/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration for cloud storage API.
 *
 * @packageDocumentation
 */

import { cors } from 'hono/cors';

/**
 * CORS configuration options.
 */
export interface CorsConfig {
  /**
   * Allowed origins.
   * Can be a string, array of strings, or a function that returns boolean.
   * Default: '*' (all origins)
   */
  readonly origin?: string | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods.
   * Default: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
   */
  readonly allowMethods?: string[];

  /**
   * Allowed request headers.
   * Default: Standard headers + X-Correlation-ID, X-API-Key
   */
  readonly allowHeaders?: string[];

  /**
   * Headers to expose to the client.
   * Default: X-Correlation-ID, X-RateLimit-*
   */
  readonly exposeHeaders?: string[];

  /**
   * Max age for preflight cache in seconds.
   * Default: 600 (10 minutes)
   */
  readonly maxAge?: number;

  /**
   * Allow credentials (cookies, authorization headers).
   * Default: true for authenticated APIs
   */
  readonly credentials?: boolean;
}

/**
 * Default CORS configuration for cloud storage API.
 */
export const DEFAULT_CORS_CONFIG: Required<CorsConfig> = {
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'If-Match',
    'If-None-Match',
  ],
  exposeHeaders: [
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'ETag',
    'Location',
    'Content-Range',
  ],
  maxAge: 600,
  credentials: true,
};

/**
 * Create production CORS configuration (restrictive).
 *
 * @param allowedOrigins - Array of allowed origins
 * @returns CORS configuration
 */
export function createProductionCorsConfig(allowedOrigins: string[]): CorsConfig {
  return {
    ...DEFAULT_CORS_CONFIG,
    origin: (origin: string) => allowedOrigins.includes(origin),
    credentials: true,
  };
}

/**
 * Create development CORS configuration (permissive).
 *
 * @returns CORS configuration
 */
export function createDevelopmentCorsConfig(): CorsConfig {
  return {
    ...DEFAULT_CORS_CONFIG,
    origin: '*',
    credentials: false, // credentials with wildcard origin not allowed
  };
}

/**
 * Create CORS middleware with cloud storage defaults.
 *
 * @param config - Optional CORS configuration
 * @returns Hono CORS middleware
 */
export function corsMiddleware(config: CorsConfig = DEFAULT_CORS_CONFIG) {
  const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  return cors({
    origin: mergedConfig.origin as any,
    allowHeaders: mergedConfig.allowHeaders,
    allowMethods: mergedConfig.allowMethods,
    exposeHeaders: mergedConfig.exposeHeaders,
    maxAge: mergedConfig.maxAge,
    credentials: mergedConfig.credentials,
  });
}

/**
 * Create CORS middleware from environment variables.
 *
 * Environment variables:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins
 * - NODE_ENV: 'production' for restrictive config, else permissive
 *
 * @returns Hono CORS middleware
 */
export function corsMiddlewareFromEnv() {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const originsEnv = process.env['CORS_ALLOWED_ORIGINS'];

  if (isProduction && originsEnv) {
    const origins = originsEnv.split(',').map((o) => o.trim());
    return corsMiddleware(createProductionCorsConfig(origins));
  }

  return corsMiddleware(createDevelopmentCorsConfig());
}
