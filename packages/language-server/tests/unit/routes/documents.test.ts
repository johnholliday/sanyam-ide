/**
 * Unit tests for Documents Routes
 *
 * Tests for document CRUD operations and tier-based feature gates.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/http/types.js';
import {
  createDocumentRoutes,
  type DocumentRouteDependencies,
} from '../../../src/http/routes/documents.js';
import { ApiException, sendError } from '../../../src/http/middleware/error-handler.js';

// Mock user data
const mockProUser = {
  id: 'user-123',
  email: 'test@example.com',
  tier: 'pro' as const,
};

const mockFreeUser = {
  ...mockProUser,
  tier: 'free' as const,
};

// Mock document
const mockDocument = {
  id: '12345678-1234-1234-1234-123456789012',
  name: 'Test Document',
  language_id: 'ecml',
  content: 'document content',
  version: 1,
  owner_id: 'user-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
};

// Simple mock builder
function mockBuilder(data: any) {
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
    limit: () => builder,
    single: async () => ({ data, error: null }),
    then: (fn: any) => fn({ data: Array.isArray(data) ? data : [data], error: null, count: 1 }),
  };
  return builder;
}

function createApp(deps: DocumentRouteDependencies, user?: any): Hono<HonoEnv> {
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
  app.route('/documents', createDocumentRoutes(deps));
  return app;
}

describe('Documents Routes', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Authentication', () => {
    it('should return 401 when user is not set', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps);
      const res = await app.request('/documents');
      expect(res.status).toBe(401);
    });

    it('should return 401 when Authorization header missing', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request('/documents');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /documents', () => {
    it('should return documents list', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder([mockDocument]) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request('/documents', {
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pagination).toBeDefined();
    });
  });

  describe('POST /documents', () => {
    it('should return 400 for invalid request body', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request('/documents', {
        method: 'POST',
        body: JSON.stringify({ invalid: true }),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /documents/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request('/documents/invalid-id', {
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(400);
    });

    it('should return document with ETag', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(mockDocument) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request(`/documents/${mockDocument.id}`, {
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('ETag')).toBeDefined();
    });
  });

  describe('DELETE /documents/:id', () => {
    it('should soft delete document', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request(`/documents/${mockDocument.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(204);
    });
  });

  describe('POST /documents/:id/restore - Tier Gate', () => {
    it('should return 403 for free tier (feature gate)', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder(null) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockFreeUser);
      const res = await app.request(`/documents/${mockDocument.id}/restore`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FEATURE_NOT_AVAILABLE');
    });

    it('should allow pro tier to restore', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder({ ...mockDocument, deleted_at: '2024-01-01' }) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request(`/documents/${mockDocument.id}/restore`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /documents/:id/versions', () => {
    it('should return versions list', async () => {
      const deps: DocumentRouteDependencies = {
        createClient: () => ({ from: () => mockBuilder([{ version_number: 1 }]) }) as any,
        getAnonClient: () => ({ from: () => mockBuilder(null) }) as any,
      };
      const app = createApp(deps, mockProUser);
      const res = await app.request(`/documents/${mockDocument.id}/versions`, {
        headers: { Authorization: 'Bearer token' },
      });
      expect(res.status).toBe(200);
    });
  });
});
