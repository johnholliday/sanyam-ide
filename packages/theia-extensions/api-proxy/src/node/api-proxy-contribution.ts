import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import type { Application } from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';

const DEFAULT_API_PORT = 3001;

@injectable()
export class ApiProxyContribution implements BackendApplicationContribution {

  configure(app: Application): void {
    const apiPort = parseInt(process.env.SANYAM_API_PORT || '', 10) || DEFAULT_API_PORT;
    const apiTarget = `http://localhost:${apiPort}`;

    const proxyOptions: Options = {
      target: apiTarget,
      changeOrigin: true,
      // Use pathFilter to match /api/* requests
      // This avoids Express stripping the /api prefix when mounting
      pathFilter: '/api/**',
      // Timeout after 15 seconds so the browser fetch doesn't hang forever
      timeout: 15_000,
      proxyTimeout: 15_000,
      on: {
        proxyReq: (proxyReq, req) => {
          // Cast to Express request to access originalUrl (full path including /api)
          const expressReq = req as typeof req & { originalUrl?: string };
          const fullPath = expressReq.originalUrl ?? req.url;
          console.log(`[api-proxy] Proxying: ${req.method} ${fullPath} → ${apiTarget}${fullPath}`);
        },
        error: (err, req, res) => {
          const expressReq = req as typeof req & { originalUrl?: string };
          const fullPath = expressReq.originalUrl ?? req.url;
          console.error(`[api-proxy] Proxy error for ${fullPath}: ${err.message}`);
          if ('writeHead' in res && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Bad Gateway',
              message: 'Language server API is not available',
              target: apiTarget
            }));
          }
        }
      }
    };

    const proxy = createProxyMiddleware(proxyOptions);

    // Use the proxy as general middleware - pathFilter handles /api/* matching
    // This preserves the full /api/* path when forwarding to the backend
    app.use(proxy);

    console.log(`[api-proxy] Proxying /api/* → ${apiTarget}/api/*`);
  }
}
