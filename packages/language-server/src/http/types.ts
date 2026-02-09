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
    correlationId: string;
    user?: OperationUser;
  };
}
