/**
 * Health Routes
 *
 * Health check endpoints for monitoring and orchestration.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';

/**
 * Create health check routes.
 *
 * @param isReady - Function that returns true when server is ready
 * @returns Hono router
 */
export function createHealthRoutes(isReady: () => boolean): Hono {
  const router = new Hono();

  /**
   * Liveness check.
   *
   * GET /health
   *
   * Returns 200 if the server process is alive.
   */
  router.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
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
