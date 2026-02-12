/**
 * Soft Delete Database Tests
 *
 * Tests soft delete behavior including cascade preservation
 * and trash lifecycle.
 * FR-133-135
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
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey;

function createUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe.skipIf(shouldSkip)('Soft Delete Database Tests', () => {
  let serviceClient: SupabaseClient;
  let testUser: TestUser;

  beforeAll(() => {
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    testUser = await createTestUser('pro'); // Pro user for restore feature
  });

  afterEach(async () => {
    if (testUser) await cleanupTestUser(testUser);
  });

  describe('soft delete mechanics', () => {
    it('should set deleted_at timestamp on soft delete', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Soft Delete', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      expect(doc!.deleted_at).toBeNull();

      const deleteTime = new Date().toISOString();
      await client.from('documents').update({ deleted_at: deleteTime }).eq('id', doc!.id);

      const { data: deleted } = await client
        .from('documents')
        .select('deleted_at')
        .eq('id', doc!.id)
        .single();

      expect(deleted!.deleted_at).not.toBeNull();
    });

    it('should preserve document data after soft delete', async () => {
      const client = createUserClient(testUser.accessToken);
      const name = 'Preserved Doc';
      const content = 'Important content to preserve';

      const { data: doc } = await client
        .from('documents')
        .insert({ name, language_id: 'sanyam', content })
        .select()
        .single();

      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

      const { data: preserved } = await client
        .from('documents')
        .select('name, content')
        .eq('id', doc!.id)
        .single();

      expect(preserved!.name).toBe(name);
      expect(preserved!.content).toBe(content);
    });
  });

  describe('cascade preservation', () => {
    it('should preserve versions when document is soft deleted', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document with versions
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Versioned', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      await client.from('documents').update({ content: 'v2' }).eq('id', doc!.id);
      await client.from('documents').update({ content: 'v3' }).eq('id', doc!.id);

      // Count versions before soft delete
      const { count: beforeCount } = await client
        .from('document_versions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc!.id);

      // Soft delete
      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

      // Versions should still exist via service role
      const { count: afterCount } = await serviceClient
        .from('document_versions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc!.id);

      expect(afterCount).toBe(beforeCount);
    });

    it('should preserve shares when document is soft deleted', async () => {
      const client = createUserClient(testUser.accessToken);
      const otherUser = await createTestUser('free');

      try {
        const { data: doc } = await client
          .from('documents')
          .insert({ name: 'Shared', language_id: 'sanyam', content: 'Content' })
          .select()
          .single();

        await client.from('document_shares').insert({
          document_id: doc!.id,
          shared_with_id: otherUser.id,
          permission: 'view',
          created_by: testUser.id,
        });

        // Count shares before soft delete
        const { count: beforeCount } = await client
          .from('document_shares')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc!.id);

        // Soft delete
        await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

        // Shares should still exist via service role
        const { count: afterCount } = await serviceClient
          .from('document_shares')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc!.id);

        expect(afterCount).toBe(beforeCount);
      } finally {
        await cleanupTestUser(otherUser);
      }
    });
  });

  describe('hard delete cascade', () => {
    it('should cascade delete versions on hard delete', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'To Hard Delete', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      await client.from('documents').update({ content: 'v2' }).eq('id', doc!.id);

      // Hard delete
      await client.from('documents').delete().eq('id', doc!.id);

      // Versions should be deleted
      const { count } = await serviceClient
        .from('document_versions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc!.id);

      expect(count).toBe(0);
    });

    it('should cascade delete shares on hard delete', async () => {
      const client = createUserClient(testUser.accessToken);
      const otherUser = await createTestUser('free');

      try {
        const { data: doc } = await client
          .from('documents')
          .insert({ name: 'Shared Hard Delete', language_id: 'sanyam', content: 'Content' })
          .select()
          .single();

        await client.from('document_shares').insert({
          document_id: doc!.id,
          shared_with_id: otherUser.id,
          permission: 'view',
          created_by: testUser.id,
        });

        // Hard delete
        await client.from('documents').delete().eq('id', doc!.id);

        // Shares should be deleted
        const { count } = await serviceClient
          .from('document_shares')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc!.id);

        expect(count).toBe(0);
      } finally {
        await cleanupTestUser(otherUser);
      }
    });
  });

  describe('restore operation', () => {
    it('should clear deleted_at on restore', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'To Restore', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      // Soft delete
      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

      // Restore
      await client.from('documents').update({ deleted_at: null }).eq('id', doc!.id);

      const { data: restored } = await client
        .from('documents')
        .select('deleted_at')
        .eq('id', doc!.id)
        .single();

      expect(restored!.deleted_at).toBeNull();
    });

    it('should make document visible again after restore', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Restored Doc', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      // Soft delete
      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

      // Verify hidden from normal query
      const { data: hidden } = await client
        .from('documents')
        .select()
        .is('deleted_at', null)
        .eq('id', doc!.id)
        .single();

      expect(hidden).toBeNull();

      // Restore
      await client.from('documents').update({ deleted_at: null }).eq('id', doc!.id);

      // Verify visible again
      const { data: visible } = await client
        .from('documents')
        .select()
        .is('deleted_at', null)
        .eq('id', doc!.id)
        .single();

      expect(visible).not.toBeNull();
    });
  });

  describe('RLS with soft delete', () => {
    it('should hide soft-deleted documents from normal queries', async () => {
      const client = createUserClient(testUser.accessToken);

      await client.from('documents').insert({ name: 'Active', language_id: 'sanyam', content: 'A' });

      const { data: toDelete } = await client
        .from('documents')
        .insert({ name: 'Deleted', language_id: 'sanyam', content: 'B' })
        .select()
        .single();

      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', toDelete!.id);

      // Query without deleted
      const { data: active } = await client
        .from('documents')
        .select('name')
        .is('deleted_at', null);

      expect(active?.length).toBe(1);
      expect(active?.[0].name).toBe('Active');
    });

    it('should allow owner to view soft-deleted documents', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Owner Can See', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);

      // Owner should be able to see deleted document
      const { data: deleted } = await client
        .from('documents')
        .select()
        .not('deleted_at', 'is', null)
        .eq('id', doc!.id)
        .single();

      expect(deleted).not.toBeNull();
      expect(deleted!.name).toBe('Owner Can See');
    });
  });
});
