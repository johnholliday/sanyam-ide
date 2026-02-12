/**
 * Factory functions for creating test user profile data.
 */

import type { SubscriptionTier } from '../types.js';

/**
 * User profile entity structure.
 */
export interface UserProfile {
  /** Supabase auth user ID */
  user_id: string;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** Organization ID (null for individual users) */
  organization_id: string | null;
  /** Total storage usage in bytes */
  total_storage_bytes: number;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Builds a UserProfile with sensible defaults.
 *
 * @param overrides - Partial values to override defaults
 * @returns UserProfile
 *
 * @example
 * ```typescript
 * const profile = buildUserProfile({ tier: 'pro', total_storage_bytes: 1024 * 1024 });
 * ```
 */
export function buildUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  const now = new Date().toISOString();

  return {
    user_id: crypto.randomUUID(),
    tier: 'free',
    organization_id: null,
    total_storage_bytes: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
