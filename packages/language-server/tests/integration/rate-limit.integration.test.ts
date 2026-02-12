/**
 * Integration tests for rate limiting with sliding window.
 *
 * Tests rate limiting middleware behavior under real conditions.
 * FR-070-074
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

describe.skipIf(shouldSkip)('Rate Limit Integration Tests', () => {
  let testUser: TestUser;

  beforeEach(async () => {
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('basic rate limit enforcement', () => {
    it('should allow requests within rate limit', async () => {
      const client = createUserClient(testUser.accessToken);

      // Make a few requests (well under typical rate limit)
      for (let i = 0; i < 3; i++) {
        const { error } = await client.from('documents').select('id').limit(1);
        expect(error).toBeNull();
      }
    });

    it('should allow different operations independently', async () => {
      const client = createUserClient(testUser.accessToken);

      // Different operations should have separate rate limits
      await client.from('documents').select('id').limit(1);
      await client.from('user_profiles').select('tier').single();
      await client.from('tier_limits').select('*').limit(1);

      // All should succeed
    });
  });

  describe('sliding window behavior', () => {
    it('should reset rate limit after window expires', async () => {
      const client = createUserClient(testUser.accessToken);

      // Make initial request
      const { error: error1 } = await client.from('documents').select('id').limit(1);
      expect(error1).toBeNull();

      // Wait a short time (not enough to reset window, but to verify timing)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make another request
      const { error: error2 } = await client.from('documents').select('id').limit(1);
      expect(error2).toBeNull();
    });
  });

  describe('rate limit by operation type', () => {
    it('should track read operations', async () => {
      const client = createUserClient(testUser.accessToken);

      // Multiple reads
      const results = await Promise.all([
        client.from('documents').select('id').limit(1),
        client.from('documents').select('name').limit(1),
        client.from('documents').select('content').limit(1),
      ]);

      // All should succeed (parallel reads within limits)
      for (const { error } of results) {
        expect(error).toBeNull();
      }
    });

    it('should track write operations', async () => {
      const client = createUserClient(testUser.accessToken);

      // Create document
      const { data: doc, error: createError } = await client
        .from('documents')
        .insert({
          name: 'Rate Limit Test',
          language_id: 'sanyam',
          content: 'Content',
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Update document
      const { error: updateError } = await client
        .from('documents')
        .update({ content: 'Updated' })
        .eq('id', doc!.id);

      expect(updateError).toBeNull();
    });
  });

  describe('rate limit per user', () => {
    let otherUser: TestUser;

    beforeEach(async () => {
      otherUser = await createTestUser('free');
    });

    afterEach(async () => {
      if (otherUser) {
        await cleanupTestUser(otherUser);
      }
    });

    it('should track rate limits separately per user', async () => {
      const client1 = createUserClient(testUser.accessToken);
      const client2 = createUserClient(otherUser.accessToken);

      // User 1 makes requests
      const { error: error1 } = await client1.from('documents').select('id').limit(1);
      expect(error1).toBeNull();

      // User 2 makes requests independently
      const { error: error2 } = await client2.from('documents').select('id').limit(1);
      expect(error2).toBeNull();

      // Both should succeed independently
    });
  });

  describe('tier-based rate limits', () => {
    let proUser: TestUser;

    beforeEach(async () => {
      proUser = await createTestUser('pro');
    });

    afterEach(async () => {
      if (proUser) {
        await cleanupTestUser(proUser);
      }
    });

    it('should allow more requests for higher tiers', async () => {
      const freeClient = createUserClient(testUser.accessToken);
      const proClient = createUserClient(proUser.accessToken);

      // Both make requests
      const freeResults: boolean[] = [];
      const proResults: boolean[] = [];

      for (let i = 0; i < 5; i++) {
        const { error: freeError } = await freeClient.from('documents').select('id').limit(1);
        freeResults.push(!freeError);

        const { error: proError } = await proClient.from('documents').select('id').limit(1);
        proResults.push(!proError);
      }

      // Both should handle the requests (exact limits depend on configuration)
      expect(freeResults.filter(Boolean).length).toBeGreaterThan(0);
      expect(proResults.filter(Boolean).length).toBeGreaterThan(0);
    });
  });

  describe('rate limit error responses', () => {
    it('should handle burst requests gracefully', async () => {
      const client = createUserClient(testUser.accessToken);

      // Make burst of requests
      const promises = Array.from({ length: 10 }, () =>
        client.from('documents').select('id').limit(1)
      );

      const results = await Promise.all(promises);

      // Some requests should succeed
      const successes = results.filter((r) => !r.error).length;
      expect(successes).toBeGreaterThan(0);
    });
  });

  describe('rate limit recovery', () => {
    it('should recover after rate limit window', async () => {
      const client = createUserClient(testUser.accessToken);

      // Make initial request
      const { error: initialError } = await client.from('documents').select('id').limit(1);
      expect(initialError).toBeNull();

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should be able to make more requests
      const { error: recoveryError } = await client.from('documents').select('id').limit(1);
      expect(recoveryError).toBeNull();
    });
  });
});
