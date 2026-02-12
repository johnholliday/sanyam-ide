/**
 * Pagination Middleware & Utilities
 *
 * Request/response helpers for cursor-based pagination.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Context } from 'hono';
import {
  type PaginationParams,
  type PaginationMeta,
  type PaginatedResponse,
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  encodeCursor,
  decodeCursor,
} from '@sanyam/types';
import type { HonoEnv } from '../types.js';
import { ApiErrors } from './error-handler.js';

/**
 * Zod schema for pagination query parameters.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGINATION_LIMIT)
    .default(DEFAULT_PAGINATION_LIMIT),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).default('next'),
});

/**
 * Parsed pagination parameters with validation.
 */
export type ParsedPagination = z.infer<typeof paginationQuerySchema>;

/**
 * Parse pagination parameters from query string.
 *
 * @param c - Hono context
 * @returns Validated pagination parameters
 * @throws ApiException if cursor is invalid
 */
export function parsePagination(c: Context<HonoEnv>): ParsedPagination {
  const query = c.req.query();
  const result = paginationQuerySchema.safeParse(query);

  if (!result.success) {
    ApiErrors.validationError('Invalid pagination parameters', {
      limit: result.error.issues
        .filter((i) => i.path[0] === 'limit')
        .map((i) => i.message)
        .join(', ') || undefined,
      cursor: result.error.issues
        .filter((i) => i.path[0] === 'cursor')
        .map((i) => i.message)
        .join(', ') || undefined,
    } as Record<string, string>);
  }

  // Validate cursor format if provided
  if (result.data.cursor) {
    const decoded = decodeCursor(result.data.cursor);
    if (!decoded) {
      ApiErrors.invalidCursor();
    }
  }

  return result.data;
}

/**
 * Decoded cursor data.
 */
export interface DecodedCursor {
  readonly updatedAt: Date;
  readonly id: string;
}

/**
 * Decode a pagination cursor.
 *
 * @param cursor - Base64-encoded cursor
 * @returns Decoded cursor data
 * @throws ApiException if cursor is invalid
 */
export function decodePaginationCursor(cursor: string): DecodedCursor {
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    ApiErrors.invalidCursor();
  }
  return decoded as DecodedCursor;
}

/**
 * Row with pagination fields.
 */
export interface PaginatableRow {
  readonly id: string;
  readonly updated_at: Date | string;
}

/**
 * Build pagination metadata from query results.
 *
 * @param rows - Query result rows
 * @param pagination - Original pagination parameters
 * @param totalCount - Total number of items (optional)
 * @returns Pagination metadata
 */
export function buildPaginationMeta<T extends PaginatableRow>(
  rows: T[],
  pagination: ParsedPagination,
  totalCount?: number
): PaginationMeta {
  const { limit, direction, cursor } = pagination;

  // If we got more rows than requested, there's another page
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Build cursors from first/last items
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (items.length > 0) {
    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;

    const firstUpdatedAt =
      firstItem.updated_at instanceof Date
        ? firstItem.updated_at
        : new Date(firstItem.updated_at);
    const lastUpdatedAt =
      lastItem.updated_at instanceof Date
        ? lastItem.updated_at
        : new Date(lastItem.updated_at);

    if (direction === 'next') {
      // Going forward
      if (hasMore) {
        nextCursor = encodeCursor(lastUpdatedAt, lastItem.id);
      }
      if (cursor) {
        // We have a cursor, so there's a previous page
        prevCursor = encodeCursor(firstUpdatedAt, firstItem.id);
      }
    } else {
      // Going backward
      if (hasMore) {
        prevCursor = encodeCursor(firstUpdatedAt, firstItem.id);
      }
      nextCursor = encodeCursor(lastUpdatedAt, lastItem.id);
    }
  }

  return {
    next_cursor: nextCursor,
    prev_cursor: prevCursor,
    total_count: totalCount ?? -1, // -1 indicates count not provided
  };
}

/**
 * Create a paginated response.
 *
 * @param items - Items to include in response
 * @param pagination - Original pagination parameters
 * @param totalCount - Optional total count
 * @returns Paginated response
 */
export function createPaginatedResponse<T extends PaginatableRow>(
  items: T[],
  pagination: ParsedPagination,
  totalCount?: number
): PaginatedResponse<T> {
  const { limit } = pagination;

  // Take only the requested number of items
  const data = items.slice(0, limit);
  const meta = buildPaginationMeta(items, pagination, totalCount);

  return {
    data,
    pagination: meta,
  };
}

/**
 * Build SQL/Supabase query conditions for cursor-based pagination.
 *
 * @param pagination - Parsed pagination parameters
 * @returns Query conditions and order
 */
export function buildPaginationQuery(pagination: ParsedPagination): {
  readonly cursorCondition: DecodedCursor | null;
  readonly orderDirection: 'asc' | 'desc';
  readonly limit: number;
} {
  const { cursor, direction, limit } = pagination;

  // Decode cursor if present
  let cursorCondition: DecodedCursor | null = null;
  if (cursor) {
    cursorCondition = decodePaginationCursor(cursor);
  }

  // Determine order direction
  // For 'next' direction, we order DESC (newest first) and use < for cursor
  // For 'prev' direction, we order ASC (oldest first) and use > for cursor
  const orderDirection = direction === 'next' ? 'desc' : 'asc';

  // Fetch one extra row to detect if there's another page
  return {
    cursorCondition,
    orderDirection,
    limit: limit + 1,
  };
}

/**
 * Apply pagination to a Supabase query builder.
 *
 * Usage:
 * ```ts
 * const pagination = parsePagination(c);
 * let query = supabase.from('documents').select('*');
 * query = applyPaginationToSupabaseQuery(query, pagination);
 * const { data } = await query;
 * return createPaginatedResponse(data, pagination);
 * ```
 *
 * @param query - Supabase query builder
 * @param pagination - Parsed pagination parameters
 * @returns Modified query builder
 */
export function applyPaginationToSupabaseQuery<T>(
  query: any,
  pagination: ParsedPagination
): any {
  const { cursorCondition, orderDirection, limit } = buildPaginationQuery(pagination);

  // Apply ordering
  query = query.order('updated_at', { ascending: orderDirection === 'asc' });
  query = query.order('id', { ascending: orderDirection === 'asc' });

  // Apply cursor condition if present
  if (cursorCondition) {
    const cursorValue = cursorCondition.updatedAt.toISOString();
    const cursorId = cursorCondition.id;

    if (pagination.direction === 'next') {
      // For next: get items older than cursor (updated_at < cursor OR same time but id < cursor)
      query = query.or(
        `updated_at.lt.${cursorValue},and(updated_at.eq.${cursorValue},id.lt.${cursorId})`
      );
    } else {
      // For prev: get items newer than cursor
      query = query.or(
        `updated_at.gt.${cursorValue},and(updated_at.eq.${cursorValue},id.gt.${cursorId})`
      );
    }
  }

  // Apply limit
  query = query.limit(limit);

  return query;
}

// Re-export types and utilities from @sanyam/types
export {
  type PaginationParams,
  type PaginationMeta,
  type PaginatedResponse,
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  encodeCursor,
  decodeCursor,
};
