/**
 * Unit tests for Feature Contribution extensibility
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container, injectable } from 'inversify';
import type { TierLimits, SubscriptionTier, FeatureRegistration } from '@sanyam/types';
import { FeatureContribution } from '@sanyam/types';
import {
  FeatureGate,
  FeatureGateImpl,
} from '../../src/feature-gate.js';
import {
  LicenseValidator,
  LicenseValidatorImpl,
} from '../../src/license-validator.js';

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

const PRO_LIMITS: TierLimits = {
  tier: 'pro',
  max_documents: 100,
  max_storage_bytes: 500 * 1024 * 1024,
  max_collaborators: 10,
  max_api_keys: 5,
  max_versions_per_doc: 50,
  version_retention_days: 30,
  offline_access: true,
  priority_support: false,
};

function createMockLicenseValidator(tier: SubscriptionTier): LicenseValidatorImpl {
  const limits = tier === 'free' ? FREE_LIMITS : PRO_LIMITS;
  const validator = new LicenseValidatorImpl();
  (validator as any).cachedTier = tier;
  (validator as any).cachedLimits = limits;
  return validator;
}

/**
 * Example feature contribution for testing.
 */
@injectable()
class ExampleFeatureContribution implements FeatureContribution {
  getFeatureRegistration(): FeatureRegistration {
    return {
      id: 'example.feature',
      name: 'Example Feature',
      description: 'An example feature for testing',
      requiredTier: 'pro',
      disabledMessage: 'Example feature requires Pro subscription',
    };
  }
}

/**
 * Another feature contribution with custom isEnabled logic.
 */
@injectable()
class CustomLogicFeatureContribution implements FeatureContribution {
  getFeatureRegistration(): FeatureRegistration {
    return {
      id: 'custom.logic.feature',
      name: 'Custom Logic Feature',
      description: 'Feature with custom enabled logic',
      isEnabled: (tier: SubscriptionTier, limits: TierLimits) => {
        // Only enabled if user has at least 5 API keys allowed
        return limits.max_api_keys >= 5;
      },
      disabledMessage: 'This feature requires at least 5 API keys quota',
    };
  }
}

describe('Feature Contribution', () => {
  describe('FeatureContribution interface', () => {
    it('should define getFeatureRegistration method', () => {
      const contribution = new ExampleFeatureContribution();
      const registration = contribution.getFeatureRegistration();

      expect(registration.id).toBe('example.feature');
      expect(registration.name).toBe('Example Feature');
      expect(registration.requiredTier).toBe('pro');
    });

    it('should support optional isEnabled function', () => {
      const contribution = new CustomLogicFeatureContribution();
      const registration = contribution.getFeatureRegistration();

      expect(typeof registration.isEnabled).toBe('function');
    });
  });

  describe('FeatureGate with contributions', () => {
    it('should register features from contributions in postConstruct', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      (featureGate as any).contributions = [
        new ExampleFeatureContribution(),
        new CustomLogicFeatureContribution(),
      ];

      // Manually call init (normally called by inversify postConstruct)
      (featureGate as any).init();

      const features = featureGate.getRegisteredFeatures();

      expect(features.has('example.feature')).toBe(true);
      expect(features.has('custom.logic.feature')).toBe(true);
    });

    it('should handle empty contributions array', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      (featureGate as any).contributions = [];

      (featureGate as any).init();

      const features = featureGate.getRegisteredFeatures();
      expect(features.size).toBe(0);
    });

    it('should handle undefined contributions', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      // contributions is undefined (optional)

      // Should not throw
      expect(() => (featureGate as any).init()).not.toThrow();
    });
  });

  describe('Custom isEnabled logic', () => {
    it('should call isEnabled with tier and limits', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const isEnabled = vi.fn().mockReturnValue(true);
      featureGate.registerFeature({
        id: 'spy.feature',
        name: 'Spy Feature',
        isEnabled,
      });

      featureGate.checkFeature('spy.feature');

      expect(isEnabled).toHaveBeenCalledWith('free', FREE_LIMITS);
    });

    it('should disable feature when isEnabled returns false', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      featureGate.registerFeature({
        id: 'conditional.feature',
        name: 'Conditional Feature',
        isEnabled: () => false,
        disabledMessage: 'Feature is disabled',
      });

      const result = featureGate.checkFeature('conditional.feature');

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('Feature is disabled');
    });

    it('should enable feature when isEnabled returns true', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      featureGate.registerFeature({
        id: 'conditional.feature',
        name: 'Conditional Feature',
        isEnabled: () => true,
      });

      const result = featureGate.checkFeature('conditional.feature');

      expect(result.enabled).toBe(true);
    });

    it('should check tier requirement before isEnabled', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const isEnabled = vi.fn().mockReturnValue(true);
      featureGate.registerFeature({
        id: 'tier.first.feature',
        name: 'Tier First Feature',
        requiredTier: 'pro',
        isEnabled,
      });

      const result = featureGate.checkFeature('tier.first.feature');

      // Should fail on tier check before calling isEnabled
      expect(result.enabled).toBe(false);
      expect(result.requiredTier).toBe('pro');
      expect(isEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Feature registration overriding', () => {
    it('should allow overriding previously registered features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Register original
      featureGate.registerFeature({
        id: 'override.me',
        name: 'Original',
        requiredTier: 'enterprise',
      });

      // Register override with lower tier
      featureGate.registerFeature({
        id: 'override.me',
        name: 'Overridden',
        requiredTier: 'free',
      });

      const result = featureGate.checkFeature('override.me');

      // Should use the overridden registration
      expect(result.enabled).toBe(true);
    });

    it('should use last registration for duplicate contributions', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const contrib1: FeatureContribution = {
        getFeatureRegistration: () => ({
          id: 'dup.feature',
          name: 'First Version',
        }),
      };

      const contrib2: FeatureContribution = {
        getFeatureRegistration: () => ({
          id: 'dup.feature',
          name: 'Second Version',
          requiredTier: 'pro',
        }),
      };

      (featureGate as any).contributions = [contrib1, contrib2];
      (featureGate as any).init();

      const features = featureGate.getRegisteredFeatures();
      const feature = features.get('dup.feature');

      expect(feature?.name).toBe('Second Version');
      expect(feature?.requiredTier).toBe('pro');
    });
  });

  describe('Complex feature scenarios', () => {
    it('should support feature with tier AND custom logic', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      featureGate.registerFeature({
        id: 'complex.feature',
        name: 'Complex Feature',
        requiredTier: 'pro',
        isEnabled: (tier, limits) => limits.max_documents > 50,
      });

      // Pro tier passes tier check, and has 100 max docs (> 50)
      const result = featureGate.checkFeature('complex.feature');
      expect(result.enabled).toBe(true);
    });

    it('should fail when tier passes but custom logic fails', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      featureGate.registerFeature({
        id: 'strict.feature',
        name: 'Strict Feature',
        requiredTier: 'pro',
        isEnabled: (tier, limits) => limits.max_documents > 500, // Pro only has 100
        disabledMessage: 'Requires more document quota',
      });

      const result = featureGate.checkFeature('strict.feature');

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('Requires more document quota');
    });

    it('should use default disabled message when none provided', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      featureGate.registerFeature({
        id: 'no.message.feature',
        name: 'No Message Feature',
        isEnabled: () => false,
        // No disabledMessage provided
      });

      const result = featureGate.checkFeature('no.message.feature');

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('Feature is not available for your subscription');
    });
  });
});
