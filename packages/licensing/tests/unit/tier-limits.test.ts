/**
 * Unit tests for Tier Limits functionality
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TierLimits, SubscriptionTier } from '@sanyam/types';
import {
  FeatureGateImpl,
  BuiltInFeatures,
  registerBuiltInFeatures,
} from '../../src/feature-gate.js';
import type { LicenseValidator } from '../../src/license-validator.js';

const createMockLimits = (tier: SubscriptionTier): TierLimits => {
  const defaults: Record<SubscriptionTier, TierLimits> = {
    free: {
      tier: 'free',
      max_documents: 10,
      max_storage_bytes: 50 * 1024 * 1024, // 50MB
      max_collaborators: 0,
      max_api_keys: 0,
      max_versions_per_doc: 5,
      version_retention_days: 7,
      offline_access: false,
      priority_support: false,
    },
    pro: {
      tier: 'pro',
      max_documents: 100,
      max_storage_bytes: 500 * 1024 * 1024, // 500MB
      max_collaborators: 10,
      max_api_keys: 5,
      max_versions_per_doc: 50,
      version_retention_days: 30,
      offline_access: true,
      priority_support: false,
    },
    enterprise: {
      tier: 'enterprise',
      max_documents: -1, // unlimited
      max_storage_bytes: -1, // unlimited
      max_collaborators: -1, // unlimited
      max_api_keys: -1, // unlimited
      max_versions_per_doc: -1, // unlimited
      version_retention_days: -1, // unlimited
      offline_access: true,
      priority_support: true,
    },
  };
  return defaults[tier];
};

function createMockLicenseValidator(tier: SubscriptionTier): LicenseValidator {
  const limits = createMockLimits(tier);
  return {
    currentTier: tier,
    currentLimits: limits,
    hasTier: (required: SubscriptionTier) => {
      const hierarchy = ['free', 'pro', 'enterprise'];
      return hierarchy.indexOf(tier) >= hierarchy.indexOf(required);
    },
    validateLicense: vi.fn().mockResolvedValue({ valid: true, tier, limits }),
    invalidateCache: vi.fn(),
    refreshLimits: vi.fn().mockResolvedValue(limits),
  };
}

describe('Tier Limits', () => {
  describe('getTierLimits', () => {
    it('should return current tier limits', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(limits.tier).toBe('pro');
      expect(limits.max_documents).toBe(100);
    });

    it('should return free tier limits for free users', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const limits = featureGate.getTierLimits();

      expect(limits.tier).toBe('free');
      expect(limits.max_documents).toBe(10);
      expect(limits.max_api_keys).toBe(0);
      expect(limits.offline_access).toBe(false);
    });

    it('should return pro tier limits for pro users', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(limits.tier).toBe('pro');
      expect(limits.max_documents).toBe(100);
      expect(limits.max_api_keys).toBe(5);
      expect(limits.offline_access).toBe(true);
    });

    it('should return enterprise tier limits for enterprise users', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      const limits = featureGate.getTierLimits();

      expect(limits.tier).toBe('enterprise');
      expect(limits.max_documents).toBe(-1); // unlimited
      expect(limits.priority_support).toBe(true);
    });
  });

  describe('Numeric limit columns', () => {
    it('should have max_documents as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.max_documents).toBe('number');
    });

    it('should have max_storage_bytes as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.max_storage_bytes).toBe('number');
      expect(limits.max_storage_bytes).toBe(500 * 1024 * 1024);
    });

    it('should have max_collaborators as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.max_collaborators).toBe('number');
      expect(limits.max_collaborators).toBe(10);
    });

    it('should have max_api_keys as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.max_api_keys).toBe('number');
      expect(limits.max_api_keys).toBe(0);
    });

    it('should have max_versions_per_doc as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.max_versions_per_doc).toBe('number');
      expect(limits.max_versions_per_doc).toBe(50);
    });

    it('should have version_retention_days as number', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.version_retention_days).toBe('number');
      expect(limits.version_retention_days).toBe(7);
    });
  });

  describe('Boolean limit columns', () => {
    it('should have offline_access as boolean', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.offline_access).toBe('boolean');
      expect(limits.offline_access).toBe(true);
    });

    it('should have priority_support as boolean', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      const limits = featureGate.getTierLimits();

      expect(typeof limits.priority_support).toBe('boolean');
      expect(limits.priority_support).toBe(true);
    });
  });

  describe('Unlimited values', () => {
    it('should represent unlimited as -1', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      const limits = featureGate.getTierLimits();

      expect(limits.max_documents).toBe(-1);
      expect(limits.max_storage_bytes).toBe(-1);
      expect(limits.max_collaborators).toBe(-1);
      expect(limits.max_api_keys).toBe(-1);
      expect(limits.max_versions_per_doc).toBe(-1);
      expect(limits.version_retention_days).toBe(-1);
    });
  });

  describe('Features using limits', () => {
    it('should check version_retention_days for version history feature', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      registerBuiltInFeatures(featureGate);

      // Free tier has 7 days retention, so version history should be enabled
      const result = featureGate.checkFeature(BuiltInFeatures.VERSION_HISTORY);
      expect(result.enabled).toBe(true);
    });

    it('should disable version history when retention is 0', () => {
      const featureGate = new FeatureGateImpl();
      const validator = createMockLicenseValidator('free');
      validator.currentLimits.version_retention_days = 0;
      (featureGate as any).licenseValidator = validator;
      registerBuiltInFeatures(featureGate);

      const result = featureGate.checkFeature(BuiltInFeatures.VERSION_HISTORY);
      expect(result.enabled).toBe(false);
    });

    it('should check offline_access for offline mode feature', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      registerBuiltInFeatures(featureGate);

      const result = featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE);
      expect(result.enabled).toBe(true);
    });

    it('should disable offline mode when offline_access is false', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      registerBuiltInFeatures(featureGate);

      const result = featureGate.checkFeature(BuiltInFeatures.OFFLINE_MODE);
      // Free tier requires 'pro' for offline mode
      expect(result.enabled).toBe(false);
    });

    it('should check priority_support for priority support feature', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');
      registerBuiltInFeatures(featureGate);

      const result = featureGate.checkFeature(BuiltInFeatures.PRIORITY_SUPPORT);
      expect(result.enabled).toBe(true);
    });
  });
});
