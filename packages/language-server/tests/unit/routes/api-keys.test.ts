/**
 * Unit tests for API Keys Routes
 *
 * Tests for API key management with tier restrictions.
 * FR-154-160
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/http/types.js';
import {
  createApiKeyRoutes,
  type ApiKeyRouteDependencies,
} from '../../../src/http/routes/api-keys.js';
import { ApiException, sendError } from '../../../src/http/middleware/error-handler.js';

// Mock users
const mockProUser = {
  id: 'user-123',
  email: 'pro@example.com',
  tier: 'pro' as const,
};

const mockFreeUser = {
  id: 'user-456',
  email: 'free@example.com',
  tier: 'free' as const,
};

// Mock API key data
const mockApiKey = {
  id: '12345678-1234-1234-1234-123456789012',
  name: 'Test API Key',
  scopes: ['documents:read', 'documents:write'],
  created_at: '2024-01-01T00:00:00Z',
  expires_at: null,
  last_used_at: null,
  revoked_at: null,
};

// Simple mock builder that chains properly
function mockBuilder(data: any, error: any = null) {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data, error }),
    then: (fn: any) => fn({
      data: Array.isArray(data) ? data : data ? [data] : [],
      error,
      count: data ? (Array.isArray(data) ? data.length : 1) : 0
    }),
  };
  return builder;
}

function createApp(deps: ApiKeyRouteDependencies, user?: any): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();
  app.onError((err, c) => {
    if (err instanceof ApiException) {
      return sendError(c as any, err.code, err.message, err.statusCode, err.details);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
  });
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/api-keys', createApiKeyRoutes(deps));
  return app;
}

describe('API Keys Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps);

      const res = await app.request('/api-keys');

      expect(res.status).toBe(401);
    });

    it('should return 401 when Authorization header is missing', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api-keys', () => {
    it('should return API keys for pro tier users', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'user_profiles') {
              return mockBuilder({ subscription_tier: 'pro' });
            }
            return mockBuilder([mockApiKey]);
          },
        }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('POST /api-keys', () => {
    it('should validate request body - missing name', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ scopes: ['documents:read'] }), // Missing 'name'
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(400);
    });

    it('should create API key for pro tier users', async () => {
      const createdKey = { ...mockApiKey, id: 'new-key-id' };
      let callCount = 0;

      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'user_profiles') {
              return mockBuilder({ subscription_tier: 'pro' });
            }
            if (table === 'tier_limits') {
              return mockBuilder({ api_keys_allowed: true, max_api_keys: 5 });
            }
            if (table === 'api_keys') {
              callCount++;
              if (callCount === 1) {
                // Count check - return 0 existing keys
                const builder = mockBuilder([]);
                builder.then = (fn: any) => fn({ count: 0, error: null });
                return builder;
              }
              // Insert - return created key
              return mockBuilder(createdKey);
            }
            return mockBuilder(null);
          },
        }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key', scopes: ['documents:read'] }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.key).toBeDefined();
      expect(body.message).toContain('Store this key securely');
    });
  });

  describe('GET /api-keys/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys/not-a-uuid', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(400);
    });

    it('should return key details (without secret)', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(mockApiKey) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request(`/api-keys/${mockApiKey.id}`, {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.key_hash).toBeUndefined();
      expect(body.key).toBeUndefined();
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys/not-a-uuid', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(400);
    });

    it('should revoke API key (soft delete)', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder({ id: mockApiKey.id }) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request(`/api-keys/${mockApiKey.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('revoked');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing Authorization header', async () => {
      const deps: ApiKeyRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);

      const res = await app.request('/api-keys');

      expect(res.status).toBe(401);
    });
  });
});
