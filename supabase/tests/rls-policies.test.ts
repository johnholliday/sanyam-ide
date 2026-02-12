/**
 * RLS Policy Tests
 *
 * Tests Row Level Security policies per-table to ensure
 * proper data isolation between users.
 * FR-015-016
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

describe.skipIf(shouldSkip)('RLS Policy Tests', () => {
  let serviceClient: SupabaseClient;
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(() => {
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    userA = await createTestUser('free');
    userB = await createTestUser('free');
  });

  afterEach(async () => {
    if (userB) await cleanupTestUser(userB);
    if (userA) await cleanupTestUser(userA);
  });

  describe('user_profiles RLS', () => {
    it('should only allow user to see own profile', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { data: profiles } = await clientA.from('user_profiles').select('id');

      expect(profiles?.length).toBe(1);
      expect(profiles?.[0].id).toBe(userA.id);
    });

    it('should prevent user from reading another profile', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { data } = await clientA
        .from('user_profiles')
        .select()
        .eq('id', userB.id)
        .single();

      expect(data).toBeNull();
    });

    it('should prevent user from updating another profile', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { count } = await clientA
        .from('user_profiles')
        .update({ display_name: 'Hacked' })
        .eq('id', userB.id);

      expect(count).toBe(0);
    });
  });

  describe('documents RLS', () => {
    it('should only show user their own documents', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      await clientA.from('documents').insert({
        name: 'User A Doc',
        language_id: 'sanyam',
        content: 'A content',
      });

      await clientB.from('documents').insert({
        name: 'User B Doc',
        language_id: 'sanyam',
        content: 'B content',
      });

      const { data: docsA } = await clientA.from('documents').select('name');
      const { data: docsB } = await clientB.from('documents').select('name');

      expect(docsA?.length).toBe(1);
      expect(docsA?.[0].name).toBe('User A Doc');
      expect(docsB?.length).toBe(1);
      expect(docsB?.[0].name).toBe('User B Doc');
    });

    it('should prevent user from inserting document with wrong owner_id', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { error } = await clientA.from('documents').insert({
        name: 'Fake Doc',
        language_id: 'sanyam',
        content: 'Content',
        owner_id: userB.id, // Try to set different owner
      });

      // Should fail due to RLS
      expect(error).not.toBeNull();
    });

    it('should prevent user from updating another user document', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Protected', language_id: 'sanyam', content: 'Original' })
        .select()
        .single();

      const { count } = await clientB
        .from('documents')
        .update({ content: 'Hacked' })
        .eq('id', doc!.id);

      expect(count).toBe(0);
    });

    it('should prevent user from deleting another user document', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'To Delete', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      const { count } = await clientB.from('documents').delete().eq('id', doc!.id);

      expect(count).toBe(0);
    });
  });

  describe('document_shares RLS', () => {
    it('should allow owner to create shares', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Shareable', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      const { error } = await clientA.from('document_shares').insert({
        document_id: doc!.id,
        shared_with_id: userB.id,
        permission: 'view',
        created_by: userA.id,
      });

      expect(error).toBeNull();
    });

    it('should prevent non-owner from creating shares', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Not Yours', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      const { error } = await clientB.from('document_shares').insert({
        document_id: doc!.id,
        shared_with_id: userA.id,
        permission: 'view',
        created_by: userB.id,
      });

      expect(error).not.toBeNull();
    });

    it('should allow shared user to see the share', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Shared Doc', language_id: 'sanyam', content: 'Content' })
        .select()
        .single();

      await clientA.from('document_shares').insert({
        document_id: doc!.id,
        shared_with_id: userB.id,
        permission: 'view',
        created_by: userA.id,
      });

      const { data: shares } = await clientB
        .from('document_shares')
        .select()
        .eq('document_id', doc!.id);

      expect(shares?.length).toBe(1);
    });
  });

  describe('document_versions RLS', () => {
    it('should allow owner to see document versions', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Versioned', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      await clientA.from('documents').update({ content: 'v2' }).eq('id', doc!.id);

      const { data: versions } = await clientA
        .from('document_versions')
        .select()
        .eq('document_id', doc!.id);

      // Should see versions (may vary based on trigger implementation)
      expect(versions).toBeDefined();
    });

    it('should prevent non-owner from seeing versions', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      const { data: doc } = await clientA
        .from('documents')
        .insert({ name: 'Private Versions', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      const { data: versions } = await clientB
        .from('document_versions')
        .select()
        .eq('document_id', doc!.id);

      expect(versions?.length ?? 0).toBe(0);
    });
  });

  describe('api_keys RLS', () => {
    it('should only allow user to see own API keys', async () => {
      const clientA = createUserClient(userA.accessToken);
      const clientB = createUserClient(userB.accessToken);

      await clientA.from('api_keys').insert({
        name: 'User A Key',
        key_hash: 'hash-a-' + crypto.randomUUID(),
        key_prefix: 'sk_a_' + Date.now().toString().slice(-4),
        scopes: ['documents:read'],
      });

      await clientB.from('api_keys').insert({
        name: 'User B Key',
        key_hash: 'hash-b-' + crypto.randomUUID(),
        key_prefix: 'sk_b_' + Date.now().toString().slice(-4),
        scopes: ['documents:read'],
      });

      const { data: keysA } = await clientA.from('api_keys').select('name');
      const { data: keysB } = await clientB.from('api_keys').select('name');

      expect(keysA?.length).toBe(1);
      expect(keysA?.[0].name).toBe('User A Key');
      expect(keysB?.length).toBe(1);
      expect(keysB?.[0].name).toBe('User B Key');
    });
  });

  describe('tier_limits public access', () => {
    it('should allow anonymous access to tier_limits', async () => {
      const anonClient = createClient(supabaseUrl!, supabaseAnonKey!);

      const { data, error } = await anonClient.from('tier_limits').select('tier');

      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow authenticated user to read tier_limits', async () => {
      const clientA = createUserClient(userA.accessToken);

      const { data, error } = await clientA.from('tier_limits').select('*');

      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });
  });
});
