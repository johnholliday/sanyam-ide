/**
 * Unit tests for FeatureGate
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container, ContainerModule } from 'inversify';
import {
  FeatureGateImpl,
  FeatureGate,
  BuiltInFeatures,
  registerBuiltInFeatures,
  type FeatureCheckResult,
} from '../../src/feature-gate.js';
import { LicenseValidator } from '../../src/license-validator.js';
import type { TierLimits, SubscriptionTier, FeatureRegistration } from '@sanyam/types';

// Mock tier limits for different tiers
const FREE_TIER_LIMITS: TierLimits = {
  tier: 'free',
  max_documents: 10,
  max_storage_bytes: 104857600,
  max_document_size_bytes: 1048576,
  max_api_keys: 0,
  version_retention_days: 7,
  offline_access: false,
  priority_support: false,
};

const PRO_TIER_LIMITS: TierLimits = {
  tier: 'pro',
  max_documents: 100,
  max_storage_bytes: 1073741824,
  max_document_size_bytes: 10485760,
  max_api_keys: 5,
  version_retention_days: 30,
  offline_access: true,
  priority_support: false,
};

const ENTERPRISE_TIER_LIMITS: TierLimits = {
  tier: 'enterprise',
  max_documents: -1,
  max_storage_bytes: 10737418240,
  max_document_size_bytes: 104857600,
  max_api_keys: -1,
  version_retention_days: -1,
  offline_access: true,
  priority_support: true,
};

describe('FeatureGate', () => {
  let container: Container;
  let featureGate: FeatureGateImpl;
  let mockLicenseValidator: {
    currentTier: SubscriptionTier;
    currentLimits: TierLimits;
    hasTier: ReturnType<typeof vi.fn>;
  };

  function setupContainer(tier: SubscriptionTier, limits: TierLimits) {
    mockLicenseValidator = {
      currentTier: tier,
      currentLimits: limits,
      hasTier: vi.fn((requiredTier: SubscriptionTier) => {
        const hierarchy = ['free', 'pro', 'enterprise'];
        const userIndex = hierarchy.indexOf(tier);
        const requiredIndex = hierarchy.indexOf(requiredTier);
        return userIndex >= requiredIndex;
      }),
    };

    container = new Container();
    container.bind(LicenseValidator).toConstantValue(mockLicenseValidator as any);
    container.bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

    featureGate = container.get(FeatureGate) as FeatureGateImpl;
  }

  describe('checkFeature', () => {
    describe('with free tier user', () => {
      beforeEach(() => {
        setupContainer('free', FREE_TIER_LIMITS);
        registerBuiltInFeatures(featureGate);
      });

      it('should allow cloud storage for free tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.CLOUD_STORAGE);

        expect(result.enabled).toBe(true);
        expect(result.currentTier).toBe('free');
      });

      it('should deny document sharing for free tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);

        expect(result.enabled).toBe(false);
        expect(result.requiredTier).toBe('pro');
        expect(result.reason).toContain('pro');
      });

      it('should deny API keys for free tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.API_KEYS);

        expect(result.enabled).toBe(false);
        expect(result.requiredTier).toBe('pro');
      });

      it('should allow version history when retention > 0', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.VERSION_HISTORY);

        expect(result.enabled).toBe(true);
      });

      it('should deny offline mode for free tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE);

        expect(result.enabled).toBe(false);
      });

      it('should deny priority support for free tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.PRIORITY_SUPPORT);

        expect(result.enabled).toBe(false);
        expect(result.requiredTier).toBe('enterprise');
      });
    });

    describe('with pro tier user', () => {
      beforeEach(() => {
        setupContainer('pro', PRO_TIER_LIMITS);
        registerBuiltInFeatures(featureGate);
      });

      it('should allow document sharing for pro tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);

        expect(result.enabled).toBe(true);
        expect(result.currentTier).toBe('pro');
      });

      it('should allow API keys for pro tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.API_KEYS);

        expect(result.enabled).toBe(true);
      });

      it('should allow offline mode for pro tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE);

        expect(result.enabled).toBe(true);
      });

      it('should deny priority support for pro tier', () => {
        const result = featureGate.checkFeature(BuiltInFeatures.PRIORITY_SUPPORT);

        expect(result.enabled).toBe(false);
      });
    });

    describe('with enterprise tier user', () => {
      beforeEach(() => {
        setupContainer('enterprise', ENTERPRISE_TIER_LIMITS);
        registerBuiltInFeatures(featureGate);
      });

      it('should allow all features for enterprise tier', () => {
        expect(featureGate.checkFeature(BuiltInFeatures.CLOUD_STORAGE).enabled).toBe(true);
        expect(featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING).enabled).toBe(true);
        expect(featureGate.checkFeature(BuiltInFeatures.API_KEYS).enabled).toBe(true);
        expect(featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE).enabled).toBe(true);
        expect(featureGate.checkFeature(BuiltInFeatures.PRIORITY_SUPPORT).enabled).toBe(true);
      });
    });

    describe('unknown features', () => {
      beforeEach(() => {
        setupContainer('free', FREE_TIER_LIMITS);
      });

      it('should allow unknown features by default', () => {
        const result = featureGate.checkFeature('unknown.feature');

        expect(result.enabled).toBe(true);
        expect(result.currentTier).toBe('free');
      });
    });
  });

  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      setupContainer('free', FREE_TIER_LIMITS);
      registerBuiltInFeatures(featureGate);
    });

    it('should return boolean for feature check', () => {
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(false);
    });
  });

  describe('registerFeature', () => {
    beforeEach(() => {
      setupContainer('free', FREE_TIER_LIMITS);
    });

    it('should register custom features', () => {
      const customFeature: FeatureRegistration = {
        id: 'custom.feature',
        name: 'Custom Feature',
        description: 'A custom feature',
        requiredTier: 'pro',
      };

      featureGate.registerFeature(customFeature);

      const registered = featureGate.getRegisteredFeatures();
      expect(registered.has('custom.feature')).toBe(true);
      expect(featureGate.isFeatureEnabled('custom.feature')).toBe(false);
    });

    it('should register features with custom isEnabled function', () => {
      const customFeature: FeatureRegistration = {
        id: 'custom.conditional',
        name: 'Conditional Feature',
        description: 'Feature with custom condition',
        isEnabled: (tier, limits) => limits.max_documents > 5,
      };

      featureGate.registerFeature(customFeature);

      // Free tier has max_documents: 10, so should be enabled
      expect(featureGate.isFeatureEnabled('custom.conditional')).toBe(true);
    });
  });

  describe('getTierLimits', () => {
    beforeEach(() => {
      setupContainer('pro', PRO_TIER_LIMITS);
    });

    it('should return current tier limits', () => {
      const limits = featureGate.getTierLimits();

      expect(limits.tier).toBe('pro');
      expect(limits.max_documents).toBe(100);
      expect(limits.offline_access).toBe(true);
    });
  });

  describe('hasTier', () => {
    beforeEach(() => {
      setupContainer('pro', PRO_TIER_LIMITS);
    });

    it('should check tier hierarchy correctly', () => {
      expect(featureGate.hasTier('free')).toBe(true);
      expect(featureGate.hasTier('pro')).toBe(true);
      expect(featureGate.hasTier('enterprise')).toBe(false);
    });
  });

  describe('getRegisteredFeatures', () => {
    beforeEach(() => {
      setupContainer('free', FREE_TIER_LIMITS);
      registerBuiltInFeatures(featureGate);
    });

    it('should return copy of registered features', () => {
      const features = featureGate.getRegisteredFeatures();

      expect(features.size).toBeGreaterThan(0);
      expect(features.has(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);

      // Should be a copy, not the original
      features.delete(BuiltInFeatures.CLOUD_STORAGE);
      expect(featureGate.getRegisteredFeatures().has(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);
    });
  });
});

describe('registerBuiltInFeatures', () => {
  it('should register all built-in features', () => {
    const container = new Container();
    container.bind(LicenseValidator).toConstantValue({
      currentTier: 'free',
      currentLimits: FREE_TIER_LIMITS,
      hasTier: () => true,
    } as any);
    container.bind(FeatureGate).to(FeatureGateImpl);

    const gate = container.get(FeatureGate) as FeatureGateImpl;
    registerBuiltInFeatures(gate);

    const features = gate.getRegisteredFeatures();
    expect(features.has(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);
    expect(features.has(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);
    expect(features.has(BuiltInFeatures.VERSION_HISTORY)).toBe(true);
    expect(features.has(BuiltInFeatures.RESTORE_DOCUMENTS)).toBe(true);
    expect(features.has(BuiltInFeatures.API_KEYS)).toBe(true);
    expect(features.has(BuiltInFeatures.OFFLINE_MODE)).toBe(true);
    expect(features.has(BuiltInFeatures.PRIORITY_SUPPORT)).toBe(true);
  });
});
