/**
 * Storage Usage Trigger Tests
 *
 * Tests the update_user_storage trigger that maintains
 * accurate storage_used_bytes and document_count on user_profiles.
 * FR-140-145
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

describe.skipIf(shouldSkip)('Storage Usage Trigger Tests', () => {
  let serviceClient: SupabaseClient;
  let testUser: TestUser;

  beforeAll(() => {
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    if (testUser) await cleanupTestUser(testUser);
  });

  describe('document_count tracking', () => {
    it('should increment document_count on insert', async () => {
      const client = createUserClient(testUser.accessToken);

      // Get initial count
      const { data: before } = await client
        .from('user_profiles')
        .select('document_count')
        .single();

      expect(before!.document_count).toBe(0);

      // Create document
      await client.from('documents').insert({
        name: 'Count Test',
        language_id: 'sanyam',
        content: 'Content',
      });

      // Check updated count
      const { data: after } = await client
        .from('user_profiles')
        .select('document_count')
        .single();

      expect(after!.document_count).toBe(1);
    });

    it('should decrement document_count on delete', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'To Delete', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      // Verify count is 1
      const { data: before } = await client
        .from('user_profiles')
        .select('document_count')
        .single();

      expect(before!.document_count).toBe(1);

      // Delete document (hard delete)
      await client.from('documents').delete().eq('id', doc!.id);

      // Check count is 0
      const { data: after } = await client
        .from('user_profiles')
        .select('document_count')
        .single();

      expect(after!.document_count).toBe(0);
    });

    it('should track multiple documents correctly', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create 3 documents
      await client.from('documents').insert({ name: 'Doc 1', language_id: 'sanyam', content: 'A' });
      await client.from('documents').insert({ name: 'Doc 2', language_id: 'sanyam', content: 'B' });
      await client.from('documents').insert({ name: 'Doc 3', language_id: 'sanyam', content: 'C' });

      const { data: profile } = await client
        .from('user_profiles')
        .select('document_count')
        .single();

      expect(profile!.document_count).toBe(3);
    });
  });

  describe('storage_used_bytes tracking', () => {
    it('should increase storage on document insert', async () => {
      const client = createUserClient(testUser.accessToken);
      const content = 'Test content for storage tracking';
      const expectedSize = new TextEncoder().encode(content).length;

      // Get initial storage
      const { data: before } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(before!.storage_used_bytes).toBe(0);

      // Create document
      await client.from('documents').insert({
        name: 'Storage Test',
        language_id: 'sanyam',
        content,
      });

      // Check storage increased
      const { data: after } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(after!.storage_used_bytes).toBe(expectedSize);
    });

    it('should decrease storage on document delete', async () => {
      const client = createUserClient(testUser.accessToken);
      const content = 'Content to delete';

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Delete Storage', language_id: 'sanyam', content })
        .select()
        .single();

      // Verify storage is set
      const { data: before } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(before!.storage_used_bytes).toBeGreaterThan(0);

      // Delete document
      await client.from('documents').delete().eq('id', doc!.id);

      // Storage should be back to 0
      const { data: after } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(after!.storage_used_bytes).toBe(0);
    });

    it('should update storage on document content change', async () => {
      const client = createUserClient(testUser.accessToken);
      const smallContent = 'Small';
      const largeContent = 'This is much larger content that takes more bytes';

      // Create with small content
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Update Storage', language_id: 'sanyam', content: smallContent })
        .select()
        .single();

      const { data: smallProfile } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      const smallStorage = smallProfile!.storage_used_bytes;

      // Update with larger content
      await client.from('documents').update({ content: largeContent }).eq('id', doc!.id);

      const { data: largeProfile } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(largeProfile!.storage_used_bytes).toBeGreaterThan(smallStorage);
    });

    it('should track cumulative storage across multiple documents', async () => {
      const client = createUserClient(testUser.accessToken);

      const content1 = 'First document content';
      const content2 = 'Second document with more content';
      const content3 = 'Third document';

      const totalExpectedSize =
        new TextEncoder().encode(content1).length +
        new TextEncoder().encode(content2).length +
        new TextEncoder().encode(content3).length;

      await client.from('documents').insert({ name: 'Doc 1', language_id: 'sanyam', content: content1 });
      await client.from('documents').insert({ name: 'Doc 2', language_id: 'sanyam', content: content2 });
      await client.from('documents').insert({ name: 'Doc 3', language_id: 'sanyam', content: content3 });

      const { data: profile } = await client
        .from('user_profiles')
        .select('storage_used_bytes')
        .single();

      expect(profile!.storage_used_bytes).toBe(totalExpectedSize);
    });
  });

  describe('content_size_bytes computed column', () => {
    it('should correctly compute content_size_bytes', async () => {
      const client = createUserClient(testUser.accessToken);
      const content = 'Test content for size calculation';
      const expectedSize = new TextEncoder().encode(content).length;

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Size Test', language_id: 'sanyam', content })
        .select('content_size_bytes')
        .single();

      expect(doc!.content_size_bytes).toBe(expectedSize);
    });

    it('should update content_size_bytes on content change', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Size Update', language_id: 'sanyam', content: 'Short' })
        .select('id, content_size_bytes')
        .single();

      const newContent = 'This is a much longer content string';
      await client.from('documents').update({ content: newContent }).eq('id', doc!.id);

      const { data: updated } = await client
        .from('documents')
        .select('content_size_bytes')
        .eq('id', doc!.id)
        .single();

      expect(updated!.content_size_bytes).toBe(new TextEncoder().encode(newContent).length);
    });
  });
});
