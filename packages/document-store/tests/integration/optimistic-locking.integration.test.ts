/**
 * Integration tests for optimistic locking (concurrent PUT).
 *
 * Tests version-based conflict detection and resolution.
 * FR-042-044
 *
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

describe.skipIf(shouldSkip)('Optimistic Locking Integration Tests', () => {
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

  describe('version tracking', () => {
    it('should start with version 1 on document creation', async () => {
      const result = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Version Start Doc' })
      );

      expect(result.success).toBe(true);
      expect(result.data!.version).toBe(1);
    });

    it('should increment version on each update', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Version Increment Doc' })
      );
      const documentId = createResult.data!.id;
      expect(createResult.data!.version).toBe(1);

      const update1 = await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 1',
      });
      expect(update1.data!.version).toBe(2);

      const update2 = await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 2',
      });
      expect(update2.data!.version).toBe(3);

      const update3 = await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 3',
      });
      expect(update3.data!.version).toBe(4);
    });
  });

  describe('optimistic locking with expectedVersion', () => {
    it('should succeed when expectedVersion matches current version', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Optimistic Success Doc' })
      );
      const documentId = createResult.data!.id;
      const currentVersion = createResult.data!.version;

      const result = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'Updated with correct version' },
        currentVersion
      );

      expect(result.success).toBe(true);
      expect(result.data!.version).toBe(currentVersion + 1);
    });

    it('should fail when expectedVersion does not match current version', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Optimistic Conflict Doc' })
      );
      const documentId = createResult.data!.id;
      const staleVersion = createResult.data!.version;

      // Make an update to change the version
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'First update',
      });

      // Try to update with stale version
      const result = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'Attempted update with stale version' },
        staleVersion
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    it('should return current and expected versions in conflict error details', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Conflict Details Doc' })
      );
      const documentId = createResult.data!.id;
      const staleVersion = createResult.data!.version;

      // Update twice to create a 2-version gap
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 1',
      });
      await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Update 2',
      });

      // Try with stale version
      const result = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'Stale update' },
        staleVersion
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
      expect(result.error?.details).toBeDefined();
      expect(result.error?.details?.current_version).toBe(3);
      expect(result.error?.details?.your_version).toBe(staleVersion);
    });
  });

  describe('update without expectedVersion', () => {
    it('should succeed without optimistic locking when expectedVersion not provided', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'No Lock Doc' })
      );
      const documentId = createResult.data!.id;

      // Update without version check
      const result = await documentStore.updateDocument(testUser.accessToken, documentId, {
        content: 'Updated without version check',
      });

      expect(result.success).toBe(true);
    });

    it('should always succeed regardless of current version when no expectedVersion', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Force Update Doc' })
      );
      const documentId = createResult.data!.id;

      // Multiple updates without version checks
      for (let i = 0; i < 5; i++) {
        const result = await documentStore.updateDocument(testUser.accessToken, documentId, {
          content: `Update ${i + 1}`,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('concurrent updates simulation', () => {
    it('should handle concurrent updates with different outcomes based on version', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Concurrent Doc' })
      );
      const documentId = createResult.data!.id;
      const initialVersion = createResult.data!.version;

      // Simulate User A reading document
      const userAVersion = initialVersion;

      // Simulate User B reading document (same version)
      const userBVersion = initialVersion;

      // User A updates first - should succeed
      const userAResult = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'User A update' },
        userAVersion
      );
      expect(userAResult.success).toBe(true);

      // User B tries to update with stale version - should fail
      const userBResult = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'User B update' },
        userBVersion
      );
      expect(userBResult.success).toBe(false);
      expect(userBResult.error?.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    it('should allow User B to retry with updated version after conflict', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Retry Doc' })
      );
      const documentId = createResult.data!.id;
      const initialVersion = createResult.data!.version;

      // User A updates
      await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'User A update' },
        initialVersion
      );

      // User B's update fails
      const userBFailedResult = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'User B initial attempt' },
        initialVersion
      );
      expect(userBFailedResult.success).toBe(false);

      // User B re-reads document to get current version
      const refreshedDoc = await documentStore.getDocument(testUser.accessToken, documentId);
      const currentVersion = refreshedDoc.data!.version;

      // User B retries with updated version
      const userBRetryResult = await documentStore.updateDocument(
        testUser.accessToken,
        documentId,
        { content: 'User B retry with correct version' },
        currentVersion
      );
      expect(userBRetryResult.success).toBe(true);
    });
  });

  describe('version with metadata updates', () => {
    it('should increment version even when only metadata changes', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Metadata Version Doc' })
      );
      const documentId = createResult.data!.id;
      const initialVersion = createResult.data!.version;

      const result = await documentStore.updateDocument(testUser.accessToken, documentId, {
        metadata: { key: 'value' },
      });

      expect(result.success).toBe(true);
      expect(result.data!.version).toBe(initialVersion + 1);
    });
  });

  describe('version with name-only updates', () => {
    it('should increment version when only name changes', async () => {
      const createResult = await documentStore.createDocument(
        testUser.accessToken,
        buildCreateDocumentRequest({ name: 'Name Version Doc' })
      );
      const documentId = createResult.data!.id;
      const initialVersion = createResult.data!.version;

      const result = await documentStore.updateDocument(testUser.accessToken, documentId, {
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.data!.version).toBe(initialVersion + 1);
    });
  });
});
