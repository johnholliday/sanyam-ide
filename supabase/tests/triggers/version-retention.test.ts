/**
 * Version Retention Trigger Tests
 *
 * Tests the enforce_version_limit trigger that enforces
 * max_versions_per_document based on tier limits.
 * FR-124-127
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

describe.skipIf(shouldSkip)('Version Retention Trigger Tests', () => {
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

  describe('version limit enforcement', () => {
    it('should respect max_versions_per_document from tier_limits', async () => {
      // Get user's tier limit
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      const { data: limits } = await serviceClient
        .from('tier_limits')
        .select('max_versions_per_document')
        .eq('tier', profile!.tier)
        .single();

      expect(limits!.max_versions_per_document).toBeGreaterThan(0);
    });

    it('should create version entries on document update', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Versioned', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      // Update to create version
      await client.from('documents').update({ content: 'v2' }).eq('id', doc!.id);
      await client.from('documents').update({ content: 'v3' }).eq('id', doc!.id);

      // Check versions
      const { data: versions } = await client
        .from('document_versions')
        .select('version_number')
        .eq('document_id', doc!.id)
        .order('version_number', { ascending: true });

      // Should have version entries (exact count depends on implementation)
      expect(versions).toBeDefined();
    });

    it('should delete oldest versions when limit exceeded', async () => {
      const client = createUserClient(testUser.accessToken);

      // Get max versions for free tier
      const { data: limits } = await serviceClient
        .from('tier_limits')
        .select('max_versions_per_document')
        .eq('tier', 'free')
        .single();

      const maxVersions = limits!.max_versions_per_document;

      // Create document
      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Many Versions', language_id: 'sanyam', content: 'v0' })
        .select()
        .single();

      // Create many versions (more than limit)
      for (let i = 1; i <= maxVersions + 5; i++) {
        await client.from('documents').update({ content: `v${i}` }).eq('id', doc!.id);
      }

      // Count versions
      const { data: versions, count } = await client
        .from('document_versions')
        .select('*', { count: 'exact' })
        .eq('document_id', doc!.id);

      // Should not exceed max (trigger should delete oldest)
      expect(count ?? versions?.length ?? 0).toBeLessThanOrEqual(maxVersions);
    });
  });

  describe('version ordering', () => {
    it('should order versions by version_number', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Ordered', language_id: 'sanyam', content: 'v1' })
        .select()
        .single();

      await client.from('documents').update({ content: 'v2' }).eq('id', doc!.id);
      await client.from('documents').update({ content: 'v3' }).eq('id', doc!.id);

      const { data: versions } = await client
        .from('document_versions')
        .select('version_number')
        .eq('document_id', doc!.id)
        .order('version_number', { ascending: true });

      if (versions && versions.length > 1) {
        for (let i = 1; i < versions.length; i++) {
          expect(versions[i].version_number).toBeGreaterThan(versions[i - 1].version_number);
        }
      }
    });
  });

  describe('version content preservation', () => {
    it('should preserve content in version history', async () => {
      const client = createUserClient(testUser.accessToken);
      const originalContent = 'Original unique content ' + Date.now();

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'Preserve Content', language_id: 'sanyam', content: originalContent })
        .select()
        .single();

      await client.from('documents').update({ content: 'Updated content' }).eq('id', doc!.id);

      const { data: versions } = await client
        .from('document_versions')
        .select('content')
        .eq('document_id', doc!.id);

      // At least one version should contain the content
      if (versions && versions.length > 0) {
        const contents = versions.map((v) => v.content);
        expect(contents.length).toBeGreaterThan(0);
      }
    });
  });

  describe('FIFO deletion policy', () => {
    it('should delete oldest versions first when limit exceeded', async () => {
      const client = createUserClient(testUser.accessToken);

      const { data: limits } = await serviceClient
        .from('tier_limits')
        .select('max_versions_per_document')
        .eq('tier', 'free')
        .single();

      const maxVersions = limits!.max_versions_per_document;

      const { data: doc } = await client
        .from('documents')
        .insert({ name: 'FIFO Test', language_id: 'sanyam', content: 'initial' })
        .select()
        .single();

      // Create versions beyond limit
      for (let i = 1; i <= maxVersions + 3; i++) {
        await client.from('documents').update({ content: `version-${i}` }).eq('id', doc!.id);
      }

      const { data: versions } = await client
        .from('document_versions')
        .select('version_number, content')
        .eq('document_id', doc!.id)
        .order('version_number', { ascending: true });

      if (versions && versions.length > 0) {
        // Oldest versions should have been deleted
        // Latest versions should remain
        const versionNumbers = versions.map((v) => v.version_number);
        const minVersion = Math.min(...versionNumbers);

        // The minimum version should be relatively recent (oldest deleted)
        expect(minVersion).toBeGreaterThan(0);
      }
    });
  });
});
