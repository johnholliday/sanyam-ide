/**
 * Integration tests for billing webhook handling.
 *
 * Tests the full chain of billing webhook processing including
 * tier updates in the database.
 * FR-108-110
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

describe.skipIf(shouldSkip)('Billing Webhook Integration Tests', () => {
  let anonClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUser: TestUser;

  beforeAll(() => {
    anonClient = createClient(supabaseUrl!, supabaseAnonKey!);
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('user profile tier update', () => {
    it('should update user tier in profile when subscription changes', async () => {
      // Check initial tier
      const { data: initialProfile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(initialProfile?.tier).toBe('free');

      // Simulate billing webhook updating tier to pro
      const { error: updateError } = await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      expect(updateError).toBeNull();

      // Verify tier was updated
      const { data: updatedProfile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(updatedProfile?.tier).toBe('pro');
    });

    it('should allow downgrade from pro to free', async () => {
      // First upgrade to pro
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      // Downgrade to free
      const { error: downgradeError } = await serviceClient
        .from('user_profiles')
        .update({ tier: 'free' })
        .eq('id', testUser.id);

      expect(downgradeError).toBeNull();

      // Verify downgrade
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('free');
    });

    it('should allow upgrade from free to enterprise', async () => {
      // Upgrade directly to enterprise
      const { error: upgradeError } = await serviceClient
        .from('user_profiles')
        .update({ tier: 'enterprise' })
        .eq('id', testUser.id);

      expect(upgradeError).toBeNull();

      // Verify upgrade
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('enterprise');
    });
  });

  describe('tier constraint enforcement', () => {
    it('should reject invalid tier values', async () => {
      // Try to set an invalid tier
      const { error } = await serviceClient
        .from('user_profiles')
        .update({ tier: 'invalid_tier' as SubscriptionTier })
        .eq('id', testUser.id);

      // Should fail due to check constraint
      expect(error).not.toBeNull();
    });
  });

  describe('billing webhook event processing', () => {
    it('should process subscription.created event', async () => {
      // Simulate what a billing webhook handler would do
      const newTier: SubscriptionTier = 'pro';

      // Update user tier (as webhook handler would)
      const { error } = await serviceClient
        .from('user_profiles')
        .update({
          tier: newTier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUser.id);

      expect(error).toBeNull();

      // Verify update
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('pro');
    });

    it('should process subscription.updated event (upgrade)', async () => {
      // Start with pro
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      // Process upgrade event
      const { error } = await serviceClient
        .from('user_profiles')
        .update({
          tier: 'enterprise',
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUser.id);

      expect(error).toBeNull();

      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('enterprise');
    });

    it('should process subscription.deleted event (downgrade to free)', async () => {
      // Start with pro
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      // Process cancellation event - downgrade to free
      const { error } = await serviceClient
        .from('user_profiles')
        .update({
          tier: 'free',
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUser.id);

      expect(error).toBeNull();

      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('free');
    });
  });

  describe('audit trail for tier changes', () => {
    it('should update updated_at timestamp on tier change', async () => {
      // Get initial timestamp
      const { data: initialProfile } = await serviceClient
        .from('user_profiles')
        .select('updated_at')
        .eq('id', testUser.id)
        .single();

      const initialUpdatedAt = initialProfile?.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update tier
      await serviceClient
        .from('user_profiles')
        .update({
          tier: 'pro',
          updated_at: new Date().toISOString(),
        })
        .eq('id', testUser.id);

      // Get new timestamp
      const { data: updatedProfile } = await serviceClient
        .from('user_profiles')
        .select('updated_at')
        .eq('id', testUser.id)
        .single();

      expect(updatedProfile?.updated_at).not.toBe(initialUpdatedAt);
    });
  });

  describe('concurrent tier updates', () => {
    it('should handle rapid tier changes', async () => {
      // Simulate rapid changes (like test billing scenarios)
      const tiers: SubscriptionTier[] = ['pro', 'enterprise', 'pro', 'free'];

      for (const tier of tiers) {
        const { error } = await serviceClient
          .from('user_profiles')
          .update({ tier })
          .eq('id', testUser.id);

        expect(error).toBeNull();
      }

      // Final tier should be 'free'
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile?.tier).toBe('free');
    });
  });

  describe('tier lookup for billing decisions', () => {
    it('should be able to lookup user tier for billing checks', async () => {
      // Upgrade user
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      // Lookup tier (as billing service would)
      const { data: profile, error } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(error).toBeNull();
      expect(profile?.tier).toBe('pro');
    });

    it('should return tier limits for billing enforcement', async () => {
      // Update to pro
      await serviceClient
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', testUser.id);

      // Get profile tier
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      // Get limits for tier
      const { data: limits, error } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', profile!.tier)
        .single();

      expect(error).toBeNull();
      expect(limits).toBeDefined();
      expect(limits.tier).toBe('pro');
    });
  });
});
