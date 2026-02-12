/**
 * Unit tests for API Key Authentication Middleware
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  createApiKeyAuthMiddleware,
  requireApiKey,
  hashApiKey,
  generateApiKey,
  isApiKeyAuth,
  getApiKeyContext,
  API_KEY_HEADER,
  type ApiKeyAuthDependencies,
} from '../../../src/http/middleware/api-key-auth.js';
import { ApiException, sendError } from '../../../src/http/middleware/error-handler.js';

describe('API Key Authentication Middleware', () => {
  describe('generateApiKey', () => {
    it('should generate key with sanyam_ prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^sanyam_[0-9a-f]{32}$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey());
      }
      expect(keys.size).toBe(100);
    });

    it('should generate 39 character keys', () => {
      const key = generateApiKey();
      expect(key.length).toBe(39);
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hash for same key', () => {
      const key = 'sanyam_0123456789abcdef0123456789abcdef';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const key1 = 'sanyam_0123456789abcdef0123456789abcdef';
      const key2 = 'sanyam_fedcba9876543210fedcba9876543210';
      const hash1 = hashApiKey(key1);
      const hash2 = hashApiKey(key2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64 character hex hash', () => {
      const key = generateApiKey();
      const hash = hashApiKey(key);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('createApiKeyAuthMiddleware', () => {
    let app: Hono;
    let mockClient: any;
    let deps: ApiKeyAuthDependencies;

    const TEST_API_KEY = 'sanyam_0123456789abcdef0123456789abcdef';
    const TEST_KEY_HASH = hashApiKey(TEST_API_KEY);

    beforeEach(() => {
      mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'key-123',
            user_id: 'user-456',
            name: 'Test Key',
            scopes: ['documents.read', 'documents.write'],
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };

      deps = {
        createAdminClient: () => mockClient,
      };

      app = new Hono();
      // Add error handler to catch ApiException errors
      app.onError((error, c) => {
        if (error instanceof ApiException) {
          return sendError(c as any, error.code, error.message, error.statusCode, error.details);
        }
        return c.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
      });
    });

    it('should continue without API key (fallback to other auth)', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.json({ authenticated: false }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });

    it('should reject invalid API key format (wrong prefix)', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: 'invalid_0123456789abcdef0123456789abcdef' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('Invalid API key format');
    });

    it('should reject invalid API key format (wrong length)', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: 'sanyam_tooshort' },
      });

      expect(res.status).toBe(401);
    });

    it('should authenticate with valid API key', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => {
        const apiKey = getApiKeyContext(c as any);
        return c.json({ userId: apiKey?.userId });
      });

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-456');
    });

    it('should reject revoked API key', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      });

      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('Invalid or revoked');
    });

    it('should reject expired API key', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockClient.single.mockResolvedValue({
        data: {
          id: 'key-123',
          user_id: 'user-456',
          name: 'Test Key',
          scopes: ['documents.read'],
          expires_at: pastDate,
          revoked_at: null,
        },
        error: null,
      });

      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('expired');
    });

    it('should check required scopes', async () => {
      mockClient.single.mockResolvedValue({
        data: {
          id: 'key-123',
          user_id: 'user-456',
          name: 'Test Key',
          scopes: ['documents.read'],
          expires_at: null,
          revoked_at: null,
        },
        error: null,
      });

      app.use('*', createApiKeyAuthMiddleware(deps, ['documents.write']));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.message).toContain('Missing required scopes');
    });

    it('should allow request when scopes match', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps, ['documents.read']));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(res.status).toBe(200);
    });

    it('should update last_used_at on successful auth', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      expect(mockClient.from).toHaveBeenCalledWith('api_keys');
      expect(mockClient.update).toHaveBeenCalled();
    });

    it('should set user context for RLS', async () => {
      app.use('*', createApiKeyAuthMiddleware(deps));
      app.get('/test', (c) => {
        const user = c.get('user');
        return c.json({ userId: user?.id });
      });

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: TEST_API_KEY },
      });

      const body = await res.json();
      expect(body.userId).toBe('user-456');
    });
  });

  describe('requireApiKey', () => {
    let app: Hono;
    let deps: ApiKeyAuthDependencies;

    beforeEach(() => {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'key-123',
            user_id: 'user-456',
            name: 'Test Key',
            scopes: ['documents.read'],
            expires_at: null,
            revoked_at: null,
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };

      deps = {
        createAdminClient: () => mockClient,
      };

      app = new Hono();
      // Add error handler to catch ApiException errors
      app.onError((error, c) => {
        if (error instanceof ApiException) {
          return sendError(c as any, error.code, error.message, error.statusCode, error.details);
        }
        return c.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
      });
    });

    it('should require API key header', async () => {
      app.use('*', requireApiKey(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toContain('X-API-Key header required');
    });

    it('should authenticate when API key provided', async () => {
      app.use('*', requireApiKey(deps));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test', {
        headers: { [API_KEY_HEADER]: 'sanyam_0123456789abcdef0123456789abcdef' },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('isApiKeyAuth', () => {
    it('should return true when apiKey context is set', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('apiKey', { id: 'key-1', userId: 'user-1', scopes: [], name: 'test' });
        await next();
      });
      app.get('/test', (c) => {
        return c.json({ isApiKey: isApiKeyAuth(c as any) });
      });

      const res = await app.request('/test');
      const body = await res.json();
      expect(body.isApiKey).toBe(true);
    });

    it('should return false when apiKey context is not set', async () => {
      const app = new Hono();
      app.get('/test', (c) => {
        return c.json({ isApiKey: isApiKeyAuth(c as any) });
      });

      const res = await app.request('/test');
      const body = await res.json();
      expect(body.isApiKey).toBe(false);
    });
  });

  describe('getApiKeyContext', () => {
    it('should return apiKey context when set', async () => {
      const app = new Hono();
      const testContext = { id: 'key-1', userId: 'user-1', scopes: ['read'], name: 'test' };

      app.use('*', async (c, next) => {
        c.set('apiKey', testContext);
        await next();
      });
      app.get('/test', (c) => {
        const ctx = getApiKeyContext(c as any);
        return c.json(ctx);
      });

      const res = await app.request('/test');
      const body = await res.json();
      expect(body).toEqual(testContext);
    });

    it('should return undefined when not set', async () => {
      const app = new Hono();
      app.get('/test', (c) => {
        const ctx = getApiKeyContext(c as any);
        return c.json({ hasContext: ctx !== undefined });
      });

      const res = await app.request('/test');
      const body = await res.json();
      expect(body.hasContext).toBe(false);
    });
  });
});
