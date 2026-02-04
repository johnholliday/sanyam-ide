/**
 * HTTP REST Gateway Server
 *
 * Embedded Hono HTTP server for external API access to grammar operations.
 * Runs alongside the language server on a configurable port.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import type { OperationExecutor } from '../operations/operation-executor.js';
import type { OperationRegistry } from '../operations/operation-registry.js';
import type { JobManager } from '../operations/job-manager.js';
import type { UnifiedDocumentResolver } from '../services/document-resolver.js';
import { createOperationsRoutes } from './routes/operations.js';
import { createJobsRoutes } from './routes/jobs.js';
import { createHealthRoutes } from './routes/health.js';
import { createDocsRoutes } from './routes/docs.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { authMiddleware, type AuthConfig } from './middleware/auth.js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from './types.js';

const logger = createLogger({ name: 'HttpServer' });

/**
 * HTTP server configuration.
 */
export interface HttpServerConfig {
  /** Port to listen on. Default: SANYAM_API_PORT env var or 3001 */
  port?: number;

  /** Host to bind to. Default: '0.0.0.0' */
  host?: string;

  /** Enable CORS. Default: true */
  cors?: boolean;

  /** Authentication configuration */
  auth?: AuthConfig;
}

/**
 * Dependencies for HTTP server.
 */
export interface HttpServerDependencies {
  /** Operation executor */
  executor: OperationExecutor;

  /** Operation registry */
  registry: OperationRegistry;

  /** Job manager */
  jobManager: JobManager;

  /** Document resolver */
  documentResolver: UnifiedDocumentResolver;

  /** Ready check function */
  isReady: () => boolean;
}

/**
 * HTTP server instance.
 */
export interface HttpServerInstance {
  /** The Hono app */
  app: Hono<HonoEnv>;

  /** Start the server */
  start: () => Promise<void>;

  /** Stop the server */
  stop: () => Promise<void>;

  /** Get the port the server is listening on */
  getPort: () => number;
}

/**
 * Create and configure the HTTP REST gateway server.
 *
 * @param config - Server configuration
 * @param deps - Server dependencies
 * @returns HTTP server instance
 */
export function createHttpServer(
  config: HttpServerConfig,
  deps: HttpServerDependencies
): HttpServerInstance {
  const port = config.port ?? parseInt(process.env['SANYAM_API_PORT'] ?? '3001', 10);
  const host = config.host ?? '0.0.0.0';

  const app = new Hono<HonoEnv>();

  // Middleware: CORS
  if (config.cors !== false) {
    app.use('*', cors({
      origin: '*',
      allowHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-API-Key'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }));
  }

  // Middleware: Correlation ID
  app.use('*', correlationMiddleware());

  // Middleware: Authentication (optional)
  if (config.auth) {
    app.use('/api/*', authMiddleware(config.auth));
  }

  // Mount all routes under /api prefix for consistent proxying
  const healthRoutes = createHealthRoutes(deps.isReady);
  const operationsRoutes = createOperationsRoutes(deps.executor, deps.registry);
  const jobsRoutes = createJobsRoutes(deps.jobManager);
  const docsRoutes = createDocsRoutes(deps.registry, undefined, '/api');

  // All routes under /api for consistent proxy routing
  app.route('/api', healthRoutes);        // /api/health, /api/ready, /api/version
  app.route('/api', docsRoutes);          // /api/docs, /api/openapi.json
  app.route('/api/v1', operationsRoutes); // /api/v1/* operations
  app.route('/api/v1/jobs', jobsRoutes);  // /api/v1/jobs/*

  // Global error handler
  app.onError((err, c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';
    logger.error({ err, correlationId, path: c.req.path }, 'Unhandled error');

    return c.json(
      {
        success: false,
        error: err.message,
        correlationId,
      },
      500
    );
  });

  // 404 handler
  app.notFound((c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';
    return c.json(
      {
        success: false,
        error: 'Not found',
        correlationId,
      },
      404
    );
  });

  let server: ReturnType<typeof serve> | null = null;

  return {
    app,

    async start() {
      return new Promise((resolve) => {
        server = serve({
          fetch: app.fetch,
          port,
          hostname: host,
        }, () => {
          logger.info({ port, host }, 'HTTP REST gateway started');
          resolve();
        });
      });
    },

    async stop() {
      if (server) {
        server.close();
        server = null;
        logger.info('HTTP REST gateway stopped');
      }
    },

    getPort() {
      return port;
    },
  };
}
