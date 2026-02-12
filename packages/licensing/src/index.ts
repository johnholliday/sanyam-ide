/**
 * @sanyam/licensing
 *
 * Feature gating and subscription tier management for Sanyam IDE.
 *
 * @packageDocumentation
 */

// License validator
export {
  LicenseValidator,
  LicenseValidatorImpl,
  AuthStateProvider,
  createLicenseValidator,
  DEFAULT_LICENSE_CACHE_CONFIG,
  type LicenseValidator as LicenseValidatorType,
  type AuthStateProvider as AuthStateProviderType,
  type TierLimitsFetcher,
  type LicenseValidationResult,
  type LicenseCacheConfig,
} from './license-validator.js';

// Feature gate
export {
  FeatureGate,
  FeatureGateImpl,
  registerBuiltInFeatures,
  BuiltInFeatures,
  BUILT_IN_FEATURE_REGISTRATIONS,
  type FeatureGate as FeatureGateType,
  type FeatureCheckResult,
} from './feature-gate.js';

// DI module
export { createLicensingModule } from './licensing-module.js';

// Re-export types from @sanyam/types
export type {
  TierLimits,
  SubscriptionTier,
  FeatureRegistration,
} from '@sanyam/types';

export { FeatureContribution, DEFAULT_FREE_TIER_LIMITS } from '@sanyam/types';
