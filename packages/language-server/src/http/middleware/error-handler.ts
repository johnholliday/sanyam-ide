/**
 * Error Handler Middleware
 *
 * Standardized error handling for REST API using @sanyam/types error format.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { ApiErrorCode, ErrorResponse } from '@sanyam/types';
import { createErrorResponse } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';

const logger = createLogger({ name: 'ErrorHandler' });

/**
 * Application error with structured error code.
 */
export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Map of error codes to HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  // Authentication & Authorization
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  FEATURE_NOT_AVAILABLE: 403,

  // Resource errors
  DOCUMENT_NOT_FOUND: 404,
  VERSION_NOT_FOUND: 404,
  SHARE_NOT_FOUND: 404,
  API_KEY_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,

  // Limit errors
  TIER_LIMIT_EXCEEDED: 403,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMIT_EXCEEDED: 429,

  // Conflict errors
  OPTIMISTIC_LOCK_CONFLICT: 409,
  DUPLICATE_ENTRY: 409,

  // Validation errors
  VALIDATION_ERROR: 400,
  INVALID_CURSOR: 400,

  // Configuration errors
  CLOUD_NOT_CONFIGURED: 503,

  // Server errors
  INTERNAL_ERROR: 500,
};

/**
 * Create an ApiException for a specific error code.
 *
 * @param code - Error code
 * @param message - Human-readable message
 * @param details - Optional error details
 * @returns ApiException
 */
export function createApiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiException {
  const statusCode = ERROR_STATUS_MAP[code] ?? 500;
  return new ApiException(code, message, statusCode, details);
}

/**
 * Send a standardized error response.
 *
 * @param c - Hono context
 * @param code - Error code
 * @param message - Human-readable message
 * @param statusCode - HTTP status code
 * @param details - Optional error details
 * @returns Response
 */
export function sendError(
  c: Context<HonoEnv>,
  code: ApiErrorCode,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
): Response {
  const status = statusCode ?? ERROR_STATUS_MAP[code] ?? 500;
  const response = createErrorResponse(code, message, details);
  return c.json(response, status as any);
}

/**
 * Error handler middleware factory.
 *
 * Catches errors and converts them to standardized error responses.
 *
 * @returns Hono middleware
 */
export function errorHandlerMiddleware() {
  return createMiddleware<HonoEnv>(async (c, next) => {
    try {
      await next();
    } catch (error) {
      const correlationId = c.get('correlationId') ?? 'unknown';

      // Handle ApiException
      if (error instanceof ApiException) {
        logger.warn(
          { correlationId, code: error.code, path: c.req.path },
          error.message
        );
        return sendError(c, error.code, error.message, error.statusCode, error.details);
      }

      // Handle generic errors
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err, correlationId, path: c.req.path }, 'Unhandled error');

      return sendError(
        c,
        'INTERNAL_ERROR',
        process.env['NODE_ENV'] === 'production'
          ? 'An internal error occurred'
          : err.message,
        500
      );
    }
  });
}

/**
 * Create convenience error throwers.
 */
export const ApiErrors = {
  unauthorized: (message = 'Authentication required'): never => {
    throw createApiError('UNAUTHORIZED', message);
  },

  forbidden: (message = 'Access denied'): never => {
    throw createApiError('FORBIDDEN', message);
  },

  notFound: (resource: string, id?: string): never => {
    const message = id ? `${resource} '${id}' not found` : `${resource} not found`;
    const code = resource.toLowerCase().includes('document')
      ? 'DOCUMENT_NOT_FOUND'
      : resource.toLowerCase().includes('version')
        ? 'VERSION_NOT_FOUND'
        : resource.toLowerCase().includes('share')
          ? 'SHARE_NOT_FOUND'
          : resource.toLowerCase().includes('api_key') || resource.toLowerCase().includes('apikey')
            ? 'API_KEY_NOT_FOUND'
            : resource.toLowerCase().includes('user')
              ? 'USER_NOT_FOUND'
              : 'DOCUMENT_NOT_FOUND';
    throw createApiError(code, message);
  },

  validationError: (message: string, details?: Record<string, string>): never => {
    throw createApiError('VALIDATION_ERROR', message, details);
  },

  tierLimitExceeded: (
    message: string,
    details: { current: number; limit: number; tier: string }
  ): never => {
    throw createApiError('TIER_LIMIT_EXCEEDED', message, details);
  },

  payloadTooLarge: (
    message: string,
    details: { size: number; limit: number; tier: string }
  ): never => {
    throw createApiError('PAYLOAD_TOO_LARGE', message, details);
  },

  rateLimitExceeded: (
    message: string,
    details: { limit: number; remaining: number; reset: number; tier: string }
  ): never => {
    throw createApiError('RATE_LIMIT_EXCEEDED', message, details);
  },

  optimisticLockConflict: (
    currentVersion: number,
    yourVersion: number
  ): never => {
    throw createApiError(
      'OPTIMISTIC_LOCK_CONFLICT',
      'Document was modified by another user',
      { current_version: currentVersion, your_version: yourVersion }
    );
  },

  duplicateEntry: (message: string): never => {
    throw createApiError('DUPLICATE_ENTRY', message);
  },

  cloudNotConfigured: (): never => {
    throw createApiError(
      'CLOUD_NOT_CONFIGURED',
      'Cloud services are not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
    );
  },

  featureNotAvailable: (
    feature: string,
    requiredTier: string,
    yourTier: string
  ): never => {
    throw createApiError(
      'FEATURE_NOT_AVAILABLE',
      `Feature '${feature}' requires ${requiredTier} tier (your tier: ${yourTier})`,
      { feature, required_tier: requiredTier, your_tier: yourTier }
    );
  },

  invalidCursor: (): never => {
    throw createApiError('INVALID_CURSOR', 'Invalid or expired pagination cursor');
  },

  internal: (message = 'An internal error occurred'): never => {
    throw createApiError('INTERNAL_ERROR', message);
  },

  quotaExceeded: (message: string): never => {
    throw createApiError('TIER_LIMIT_EXCEEDED', message);
  },

  /**
   * Service unavailable errors for connectivity issues.
   */
  serviceUnavailable: (message = 'Service temporarily unavailable'): never => {
    throw createApiError('CLOUD_NOT_CONFIGURED', message);
  },

  /**
   * Network/connectivity error.
   */
  networkError: (
    message = 'Unable to connect to cloud services. Please check your internet connection.'
  ): never => {
    throw createApiError('CLOUD_NOT_CONFIGURED', message);
  },

  /**
   * Timeout error.
   */
  timeout: (message = 'Request timed out. Please try again.'): never => {
    throw createApiError('INTERNAL_ERROR', message);
  },
} as const;
