/**
 * Unit tests for Tier Downgrade Policy
 *
 * Tests that verify graceful degradation when user tier is downgraded.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TierLimits, SubscriptionTier, FeatureRegistration } from '@sanyam/types';
import {
  FeatureGateImpl,
  registerBuiltInFeatures,
  BuiltInFeatures,
} from '../../src/feature-gate.js';
import { LicenseValidatorImpl } from '../../src/license-validator.js';

function createMockLimits(tier: SubscriptionTier, overrides: Partial<TierLimits> = {}): TierLimits {
  const defaults: Record<SubscriptionTier, TierLimits> = {
    free: {
      tier: 'free',
      max_documents: 10,
      max_storage_bytes: 50 * 1024 * 1024,
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
      max_storage_bytes: 500 * 1024 * 1024,
      max_collaborators: 10,
      max_api_keys: 5,
      max_versions_per_doc: 50,
      version_retention_days: 30,
      offline_access: true,
      priority_support: false,
    },
    enterprise: {
      tier: 'enterprise',
      max_documents: -1,
      max_storage_bytes: -1,
      max_collaborators: -1,
      max_api_keys: -1,
      max_versions_per_doc: -1,
      version_retention_days: -1,
      offline_access: true,
      priority_support: true,
    },
  };
  return { ...defaults[tier], ...overrides };
}

function createMockLicenseValidator(tier: SubscriptionTier, limits?: TierLimits): LicenseValidatorImpl {
  const validator = new LicenseValidatorImpl();
  const actualLimits = limits ?? createMockLimits(tier);
  (validator as any).cachedTier = tier;
  (validator as any).cachedLimits = actualLimits;
  return validator;
}

describe('Tier Downgrade Policy', () => {
  describe('Pro to Free downgrade', () => {
    it('should lose document sharing access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);

      // Downgrade to Free
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(false);
    });

    it('should lose API key management access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(true);

      // Downgrade to Free
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(false);
    });

    it('should lose offline mode access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.OFFLINE_MODE)).toBe(true);

      // Downgrade to Free
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.OFFLINE_MODE)).toBe(false);
    });

    it('should lose restore documents access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.RESTORE_DOCUMENTS)).toBe(true);

      // Downgrade to Free
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.RESTORE_DOCUMENTS)).toBe(false);
    });

    it('should retain cloud storage access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);

      // Downgrade to Free - should still have cloud storage
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);
    });

    it('should retain version history access (with reduced retention)', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Free tier still has version history (7 days retention)
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.VERSION_HISTORY)).toBe(true);

      const limits = featureGate.getTierLimits();
      expect(limits.version_retention_days).toBe(7);
    });

    it('should reduce document limit', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      let limits = featureGate.getTierLimits();
      expect(limits.max_documents).toBe(100);

      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      limits = featureGate.getTierLimits();
      expect(limits.max_documents).toBe(10);
    });

    it('should reduce storage limit', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      let limits = featureGate.getTierLimits();
      expect(limits.max_storage_bytes).toBe(500 * 1024 * 1024);

      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      limits = featureGate.getTierLimits();
      expect(limits.max_storage_bytes).toBe(50 * 1024 * 1024);
    });
  });

  describe('Enterprise to Pro downgrade', () => {
    it('should lose priority support access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Enterprise
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.PRIORITY_SUPPORT)).toBe(true);

      // Downgrade to Pro
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.PRIORITY_SUPPORT)).toBe(false);
    });

    it('should retain document sharing access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Enterprise
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);

      // Downgrade to Pro - should still have sharing
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);
    });

    it('should retain offline mode access', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Downgrade to Pro - should still have offline mode
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.OFFLINE_MODE)).toBe(true);
    });

    it('should change from unlimited to fixed limits', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      let limits = featureGate.getTierLimits();
      expect(limits.max_documents).toBe(-1); // unlimited

      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      limits = featureGate.getTierLimits();
      expect(limits.max_documents).toBe(100); // fixed limit
    });
  });

  describe('Enterprise to Free downgrade', () => {
    it('should lose all premium features', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      // Initially Enterprise with all features
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(true);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(true);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.OFFLINE_MODE)).toBe(true);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.PRIORITY_SUPPORT)).toBe(true);

      // Downgrade directly to Free
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.DOCUMENT_SHARING)).toBe(false);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.API_KEYS)).toBe(false);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.OFFLINE_MODE)).toBe(false);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.PRIORITY_SUPPORT)).toBe(false);
    });

    it('should retain basic features', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);

      (featureGate as any).licenseValidator = createMockLicenseValidator('free');
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.CLOUD_STORAGE)).toBe(true);
      expect(featureGate.isFeatureEnabled(BuiltInFeatures.VERSION_HISTORY)).toBe(true);
    });
  });

  describe('Degradation feedback messages', () => {
    it('should provide specific message for sharing feature', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const result = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);

      expect(result.enabled).toBe(false);
      expect(result.requiredTier).toBe('pro');
      expect(result.reason).toContain('pro');
    });

    it('should provide specific message for API keys feature', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const result = featureGate.checkFeature(BuiltInFeatures.API_KEYS);

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('pro');
    });

    it('should provide specific message for priority support feature', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      const result = featureGate.checkFeature(BuiltInFeatures.PRIORITY_SUPPORT);

      expect(result.enabled).toBe(false);
      expect(result.requiredTier).toBe('enterprise');
    });

    it('should include current tier in check result', () => {
      const featureGate = new FeatureGateImpl();
      registerBuiltInFeatures(featureGate);
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      const result = featureGate.checkFeature(BuiltInFeatures.DOCUMENT_SHARING);

      expect(result.currentTier).toBe('free');
    });
  });

  describe('Custom feature downgrade behavior', () => {
    it('should allow custom isEnabled to handle downgrades gracefully', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Register feature that degrades based on limits
      featureGate.registerFeature({
        id: 'advanced.export',
        name: 'Advanced Export',
        isEnabled: (tier, limits) => limits.max_documents > 50,
        disabledMessage: 'Advanced export requires more document quota',
      });

      // Free tier has 10 docs - should be disabled
      expect(featureGate.isFeatureEnabled('advanced.export')).toBe(false);

      // Upgrade to pro with 100 docs - should be enabled
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled('advanced.export')).toBe(true);
    });

    it('should allow features to use multiple limit checks', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      // Feature requires both offline access AND multiple API keys
      featureGate.registerFeature({
        id: 'sync.feature',
        name: 'Background Sync',
        isEnabled: (tier, limits) => limits.offline_access && limits.max_api_keys >= 1,
        disabledMessage: 'Background sync requires offline access and API keys',
      });

      // Free has neither - disabled
      expect(featureGate.isFeatureEnabled('sync.feature')).toBe(false);

      // Pro has both - enabled
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');
      expect(featureGate.isFeatureEnabled('sync.feature')).toBe(true);
    });
  });

  describe('Tier validation', () => {
    it('should validate free tier has access to free features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('free');

      expect(featureGate.hasTier('free')).toBe(true);
      expect(featureGate.hasTier('pro')).toBe(false);
      expect(featureGate.hasTier('enterprise')).toBe(false);
    });

    it('should validate pro tier has access to free and pro features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('pro');

      expect(featureGate.hasTier('free')).toBe(true);
      expect(featureGate.hasTier('pro')).toBe(true);
      expect(featureGate.hasTier('enterprise')).toBe(false);
    });

    it('should validate enterprise tier has access to all features', () => {
      const featureGate = new FeatureGateImpl();
      (featureGate as any).licenseValidator = createMockLicenseValidator('enterprise');

      expect(featureGate.hasTier('free')).toBe(true);
      expect(featureGate.hasTier('pro')).toBe(true);
      expect(featureGate.hasTier('enterprise')).toBe(true);
    });
  });
});
