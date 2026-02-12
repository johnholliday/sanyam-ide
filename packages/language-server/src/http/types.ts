/**
 * Hono Types
 *
 * Type definitions for Hono context variables.
 *
 * @packageDocumentation
 */

import type { OperationUser } from '@sanyam/types';

/**
 * Hono environment type for context variables.
 */
export interface HonoEnv {
  Variables: {
    /** Request correlation ID for tracing */
    correlationId: string;

    /** Authenticated user (if any) */
    user?: OperationUser;

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
