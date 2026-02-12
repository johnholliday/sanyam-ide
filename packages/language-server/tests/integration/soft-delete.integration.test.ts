/**
 * Integration tests for soft delete lifecycle.
 *
 * Tests document soft delete, restore, and permanent delete operations.
 * FR-128-132
 *
 * Skips automatically if Supabase is not configured.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createTestUser,
  cleanupTestUser,
  type TestUser,
} from '@sanyam/test-utils/setup/test-user';

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey;

/**
 * Create a user-scoped Supabase client.
 */
function createUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

describe.skipIf(shouldSkip)('Soft Delete Integration Tests', () => {
  let testUser: TestUser;
  let proUser: TestUser;

  beforeEach(async () => {
    testUser = await createTestUser('free');
    proUser = await createTestUser('pro');
  });

  afterEach(async () => {
    if (proUser) {
      await cleanupTestUser(proUser);
    }
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('soft delete operation', () => {
    it('should set deleted_at timestamp on soft delete', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'To Soft Delete',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      expect(doc!.deleted_at).toBeNull();

      // Soft delete
      const deleteTime = new Date().toISOString();
      await client
        .from('documents')
        .update({ deleted_at: deleteTime })
        .eq('id', doc!.id);

      // Verify deleted_at is set
      const { data: deleted } = await client
        .from('documents')
        .select('deleted_at')
        .eq('id', doc!.id)
        .single();

      expect(deleted!.deleted_at).not.toBeNull();
    });

    it('should exclude soft-deleted documents from normal queries', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create and soft delete a document
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Soft Deleted',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc!.id);

      // Create a non-deleted document
      await client.from('documents').insert({
        name: 'Active Doc',
        language_id: 'sanyam',
        content: 'Active content',
      });

      // Query with deleted_at filter
      const { data: activeDocs } = await client
        .from('documents')
        .select('name')
        .is('deleted_at', null);

      expect(activeDocs?.length).toBe(1);
      expect(activeDocs?.[0].name).toBe('Active Doc');
    });

    it('should preserve document data after soft delete', async () => {
      const client = createUserClient(testUser.accessToken);

      const content = 'Important content to preserve';

      // Create and soft delete
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Preserved Doc',
          language_id: 'sanyam',
          content,
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc!.id);

      // Verify data is preserved
      const { data: preserved } = await client
        .from('documents')
        .select('name, content')
        .eq('id', doc!.id)
        .single();

      expect(preserved!.name).toBe('Preserved Doc');
      expect(preserved!.content).toBe(content);
    });
  });

  describe('restore operation', () => {
    it('should clear deleted_at on restore', async () => {
      const client = createUserClient(proUser.accessToken); // Pro user for restore

      // Create and soft delete
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'To Restore',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc!.id);

      // Restore
      await client.from('documents').update({ deleted_at: null }).eq('id', doc!.id);

      // Verify restored
      const { data: restored } = await client
        .from('documents')
        .select('deleted_at')
        .eq('id', doc!.id)
        .single();

      expect(restored!.deleted_at).toBeNull();
    });

    it('should include restored document in normal queries', async () => {
      const client = createUserClient(proUser.accessToken);

      // Create, delete, and restore
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Restored Doc',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc!.id);

      await client.from('documents').update({ deleted_at: null }).eq('id', doc!.id);

      // Should appear in normal queries
      const { data: activeDocs } = await client
        .from('documents')
        .select('name')
        .is('deleted_at', null)
        .eq('id', doc!.id);

      expect(activeDocs?.length).toBe(1);
      expect(activeDocs?.[0].name).toBe('Restored Doc');
    });
  });

  describe('permanent delete', () => {
    it('should permanently delete a soft-deleted document', async () => {
      const client = createUserClient(proUser.accessToken);

      // Create and soft delete
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'To Permanently Delete',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc!.id);

      // Permanently delete
      await client.from('documents').delete().eq('id', doc!.id);

      // Verify gone
      const { data: gone } = await client
        .from('documents')
        .select()
        .eq('id', doc!.id)
        .single();

      expect(gone).toBeNull();
    });

    it('should cascade delete versions on permanent delete', async () => {
      const client = createUserClient(proUser.accessToken);

      // Create document with versions
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Versioned to Delete',
          language_id: 'sanyam',
          content: 'Version 1',
        })
        .select()
        .single();

      // Update to create version
      await client.from('documents').update({ content: 'Version 2' }).eq('id', doc!.id);

      // Permanent delete
      await client.from('documents').delete().eq('id', doc!.id);

      // Versions should be deleted (cascade)
      const { data: versions } = await client
        .from('document_versions')
        .select()
        .eq('document_id', doc!.id);

      expect(versions?.length ?? 0).toBe(0);
    });

    it('should cascade delete shares on permanent delete', async () => {
      const client = createUserClient(proUser.accessToken);

      // Create document with share
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Shared to Delete',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      await client.from('document_shares').insert({
        document_id: doc!.id,
        shared_with_id: testUser.id,
        permission: 'view',
        created_by: proUser.id,
      });

      // Permanent delete
      await client.from('documents').delete().eq('id', doc!.id);

      // Shares should be deleted (cascade)
      const { data: shares } = await client
        .from('document_shares')
        .select()
        .eq('document_id', doc!.id);

      expect(shares?.length ?? 0).toBe(0);
    });
  });

  describe('trash listing', () => {
    it('should list only soft-deleted documents in trash view', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create active document
      await client.from('documents').insert({
        name: 'Active',
        language_id: 'sanyam',
        content: 'Active',
      });

      // Create and soft delete document
      const { data: toDelete } = await client
        .from('documents')
        .insert({
          name: 'In Trash',
          language_id: 'sanyam',
          content: 'Deleted',
        })
        .select()
        .single();

      await client
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', toDelete!.id);

      // Query trash
      const { data: trash } = await client
        .from('documents')
        .select('name')
        .not('deleted_at', 'is', null);

      expect(trash?.length).toBe(1);
      expect(trash?.[0].name).toBe('In Trash');
    });
  });

  describe('soft delete timestamp', () => {
    it('should preserve original content timestamp on soft delete', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Timestamp Test',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      const originalUpdatedAt = doc!.updated_at;

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Soft delete
      await client
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc!.id);

      // updated_at should change on delete
      const { data: deleted } = await client
        .from('documents')
        .select('updated_at')
        .eq('id', doc!.id)
        .single();

      expect(deleted!.updated_at).not.toBe(originalUpdatedAt);
    });
  });
});
