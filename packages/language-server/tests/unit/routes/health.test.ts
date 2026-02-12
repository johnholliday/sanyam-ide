/**
 * Unit tests for Health Routes
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  createHealthRoutes,
  type HealthCheckConfig,
  type HealthResponse,
} from '../../../src/http/routes/health.js';

describe('Health Routes', () => {
  let app: Hono;

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        isSupabaseConfigured: () => true,
        isAuthAvailable: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
    });

    it('should return supabase configuration status', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        isSupabaseConfigured: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.supabase).toBe(true);
    });

    it('should return auth availability status', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        isAuthAvailable: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.auth).toBe(true);
    });

    it('should return version', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '2.3.4',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.version).toBe('2.3.4');
    });

    it('should default supabase to false when not configured', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.supabase).toBe(false);
    });

    it('should default auth to false when not configured', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.auth).toBe(false);
    });

    it('should support legacy function signature', async () => {
      app = new Hono().route('/', createHealthRoutes(() => true));

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.supabase).toBe(false);
      expect(body.auth).toBe(false);
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when ready', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/ready');
      const body = (await res.json()) as { status: string; timestamp: string };

      expect(res.status).toBe(200);
      expect(body.status).toBe('ready');
      expect(body.timestamp).toBeDefined();
    });

    it('should return 503 when not ready', async () => {
      const config: HealthCheckConfig = {
        isReady: () => false,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/ready');
      const body = (await res.json()) as {
        status: string;
        message: string;
        timestamp: string;
      };

      expect(res.status).toBe(503);
      expect(body.status).toBe('not_ready');
      expect(body.message).toContain('initializing');
    });

    it('should return timestamp', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const before = new Date();
      const res = await app.request('/ready');
      const after = new Date();
      const body = (await res.json()) as { timestamp: string };

      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('GET /version', () => {
    beforeEach(() => {
      vi.stubEnv('npm_package_version', '1.2.3');
    });

    it('should return version info', async () => {
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/version');
      const body = (await res.json()) as {
        name: string;
        version: string;
        nodeVersion: string;
        timestamp: string;
      };

      expect(res.status).toBe(200);
      expect(body.name).toBe('sanyam-language-server');
      expect(body.version).toBe('1.2.3');
      expect(body.nodeVersion).toBe(process.version);
      expect(body.timestamp).toBeDefined();
    });

    it('should return unknown when version env var is undefined', async () => {
      vi.unstubAllEnvs();
      delete process.env['npm_package_version'];
      const config: HealthCheckConfig = {
        isReady: () => true,
        version: '1.0.0',
      };
      app = new Hono().route('/', createHealthRoutes(config));

      const res = await app.request('/version');
      const body = (await res.json()) as { version: string };

      // When npm_package_version is undefined, it falls back to 'unknown'
      expect(body.version).toBe('unknown');
    });
  });
});
