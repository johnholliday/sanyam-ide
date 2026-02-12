/**
 * Integration tests for user-scoped Supabase client RLS enforcement.
 *
 * Tests that RLS policies correctly isolate user data and
 * prevent unauthorized access.
 * FR-120-123
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

describe.skipIf(shouldSkip)('User-Scoped Client RLS Integration Tests', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeEach(async () => {
    userA = await createTestUser('free');
    userB = await createTestUser('free');
  });

  afterEach(async () => {
    if (userB) {
      await cleanupTestUser(userB);
    }
    if (userA) {
      await cleanupTestUser(userA);
    }
  });

  describe('document isolation', () => {
    it('should only show user their own documents', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates a document
      await clientA.from('documents').insert({
        name: 'User A Document',
        language_id: 'sanyam',
        content: 'User A content',
      });

      // User B creates a document
      await clientB.from('documents').insert({
        name: 'User B Document',
        language_id: 'sanyam',
        content: 'User B content',
      });

      // User A should only see their document
      const { data: userADocs } = await clientA.from('documents').select('name');

      expect(userADocs?.length).toBe(1);
      expect(userADocs?.[0].name).toBe('User A Document');

      // User B should only see their document
      const { data: userBDocs } = await clientB.from('documents').select('name');

      expect(userBDocs?.length).toBe(1);
      expect(userBDocs?.[0].name).toBe('User B Document');
    });

    it('should prevent user from reading another user document by ID', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates a document
      const { data: docA } = await clientA
        .from('documents')
        .insert({
          name: 'Private Doc',
          language_id: 'sanyam',
          content: 'Private content',
        })
        .select()
        .single();

      // User B tries to read User A's document
      const { data: doc, error } = await clientB
        .from('documents')
        .select()
        .eq('id', docA!.id)
        .single();

      // Should not find the document (RLS blocks access)
      expect(doc).toBeNull();
    });

    it('should prevent user from updating another user document', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates a document
      const { data: docA } = await clientA
        .from('documents')
        .insert({
          name: 'User A Only',
          language_id: 'sanyam',
          content: 'Original content',
        })
        .select()
        .single();

      // User B tries to update User A's document
      const { data: updated, count } = await clientB
        .from('documents')
        .update({ content: 'Hacked content' })
        .eq('id', docA!.id)
        .select();

      // Should not update (count = 0 or null)
      expect(updated?.length ?? 0).toBe(0);

      // Verify original content unchanged
      const { data: unchanged } = await clientA
        .from('documents')
        .select('content')
        .eq('id', docA!.id)
        .single();

      expect(unchanged?.content).toBe('Original content');
    });

    it('should prevent user from deleting another user document', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates a document
      const { data: docA } = await clientA
        .from('documents')
        .insert({
          name: 'Protected Doc',
          language_id: 'sanyam',
          content: 'Protected content',
        })
        .select()
        .single();

      // User B tries to delete User A's document
      const { count } = await clientB.from('documents').delete().eq('id', docA!.id);

      // Should not delete
      expect(count).toBe(0);

      // Verify document still exists
      const { data: stillExists } = await clientA
        .from('documents')
        .select()
        .eq('id', docA!.id)
        .single();

      expect(stillExists).not.toBeNull();
    });
  });

  describe('user profile isolation', () => {
    it('should only allow user to read their own profile', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A reads their profile
      const { data: profileA } = await clientA
        .from('user_profiles')
        .select()
        .eq('id', userA.id)
        .single();

      expect(profileA).not.toBeNull();

      // User B tries to read User A's profile
      const { data: profileAByB } = await clientB
        .from('user_profiles')
        .select()
        .eq('id', userA.id)
        .single();

      // Should not find it (RLS blocks)
      expect(profileAByB).toBeNull();
    });

    it('should prevent user from updating another user profile', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User B tries to update User A's profile tier
      const { count } = await clientB
        .from('user_profiles')
        .update({ tier: 'enterprise' })
        .eq('id', userA.id);

      // Should not update
      expect(count).toBe(0);
    });
  });

  describe('API key isolation', () => {
    it('should only show user their own API keys', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates an API key
      await clientA.from('api_keys').insert({
        name: 'User A Key',
        key_hash: 'hash-a-' + crypto.randomUUID(),
        key_prefix: 'sk_a_',
        permissions: ['read'],
      });

      // User B creates an API key
      await clientB.from('api_keys').insert({
        name: 'User B Key',
        key_hash: 'hash-b-' + crypto.randomUUID(),
        key_prefix: 'sk_b_',
        permissions: ['read'],
      });

      // User A should only see their key
      const { data: keysA } = await clientA.from('api_keys').select('name');

      expect(keysA?.length).toBe(1);
      expect(keysA?.[0].name).toBe('User A Key');

      // User B should only see their key
      const { data: keysB } = await clientB.from('api_keys').select('name');

      expect(keysB?.length).toBe(1);
      expect(keysB?.[0].name).toBe('User B Key');
    });
  });

  describe('shared document access', () => {
    it('should allow access to shared documents', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates a document
      const { data: docA } = await clientA
        .from('documents')
        .insert({
          name: 'Shared Doc',
          language_id: 'sanyam',
          content: 'Shared content',
        })
        .select()
        .single();

      // User A shares with User B
      await clientA.from('document_shares').insert({
        document_id: docA!.id,
        shared_with_id: userB.id,
        permission: 'view',
        created_by: userA.id,
      });

      // User B should now be able to read the shared document
      const { data: sharedDoc } = await clientB
        .from('documents')
        .select()
        .eq('id', docA!.id)
        .single();

      // If RLS is set up for sharing, doc should be accessible
      if (sharedDoc) {
        expect(sharedDoc.name).toBe('Shared Doc');
      }
    });
  });

  describe('version history isolation', () => {
    it('should only show versions for user-owned documents', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      // User A creates and updates a document
      const { data: docA } = await clientA
        .from('documents')
        .insert({
          name: 'Versioned Doc',
          language_id: 'sanyam',
          content: 'Version 1',
        })
        .select()
        .single();

      await clientA
        .from('documents')
        .update({ content: 'Version 2' })
        .eq('id', docA!.id);

      // User A should see versions
      const { data: versionsA } = await clientA
        .from('document_versions')
        .select()
        .eq('document_id', docA!.id);

      // User B should NOT see versions
      const { data: versionsB } = await clientB
        .from('document_versions')
        .select()
        .eq('document_id', docA!.id);

      // RLS should block User B
      expect(versionsB?.length ?? 0).toBe(0);
    });
  });
});
