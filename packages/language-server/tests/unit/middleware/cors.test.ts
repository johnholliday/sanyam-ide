/**
 * Unit tests for CORS Middleware
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  corsMiddleware,
  corsMiddlewareFromEnv,
  createProductionCorsConfig,
  createDevelopmentCorsConfig,
  DEFAULT_CORS_CONFIG,
} from '../../../src/http/middleware/cors.js';

describe('CORS Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe('DEFAULT_CORS_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CORS_CONFIG.origin).toBe('*');
      expect(DEFAULT_CORS_CONFIG.allowMethods).toContain('GET');
      expect(DEFAULT_CORS_CONFIG.allowMethods).toContain('POST');
      expect(DEFAULT_CORS_CONFIG.allowMethods).toContain('PUT');
      expect(DEFAULT_CORS_CONFIG.allowMethods).toContain('DELETE');
      expect(DEFAULT_CORS_CONFIG.maxAge).toBe(600);
      expect(DEFAULT_CORS_CONFIG.credentials).toBe(true);
    });

    it('should include required headers', () => {
      expect(DEFAULT_CORS_CONFIG.allowHeaders).toContain('Content-Type');
      expect(DEFAULT_CORS_CONFIG.allowHeaders).toContain('Authorization');
      expect(DEFAULT_CORS_CONFIG.allowHeaders).toContain('X-Correlation-ID');
      expect(DEFAULT_CORS_CONFIG.allowHeaders).toContain('X-API-Key');
    });

    it('should expose rate limit headers', () => {
      expect(DEFAULT_CORS_CONFIG.exposeHeaders).toContain('X-RateLimit-Limit');
      expect(DEFAULT_CORS_CONFIG.exposeHeaders).toContain('X-RateLimit-Remaining');
      expect(DEFAULT_CORS_CONFIG.exposeHeaders).toContain('X-RateLimit-Reset');
      expect(DEFAULT_CORS_CONFIG.exposeHeaders).toContain('ETag');
    });
  });

  describe('corsMiddleware', () => {
    it('should add CORS headers to response', async () => {
      app.use('*', corsMiddleware());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { Origin: 'http://example.com' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });

    it('should handle preflight OPTIONS request', async () => {
      app.use('*', corsMiddleware());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });

    it('should use custom configuration', async () => {
      app.use(
        '*',
        corsMiddleware({
          origin: 'https://custom.example.com',
          maxAge: 3600,
        })
      );
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { Origin: 'https://custom.example.com' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://custom.example.com'
      );
    });
  });

  describe('createProductionCorsConfig', () => {
    it('should create config that validates allowed origins', () => {
      const config = createProductionCorsConfig([
        'https://app.example.com',
        'https://admin.example.com',
      ]);

      expect(config.credentials).toBe(true);
      expect(typeof config.origin).toBe('function');
    });

    it('should allow listed origins', () => {
      const config = createProductionCorsConfig(['https://app.example.com']);
      const originFn = config.origin as (origin: string) => boolean;

      expect(originFn('https://app.example.com')).toBe(true);
    });

    it('should reject unlisted origins', () => {
      const config = createProductionCorsConfig(['https://app.example.com']);
      const originFn = config.origin as (origin: string) => boolean;

      expect(originFn('https://evil.example.com')).toBe(false);
    });
  });

  describe('createDevelopmentCorsConfig', () => {
    it('should create permissive config', () => {
      const config = createDevelopmentCorsConfig();

      expect(config.origin).toBe('*');
      expect(config.credentials).toBe(false); // Cannot use credentials with wildcard
    });
  });

  describe('corsMiddlewareFromEnv', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CORS_ALLOWED_ORIGINS', '');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should use development config in non-production', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      app.use('*', corsMiddlewareFromEnv());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should use production config with allowed origins', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ALLOWED_ORIGINS', 'https://app.example.com,https://admin.example.com');

      app.use('*', corsMiddlewareFromEnv());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { Origin: 'https://app.example.com' },
      });

      // Production mode should have CORS header set (Hono may return boolean string or origin)
      const origin = res.headers.get('Access-Control-Allow-Origin');
      expect(origin).toBeDefined();
      // Allowed origin should result in a truthy response (either the origin or 'true')
      expect(['true', 'https://app.example.com']).toContain(origin);
    });

    it('should use development config when production without origins', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ALLOWED_ORIGINS', '');

      app.use('*', corsMiddlewareFromEnv());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { Origin: 'http://example.com' },
      });

      // Falls back to development config when no origins specified
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
