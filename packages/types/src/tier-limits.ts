/**
 * Subscription tier identifiers.
 * NOTE: Unknown tier values should default to 'free' limits.
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Complete tier configuration from the tier_limits database table.
 * This interface mirrors the tier_limits table row exactly.
 */
export interface TierLimits {
  /** Subscription tier identifier */
  readonly tier: SubscriptionTier;

  // Numeric limits
  /** Maximum number of documents allowed */
  readonly max_documents: number;
  /** Maximum total storage in bytes */
  readonly max_storage_bytes: number;
  /** Maximum size per document in bytes */
  readonly max_document_size_bytes: number;
  /** Maximum versions to retain per document */
  readonly max_versions_per_document: number;
  /** Days to retain versions (-1 for unlimited) */
  readonly version_retention_days: number;
  /** Days to retain deleted documents in trash */
  readonly trash_retention_days: number;
  /** API rate limit per hour */
  readonly api_rate_limit_per_hour: number;

  // Feature flags
  /** Whether cloud storage is enabled */
  readonly has_cloud_storage: boolean;
  /** Whether cloud authentication is enabled */
  readonly has_cloud_auth: boolean;
  /** Whether document sharing is enabled */
  readonly has_document_sharing: boolean;
  /** Whether document versioning is enabled */
  readonly has_document_versioning: boolean;
  /** Whether API keys are enabled */
  readonly has_api_keys: boolean;
  /** Whether real-time collaboration is enabled */
  readonly has_realtime_collaboration: boolean;
  /** Whether Azure AD SSO is enabled */
  readonly has_azure_ad: boolean;
}

/**
 * Default free-tier limits used when tier lookup fails or is unavailable.
 */
export const DEFAULT_FREE_TIER_LIMITS: TierLimits = {
  tier: 'free',
  max_documents: 5,
  max_storage_bytes: 10485760, // 10MB
  max_document_size_bytes: 262144, // 256KB
  max_versions_per_document: 10,
  version_retention_days: 90,
  trash_retention_days: 30,
  api_rate_limit_per_hour: 100,
  has_cloud_storage: true,
  has_cloud_auth: true,
  has_document_sharing: false,
  has_document_versioning: false,
  has_api_keys: false,
  has_realtime_collaboration: false,
  has_azure_ad: false,
};
