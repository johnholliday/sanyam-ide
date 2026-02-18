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
import { execSync } from 'node:child_process';
import net from 'node:net';
import type { LangiumSharedCoreServices } from 'langium';
import type { OperationExecutor } from '../operations/operation-executor.js';
import type { OperationRegistry } from '../operations/operation-registry.js';
import type { JobManager } from '../operations/job-manager.js';
import type { UnifiedDocumentResolver } from '../services/document-resolver.js';
import type { LanguageRegistry } from '../language-registry.js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createOperationsRoutes } from './routes/operations.js';
import { createJobsRoutes } from './routes/jobs.js';
import { createHealthRoutes } from './routes/health.js';
import { createDocsRoutes } from './routes/docs.js';
import { createModelsRoutes } from './routes/models.js';
import { createDocumentRoutes } from './routes/documents.js';
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

  /** Langium shared core services for workspace access */
  sharedServices: LangiumSharedCoreServices;

  /** Language registry for metadata lookups */
  languageRegistry: LanguageRegistry;

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
 * Check whether a TCP port is currently in use.
 *
 * @param port - Port number to probe
 * @returns true if something is listening on the port
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * Kill any stale process occupying the given port so this server can bind.
 *
 * Only kills processes whose command line indicates they are a sanyam language
 * server (`main.js`). Other processes are left alone.
 *
 * @param port - Port number to reclaim
 */
async function reclaimPort(port: number): Promise<void> {
  if (!(await isPortInUse(port))) {
    return;
  }

  logger.warn({ port }, `Port ${port} occupied by another process, attempting to reclaim`);

  try {
    // Find the PID occupying the port
    const pidOutput = execSync(`fuser ${port}/tcp 2>/dev/null`, { encoding: 'utf-8' }).trim();
    const pids = pidOutput.split(/\s+/).filter(Boolean);

    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid) || pid === process.pid) {
        continue;
      }

      // Verify it's a sanyam language server process before killing
      try {
        const cmdline = execSync(`ps -p ${pid} -o args=`, { encoding: 'utf-8' }).trim();
        if (!cmdline.includes('main.js') || !cmdline.includes('node')) {
          logger.warn({ port, pid, cmdline }, 'Port occupied by non-sanyam process, skipping');
          continue;
        }

        logger.info({ port, pid }, 'Killing stale language server process');
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process may have already exited
      }
    }

    // Wait briefly for port to be released
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {
    // fuser not available or no process found — continue and let bind fail naturally
    logger.debug({ port }, 'Could not reclaim port (fuser unavailable or no process found)');
  }
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
  const modelsRoutes = createModelsRoutes({
    sharedServices: deps.sharedServices,
    languageRegistry: deps.languageRegistry,
    workspaceRoot: deps.documentResolver.getWorkspaceRoot(),
  });

  // All routes under /api for consistent proxy routing
  app.route('/api', healthRoutes);        // /api/health, /api/ready, /api/version
  app.route('/api', docsRoutes);          // /api/docs, /api/openapi.json
  app.route('/api', modelsRoutes);        // /api/models (CRUD)
  app.route('/api/v1', operationsRoutes); // /api/v1/* operations
  app.route('/api/v1/jobs', jobsRoutes);  // /api/v1/jobs/*

  // Cloud document routes (require Supabase)
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (supabaseUrl && supabaseAnonKey) {
    const documentRoutes = createDocumentRoutes({
      createClient: (accessToken: string) =>
        createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        }),
      getAnonClient: () =>
        createSupabaseClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }),
    });
    app.route('/api/v1/documents', documentRoutes);
    logger.info('Cloud document routes mounted at /api/v1/documents');
  } else {
    logger.info('Supabase not configured — cloud document routes disabled');
  }

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
      // Kill any stale language server process occupying the port
      await reclaimPort(port);

      return new Promise<void>((resolve) => {
        try {
          server = serve({
            fetch: app.fetch,
            port,
            hostname: host,
          }, () => {
            logger.info({ port, host }, 'HTTP REST gateway started');
            resolve();
          });

          // Handle server errors (EADDRINUSE, etc.)
          server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              logger.warn(
                { port, host },
                `Port ${port} already in use after reclaim attempt. REST API disabled. Kill the existing process or set SANYAM_API_PORT to use a different port.`
              );
              server = null;
              resolve(); // Continue without REST API
            } else {
              logger.error({ err, port, host }, 'HTTP server error');
              server = null;
              resolve(); // Don't crash, just continue without REST API
            }
          });
        } catch (err) {
          logger.error({ err, port, host }, 'Failed to start HTTP server');
          resolve(); // Continue without REST API
        }
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
