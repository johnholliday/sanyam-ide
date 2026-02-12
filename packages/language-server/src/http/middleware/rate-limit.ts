/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiting with tier-based limits.
 * Uses sliding window algorithm for smooth rate enforcement.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import type { SubscriptionTier } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';
import { ApiErrors } from './error-handler.js';

const logger = createLogger({ name: 'RateLimitMiddleware' });

/**
 * Rate limit configuration per tier.
 */
export interface RateLimitTierConfig {
  /** Maximum requests per window */
  readonly limit: number;

  /** Window size in milliseconds */
  readonly windowMs: number;
}

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  /** Limits per subscription tier */
  readonly tiers: Record<SubscriptionTier, RateLimitTierConfig>;

  /** Default tier for unauthenticated requests */
  readonly defaultTier: SubscriptionTier;

  /** Key generator function (default: user ID or IP) */
  readonly keyGenerator?: (c: any) => string;

  /** Paths to skip rate limiting */
  readonly skipPaths?: string[];

  /** Whether to skip rate limiting for authenticated requests with enterprise tier */
  readonly skipEnterprise?: boolean;
}

/**
 * Rate limit entry for tracking requests.
 */
interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];

  /** Last cleanup time */
  lastCleanup: number;
}

/**
 * In-memory rate limit store.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval for expired entries (5 minutes).
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Last global cleanup time.
 */
let lastGlobalCleanup = Date.now();

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  tiers: {
    free: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
    pro: { limit: 500, windowMs: 60 * 1000 }, // 500 requests per minute
    enterprise: { limit: 2000, windowMs: 60 * 1000 }, // 2000 requests per minute
  },
  defaultTier: 'free',
  skipPaths: ['/health', '/ready', '/version'],
  skipEnterprise: false,
};

/**
 * Get client identifier from request context.
 *
 * @param c - Hono context
 * @returns Client identifier
 */
function defaultKeyGenerator(c: any): string {
  // Use user ID if authenticated
  const user = c.get('user');
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Fall back to IP address
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return `ip:${forwarded.split(',')[0]?.trim()}`;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }

  // Last resort: use a generic key
  return 'ip:unknown';
}

/**
 * Clean up old timestamps from an entry.
 *
 * @param entry - Rate limit entry
 * @param windowMs - Window size in milliseconds
 * @param now - Current timestamp
 */
function cleanupEntry(entry: RateLimitEntry, windowMs: number, now: number): void {
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
  entry.lastCleanup = now;
}

/**
 * Global cleanup of expired entries.
 */
function globalCleanup(): void {
  const now = Date.now();
  if (now - lastGlobalCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastGlobalCleanup = now;
  const maxWindowMs = 60 * 60 * 1000; // 1 hour max window

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.timestamps.length === 0 || now - entry.lastCleanup > maxWindowMs) {
      rateLimitStore.delete(key);
    }
  }

  logger.debug({ entriesRemaining: rateLimitStore.size }, 'Rate limit cleanup completed');
}

/**
 * Create rate limiting middleware.
 *
 * @param config - Rate limit configuration
 * @returns Hono middleware
 */
export function rateLimitMiddleware(config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
  const skipPaths = new Set(config.skipPaths ?? []);
  const keyGen = config.keyGenerator ?? defaultKeyGenerator;

  return createMiddleware<HonoEnv>(async (c, next) => {
    // Skip rate limiting for excluded paths
    const path = c.req.path;
    if (skipPaths.has(path)) {
      await next();
      return;
    }

    // Determine user tier
    const user = c.get('user');
    const tier = (user?.tier as SubscriptionTier) ?? config.defaultTier;

    // Skip enterprise tier if configured
    if (config.skipEnterprise && tier === 'enterprise') {
      await next();
      return;
    }

    // Get tier-specific limits
    const tierConfig = config.tiers[tier] ?? config.tiers[config.defaultTier];
    const { limit, windowMs } = tierConfig;

    // Generate key for this client
    const key = keyGen(c);
    const now = Date.now();

    // Get or create entry
    let entry = rateLimitStore.get(key);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      rateLimitStore.set(key, entry);
    }

    // Clean up old timestamps
    cleanupEntry(entry, windowMs, now);

    // Run global cleanup periodically
    globalCleanup();

    // Check rate limit
    const remaining = Math.max(0, limit - entry.timestamps.length);
    const resetTime = Math.ceil((entry.timestamps[0] ?? now) + windowMs - now) / 1000;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetTime)));

    if (entry.timestamps.length >= limit) {
      const correlationId = c.get('correlationId') ?? 'unknown';
      logger.warn(
        { correlationId, key, tier, limit, windowMs },
        'Rate limit exceeded'
      );

      // Set Retry-After header
      c.header('Retry-After', String(Math.ceil(resetTime)));

      ApiErrors.rateLimitExceeded(
        `Rate limit exceeded. Try again in ${Math.ceil(resetTime)} seconds.`,
        {
          limit,
          remaining: 0,
          reset: Math.ceil(resetTime),
          tier,
        }
      );
    }

    // Record this request
    entry.timestamps.push(now);

    await next();
  });
}

/**
 * Clear rate limit store (for testing).
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit info for a key (for testing/debugging).
 *
 * @param key - Client key
 * @returns Rate limit entry or undefined
 */
export function getRateLimitInfo(key: string): RateLimitEntry | undefined {
  return rateLimitStore.get(key);
}
