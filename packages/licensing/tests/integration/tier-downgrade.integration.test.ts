/**
 * Integration tests for tier downgrade handling.
 *
 * Tests that tier changes (especially downgrades) are handled gracefully
 * with proper degradation policies.
 * FR-097
 *
 * Skips automatically if Supabase is not configured.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FeatureGate,
  FeatureGateImpl,
  BuiltInFeatures,
  registerBuiltInFeatures,
} from '../../src/feature-gate.js';
import {
  LicenseValidator,
  LicenseValidatorImpl,
} from '../../src/license-validator.js';
import {
  createTestUser,
  cleanupTestUser,
  type TestUser,
} from '@sanyam/test-utils/setup/test-user';
import type { TierLimits, SubscriptionTier } from '@sanyam/types';
import { DEFAULT_FREE_TIER_LIMITS } from '@sanyam/types';

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey;

/**
 * Create a tier limits fetcher using the Supabase client.
 */
function createDbTierLimitsFetcher(client: SupabaseClient) {
  return async (tier: SubscriptionTier): Promise<TierLimits | null> => {
    const { data, error } = await client
      .from('tier_limits')
      .select('*')
      .eq('tier', tier)
      .single();

    if (error || !data) {
      return null;
    }

    return data as TierLimits;
  };
}

describe.skipIf(shouldSkip)('Tier Downgrade Integration Tests', () => {
  let anonClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUser: TestUser;

  beforeAll(() => {
    anonClient = createClient(supabaseUrl!, supabaseAnonKey!);
    serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);
  });

  beforeEach(async () => {
    testUser = await createTestUser('pro');
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(testUser);
    }
  });

  describe('tier downgrade detection', () => {
    it('should detect downgrade from pro to free', async () => {
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      // Initialize with pro tier
      await validator.initialize();
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      expect(validator.currentTier).toBe('pro');
      expect(validator.hasTier('pro')).toBe(true);

      // Simulate downgrade to free
      (validator as any).cachedTier = 'free';
      const freeLimits = await fetcher('free');
      (validator as any).cachedLimits = freeLimits;

      expect(validator.currentTier).toBe('free');
      expect(validator.hasTier('pro')).toBe(false);
    });

    it('should detect downgrade from enterprise to pro', async () => {
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      // Initialize with enterprise tier
      await validator.initialize();
      (validator as any).cachedTier = 'enterprise';
      const enterpriseLimits = await fetcher('enterprise');
      (validator as any).cachedLimits = enterpriseLimits;

      expect(validator.hasTier('enterprise')).toBe(true);

      // Simulate downgrade to pro
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      expect(validator.hasTier('enterprise')).toBe(false);
      expect(validator.hasTier('pro')).toBe(true);
    });
  });

  describe('feature availability after downgrade', () => {
    it('should disable sharing feature after downgrade from pro to free', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      // Start with pro tier
      await validator.initialize();
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Verify sharing is enabled for pro
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);

      // Simulate downgrade to free
      (validator as any).cachedTier = 'free';
      const freeLimits = await fetcher('free');
      (validator as any).cachedLimits = freeLimits;

      // Verify sharing is disabled after downgrade
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(false);

      testContainer.unbindAll();
    });

    it('should disable API keys feature after downgrade from pro to free', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Verify API keys enabled for pro
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(true);

      // Simulate downgrade
      (validator as any).cachedTier = 'free';
      const freeLimits = await fetcher('free');
      (validator as any).cachedLimits = freeLimits;

      // Verify disabled after downgrade
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(false);

      testContainer.unbindAll();
    });
  });

  describe('limit changes after downgrade', () => {
    it('should reflect reduced document limit after downgrade', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);

      const proDocLimit = featureGate.getTierLimits().max_documents;

      // Simulate downgrade
      (validator as any).cachedTier = 'free';
      const freeLimits = await fetcher('free');
      (validator as any).cachedLimits = freeLimits;

      const freeDocLimit = featureGate.getTierLimits().max_documents;

      // Free limit should be <= pro limit
      expect(freeDocLimit).toBeLessThanOrEqual(proDocLimit);

      testContainer.unbindAll();
    });

    it('should reflect reduced storage limit after downgrade', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();
      (validator as any).cachedTier = 'pro';
      const proLimits = await fetcher('pro');
      (validator as any).cachedLimits = proLimits;

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);

      const proStorageLimit = featureGate.getTierLimits().max_storage_bytes;

      // Simulate downgrade
      (validator as any).cachedTier = 'free';
      const freeLimits = await fetcher('free');
      (validator as any).cachedLimits = freeLimits;

      const freeStorageLimit = featureGate.getTierLimits().max_storage_bytes;

      // Free limit should be <= pro limit
      expect(freeStorageLimit).toBeLessThanOrEqual(proStorageLimit);

      testContainer.unbindAll();
    });
  });

  describe('cache invalidation on tier change', () => {
    it('should invalidate cache when tier changes', async () => {
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();

      // Force cache to have a future expiry
      (validator as any).cacheExpiresAt = Date.now() + 1000000;

      // Invalidate cache
      validator.invalidateCache();

      // Cache should be expired
      expect((validator as any).cacheExpiresAt).toBe(0);
    });

    it('should refetch limits after cache invalidation', async () => {
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();
      const initialLimits = validator.currentLimits;

      // Invalidate and refresh
      validator.invalidateCache();

      // Re-validate should fetch fresh limits
      // (In real scenario, would have new token with different tier)
      const result = await validator.validate('mock-token');

      expect(result.limits).toBeDefined();
    });
  });

  describe('graceful degradation', () => {
    it('should fallback to free tier on fetch error', async () => {
      const validator = new LicenseValidatorImpl();

      // Set a fetcher that always fails
      validator.setTierLimitsFetcher(async () => null);

      await validator.initialize();

      // Should default to free tier
      expect(validator.currentTier).toBe('free');
      expect(validator.currentLimits).toBeDefined();
      expect(validator.currentLimits.tier).toBe('free');
    });

    it('should maintain access to basic features during tier fetch failure', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      validator.setTierLimitsFetcher(async () => null);
      await validator.initialize();

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Cloud storage should still be available (free tier feature)
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);

      testContainer.unbindAll();
    });
  });
});
