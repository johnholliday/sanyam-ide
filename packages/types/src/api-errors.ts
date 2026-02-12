/**
 * Machine-readable error codes (SCREAMING_SNAKE_CASE).
 */
export type ApiErrorCode =
  // Authentication & Authorization
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'FEATURE_NOT_AVAILABLE'

  // Resource errors
  | 'DOCUMENT_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'SHARE_NOT_FOUND'
  | 'API_KEY_NOT_FOUND'
  | 'USER_NOT_FOUND'

  // Limit errors
  | 'TIER_LIMIT_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMIT_EXCEEDED'

  // Conflict errors
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'DUPLICATE_ENTRY'

  // Validation errors
  | 'VALIDATION_ERROR'
  | 'INVALID_CURSOR'

  // Configuration errors
  | 'CLOUD_NOT_CONFIGURED'

  // Server errors
  | 'INTERNAL_ERROR';

/**
 * Standard API error structure.
 */
export interface ApiError {
  /** Machine-readable error code */
  readonly code: ApiErrorCode;

  /** Human-readable error message */
  readonly message: string;

  /** Context-specific error details */
  readonly details?: Record<string, unknown>;
}

/**
 * Standard error response envelope.
 */
export interface ErrorResponse {
  readonly error: ApiError;
}

/**
 * Tier limit exceeded error details.
 */
export interface TierLimitDetails {
  /** Current count/usage */
  readonly current: number;

  /** Maximum allowed */
  readonly limit: number;

  /** User's current tier */
  readonly tier: string;
}

/**
 * Payload too large error details.
 */
export interface PayloadTooLargeDetails {
  /** Actual size in bytes */
  readonly size: number;

  /** Maximum allowed size in bytes */
  readonly limit: number;

  /** User's current tier */
  readonly tier: string;
}

/**
 * Optimistic lock conflict error details.
 */
export interface OptimisticLockDetails {
  /** Current version on server */
  readonly current_version: number;

  /** Version client tried to update */
  readonly your_version: number;
}

/**
 * Rate limit exceeded error details.
 */
export interface RateLimitDetails {
  /** Maximum requests per window */
  readonly limit: number;

  /** Remaining requests in current window */
  readonly remaining: number;

  /** Seconds until window resets */
  readonly reset: number;

  /** User's current tier */
  readonly tier: string;
}

/**
 * Validation error details (field-level errors).
 */
export interface ValidationErrorDetails {
  /** Field path to error message mapping */
  readonly [fieldPath: string]: string;
}

/**
 * Feature not available error details.
 */
export interface FeatureNotAvailableDetails {
  /** Feature identifier */
  readonly feature: string;

  /** Required tier for this feature */
  readonly required_tier: string;

  /** User's current tier */
  readonly your_tier: string;
}

/**
 * Creates a standard error response.
 * @param code - Error code
 * @param message - Human-readable message
 * @param details - Optional context-specific details
 * @returns Error response object
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
