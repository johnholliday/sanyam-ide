/**
 * Pagination direction.
 */
export type PaginationDirection = 'next' | 'prev';

/**
 * Pagination query parameters.
 */
export interface PaginationParams {
  /**
   * Maximum number of items to return.
   * Default: 20, Max: 100
   */
  readonly limit?: number;

  /**
   * Opaque cursor for pagination.
   * Base64-encoded compound key (updated_at, id).
   */
  readonly cursor?: string;

  /**
   * Pagination direction.
   * Default: 'next'
   */
  readonly direction?: PaginationDirection;
}

/**
 * Pagination metadata in response.
 */
export interface PaginationMeta {
  /** Cursor for next page (null if no more results) */
  readonly next_cursor: string | null;

  /** Cursor for previous page (null if at beginning) */
  readonly prev_cursor: string | null;

  /** Total count of items (may be expensive for large datasets) */
  readonly total_count: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  readonly data: T[];

  /** Pagination metadata */
  readonly pagination: PaginationMeta;
}

/**
 * Default pagination limit.
 */
export const DEFAULT_PAGINATION_LIMIT = 20;

/**
 * Maximum pagination limit.
 */
export const MAX_PAGINATION_LIMIT = 100;

/**
 * Cursor encoding delimiter.
 */
export const CURSOR_DELIMITER = '|';

/**
 * Encodes a cursor from record fields.
 * @param updatedAt - Record updated_at timestamp
 * @param id - Record ID
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(updatedAt: Date, id: string): string {
  const payload = `${updatedAt.toISOString()}${CURSOR_DELIMITER}${id}`;
  return Buffer.from(payload).toString('base64');
}

/**
 * Decodes a cursor into its component fields.
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor components or null if invalid
 */
export function decodeCursor(
  cursor: string
): { updatedAt: Date; id: string } | null {
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf-8');
    const delimiterIndex = payload.indexOf(CURSOR_DELIMITER);
    if (delimiterIndex === -1) {
      return null;
    }
    const updatedAtStr = payload.slice(0, delimiterIndex);
    const id = payload.slice(delimiterIndex + 1);
    const updatedAt = new Date(updatedAtStr);
    if (isNaN(updatedAt.getTime())) {
      return null;
    }
    return { updatedAt, id };
  } catch {
    return null;
  }
}
