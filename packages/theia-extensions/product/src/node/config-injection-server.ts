/**
 * Backend server that injects `window.__SANYAM_CONFIG__` into `index.html`.
 *
 * Replaces the default `BackendApplicationServer` so that the browser app
 * receives runtime configuration (Supabase URL, anon key, etc.) without
 * requiring a separate build step or env-file bundling.
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationServer } from '@theia/core/lib/node';
import type { Application } from 'express';
import express = require('@theia/core/shared/express');

/**
 * Build the `<script>` tag that sets `window.__SANYAM_CONFIG__`.
 *
 * Values are read from `process.env` at call time so that
 * dotenv-loader (imported before this module) has already populated them.
 */
function buildConfigScript(): string {
    const config: Record<string, string | undefined> = {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        authProviders: process.env.SANYAM_AUTH_PROVIDERS,
        authRedirectUrl: process.env.SANYAM_AUTH_REDIRECT_URL,
    };
    // JSON.stringify handles escaping for safe inline injection
    return `<script>window.__SANYAM_CONFIG__ = ${JSON.stringify(config)};</script>`;
}

@injectable()
export class ConfigInjectionServer implements BackendApplicationServer {

    configure(app: Application): void {
        const projectPath = process.env.THEIA_APP_PROJECT_PATH;
        if (!projectPath) {
            console.error('[config-injection] THEIA_APP_PROJECT_PATH not set — cannot serve frontend');
            return;
        }

        const frontendDir = path.resolve(projectPath, 'lib', 'frontend');
        const indexPath = path.join(frontendDir, 'index.html');

        // Read `index.html` once at startup and inject the config script
        let injectedHtml: string | undefined;
        if (fs.existsSync(indexPath)) {
            const raw = fs.readFileSync(indexPath, 'utf-8');
            const script = buildConfigScript();
            // Insert just before </head>
            injectedHtml = raw.replace('</head>', `${script}\n</head>`);
            console.log('[config-injection] Injected __SANYAM_CONFIG__ into index.html');
            if (process.env.SUPABASE_URL) {
                console.log(`[config-injection]   SUPABASE_URL = ${process.env.SUPABASE_URL}`);
            } else {
                console.log('[config-injection]   SUPABASE_URL is not set — auth will be disabled');
            }
        } else {
            console.warn(`[config-injection] index.html not found at ${indexPath}`);
        }

        // Redirect `/auth/callback` to `/` preserving query params.
        // Supabase OAuth/magic-link redirects here with `?code=...`.
        // We can't serve index.html directly at this path because Theia's
        // bundle.js is referenced as `./bundle.js` (relative), which would
        // resolve to `/auth/bundle.js` and 404. Redirecting to `/` keeps
        // the query string intact so the Supabase JS client (with
        // `detectSessionInUrl: true`) can still exchange the code.
        app.get('/auth/callback', (req, res) => {
            const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
            const hash = req.url.includes('#') ? req.url.slice(req.url.indexOf('#')) : '';
            res.redirect(`/${qs}${hash}`);
        });

        // Intercept requests for the root page and serve the modified HTML.
        if (injectedHtml) {
            app.get(['/', '/index.html'], (_req, res) => {
                res.type('html').send(injectedHtml);
            });
        }

        // Serve all other static files normally
        app.use(express.static(frontendDir));
    }
}
