/**
 * Integration tests for feature gate with database source-of-truth.
 *
 * Tests that feature gating decisions are based on actual tier limits
 * stored in the database rather than hardcoded values.
 * FR-083-084
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

// Skip entire suite if Supabase not configured
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const shouldSkip = !supabaseUrl || !supabaseAnonKey;

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

describe.skipIf(shouldSkip)('Feature Gate DB Integration Tests', () => {
  let container: Container;
  let anonClient: SupabaseClient;
  let freeUser: TestUser;
  let proUser: TestUser;

  beforeAll(() => {
    anonClient = createClient(supabaseUrl!, supabaseAnonKey!);
  });

  afterAll(() => {
    // Nothing to clean up
  });

  beforeEach(async () => {
    // Create test users with different tiers
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

  describe('tier limits from database', () => {
    it('should fetch tier limits from database', async () => {
      const fetcher = createDbTierLimitsFetcher(anonClient);
      const limits = await fetcher('free');

      expect(limits).not.toBeNull();
      expect(limits!.tier).toBe('free');
      expect(limits!.max_documents).toBeGreaterThan(0);
    });

    it('should fetch pro tier limits from database', async () => {
      const fetcher = createDbTierLimitsFetcher(anonClient);
      const limits = await fetcher('pro');

      expect(limits).not.toBeNull();
      expect(limits!.tier).toBe('pro');
    });

    it('should return null for non-existent tier', async () => {
      const fetcher = createDbTierLimitsFetcher(anonClient);
      const limits = await fetcher('nonexistent' as SubscriptionTier);

      expect(limits).toBeNull();
    });
  });

  describe('license validator with db fetcher', () => {
    it('should validate using database tier limits', async () => {
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      await validator.initialize();

      // Validator should have initialized with free tier limits
      expect(validator.currentTier).toBe('free');
      expect(validator.currentLimits).toBeDefined();
    });
  });

  describe('feature gate with database source', () => {
    it('should check features based on database tier limits', async () => {
      // Set up container
      const testContainer = new Container();

      // Create license validator with db fetcher
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);
      await validator.initialize();

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Cloud storage should be available for free tier
      const storageResult = featureGate.checkFeature(BuiltInFeatures.CLOUD_STORAGE);
      expect(storageResult.enabled).toBe(true);

      // Document sharing should NOT be available for free tier
      const sharingResult = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);
      expect(sharingResult.enabled).toBe(false);
      expect(sharingResult.requiredTier).toBe('pro');

      testContainer.unbindAll();
    });

    it('should enable pro features for pro tier', async () => {
      const testContainer = new Container();

      // Create license validator with db fetcher and pro tier
      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);

      // Manually set to pro tier for testing
      await validator.initialize();
      (validator as any).cachedTier = 'pro';

      // Fetch pro limits
      const proLimits = await fetcher('pro');
      if (proLimits) {
        (validator as any).cachedLimits = proLimits;
      }

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Document sharing should be available for pro tier
      const sharingResult = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);
      expect(sharingResult.enabled).toBe(true);
      expect(sharingResult.currentTier).toBe('pro');

      testContainer.unbindAll();
    });
  });

  describe('feature limits from database', () => {
    it('should use database version_retention_days for version history feature', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);
      await validator.initialize();

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      // Get tier limits to check version_retention_days
      const limits = featureGate.getTierLimits();

      // Version history feature depends on version_retention_days > 0
      const versionResult = featureGate.checkFeature(BuiltInFeatures.VERSION_HISTORY);

      if (limits.version_retention_days > 0) {
        expect(versionResult.enabled).toBe(true);
      } else {
        expect(versionResult.enabled).toBe(false);
      }

      testContainer.unbindAll();
    });

    it('should use database offline_access flag for offline mode feature', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);
      await validator.initialize();

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);
      registerBuiltInFeatures(featureGate);

      const limits = featureGate.getTierLimits();
      const offlineResult = featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE);

      // Offline mode requires pro tier AND offline_access flag
      if (validator.currentTier === 'free') {
        // Free tier never has offline access
        expect(offlineResult.enabled).toBe(false);
      } else if (limits.offline_access) {
        expect(offlineResult.enabled).toBe(true);
      }

      testContainer.unbindAll();
    });
  });

  describe('hasTier validation', () => {
    it('should correctly validate tier hierarchy with database values', async () => {
      const testContainer = new Container();

      const validator = new LicenseValidatorImpl();
      const fetcher = createDbTierLimitsFetcher(anonClient);
      validator.setTierLimitsFetcher(fetcher);
      await validator.initialize();

      testContainer.bind(LicenseValidator).toConstantValue(validator);
      testContainer.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

      const featureGate = testContainer.get<FeatureGate>(FeatureGate);

      // Free tier should have free tier
      expect(featureGate.hasTier('free')).toBe(true);

      // Free tier should NOT have pro tier
      expect(featureGate.hasTier('pro')).toBe(false);

      // Free tier should NOT have enterprise tier
      expect(featureGate.hasTier('enterprise')).toBe(false);

      testContainer.unbindAll();
    });
  });
});
