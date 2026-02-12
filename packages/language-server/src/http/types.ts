/**
 * Hono Types
 *
 * Type definitions for Hono context variables.
 *
 * @packageDocumentation
 */

import type { OperationUser } from '@sanyam/types';
import type { ApiScope } from './routes/api-keys.schemas.js';

/**
 * API key context for authenticated requests.
 */
export interface ApiKeyContext {
  /** API key ID */
  id: string;
  /** User ID who owns the key */
  userId: string;
  /** Granted scopes */
  scopes: ApiScope[];
  /** Key name */
  name: string;
}

/**
 * Hono environment type for context variables.
 */
export interface HonoEnv {
  Variables: {
    /** Request correlation ID for tracing */
    correlationId: string;

    /** Authenticated user (if any) */
    user?: OperationUser;

    /** API key context (if authenticated via API key) */
    apiKey?: ApiKeyContext;

    /** Validated JSON body from validateJson middleware */
    validatedJson?: unknown;

    /** Validated query parameters from validateQuery middleware */
    validatedQuery?: unknown;

    /** Validated path parameters from validateParam middleware */
    validatedParam?: unknown;

    /** Validated headers from validateHeader middleware */
    validatedHeader?: unknown;
  };
}
