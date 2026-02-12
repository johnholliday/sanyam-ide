/**
 * Unit tests for API Response Snapshots
 *
 * Verifies that error responses and pagination envelopes match expected formats.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { createErrorResponse, type ErrorResponse, type PaginatedResponse, type PaginationMeta, encodeCursor, decodeCursor, CURSOR_DELIMITER } from '@sanyam/types';

/**
 * Helper to create a success response (not in types package yet).
 */
function createSuccessResponse<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Helper to create a paginated response (not in types package yet).
 */
function createPaginatedResponse<T>(
  data: T[],
  pagination: { hasMore: boolean; nextCursor?: string; prevCursor?: string; total: number }
): { success: true; data: T[]; pagination: typeof pagination } {
  return { success: true, data, pagination };
}

describe('Response Snapshots', () => {
  describe('Error Response Format', () => {
    it('should match basic error response shape', () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input');

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "VALIDATION_ERROR",
            "message": "Invalid input",
          },
        }
      `);
    });

    it('should match error response with details', () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', {
        field: 'email',
        reason: 'Must be a valid email address',
      });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "VALIDATION_ERROR",
            "details": Object {
              "field": "email",
              "reason": "Must be a valid email address",
            },
            "message": "Invalid input",
          },
        }
      `);
    });

    it('should match unauthorized error response', () => {
      const response = createErrorResponse('UNAUTHORIZED', 'Authentication required');

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "UNAUTHORIZED",
            "message": "Authentication required",
          },
        }
      `);
    });

    it('should match not found error response', () => {
      const response = createErrorResponse('DOCUMENT_NOT_FOUND', 'Document abc123 not found');

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "DOCUMENT_NOT_FOUND",
            "message": "Document abc123 not found",
          },
        }
      `);
    });

    it('should match rate limit error response', () => {
      const response = createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests', {
        limit: 100,
        remaining: 0,
        reset: 1609459200,
        tier: 'free',
      });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "RATE_LIMIT_EXCEEDED",
            "details": Object {
              "limit": 100,
              "remaining": 0,
              "reset": 1609459200,
              "tier": "free",
            },
            "message": "Too many requests",
          },
        }
      `);
    });

    it('should match optimistic lock conflict error response', () => {
      const response = createErrorResponse('OPTIMISTIC_LOCK_CONFLICT', 'Document was modified', {
        current_version: 5,
        your_version: 3,
      });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "OPTIMISTIC_LOCK_CONFLICT",
            "details": Object {
              "current_version": 5,
              "your_version": 3,
            },
            "message": "Document was modified",
          },
        }
      `);
    });

    it('should match tier limit exceeded error response', () => {
      const response = createErrorResponse('TIER_LIMIT_EXCEEDED', 'Document limit reached', {
        current: 10,
        limit: 10,
        tier: 'free',
      });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "error": Object {
            "code": "TIER_LIMIT_EXCEEDED",
            "details": Object {
              "current": 10,
              "limit": 10,
              "tier": "free",
            },
            "message": "Document limit reached",
          },
        }
      `);
    });
  });

  describe('Success Response Format', () => {
    it('should match basic success response shape', () => {
      const response = createSuccessResponse({ id: '123', name: 'Test Document' });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "id": "123",
            "name": "Test Document",
          },
          "success": true,
        }
      `);
    });

    it('should match success response with complex data', () => {
      const response = createSuccessResponse({
        id: '12345678-1234-1234-1234-123456789abc',
        name: 'My Document',
        languageId: 'ecml',
        content: 'document content',
        version: 3,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-16T14:45:00Z',
        metadata: {
          author: 'John',
          tags: ['important', 'draft'],
        },
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('metadata');
    });
  });

  describe('Pagination Envelope Format', () => {
    it('should match first page response shape', () => {
      const response = createPaginatedResponse(
        [
          { id: '1', name: 'Doc 1' },
          { id: '2', name: 'Doc 2' },
        ],
        {
          hasMore: true,
          nextCursor: 'cursor_abc123',
          total: 100,
        }
      );

      expect(response).toMatchInlineSnapshot(`
        Object {
          "data": Array [
            Object {
              "id": "1",
              "name": "Doc 1",
            },
            Object {
              "id": "2",
              "name": "Doc 2",
            },
          ],
          "pagination": Object {
            "hasMore": true,
            "nextCursor": "cursor_abc123",
            "total": 100,
          },
          "success": true,
        }
      `);
    });

    it('should match last page response shape', () => {
      const response = createPaginatedResponse(
        [{ id: '99', name: 'Doc 99' }],
        {
          hasMore: false,
          total: 99,
        }
      );

      expect(response).toMatchInlineSnapshot(`
        Object {
          "data": Array [
            Object {
              "id": "99",
              "name": "Doc 99",
            },
          ],
          "pagination": Object {
            "hasMore": false,
            "total": 99,
          },
          "success": true,
        }
      `);
    });

    it('should match empty results response shape', () => {
      const response = createPaginatedResponse([], {
        hasMore: false,
        total: 0,
      });

      expect(response).toMatchInlineSnapshot(`
        Object {
          "data": Array [],
          "pagination": Object {
            "hasMore": false,
            "total": 0,
          },
          "success": true,
        }
      `);
    });

    it('should match bidirectional pagination response', () => {
      const response = createPaginatedResponse(
        [{ id: '50', name: 'Doc 50' }],
        {
          hasMore: true,
          nextCursor: 'next_cursor',
          prevCursor: 'prev_cursor',
          total: 100,
        }
      );

      expect(response.pagination.nextCursor).toBe('next_cursor');
      expect(response.pagination.prevCursor).toBe('prev_cursor');
      expect(response.pagination.hasMore).toBe(true);
    });
  });

  describe('Cursor Encoding/Decoding', () => {
    it('should encode cursor with date and ID', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const cursor = encodeCursor(date, 'doc-123');

      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe('string');
    });

    it('should decode cursor back to original values', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const id = 'doc-123';
      const cursor = encodeCursor(date, id);

      const decoded = decodeCursor(cursor);

      expect(decoded).not.toBeNull();
      expect(decoded?.updatedAt.toISOString()).toBe(date.toISOString());
      expect(decoded?.id).toBe(id);
    });

    it('should return null for invalid cursor', () => {
      const decoded = decodeCursor('invalid-cursor');
      expect(decoded).toBeNull();
    });

    it('should return null for malformed base64', () => {
      const decoded = decodeCursor('!!!not-base64!!!');
      expect(decoded).toBeNull();
    });

    it('should return null for missing delimiter', () => {
      const noDelimiter = Buffer.from('2024-01-15T10:30:00.000Z').toString('base64');
      const decoded = decodeCursor(noDelimiter);
      expect(decoded).toBeNull();
    });

    it('should return null for invalid date', () => {
      const invalidDate = Buffer.from(`invalid-date${CURSOR_DELIMITER}doc-123`).toString('base64');
      const decoded = decodeCursor(invalidDate);
      expect(decoded).toBeNull();
    });

    it('should handle UUID-style IDs', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const uuid = '12345678-1234-1234-1234-123456789abc';
      const cursor = encodeCursor(date, uuid);

      const decoded = decodeCursor(cursor);

      expect(decoded?.id).toBe(uuid);
    });
  });

  describe('Response Type Guarantees', () => {
    it('error response should always have error object', () => {
      const response = createErrorResponse('INTERNAL_ERROR', 'Something went wrong');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBeDefined();
      expect(response.error.message).toBeDefined();
    });

    it('success response should have success: true', () => {
      const response = createSuccessResponse({});
      expect(response.success).toBe(true);
    });

    it('success response should always have data property', () => {
      const response = createSuccessResponse({ value: 42 });
      expect(response.data).toBeDefined();
    });

    it('paginated response should have both data and pagination', () => {
      const response = createPaginatedResponse([1, 2, 3], { hasMore: false, total: 3 });
      expect(response.data).toBeDefined();
      expect(response.pagination).toBeDefined();
    });
  });
});
