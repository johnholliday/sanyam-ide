/**
 * Auto Profile Trigger Tests
 *
 * Tests the on_auth_user_created trigger that automatically creates
 * user profiles when users sign up.
 * FR-136-139
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

describe.skipIf(shouldSkip)('Auto Profile Trigger Tests', () => {
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

  describe('profile creation on signup', () => {
    it('should automatically create profile when user signs up', async () => {
      // Profile should exist since createTestUser triggers the signup
      const { data: profile, error } = await serviceClient
        .from('user_profiles')
        .select('*')
        .eq('id', testUser.id)
        .single();

      expect(error).toBeNull();
      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(testUser.id);
    });

    it('should set email from auth user', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('email')
        .eq('id', testUser.id)
        .single();

      expect(profile!.email).toBe(testUser.email);
    });

    it('should default to free tier', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tier')
        .eq('id', testUser.id)
        .single();

      expect(profile!.tier).toBe('free');
    });

    it('should initialize storage_used_bytes to 0', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('storage_used_bytes')
        .eq('id', testUser.id)
        .single();

      expect(profile!.storage_used_bytes).toBe(0);
    });

    it('should initialize document_count to 0', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('document_count')
        .eq('id', testUser.id)
        .single();

      expect(profile!.document_count).toBe(0);
    });

    it('should set created_at timestamp', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('created_at')
        .eq('id', testUser.id)
        .single();

      expect(profile!.created_at).toBeDefined();
      const createdAt = new Date(profile!.created_at);
      expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('profile uniqueness', () => {
    it('should not allow duplicate profiles for same user', async () => {
      // Try to insert duplicate profile via service role
      const { error } = await serviceClient.from('user_profiles').insert({
        id: testUser.id,
        email: 'duplicate@test.com',
        tier: 'free',
      });

      // Should fail due to primary key constraint
      expect(error).not.toBeNull();
    });
  });

  describe('profile-auth user link', () => {
    it('should cascade delete profile when auth user is deleted', async () => {
      // Get profile before cleanup
      const { data: beforeDelete } = await serviceClient
        .from('user_profiles')
        .select('id')
        .eq('id', testUser.id)
        .single();

      expect(beforeDelete).not.toBeNull();

      // Delete auth user
      await serviceClient.auth.admin.deleteUser(testUser.id);

      // Profile should be deleted via cascade
      const { data: afterDelete } = await serviceClient
        .from('user_profiles')
        .select('id')
        .eq('id', testUser.id)
        .single();

      expect(afterDelete).toBeNull();

      // Mark as cleaned up so afterEach doesn't fail
      testUser = null as any;
    });
  });

  describe('default values', () => {
    it('should allow null display_name by default', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('display_name')
        .eq('id', testUser.id)
        .single();

      // display_name is nullable and not set by trigger
      expect(profile!.display_name === null || profile!.display_name === undefined).toBe(true);
    });

    it('should allow null avatar_url by default', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', testUser.id)
        .single();

      expect(profile!.avatar_url === null || profile!.avatar_url === undefined).toBe(true);
    });

    it('should allow null trial_expires_at by default', async () => {
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('trial_expires_at')
        .eq('id', testUser.id)
        .single();

      expect(profile!.trial_expires_at).toBeNull();
    });
  });
});
