/**
 * Unit tests for Unknown Tier Handling (defensive tier handling)
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TierLimits, SubscriptionTier, FeatureRegistration } from '@sanyam/types';
import {
  FeatureGateImpl,
  registerBuiltInFeatures,
} from '../../src/feature-gate.js';
import type { LicenseValidator } from '../../src/license-validator.js';

const FREE_LIMITS: TierLimits = {
  tier: 'free',
  max_documents: 10,
  max_storage_bytes: 50 * 1024 * 1024,
  max_collaborators: 0,
  max_api_keys: 0,
  max_versions_per_doc: 5,
  version_retention_days: 7,
  offline_access: false,
  priority_support: false,
};

function createMockLicenseValidator(tier: SubscriptionTier): LicenseValidator {
  return {
    currentTier: tier,
    currentLimits: { ...FREE_LIMITS, tier },
    hasTier: (required: SubscriptionTier) => {
      const hierarchy = ['free', 'pro', 'enterprise'];
      return hierarchy.indexOf(tier) >= hierarchy.indexOf(required);
    },
    validateLicense: vi.fn().mockResolvedValue({ valid: true, tier, limits: FREE_LIMITS }),
    invalidateCache: vi.fn(),
    refreshLimits: vi.fn().mockResolvedValue(FREE_LIMITS),
  };
}

describe('Unknown Tier Handling', () => {
  describe('checkFeature with unregistered feature', () => {
    it('should allow unregistered features by default', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Unknown feature not in registry
      const result = featureGate.checkFeature('unknown.feature');

      expect(result.enabled).toBe(true);
      expect(result.currentTier).toBe('free');
    });

    it('should return current tier for unregistered features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const result = featureGate.checkFeature('some.new.feature');

      expect(result.currentTier).toBe('pro');
    });

    it('should not have requiredTier for unregistered features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const result = featureGate.checkFeature('mystery.feature');

      expect(result.requiredTier).toBeUndefined();
    });
  });

  describe('isFeatureEnabled with unregistered feature', () => {
    it('should return true for unregistered features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const enabled = featureGate.isFeatureEnabled('unknown.feature.id');

      expect(enabled).toBe(true);
    });
  });

  describe('getRegisteredFeatures', () => {
    it('should return empty map initially', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const features = featureGate.getRegisteredFeatures();

      expect(features.size).toBe(0);
    });

    it('should return copy of internal map', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const features1 = featureGate.getRegisteredFeatures();
      features1.set('custom', { id: 'custom', name: 'Custom' });

      const features2 = featureGate.getRegisteredFeatures();

      // Modifying returned map should not affect internal state
      expect(features2.has('custom')).toBe(false);
    });

    it('should include all registered features after registration', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      featureGate.registerFeature({ id: 'feature.a', name: 'Feature A' });
      featureGate.registerFeature({ id: 'feature.b', name: 'Feature B' });

      const features = featureGate.getRegisteredFeatures();

      expect(features.size).toBe(2);
      expect(features.has('feature.a')).toBe(true);
      expect(features.has('feature.b')).toBe(true);
    });
  });

  describe('registerFeature', () => {
    it('should register new feature', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const registration: FeatureRegistration = {
        id: 'custom.feature',
        name: 'Custom Feature',
        requiredTier: 'pro',
      };

      featureGate.registerFeature(registration);

      const features = featureGate.getRegisteredFeatures();
      expect(features.get('custom.feature')).toEqual(registration);
    });

    it('should override existing registration with same ID', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      featureGate.registerFeature({ id: 'my.feature', name: 'Version 1' });
      featureGate.registerFeature({ id: 'my.feature', name: 'Version 2', requiredTier: 'enterprise' });

      const features = featureGate.getRegisteredFeatures();
      const feature = features.get('my.feature');

      expect(feature?.name).toBe('Version 2');
      expect(feature?.requiredTier).toBe('enterprise');
    });

    it('should make previously unknown feature gated after registration', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Before registration - allowed
      expect(featureGate.isFeatureEnabled('premium.feature')).toBe(true);

      // Register with pro requirement
      featureGate.registerFeature({
        id: 'premium.feature',
        name: 'Premium Feature',
        requiredTier: 'pro',
      });

      // After registration - denied for free tier
      expect(featureGate.isFeatureEnabled('premium.feature')).toBe(false);
    });
  });

  describe('hasTier', () => {
    it('should delegate to license validator', () => {
      const featureGate = new FeatureGateImpl();
      const validator = createMockLicenseValidator('pro');
      (featureGate as any).licenseValidator = validator;

      expect(featureGate.hasTier('free')).toBe(true);
      expect(featureGate.hasTier('pro')).toBe(true);
      expect(featureGate.hasTier('enterprise')).toBe(false);
    });
  });

  describe('Defensive behavior with edge cases', () => {
    it('should handle empty feature ID', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Empty string feature ID - should be allowed as unknown
      const result = featureGate.checkFeature('');

      expect(result.enabled).toBe(true);
    });

    it('should handle feature ID with special characters', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const specialId = 'feature:with/special@chars#123';
      featureGate.registerFeature({ id: specialId, name: 'Special' });

      const result = featureGate.checkFeature(specialId);

      expect(result.enabled).toBe(true);
    });

    it('should handle registration with minimal fields', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Only required fields
      featureGate.registerFeature({ id: 'minimal', name: 'Minimal' });

      const result = featureGate.checkFeature('minimal');

      expect(result.enabled).toBe(true);
      expect(result.requiredTier).toBeUndefined();
    });

    it('should handle registration with all fields', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      featureGate.registerFeature({
        id: 'full',
        name: 'Full Feature',
        description: 'A fully configured feature',
        requiredTier: 'pro',
        isEnabled: (tier, limits) => limits.max_documents > 0,
        disabledMessage: 'Custom disabled message',
      });

      const result = featureGate.checkFeature('full');

      expect(result.enabled).toBe(true);
    });
  });

  describe('Built-in features registration', () => {
    it('should register all built-in features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      registerBuiltInFeatures(featureGate);

      const features = featureGate.getRegisteredFeatures();

      // Should have at least the core built-in features
      expect(features.has('cloud.storage')).toBe(true);
      expect(features.has('cloud.sharing')).toBe(true);
      expect(features.has('cloud.versionHistory')).toBe(true);
      expect(features.has('cloud.apiKeys')).toBe(true);
    });

    it('should make built-in features gate-able', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      registerBuiltInFeatures(featureGate);

      // cloud.sharing requires pro tier
      const sharingResult = featureGate.checkFeature('cloud.sharing');
      expect(sharingResult.enabled).toBe(false);
      expect(sharingResult.requiredTier).toBe('pro');
    });
  });
});
