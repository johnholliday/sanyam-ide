/**
 * Integration tests for CloudDocumentStore CRUD operations.
 *
 * Tests real Supabase interactions with ephemeral test users.
 * Skips automatically if Supabase is not configured.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';
import {
  CloudDocumentStore,
  CloudDocumentStoreImpl,
} from '../../src/cloud-document-store.js';
import {
  SupabaseClientFactory,
  SupabaseClientFactoryImpl,
} from '../../src/supabase-client-factory.js';
import {
  createTestUser,
  cleanupTestUser,
  type TestUser,
} from '@sanyam/test-utils/setup/test-user';
import { buildCreateDocumentRequest } from '@sanyam/test-utils/factories/document-factory';

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey;

describe.skipIf(shouldSkip)('CloudDocumentStore Integration Tests', () => {
  let container: Container;
  let documentStore: CloudDocumentStore;
  let testUser: TestUser;

  beforeAll(() => {
    // Set up DI container with real implementations
    container = new Container();
    container.bind(SupabaseClientFactory).to(SupabaseClientFactoryImpl).inSingletonScope();
    container.bind(CloudDocumentStore).to(CloudDocumentStoreImpl).inSingletonScope();
    documentStore = container.get<CloudDocumentStore>(CloudDocumentStore);
  });

  afterAll(() => {
    container.unbindAll();
  });

  beforeEach(async () => {
    // Create ephemeral test user before each test
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    // Clean up test user after each test
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('createDocument', () => {
    it('should create a document and return it with assigned ID', async () => {
      const request = buildCreateDocumentRequest({
        name: 'Integration Test Document',
        content: 'Test content for integration test',
      });

      const result = await documentStore.createDocument(testUser.accessToken, request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBeDefined();
      expect(result.data!.name).toBe(request.name);
      expect(result.data!.content).toBe(request.content);
      expect(result.data!.version).toBe(1);
      expect(result.data!.owner_id).toBe(testUser.id);
      expect(result.data!.deleted_at).toBeNull();
    });

    it('should set content_size_bytes correctly', async () => {
      const content = 'Hello, world!';
      const expectedSize = new TextEncoder().encode(content).length;
      const request = buildCreateDocumentRequest({ content });

      const result = await documentStore.createDocument(testUser.accessToken, request);

      expect(result.success).toBe(true);
      expect(result.data!.content_size_bytes).toBe(expectedSize);
    });

    it('should store metadata when provided', async () => {
      const request = buildCreateDocumentRequest();
      // Type assertion needed since factory type may not include metadata
      const requestWithMetadata = {
        ...request,
        metadata: { author: 'test', tags: ['integration', 'test'] },
      };

      const result = await documentStore.createDocument(testUser.accessToken, requestWithMetadata);

      expect(result.success).toBe(true);
      expect(result.data!.metadata).toEqual({ author: 'test', tags: ['integration', 'test'] });
    });
  });

  describe('getDocument', () => {
    it('should retrieve a document by ID', async () => {
      const request = buildCreateDocumentRequest({ name: 'Get Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const getResult = await documentStore.getDocument(testUser.accessToken, documentId);

      expect(getResult.success).toBe(true);
      expect(getResult.data!.id).toBe(documentId);
      expect(getResult.data!.name).toBe('Get Test');
    });

    it('should return error for non-existent document', async () => {
      const result = await documentStore.getDocument(
        testUser.accessToken,
        '00000000-0000-0000-0000-000000000000'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  describe('updateDocument', () => {
    it('should update document content and increment version', async () => {
      const request = buildCreateDocumentRequest({ name: 'Update Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const updateResult = await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Updated content',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.content).toBe('Updated content');
      expect(updateResult.data!.version).toBe(2);
    });

    it('should update document name', async () => {
      const request = buildCreateDocumentRequest({ name: 'Original Name' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const updateResult = await documentStore.updateDocument(testUser.accessToken, documentId, {
        name: 'New Name',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.name).toBe('New Name');
    });

    it('should update document metadata', async () => {
      const request = buildCreateDocumentRequest();
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const updateResult = await documentStore.updateDocument(testUser.accessToken, documentId, {
        metadata: { revised: true, version: 'v2' },
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.metadata).toEqual({ revised: true, version: 'v2' });
    });
  });

  describe('deleteDocument (soft delete)', () => {
    it('should soft delete a document', async () => {
      const request = buildCreateDocumentRequest({ name: 'Delete Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const deleteResult = await documentStore.deleteDocument(testUser.accessToken, documentId);

      expect(deleteResult.success).toBe(true);

      // Document should still exist but with deleted_at set
      const getResult = await documentStore.getDocument(testUser.accessToken, documentId);
      expect(getResult.success).toBe(true);
      expect(getResult.data!.deleted_at).not.toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should list user documents', async () => {
      // Create a couple of documents
      await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Doc 1' })
      );
      await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Doc 2' })
      );

      const result = await documentStore.listDocuments(testUser.accessToken);

      expect(result.success).toBe(true);
      expect(result.data!.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data!.pagination.total_count).toBeGreaterThanOrEqual(2);
    });

    it('should exclude soft-deleted documents by default', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'To Delete' })
      );
      await documentStore.deleteDocument(testUser.accessToken, createResult.data!.id);

      const result = await documentStore.listDocuments(testUser.accessToken);

      const deletedDoc = result.data!.data.find((d) => d.id === createResult.data!.id);
      expect(deletedDoc).toBeUndefined();
    });

    it('should include soft-deleted documents when requested', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'To Delete Included' })
      );
      await documentStore.deleteDocument(testUser.accessToken, createResult.data!.id);

      const result = await documentStore.listDocuments(testUser.accessToken, {
        includeDeleted: true,
      });

      const deletedDoc = result.data!.data.find((d) => d.id === createResult.data!.id);
      expect(deletedDoc).toBeDefined();
      expect(deletedDoc!.deleted_at).not.toBeNull();
    });

    it('should paginate results', async () => {
      // Create 5 documents
      for (let i = 0; i < 5; i++) {
        await documentStore.createDocument(
          testUser.accessToken,
          buildCreateDocumentRequest({ name: `Paginated Doc ${i}` })
        );
      }

      // Get first page with limit 2
      const page1 = await documentStore.listDocuments(testUser.accessToken, { limit: 2 });

      expect(page1.success).toBe(true);
      expect(page1.data!.data.length).toBe(2);

      // If there are more docs, next_cursor should be set
      if (page1.data!.pagination.total_count > 2) {
        expect(page1.data!.pagination.next_cursor).not.toBeNull();
      }
    });
  });

  describe('getTierLimits', () => {
    it('should return tier limits for the user', async () => {
      const result = await documentStore.getTierLimits(testUser.accessToken);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.tier).toBeDefined();
      expect(result.data!.max_documents).toBeGreaterThan(0);
      expect(result.data!.max_storage_bytes).toBeGreaterThan(0);
    });
  });

  describe('checkTierLimit', () => {
    it('should allow document creation within limits', async () => {
      const result = await documentStore.checkTierLimit(
        testUser.accessToken,
        'create_document',
        100
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow small content uploads', async () => {
      const result = await documentStore.checkTierLimit(
        testUser.accessToken,
        'upload_content',
        1000
      );

      expect(result.allowed).toBe(true);
    });
  });
});
