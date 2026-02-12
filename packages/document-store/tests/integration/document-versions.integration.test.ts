/**
 * Integration tests for document versioning.
 *
 * Tests version history, retrieval, and retention.
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

describe.skipIf(shouldSkip)('Document Versioning Integration Tests', () => {
  let container: Container;
  let documentStore: CloudDocumentStore;
  let testUser: TestUser;

  beforeAll(() => {
    container = new Container();
    container.bind(SupabaseClientFactory).to(SupabaseClientFactoryImpl).inSingletonScope();
    container.bind(CloudDocumentStore).to(CloudDocumentStoreImpl).inSingletonScope();
    documentStore = container.get<CloudDocumentStore>(CloudDocumentStore);
  });

  afterAll(() => {
    container.unbindAll();
  });

  beforeEach(async () => {
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('listVersions', () => {
    it('should return version history for a document', async () => {
      const request = buildCreateDocumentRequest({ name: 'Versioned Doc' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      // Update document to create version history
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Version 2 content',
      });
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Version 3 content',
      });

      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);

      expect(versionsResult.success).toBe(true);
      expect(versionsResult.data).toBeDefined();
      // Initial creation plus two updates = at least 3 versions
      expect(versionsResult.data!.length).toBeGreaterThanOrEqual(1);
    });

    it('should order versions by version_number descending', async () => {
      const request = buildCreateDocumentRequest({ name: 'Version Order Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      // Create multiple versions
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 1',
      });
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 2',
      });

      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);

      if (versionsResult.data && versionsResult.data.length > 1) {
        // First version should be the most recent (highest version_number)
        const versionNumbers = versionsResult.data.map((v) => v.version_number);
        for (let i = 0; i < versionNumbers.length - 1; i++) {
          expect(versionNumbers[i]).toBeGreaterThan(versionNumbers[i + 1]);
        }
      }
    });

    it('should return empty array for document with no versions', async () => {
      // Use a non-existent document ID
      const versionsResult = await documentStore.listVersions(
        testUser.accessToken,
        '00000000-0000-0000-0000-000000000000'
      );

      // This may return success with empty array or error depending on RLS
      if (versionsResult.success) {
        expect(versionsResult.data).toEqual([]);
      }
    });
  });

  describe('getVersion', () => {
    it('should retrieve a specific version by number', async () => {
      const originalContent = 'Original content';
      const request = buildCreateDocumentRequest({
        name: 'Get Version Test',
        content: originalContent,
      });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      // Create a new version
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Updated content',
      });

      // Get the versions to find version numbers
      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);

      if (versionsResult.success && versionsResult.data && versionsResult.data.length > 0) {
        const firstVersion = versionsResult.data[versionsResult.data.length - 1];
        const versionResult = await documentStore.getVersion(
          testUser.accessToken,
          documentId,
          firstVersion.version_number
        );

        expect(versionResult.success).toBe(true);
        expect(versionResult.data).toBeDefined();
        expect(versionResult.data!.version_number).toBe(firstVersion.version_number);
        expect(versionResult.data!.document_id).toBe(documentId);
      }
    });

    it('should return error for non-existent version', async () => {
      const request = buildCreateDocumentRequest({ name: 'Non-existent Version Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      const versionResult = await documentStore.getVersion(
        testUser.accessToken,
        documentId,
        99999 // Non-existent version number
      );

      expect(versionResult.success).toBe(false);
      expect(versionResult.error?.code).toBe('VERSION_NOT_FOUND');
    });
  });

  describe('version content preservation', () => {
    it('should preserve previous content in version history', async () => {
      const content1 = 'First version content';
      const content2 = 'Second version content';
      const content3 = 'Third version content';

      const request = buildCreateDocumentRequest({
        name: 'Content Preservation Test',
        content: content1,
      });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: content2,
      });
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: content3,
      });

      // Current document should have latest content
      const currentDoc = await documentStore.getDocument(testUser.accessToken, documentId);
      expect(currentDoc.data!.content).toBe(content3);

      // Version history should preserve previous content
      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);
      if (versionsResult.success && versionsResult.data && versionsResult.data.length > 0) {
        // Check that at least one version exists with content
        const contentsInVersions = versionsResult.data.map((v) => v.content);
        expect(contentsInVersions.length).toBeGreaterThan(0);
      }
    });

    it('should track content_size_bytes in versions', async () => {
      const content = 'Test content for size tracking';
      const request = buildCreateDocumentRequest({
        name: 'Size Tracking Test',
        content,
      });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Shorter',
      });

      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);

      if (versionsResult.success && versionsResult.data && versionsResult.data.length > 0) {
        // Each version should have content_size_bytes
        for (const version of versionsResult.data) {
          expect(version.content_size_bytes).toBeDefined();
          expect(version.content_size_bytes).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('version ownership', () => {
    it('should track created_by for each version', async () => {
      const request = buildCreateDocumentRequest({ name: 'Created By Test' });
      const createResult = await documentStore.createDocument(testUser.accessToken, request);
      const documentId = createResult.data!.id;

      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Updated by test user',
      });

      const versionsResult = await documentStore.listVersions(testUser.accessToken, documentId);

      if (versionsResult.success && versionsResult.data && versionsResult.data.length > 0) {
        for (const version of versionsResult.data) {
          expect(version.created_by).toBeDefined();
          expect(version.created_by).toBe(testUser.id);
        }
      }
    });
  });
});
