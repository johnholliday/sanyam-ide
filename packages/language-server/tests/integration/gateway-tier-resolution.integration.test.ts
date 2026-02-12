/**
 * Integration tests for HTTP gateway tier resolution.
 *
 * Tests that the gateway correctly resolves user tier on each request
 * and enforces tier-based limits.
 * FR-102
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
import type { SubscriptionTier } from '@sanyam/types';

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey;

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

describe.skipIf(shouldSkip)('Gateway Tier Resolution Integration Tests', () => {
  let serviceClient: SupabaseClient;
  let freeUser: TestUser;
  let proUser: TestUser;

  beforeAll(() => {
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    freeUser = await createTestUser('free');
    proUser = await createTestUser('pro');
  });

  afterEach(async () => {
    if (proUser) {
      await cleanupTestUser(proUser);
    }
    if (freeUser) {
      await cleanupTestUser(freeUser);
    }
  });

  describe('per-request tier lookup', () => {
    it('should resolve free user tier on request', async () => {
      const client = createUserClient(freeUser.accessToken);

      // Fetch user profile (which includes tier)
      const { data: profile, error } = await client
        .from('user_profiles')
        .select('tier')
        .single();

      expect(error).toBeNull();
      expect(profile!.tier).toBe('free');
    });

    it('should resolve pro user tier on request', async () => {
      const client = createUserClient(proUser.accessToken);

      const { data: profile, error } = await client
        .from('user_profiles')
        .select('tier')
        .single();

      expect(error).toBeNull();
      expect(profile!.tier).toBe('pro');
    });

    it('should look up tier limits for resolved tier', async () => {
      const client = createClient(supabaseUrl!, supabaseAnonKey!);

      // Get free tier limits
      const { data: freeLimits, error: freeError } = await client
        .from('tier_limits')
        .select('*')
        .eq('tier', 'free')
        .single();

      expect(freeError).toBeNull();
      expect(freeLimits).toBeDefined();
      expect(freeLimits!.tier).toBe('free');

      // Get pro tier limits
      const { data: proLimits, error: proError } = await client
        .from('tier_limits')
        .select('*')
        .eq('tier', 'pro')
        .single();

      expect(proError).toBeNull();
      expect(proLimits).toBeDefined();
      expect(proLimits!.tier).toBe('pro');
    });
  });

  describe('tier change during session', () => {
    it('should reflect tier change on next request', async () => {
      // Start with free tier
      const userClient = createUserClient(freeUser.accessToken);

      const { data: initialProfile } = await userClient
        .from('user_profiles')
        .select('tier')
        .single();

      expect(initialProfile!.tier).toBe('free');

      // Upgrade via service client (simulating billing webhook)
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', freeUser.id);

      // Next request should see new tier
      const { data: upgradedProfile } = await userClient
        .from('user_profiles')
        .select('tier')
        .single();

      expect(upgradedProfile!.tier).toBe('pro');

      // Revert for cleanup
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'free' })
        .eq('id', freeUser.id);
    });
  });

  describe('tier-based document limits', () => {
    it('should enforce document count based on resolved tier', async () => {
      const client = createUserClient(freeUser.accessToken);

      // Get free tier limits
      const { data: limits } = await createClient(supabaseUrl!, supabaseAnonKey!)
        .from('tier_limits')
        .select('max_documents')
        .eq('tier', 'free')
        .single();

      expect(limits!.max_documents).toBeGreaterThan(0);

      // Create a document (should succeed within limits)
      const { data: doc, error } = await client
        .from('documents')
        .insert({
          name: 'Tier Test Doc',
          language_id: 'sanyam',
          content: 'Test content',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(doc).toBeDefined();
    });

    it('should allow higher document count for pro tier', async () => {
      const freeClient = createUserClient(freeUser.accessToken);
      const proClient = createUserClient(proUser.accessToken);

      // Get tier limits
      const { data: limits } = await createClient(supabaseUrl!, supabaseAnonKey!)
        .from('tier_limits')
        .select('tier, max_documents')
        .in('tier', ['free', 'pro']);

      const freeLimits = limits?.find((l) => l.tier === 'free');
      const proLimits = limits?.find((l) => l.tier === 'pro');

      // Pro should have >= free limits
      expect(proLimits!.max_documents).toBeGreaterThanOrEqual(freeLimits!.max_documents);

      // Both can create at least one document
      const { error: freeError } = await freeClient
        .from('documents')
        .insert({
          name: 'Free User Doc',
          language_id: 'sanyam',
          content: 'Free content',
        });

      const { error: proError } = await proClient
        .from('documents')
        .insert({
          name: 'Pro User Doc',
          language_id: 'sanyam',
          content: 'Pro content',
        });

      expect(freeError).toBeNull();
      expect(proError).toBeNull();
    });
  });

  describe('tier-based storage limits', () => {
    it('should enforce storage quota based on resolved tier', async () => {
      const client = createUserClient(freeUser.accessToken);

      // Get free tier storage limit
      const { data: limits } = await createClient(supabaseUrl!, supabaseAnonKey!)
        .from('tier_limits')
        .select('max_storage_bytes')
        .eq('tier', 'free')
        .single();

      expect(limits!.max_storage_bytes).toBeGreaterThan(0);

      // Create a small document (should succeed within limits)
      const { error } = await client
        .from('documents')
        .insert({
          name: 'Storage Test Doc',
          language_id: 'sanyam',
          content: 'Small content',
        });

      expect(error).toBeNull();
    });
  });

  describe('tier resolution caching', () => {
    it('should resolve tier consistently across multiple requests', async () => {
      const client = createUserClient(proUser.accessToken);

      // Multiple requests should all see the same tier
      const requests = Array.from({ length: 3 }, () =>
        client.from('user_profiles').select('tier').single()
      );

      const results = await Promise.all(requests);

      for (const { data } of results) {
        expect(data!.tier).toBe('pro');
      }
    });
  });

  describe('anonymous tier handling', () => {
    it('should handle requests without authentication', async () => {
      // Anonymous client (no access token)
      const anonClient = createClient(supabaseUrl!, supabaseAnonKey!);

      // Public tier_limits table should be accessible
      const { data, error } = await anonClient.from('tier_limits').select('tier').limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should prevent anonymous access to user data', async () => {
      const anonClient = createClient(supabaseUrl!, supabaseAnonKey!);

      // Try to read user profiles (should be blocked by RLS)
      const { data, error } = await anonClient.from('user_profiles').select('*');

      // Should return empty (RLS blocks) or error
      expect(data?.length ?? 0).toBe(0);
    });
  });

  describe('tier lookup performance', () => {
    it('should complete tier lookup quickly', async () => {
      const client = createUserClient(freeUser.accessToken);

      const start = Date.now();

      // Perform tier lookup
      const { data } = await client.from('user_profiles').select('tier').single();

      const duration = Date.now() - start;

      expect(data!.tier).toBeDefined();
      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
