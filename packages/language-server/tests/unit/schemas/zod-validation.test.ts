/**
 * Unit tests for Zod Validation Schemas
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdSchema,
  versionParamSchema,
  listDocumentsQuerySchema,
} from '../../../src/http/routes/documents.schemas.js';
import {
  apiKeyIdParamSchema,
  listApiKeysQuerySchema,
  createApiKeySchema,
  updateApiKeySchema,
  API_SCOPES,
} from '../../../src/http/routes/api-keys.schemas.js';

describe('Document Schemas', () => {
  describe('createDocumentSchema', () => {
    it('should accept valid document data', () => {
      const result = createDocumentSchema.safeParse({
        name: 'My Document',
        languageId: 'ecml',
        content: 'document content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional metadata', () => {
      const result = createDocumentSchema.safeParse({
        name: 'My Document',
        languageId: 'ecml',
        content: 'content',
        metadata: { author: 'John', version: 1 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({ author: 'John', version: 1 });
      }
    });

    it('should reject empty name', () => {
      const result = createDocumentSchema.safeParse({
        name: '',
        languageId: 'ecml',
        content: 'content',
      });

      expect(result.success).toBe(false);
    });

    it('should reject name longer than 255 characters', () => {
      const result = createDocumentSchema.safeParse({
        name: 'a'.repeat(256),
        languageId: 'ecml',
        content: 'content',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty languageId', () => {
      const result = createDocumentSchema.safeParse({
        name: 'Document',
        languageId: '',
        content: 'content',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = createDocumentSchema.safeParse({
        name: 'Document',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateDocumentSchema', () => {
    it('should accept name only update', () => {
      const result = updateDocumentSchema.safeParse({
        name: 'New Name',
      });

      expect(result.success).toBe(true);
    });

    it('should accept content only update', () => {
      const result = updateDocumentSchema.safeParse({
        content: 'new content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept metadata only update', () => {
      const result = updateDocumentSchema.safeParse({
        metadata: { updated: true },
      });

      expect(result.success).toBe(true);
    });

    it('should accept multiple field update', () => {
      const result = updateDocumentSchema.safeParse({
        name: 'New Name',
        content: 'new content',
        metadata: { version: 2 },
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty object', () => {
      const result = updateDocumentSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe('At least one field must be provided');
      }
    });
  });

  describe('documentIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = documentIdSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const result = documentIdSchema.safeParse({
        id: 'not-a-valid-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing id', () => {
      const result = documentIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('versionParamSchema', () => {
    it('should accept valid version params', () => {
      const result = versionParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
        versionNumber: 5,
      });

      expect(result.success).toBe(true);
    });

    it('should coerce string version number', () => {
      const result = versionParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
        versionNumber: '5',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.versionNumber).toBe(5);
      }
    });

    it('should reject negative version number', () => {
      const result = versionParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
        versionNumber: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject zero version number', () => {
      const result = versionParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
        versionNumber: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject decimal version number', () => {
      const result = versionParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
        versionNumber: 1.5,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('listDocumentsQuerySchema', () => {
    it('should use defaults when no params provided', () => {
      const result = listDocumentsQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.direction).toBe('next');
        expect(result.data.includeDeleted).toBe(false);
      }
    });

    it('should accept custom limit', () => {
      const result = listDocumentsQuerySchema.safeParse({
        limit: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should coerce string limit', () => {
      const result = listDocumentsQuerySchema.safeParse({
        limit: '50',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit below 1', () => {
      const result = listDocumentsQuerySchema.safeParse({
        limit: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = listDocumentsQuerySchema.safeParse({
        limit: 101,
      });

      expect(result.success).toBe(false);
    });

    it('should accept cursor parameter', () => {
      const result = listDocumentsQuerySchema.safeParse({
        cursor: 'some-cursor-token',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cursor).toBe('some-cursor-token');
      }
    });

    it('should accept prev direction', () => {
      const result = listDocumentsQuerySchema.safeParse({
        direction: 'prev',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.direction).toBe('prev');
      }
    });

    it('should reject invalid direction', () => {
      const result = listDocumentsQuerySchema.safeParse({
        direction: 'invalid',
      });

      expect(result.success).toBe(false);
    });

    it('should coerce includeDeleted boolean', () => {
      const result = listDocumentsQuerySchema.safeParse({
        includeDeleted: 'true',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeDeleted).toBe(true);
      }
    });
  });
});

describe('API Key Schemas', () => {
  describe('API_SCOPES', () => {
    it('should contain expected scopes', () => {
      expect(API_SCOPES).toContain('documents:read');
      expect(API_SCOPES).toContain('documents:write');
      expect(API_SCOPES).toContain('documents:delete');
    });
  });

  describe('apiKeyIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = apiKeyIdParamSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789abc',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = apiKeyIdParamSchema.safeParse({
        id: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('listApiKeysQuerySchema', () => {
    it('should use defaults when no params provided', () => {
      const result = listApiKeysQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.includeRevoked).toBe(false);
      }
    });

    it('should accept custom limit', () => {
      const result = listApiKeysQuerySchema.safeParse({
        limit: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept includeRevoked true', () => {
      const result = listApiKeysQuerySchema.safeParse({
        includeRevoked: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeRevoked).toBe(true);
      }
    });
  });

  describe('createApiKeySchema', () => {
    it('should accept valid API key data', () => {
      const result = createApiKeySchema.safeParse({
        name: 'My API Key',
        scopes: ['documents:read'],
      });

      expect(result.success).toBe(true);
    });

    it('should accept multiple scopes', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Full Access Key',
        scopes: ['documents:read', 'documents:write', 'documents:delete'],
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional expiresAt', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Temporary Key',
        scopes: ['documents:read'],
        expiresAt: '2025-12-31T23:59:59Z',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresAt).toBe('2025-12-31T23:59:59Z');
      }
    });

    it('should reject empty name', () => {
      const result = createApiKeySchema.safeParse({
        name: '',
        scopes: ['documents:read'],
      });

      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const result = createApiKeySchema.safeParse({
        name: 'a'.repeat(101),
        scopes: ['documents:read'],
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty scopes array', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Key',
        scopes: [],
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid scope', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Key',
        scopes: ['invalid:scope'],
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid expiresAt format', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Key',
        scopes: ['documents:read'],
        expiresAt: 'not-a-date',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateApiKeySchema', () => {
    it('should accept name update', () => {
      const result = updateApiKeySchema.safeParse({
        name: 'Updated Key Name',
      });

      expect(result.success).toBe(true);
    });

    it('should accept empty object (no update)', () => {
      const result = updateApiKeySchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = updateApiKeySchema.safeParse({
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const result = updateApiKeySchema.safeParse({
        name: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
    });
  });
});
