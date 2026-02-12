import type { SubscriptionTier } from './tier-limits.js';

/**
 * Extended user profile linked to Supabase Auth.
 */
export interface UserProfile {
  /** User ID (matches auth.users.id) */
  readonly id: string;

  /** User's email address */
  readonly email: string;

  /** Display name (optional) */
  readonly display_name: string | null;

  /** Avatar URL (optional) */
  readonly avatar_url: string | null;

  /** Current subscription tier */
  readonly tier: SubscriptionTier;

  /** Total storage used in bytes */
  readonly storage_used_bytes: number;

  /** Total document count */
  readonly document_count: number;

  /** Profile creation timestamp */
  readonly created_at: string;

  /** Last update timestamp */
  readonly updated_at: string;
}

/**
 * Authentication session information.
 */
export interface AuthSession {
  /** Session identifier */
  readonly id: string;

  /** Access token for API calls */
  readonly accessToken: string;

  /** Refresh token for token renewal */
  readonly refreshToken: string;

  /** Token expiration timestamp (ms since epoch) */
  readonly expiresAt: number;

  /** Authenticated user profile */
  readonly user: UserProfile;
}

/**
 * Authentication state change events.
 */
export type AuthStateEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

/**
 * Authentication state snapshot.
 */
export interface AuthState {
  /** Event type that triggered this state */
  readonly event: AuthStateEvent;

  /** Current session (null if signed out) */
  readonly session: AuthSession | null;
}
