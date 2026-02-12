/**
 * Feature Gate
 *
 * Dynamic feature gating based on subscription tier and feature registrations.
 *
 * @packageDocumentation
 */

import { injectable, inject, multiInject, optional, postConstruct } from 'inversify';
import type { TierLimits, SubscriptionTier, FeatureRegistration } from '@sanyam/types';
import { FeatureContribution } from '@sanyam/types';
import { LicenseValidator, type LicenseValidator as LicenseValidatorType } from './license-validator.js';

/**
 * DI token for FeatureGate.
 */
export const FeatureGate = Symbol('FeatureGate');

/**
 * Feature check result.
 */
export interface FeatureCheckResult {
  /** Whether feature is enabled */
  readonly enabled: boolean;

  /** Required tier for feature (if disabled due to tier) */
  readonly requiredTier?: SubscriptionTier;

  /** Current user tier */
  readonly currentTier: SubscriptionTier;

  /** Reason feature is disabled */
  readonly reason?: string;
}

/**
 * Interface for feature gate.
 */
export interface FeatureGate {
  /**
   * Check if a feature is enabled for current user.
   *
   * @param featureId - Feature identifier
   * @returns Feature check result
   */
  checkFeature(featureId: string): FeatureCheckResult;

  /**
   * Check if a feature is enabled (simple boolean).
   *
   * @param featureId - Feature identifier
   * @returns True if feature is enabled
   */
  isFeatureEnabled(featureId: string): boolean;

  /**
   * Get current tier limits.
   *
   * @returns Current tier limits
   */
  getTierLimits(): TierLimits;

  /**
   * Get all registered features.
   *
   * @returns Map of feature IDs to registrations
   */
  getRegisteredFeatures(): Map<string, FeatureRegistration>;

  /**
   * Register a feature dynamically.
   *
   * @param registration - Feature registration
   */
  registerFeature(registration: FeatureRegistration): void;

  /**
   * Check if user has required tier.
   *
   * @param requiredTier - Required tier
   * @returns True if user has required tier
   */
  hasTier(requiredTier: SubscriptionTier): boolean;
}

/**
 * Tier hierarchy for comparisons.
 */
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'pro', 'enterprise'];

/**
 * Default implementation of FeatureGate.
 */
@injectable()
export class FeatureGateImpl implements FeatureGate {
  private readonly features = new Map<string, FeatureRegistration>();

  @inject(LicenseValidator)
  private readonly licenseValidator!: LicenseValidatorType;

  @multiInject(FeatureContribution) @optional()
  private readonly contributions?: FeatureContribution[];

  @postConstruct()
  protected init(): void {
    // Register features from contributions
    if (this.contributions) {
      for (const contribution of this.contributions) {
        this.registerFeature(contribution.getFeatureRegistration());
      }
    }
  }

  checkFeature(featureId: string): FeatureCheckResult {
    const registration = this.features.get(featureId);
    const currentTier = this.licenseValidator.currentTier;

    if (!registration) {
      // Unknown feature - allow by default (or could be configured to deny)
      return {
        enabled: true,
        currentTier,
      };
    }

    // Check tier requirement
    if (registration.requiredTier) {
      if (!this.hasTier(registration.requiredTier)) {
        return {
          enabled: false,
          requiredTier: registration.requiredTier,
          currentTier,
          reason: `This feature requires ${registration.requiredTier} tier or higher`,
        };
      }
    }

    // Check custom enabled function
    if (registration.isEnabled) {
      const limits = this.getTierLimits();
      if (!registration.isEnabled(currentTier, limits)) {
        return {
          enabled: false,
          currentTier,
          reason: registration.disabledMessage ?? 'Feature is not available for your subscription',
        };
      }
    }

    return {
      enabled: true,
      currentTier,
    };
  }

  isFeatureEnabled(featureId: string): boolean {
    return this.checkFeature(featureId).enabled;
  }

  getTierLimits(): TierLimits {
    return this.licenseValidator.currentLimits;
  }

  getRegisteredFeatures(): Map<string, FeatureRegistration> {
    return new Map(this.features);
  }

  registerFeature(registration: FeatureRegistration): void {
    this.features.set(registration.id, registration);
  }

  hasTier(requiredTier: SubscriptionTier): boolean {
    return this.licenseValidator.hasTier(requiredTier);
  }
}

/**
 * Built-in feature IDs.
 */
export const BuiltInFeatures = {
  /** Cloud document storage */
  CLOUD_STORAGE: 'cloud.storage',

  /** Document sharing */
  DOCUMENT_SHARING: 'cloud.sharing',

  /** Version history access */
  VERSION_HISTORY: 'cloud.versionHistory',

  /** Restore deleted documents */
  RESTORE_DOCUMENTS: 'cloud.restoreDocuments',

  /** API key management */
  API_KEYS: 'cloud.apiKeys',

  /** Offline mode */
  OFFLINE_MODE: 'cloud.offlineMode',

  /** Priority support */
  PRIORITY_SUPPORT: 'cloud.prioritySupport',
} as const;

/**
 * Built-in feature registrations.
 */
export const BUILT_IN_FEATURE_REGISTRATIONS: FeatureRegistration[] = [
  {
    id: BuiltInFeatures.CLOUD_STORAGE,
    name: 'Cloud Storage',
    description: 'Store documents in the cloud',
    requiredTier: 'free',
  },
  {
    id: BuiltInFeatures.DOCUMENT_SHARING,
    name: 'Document Sharing',
    description: 'Share documents with collaborators',
    requiredTier: 'pro',
    disabledMessage: 'Document sharing requires a Pro subscription',
  },
  {
    id: BuiltInFeatures.VERSION_HISTORY,
    name: 'Version History',
    description: 'Access document version history',
    requiredTier: 'free',
    isEnabled: (tier, limits) => limits.version_retention_days > 0,
    disabledMessage: 'Version history not available for your tier',
  },
  {
    id: BuiltInFeatures.RESTORE_DOCUMENTS,
    name: 'Restore Documents',
    description: 'Restore deleted documents',
    requiredTier: 'pro',
    disabledMessage: 'Restoring deleted documents requires a Pro subscription',
  },
  {
    id: BuiltInFeatures.API_KEYS,
    name: 'API Keys',
    description: 'Create API keys for programmatic access',
    requiredTier: 'pro',
    disabledMessage: 'API key management requires a Pro subscription',
  },
  {
    id: BuiltInFeatures.OFFLINE_MODE,
    name: 'Offline Mode',
    description: 'Work offline with local caching',
    requiredTier: 'pro',
    isEnabled: (tier, limits) => limits.offline_access,
    disabledMessage: 'Offline mode requires a Pro subscription',
  },
  {
    id: BuiltInFeatures.PRIORITY_SUPPORT,
    name: 'Priority Support',
    description: 'Access to priority support channels',
    requiredTier: 'enterprise',
    isEnabled: (tier, limits) => limits.priority_support,
    disabledMessage: 'Priority support requires an Enterprise subscription',
  },
];

/**
 * Register built-in features with a feature gate.
 *
 * @param featureGate - Feature gate to register with
 */
export function registerBuiltInFeatures(featureGate: FeatureGate): void {
  for (const registration of BUILT_IN_FEATURE_REGISTRATIONS) {
    featureGate.registerFeature(registration);
  }
}
