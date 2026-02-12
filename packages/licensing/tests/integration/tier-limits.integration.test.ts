/**
 * Integration tests for tier limits fetching from database.
 *
 * Verifies that tier_limits table has correct seed data and
 * can be queried through the licensing service.
 * FR-088
 *
 * Skips automatically if Supabase is not configured.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createTestUser,
  cleanupTestUser,
  type TestUser,
} from '@sanyam/test-utils/setup/test-user';
import type { TierLimits, SubscriptionTier } from '@sanyam/types';

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey;

describe.skipIf(shouldSkip)('Tier Limits Integration Tests', () => {
  let container: Container;
  let anonClient: SupabaseClient;
  let testUser: TestUser;

  beforeAll(() => {
    container = new Container();
    // Create anonymous client for tier_limits (public table)
    anonClient = createClient(supabaseUrl!, supabaseAnonKey!);
  });

  afterAll(() => {
    container.unbindAll();
  });

  beforeEach(async () => {
    testUser = await createTestUser('free');
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('tier_limits table seed data', () => {
    it('should have free tier limits defined', async () => {
      const { data, error } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'free')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.tier).toBe('free');
      expect(data.max_documents).toBeGreaterThan(0);
      expect(data.max_storage_bytes).toBeGreaterThan(0);
    });

    it('should have pro tier limits defined', async () => {
      const { data, error } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'pro')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.tier).toBe('pro');
      expect(data.max_documents).toBeGreaterThan(0);
    });

    it('should have enterprise tier limits defined', async () => {
      const { data, error } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'enterprise')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.tier).toBe('enterprise');
    });
  });

  describe('tier hierarchy', () => {
    it('should have pro limits >= free limits for max_documents', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_documents')
        .in('tier', ['free', 'pro']);

      const free = tiers?.find((t) => t.tier === 'free');
      const pro = tiers?.find((t) => t.tier === 'pro');

      expect(free).toBeDefined();
      expect(pro).toBeDefined();
      expect(pro!.max_documents).toBeGreaterThanOrEqual(free!.max_documents);
    });

    it('should have enterprise limits >= pro limits for max_documents', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_documents')
        .in('tier', ['pro', 'enterprise']);

      const pro = tiers?.find((t) => t.tier === 'pro');
      const enterprise = tiers?.find((t) => t.tier === 'enterprise');

      expect(pro).toBeDefined();
      expect(enterprise).toBeDefined();
      expect(enterprise!.max_documents).toBeGreaterThanOrEqual(pro!.max_documents);
    });

    it('should have pro storage >= free storage', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_storage_bytes')
        .in('tier', ['free', 'pro']);

      const free = tiers?.find((t) => t.tier === 'free');
      const pro = tiers?.find((t) => t.tier === 'pro');

      expect(free).toBeDefined();
      expect(pro).toBeDefined();
      expect(pro!.max_storage_bytes).toBeGreaterThanOrEqual(free!.max_storage_bytes);
    });
  });

  describe('tier limit structure', () => {
    const expectedFields = [
      'tier',
      'max_documents',
      'max_storage_bytes',
      'max_document_size_bytes',
      'max_versions_per_document',
      'version_retention_days',
      'max_api_keys',
      'offline_access',
      'priority_support',
    ];

    it('should have all required fields for free tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'free')
        .single();

      for (const field of expectedFields) {
        expect(data).toHaveProperty(field);
      }
    });

    it('should have all required fields for pro tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'pro')
        .single();

      for (const field of expectedFields) {
        expect(data).toHaveProperty(field);
      }
    });

    it('should have all required fields for enterprise tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('*')
        .eq('tier', 'enterprise')
        .single();

      for (const field of expectedFields) {
        expect(data).toHaveProperty(field);
      }
    });
  });

  describe('tier feature flags', () => {
    it('should have offline_access disabled for free tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('offline_access')
        .eq('tier', 'free')
        .single();

      expect(data?.offline_access).toBe(false);
    });

    it('should have offline_access enabled for pro tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('offline_access')
        .eq('tier', 'pro')
        .single();

      expect(data?.offline_access).toBe(true);
    });

    it('should have priority_support disabled for free tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('priority_support')
        .eq('tier', 'free')
        .single();

      expect(data?.priority_support).toBe(false);
    });

    it('should have priority_support enabled for enterprise tier', async () => {
      const { data } = await anonClient
        .from('tier_limits')
        .select('priority_support')
        .eq('tier', 'enterprise')
        .single();

      expect(data?.priority_support).toBe(true);
    });
  });

  describe('numeric limits', () => {
    it('should have reasonable max_documents for each tier', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_documents');

      for (const tier of tiers ?? []) {
        expect(tier.max_documents).toBeGreaterThan(0);
        expect(Number.isInteger(tier.max_documents)).toBe(true);
      }
    });

    it('should have reasonable max_storage_bytes for each tier', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_storage_bytes');

      for (const tier of tiers ?? []) {
        expect(tier.max_storage_bytes).toBeGreaterThan(0);
        // At least 1 MB
        expect(tier.max_storage_bytes).toBeGreaterThanOrEqual(1024 * 1024);
      }
    });

    it('should have reasonable max_document_size_bytes for each tier', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_document_size_bytes');

      for (const tier of tiers ?? []) {
        expect(tier.max_document_size_bytes).toBeGreaterThan(0);
        // At least 1 KB
        expect(tier.max_document_size_bytes).toBeGreaterThanOrEqual(1024);
      }
    });

    it('should have non-negative max_api_keys for each tier', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, max_api_keys');

      for (const tier of tiers ?? []) {
        expect(tier.max_api_keys).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have non-negative version_retention_days for each tier', async () => {
      const { data: tiers } = await anonClient
        .from('tier_limits')
        .select('tier, version_retention_days');

      for (const tier of tiers ?? []) {
        expect(tier.version_retention_days).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
