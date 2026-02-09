/**
 * Documentation Routes
 *
 * Serves OpenAPI specification and RapiDoc UI for interactive API documentation.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { html } from 'hono/html';
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
   * RapiDoc API Documentation UI.
   *
   * GET /docs
   *
   * Serves an interactive RapiDoc UI for exploring and testing the API.
   */
  router.get('/docs', (c) => {
    const specUrl = `${basePath}/openapi.json`;
    const page = html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sanyam API Documentation</title>
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    rapi-doc { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <rapi-doc
    spec-url="${specUrl}"
    theme="dark"
    bg-color="#1e1e1e"
    text-color="#cccccc"
    header-color="#252526"
    primary-color="#007fd4"
    nav-bg-color="#252526"
    nav-text-color="#cccccc"
    nav-hover-bg-color="#2a2d2e"
    nav-accent-color="#007fd4"
    render-style="read"
    schema-style="table"
    show-header="true"
    show-info="true"
    allow-try="true"
    allow-authentication="true"
    allow-server-selection="true"
    show-method-in-nav-bar="as-colored-text"
    use-path-in-nav-bar="true"
    heading-text="Sanyam API"
    regular-font="'Segoe UI', system-ui, -apple-system, sans-serif"
    mono-font="'Cascadia Code', 'Fira Code', 'Consolas', monospace"
  ></rapi-doc>
</body>
</html>`;
    return c.html(page);
  });

  /**
   * Redirect /docs/ to /docs for convenience.
   */
  router.get('/docs/', (c) => {
    return c.redirect(`${basePath}/docs`);
  });

  return router;
}
