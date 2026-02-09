/**
 * Correlation ID Middleware
 *
 * Adds correlation IDs to all requests for tracing.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'crypto';

/**
 * Header name for correlation ID.
 */
const CORRELATION_HEADER = 'X-Correlation-ID';

/**
 * Middleware that adds correlation IDs to requests.
 *
 * If a correlation ID is provided in the request header, it's used.
 * Otherwise, a new UUID is generated.
 *
 * The correlation ID is available via `c.get('correlationId')`.
 */
export function correlationMiddleware() {
  return createMiddleware(async (c, next) => {
    // Get correlation ID from header or generate new one
    const correlationId = c.req.header(CORRELATION_HEADER) ?? randomUUID();

    // Store in context for handlers to access
    c.set('correlationId', correlationId);

    // Add to response headers
    c.header(CORRELATION_HEADER, correlationId);

    await next();
  });
}
