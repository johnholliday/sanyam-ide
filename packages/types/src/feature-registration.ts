import type { SubscriptionTier } from './tier-limits.js';

/**
 * Declares a gated feature with its required subscription tier.
 * Used by packages to register their features with the FeatureGate.
 */
export interface FeatureRegistration {
  /**
   * Unique identifier for the feature.
   * Should follow snake_case convention (e.g., 'document_sharing', 'api_keys').
   */
  readonly featureId: string;

  /**
   * Minimum subscription tier required to access this feature.
   */
  readonly requiredTier: SubscriptionTier;

  /**
   * Optional human-readable description for upgrade prompts.
   */
  readonly description?: string;
}

/**
 * Symbol for multi-binding feature contributions in Inversify.
 */
export const FeatureContribution = Symbol('FeatureContribution');

/**
 * Interface for packages to contribute their gated features.
 * Implement this and bind to FeatureContribution symbol.
 */
export interface FeatureContribution {
  /**
   * Returns all features contributed by this package.
   * @returns Array of feature registrations
   */
  getFeatures(): FeatureRegistration[];
}
