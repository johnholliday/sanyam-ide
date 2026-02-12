/**
 * Health Routes
 *
 * Health check endpoints for monitoring and orchestration.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';

/**
 * Health check configuration.
 */
export interface HealthCheckConfig {
  /** Function that returns true when server is ready */
  isReady: () => boolean;
  /** Function that returns true if Supabase is configured */
  isSupabaseConfigured?: () => boolean;
  /** Function that returns true if at least one auth provider is available */
  isAuthAvailable?: () => boolean;
  /** Server version string */
  version?: string;
}

/**
 * Health response shape for integration test readiness detection.
 */
export interface HealthResponse {
  /** Overall status */
  status: 'ok';
  /** Supabase connectivity/configuration status */
  supabase: boolean;
  /** Auth provider availability */
  auth: boolean;
  /** Gateway version */
  version: string;
}

/**
 * Create health check routes.
 *
 * @param config - Health check configuration
 * @returns Hono router
 */
export function createHealthRoutes(config: HealthCheckConfig | (() => boolean)): Hono {
  // Support legacy signature: createHealthRoutes(isReady)
  const normalizedConfig: HealthCheckConfig =
    typeof config === 'function' ? { isReady: config } : config;

  const {
    isReady,
    isSupabaseConfigured = () => false,
    isAuthAvailable = () => false,
    version = process.env['npm_package_version'] ?? 'unknown',
  } = normalizedConfig;

  const router = new Hono();

  /**
   * Liveness check.
   *
   * GET /health
   *
   * Returns 200 if the server process is alive.
   * Includes supabase, auth, and version fields for integration test readiness.
   */
  router.get('/health', (c) => {
    const response: HealthResponse = {
      status: 'ok',
      supabase: isSupabaseConfigured(),
      auth: isAuthAvailable(),
      version,
    };
    return c.json(response);
  });

  /**
   * Readiness check.
   *
   * GET /ready
   *
   * Returns 200 if the server is ready to accept requests.
   * Returns 503 if the server is still initializing.
   */
  router.get('/ready', (c) => {
    if (isReady()) {
      return c.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    }

    return c.json(
      {
        status: 'not_ready',
        message: 'Server is still initializing',
        timestamp: new Date().toISOString(),
      },
      503
    );
  });

  /**
   * Version info.
   *
   * GET /version
   */
  router.get('/version', (c) => {
    return c.json({
      name: 'sanyam-language-server',
      version: process.env['npm_package_version'] ?? 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
