/**
 * Documentation Routes
 *
 * Serves OpenAPI specification and Swagger UI for interactive API documentation.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import type { OperationRegistry } from '../../operations/operation-registry.js';
import { buildOpenAPISpec } from '../openapi/schema-builder.js';

/**
 * Create documentation routes.
 *
 * @param registry - Operation registry for generating OpenAPI spec
 * @param serverUrl - Base URL for the server (default: derived from request)
 * @param basePath - Base path for docs routes (default: '' for root)
 * @returns Hono router
 */
export function createDocsRoutes(
  registry: OperationRegistry,
  serverUrl?: string,
  basePath: string = ''
): Hono {
  const router = new Hono();

  /**
   * OpenAPI JSON specification.
   *
   * GET /openapi.json
   *
   * Returns the complete OpenAPI 3.1 specification for all registered operations.
   */
  router.get('/openapi.json', (c) => {
    // Derive server URL from request if not provided
    const url = serverUrl ?? `${c.req.header('x-forwarded-proto') ?? 'http'}://${c.req.header('host') ?? 'localhost:3001'}`;
    const spec = buildOpenAPISpec(registry, url);
    return c.json(spec);
  });

  /**
   * Swagger UI.
   *
   * GET /docs
   *
   * Serves an interactive Swagger UI for exploring and testing the API.
   * Uses a sibling-relative path to openapi.json so it works whether
   * accessed directly or through a proxy with path prefix.
   */
  router.get(
    '/docs',
    swaggerUI({
      // Use sibling-relative path so it works from /docs or /api/docs
      url: `${basePath}/openapi.json`,
    })
  );

  /**
   * Redirect /docs/ to /docs for convenience.
   */
  router.get('/docs/', (c) => {
    return c.redirect(`${basePath}/docs`);
  });

  return router;
}
