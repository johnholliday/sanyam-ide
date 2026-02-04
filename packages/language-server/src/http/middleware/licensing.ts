/**
 * Licensing Middleware
 *
 * Per-operation license checks based on operation requirements.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import type { OperationUser } from '@sanyam/types';
import type { OperationRegistry } from '../../operations/operation-registry.js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';

const logger = createLogger({ name: 'LicensingMiddleware' });

/**
 * Tier hierarchy for license checks.
 * Higher index = more permissions.
 */
const TIER_HIERARCHY = ['free', 'pro', 'enterprise'];

/**
 * Create licensing middleware.
 *
 * Checks operation licensing requirements against user tier.
 *
 * @param registry - Operation registry
 * @returns Hono middleware
 */
export function licensingMiddleware(registry: OperationRegistry) {
  return createMiddleware<HonoEnv>(async (c, next): Promise<void | Response> => {
    // Only check operation routes
    const match = c.req.path.match(/^\/api\/v1\/([^/]+)\/operations\/([^/]+)$/);
    if (!match) {
      await next();
      return;
    }

    const languageId = match[1];
    const operationId = match[2];

    if (!languageId || !operationId) {
      await next();
      return;
    }

    // Get operation from registry
    const operation = registry.getOperation(languageId, operationId);
    if (!operation) {
      // Let the route handler return 404
      await next();
      return;
    }

    const licensing = operation.declaration.licensing;
    if (!licensing) {
      // No licensing requirements
      await next();
      return;
    }

    const user = c.get('user');
    const correlationId = c.get('correlationId') ?? 'unknown';

    // Check authentication requirement
    if (licensing.requiresAuth && !user) {
      logger.warn(
        { correlationId, languageId, operationId },
        'Unauthenticated request to auth-required operation'
      );
      return c.json({
        success: false,
        error: 'Authentication required for this operation',
        correlationId,
      }, 401);
    }

    // Check tier requirement
    if (licensing.tier && user) {
      if (!hasRequiredTier(user.tier, licensing.tier)) {
        logger.warn(
          { correlationId, languageId, operationId, userTier: user.tier, requiredTier: licensing.tier },
          'User lacks required tier'
        );
        return c.json({
          success: false,
          error: `This operation requires ${licensing.tier} tier or higher (your tier: ${user.tier})`,
          correlationId,
        }, 403);
      }
    }

    await next();
  });
}

/**
 * Check if user tier meets the required tier.
 *
 * @param userTier - User's tier
 * @param requiredTier - Required tier
 * @returns True if user has access
 */
function hasRequiredTier(userTier: string, requiredTier: string): boolean {
  const userIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);

  // Unknown tiers - only allow if exact match
  if (userIndex === -1 || requiredIndex === -1) {
    return userTier === requiredTier;
  }

  // User tier must be >= required tier
  return userIndex >= requiredIndex;
}

/**
 * Get all tiers that satisfy a required tier.
 *
 * @param requiredTier - Required tier
 * @returns Array of tiers that have access
 */
export function getTiersWithAccess(requiredTier: string): string[] {
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
  if (requiredIndex === -1) {
    return [requiredTier];
  }
  return TIER_HIERARCHY.slice(requiredIndex);
}
