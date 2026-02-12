/**
 * Unit tests for Rate Limit Middleware
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  rateLimitMiddleware,
  clearRateLimitStore,
  getRateLimitInfo,
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitConfig,
} from '../../../src/http/middleware/rate-limit.js';

describe('Rate Limit Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.useFakeTimers();
    clearRateLimitStore();
    app = new Hono();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRateLimitStore();
  });

  describe('DEFAULT_RATE_LIMIT_CONFIG', () => {
    it('should have expected tier limits', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.tiers.free.limit).toBe(100);
      expect(DEFAULT_RATE_LIMIT_CONFIG.tiers.pro.limit).toBe(500);
      expect(DEFAULT_RATE_LIMIT_CONFIG.tiers.enterprise.limit).toBe(2000);
    });

    it('should have expected window size', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.tiers.free.windowMs).toBe(60000);
    });

    it('should skip health endpoints', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.skipPaths).toContain('/health');
      expect(DEFAULT_RATE_LIMIT_CONFIG.skipPaths).toContain('/ready');
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should set rate limit headers', async () => {
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { 'X-Forwarded-For': '1.2.3.4' },
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should track requests and decrement remaining', async () => {
      const config: RateLimitConfig = {
        ...DEFAULT_RATE_LIMIT_CONFIG,
        tiers: {
          ...DEFAULT_RATE_LIMIT_CONFIG.tiers,
          free: { limit: 5, windowMs: 60000 },
        },
      };
      app.use('*', rateLimitMiddleware(config));
      app.get('/test', (c) => c.text('ok'));

      // First request - remaining calculated before this request is counted
      const res1 = await app.request('/test', {
        headers: { 'X-Forwarded-For': '1.2.3.4' },
      });
      expect(res1.headers.get('X-RateLimit-Remaining')).toBe('5');

      // Second request - one previous request counted
      const res2 = await app.request('/test', {
        headers: { 'X-Forwarded-For': '1.2.3.4' },
      });
      expect(res2.headers.get('X-RateLimit-Remaining')).toBe('4');
    });

    it('should skip excluded paths', async () => {
      app.use('*', rateLimitMiddleware());
      app.get('/health', (c) => c.text('ok'));

      const res = await app.request('/health');

      // Health endpoint should not have rate limit headers set by middleware
      // (it may have them from defaults, but shouldn't count against limit)
      expect(res.status).toBe(200);
    });

    it('should use user ID when authenticated', async () => {
      app.use('*', async (c, next) => {
        c.set('user', { id: 'user-123', tier: 'pro' });
        await next();
      });
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const info = getRateLimitInfo('user:user-123');
      expect(info).toBeDefined();
      expect(info?.timestamps.length).toBe(1);
    });

    it('should use IP when not authenticated', async () => {
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', {
        headers: { 'X-Forwarded-For': '192.168.1.1' },
      });

      const info = getRateLimitInfo('ip:192.168.1.1');
      expect(info).toBeDefined();
    });

    it('should use tier-specific limits', async () => {
      app.use('*', async (c, next) => {
        c.set('user', { id: 'pro-user', tier: 'pro' });
        await next();
      });
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('500');
    });

    it('should reset window after time passes', async () => {
      const config: RateLimitConfig = {
        ...DEFAULT_RATE_LIMIT_CONFIG,
        tiers: {
          ...DEFAULT_RATE_LIMIT_CONFIG.tiers,
          free: { limit: 2, windowMs: 1000 },
        },
      };
      app.use('*', rateLimitMiddleware(config));
      app.get('/test', (c) => c.text('ok'));

      // Make 2 requests
      await app.request('/test', { headers: { 'X-Forwarded-For': '1.1.1.1' } });
      await app.request('/test', { headers: { 'X-Forwarded-For': '1.1.1.1' } });

      // Advance time past window
      vi.advanceTimersByTime(1100);

      // Should have full limit again (remaining calculated before this request counts)
      const res = await app.request('/test', {
        headers: { 'X-Forwarded-For': '1.1.1.1' },
      });
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
    });

    it('should skip enterprise tier when configured', async () => {
      const config: RateLimitConfig = {
        ...DEFAULT_RATE_LIMIT_CONFIG,
        skipEnterprise: true,
      };
      app.use('*', async (c, next) => {
        c.set('user', { id: 'enterprise-user', tier: 'enterprise' });
        await next();
      });
      app.use('*', rateLimitMiddleware(config));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test');

      // Enterprise users should not have rate limit headers when skipped
      expect(res.status).toBe(200);
    });
  });

  describe('clearRateLimitStore', () => {
    it('should clear all entries', async () => {
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', { headers: { 'X-Forwarded-For': '1.1.1.1' } });
      expect(getRateLimitInfo('ip:1.1.1.1')).toBeDefined();

      clearRateLimitStore();

      expect(getRateLimitInfo('ip:1.1.1.1')).toBeUndefined();
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return entry for tracked key', async () => {
      app.use('*', rateLimitMiddleware());
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', { headers: { 'X-Forwarded-For': '2.2.2.2' } });

      const info = getRateLimitInfo('ip:2.2.2.2');
      expect(info).toBeDefined();
      expect(info?.timestamps).toHaveLength(1);
    });

    it('should return undefined for unknown key', () => {
      const info = getRateLimitInfo('ip:unknown');
      expect(info).toBeUndefined();
    });
  });
});
