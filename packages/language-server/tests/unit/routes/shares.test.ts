/**
 * Unit tests for Shares Routes
 *
 * Tests for document sharing with feature-gate wiring.
 * FR-115-119
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/http/types.js';
import {
  createShareRoutes,
  type ShareRouteDependencies,
} from '../../../src/http/routes/shares.js';
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

// Mock document data
const mockDocument = {
  id: '12345678-1234-1234-1234-123456789012',
  name: 'Test Document',
  owner_id: 'user-123',
};

// Mock share data
const mockShare = {
  id: '12345678-1234-1234-1234-123456789abc',
  document_id: '12345678-1234-1234-1234-123456789012',
  shared_with_id: 'user-other',
  permission: 'view',
  created_at: '2024-01-01T00:00:00Z',
  expires_at: null,
};

// Mock target user
const mockTargetUser = {
  id: 'user-target',
  email: 'target@example.com',
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
    not: () => builder,
    or: () => builder,
    order: () => builder,
    single: async () => ({ data, error }),
    then: (fn: any) => fn({
      data: Array.isArray(data) ? data : data ? [data] : [],
      error,
    }),
  };
  return builder;
}

// Helper to create test app with error handling
function createTestApp(deps: ShareRouteDependencies, user?: typeof mockProUser): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  app.onError((error, c) => {
    if (error instanceof ApiException) {
      return sendError(c as any, error.code, error.message, error.statusCode, error.details);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
  });

  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }

  app.route('/documents', createShareRoutes(deps));
  return app;
}

describe('Shares Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createTestApp(deps);

      const res = await app.request(`/documents/${mockDocument.id}/shares`);

      expect(res.status).toBe(401);
    });

    it('should return 401 when Authorization header is missing', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /documents/:id/shares', () => {
    it('should return shares list for document owner', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'documents') {
              return mockBuilder(mockDocument);
            }
            return mockBuilder([mockShare]);
          },
        }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares`, {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /documents/:id/shares - Feature Gate', () => {
    it('should return 403 for free tier users (feature gate)', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createTestApp(deps, mockFreeUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares`, {
        method: 'POST',
        body: JSON.stringify({ email: 'target@example.com', permission: 'view' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(body.error.message).toContain('pro');
    });

    it('should allow pro tier users to share', async () => {
      let callCount = 0;

      const deps: ShareRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'documents') {
              return mockBuilder(mockDocument);
            }
            if (table === 'user_profiles') {
              return mockBuilder(mockTargetUser);
            }
            if (table === 'document_shares') {
              callCount++;
              if (callCount === 1) {
                // First call: check for existing share - return not found
                return mockBuilder(null, { code: 'PGRST116' });
              }
              // Second call: insert - return the new share
              return mockBuilder(mockShare);
            }
            return mockBuilder(null);
          },
        }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares`, {
        method: 'POST',
        body: JSON.stringify({ email: 'target@example.com', permission: 'view' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(201);
    });
  });

  describe('PUT /documents/:id/shares/:shareId', () => {
    it('should update share permission', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'documents') {
              return mockBuilder(mockDocument);
            }
            return mockBuilder({ ...mockShare, permission: 'edit' });
          },
        }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares/${mockShare.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permission: 'edit' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /documents/:id/shares/:shareId', () => {
    it('should delete share successfully', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'documents') {
              return mockBuilder(mockDocument);
            }
            return mockBuilder(null);
          },
        }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares/${mockShare.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(204);
    });
  });

  describe('Validation', () => {
    it('should validate document ID format', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request('/documents/not-a-uuid/shares', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(400);
    });

    it('should validate share ID format', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({
          from: (table: string) => {
            if (table === 'documents') {
              return mockBuilder(mockDocument);
            }
            return mockBuilder(null);
          },
        }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares/not-a-uuid`, {
        method: 'PUT',
        body: JSON.stringify({ permission: 'edit' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(400);
    });

    it('should validate permission value in POST body', async () => {
      const deps: ShareRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createTestApp(deps, mockProUser);

      const res = await app.request(`/documents/${mockDocument.id}/shares`, {
        method: 'POST',
        body: JSON.stringify({ email: 'target@example.com', permission: 'invalid' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      expect(res.status).toBe(400);
    });
  });
});
