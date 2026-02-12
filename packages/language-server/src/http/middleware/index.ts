/**
 * HTTP Middleware
 *
 * Re-exports all middleware for convenient importing.
 *
 * @packageDocumentation
 */

// Authentication
export { authMiddleware, type AuthConfig, type AuthMode, createAuthConfigFromEnv } from './auth.js';

// API Key Authentication
export {
  createApiKeyAuthMiddleware,
  requireApiKey,
  isApiKeyAuth,
  getApiKeyContext,
  generateApiKey,
  hashApiKey,
  API_KEY_HEADER,
  type ApiKeyContext,
  type ApiKeyAuthDependencies,
} from './api-key-auth.js';

// Correlation ID
export { correlationMiddleware } from './correlation.js';

// CORS
export {
  corsMiddleware,
  corsMiddlewareFromEnv,
  createProductionCorsConfig,
  createDevelopmentCorsConfig,
  type CorsConfig,
  DEFAULT_CORS_CONFIG,
} from './cors.js';

// Error handling
export {
  errorHandlerMiddleware,
  ApiException,
  ApiErrors,
  createApiError,
  sendError,
} from './error-handler.js';

// Licensing
export { licensingMiddleware, getTiersWithAccess } from './licensing.js';

// Pagination
export {
  parsePagination,
  decodePaginationCursor,
  buildPaginationMeta,
  createPaginatedResponse,
  buildPaginationQuery,
  applyPaginationToSupabaseQuery,
  paginationQuerySchema,
  type ParsedPagination,
  type DecodedCursor,
  type PaginatableRow,
  // Re-exports from @sanyam/types
  type PaginationParams,
  type PaginationMeta,
  type PaginatedResponse,
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  encodeCursor,
  decodeCursor,
} from './pagination.js';

// Rate limiting
export {
  rateLimitMiddleware,
  clearRateLimitStore,
  getRateLimitInfo,
  type RateLimitConfig,
  type RateLimitTierConfig,
  DEFAULT_RATE_LIMIT_CONFIG,
} from './rate-limit.js';

// Validation
export {
  validateJson,
  validateQuery,
  validateParam,
  validateHeader,
  getValidatedJson,
  getValidatedQuery,
  getValidatedParam,
  getValidatedHeader,
  type ValidationTarget,
  type ValidatedData,
} from './validation.js';
