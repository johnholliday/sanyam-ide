/**
 * Core types for @sanyam/test-utils
 */

/**
 * Subscription tier levels for test user creation.
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Log levels supported by the logging mock.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Supabase error structure for error injection in mocks.
 */
export interface SupabaseError {
  /** PostgreSQL or Supabase error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details (optional) */
  details?: string;
}
