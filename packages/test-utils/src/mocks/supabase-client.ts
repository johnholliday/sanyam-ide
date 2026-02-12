/**
 * Mock Supabase client for unit testing.
 *
 * Provides a fluent query builder API that mimics the real Supabase client
 * while storing data in memory and supporting error injection.
 */

import type { SupabaseError } from '../types.js';

/**
 * Configuration options for creating a mock Supabase client.
 */
export interface MockSupabaseClientOptions {
  /** Initial data by table name */
  data?: Record<string, unknown[]>;
  /** Error injection by table name */
  errors?: Record<string, SupabaseError>;
}

/**
 * Recorded query operation for test assertions.
 */
export interface QueryLogEntry {
  /** Table being queried */
  table: string;
  /** Type of operation */
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  /** Applied filters */
  filters: Array<{ column: string; operator: string; value: unknown }>;
  /** Timestamp of operation */
  timestamp: number;
}

/**
 * Fluent query builder that mirrors Supabase SDK patterns.
 */
export interface MockQueryBuilder {
  select(columns?: string): MockQueryBuilder;
  insert(data: unknown): MockQueryBuilder;
  update(data: unknown): MockQueryBuilder;
  delete(): MockQueryBuilder;
  upsert(data: unknown): MockQueryBuilder;

  eq(column: string, value: unknown): MockQueryBuilder;
  neq(column: string, value: unknown): MockQueryBuilder;
  gt(column: string, value: unknown): MockQueryBuilder;
  gte(column: string, value: unknown): MockQueryBuilder;
  lt(column: string, value: unknown): MockQueryBuilder;
  lte(column: string, value: unknown): MockQueryBuilder;
  like(column: string, pattern: string): MockQueryBuilder;
  ilike(column: string, pattern: string): MockQueryBuilder;
  is(column: string, value: unknown): MockQueryBuilder;
  in(column: string, values: unknown[]): MockQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): MockQueryBuilder;
  limit(count: number): MockQueryBuilder;
  range(from: number, to: number): MockQueryBuilder;
  single(): MockQueryBuilder;
  maybeSingle(): MockQueryBuilder;

  then<T>(
    onfulfilled?: (value: { data: unknown; error: SupabaseError | null }) => T
  ): Promise<T>;
}

/**
 * Mock Supabase client interface.
 */
export interface MockSupabaseClient {
  /** Access query log for verification */
  readonly queryLog: readonly QueryLogEntry[];

  /** Start a query on a table */
  from(table: string): MockQueryBuilder;

  /** Clear all data and query log */
  reset(): void;
}

interface QueryState {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters: Array<{ column: string; operator: string; value: unknown }>;
  data: unknown | null;
  columns: string | null;
  orderBy: { column: string; ascending: boolean } | null;
  limitCount: number | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  singleMode: boolean;
  maybeSingleMode: boolean;
}

/**
 * Creates a mock Supabase client with query builder chain support.
 *
 * @param options - Configuration for initial data and error injection
 * @returns Mock client compatible with Supabase SDK patterns
 *
 * @example
 * ```typescript
 * const mockClient = createMockSupabaseClient({
 *   data: {
 *     documents: [{ id: '123', name: 'Test' }]
 *   }
 * });
 *
 * const { data, error } = await mockClient.from('documents').select('*').eq('id', '123');
 * ```
 */
export function createMockSupabaseClient(
  options: MockSupabaseClientOptions = {}
): MockSupabaseClient {
  const store: Record<string, unknown[]> = { ...options.data };
  const errors: Record<string, SupabaseError> = { ...options.errors };
  const queryLog: QueryLogEntry[] = [];

  function createQueryBuilder(table: string): MockQueryBuilder {
    const state: QueryState = {
      table,
      operation: 'select',
      filters: [],
      data: null,
      columns: null,
      orderBy: null,
      limitCount: null,
      rangeFrom: null,
      rangeTo: null,
      singleMode: false,
      maybeSingleMode: false,
    };

    const builder: MockQueryBuilder = {
      select(columns?: string) {
        state.operation = 'select';
        state.columns = columns ?? '*';
        return builder;
      },

      insert(data: unknown) {
        state.operation = 'insert';
        state.data = data;
        return builder;
      },

      update(data: unknown) {
        state.operation = 'update';
        state.data = data;
        return builder;
      },

      delete() {
        state.operation = 'delete';
        return builder;
      },

      upsert(data: unknown) {
        state.operation = 'upsert';
        state.data = data;
        return builder;
      },

      eq(column: string, value: unknown) {
        state.filters.push({ column, operator: 'eq', value });
        return builder;
      },

      neq(column: string, value: unknown) {
        state.filters.push({ column, operator: 'neq', value });
        return builder;
      },

      gt(column: string, value: unknown) {
        state.filters.push({ column, operator: 'gt', value });
        return builder;
      },

      gte(column: string, value: unknown) {
        state.filters.push({ column, operator: 'gte', value });
        return builder;
      },

      lt(column: string, value: unknown) {
        state.filters.push({ column, operator: 'lt', value });
        return builder;
      },

      lte(column: string, value: unknown) {
        state.filters.push({ column, operator: 'lte', value });
        return builder;
      },

      like(column: string, pattern: string) {
        state.filters.push({ column, operator: 'like', value: pattern });
        return builder;
      },

      ilike(column: string, pattern: string) {
        state.filters.push({ column, operator: 'ilike', value: pattern });
        return builder;
      },

      is(column: string, value: unknown) {
        state.filters.push({ column, operator: 'is', value });
        return builder;
      },

      in(column: string, values: unknown[]) {
        state.filters.push({ column, operator: 'in', value: values });
        return builder;
      },

      order(column: string, options?: { ascending?: boolean }) {
        state.orderBy = { column, ascending: options?.ascending ?? true };
        return builder;
      },

      limit(count: number) {
        state.limitCount = count;
        return builder;
      },

      range(from: number, to: number) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return builder;
      },

      single() {
        state.singleMode = true;
        return builder;
      },

      maybeSingle() {
        state.maybeSingleMode = true;
        return builder;
      },

      then<T>(
        onfulfilled?: (value: { data: unknown; error: SupabaseError | null }) => T
      ): Promise<T> {
        // Log the query
        queryLog.push({
          table: state.table,
          operation: state.operation,
          filters: [...state.filters],
          timestamp: Date.now(),
        });

        // Check for error injection
        const tableError = errors[state.table];
        if (tableError) {
          const result = { data: null, error: tableError };
          return Promise.resolve(onfulfilled ? onfulfilled(result) : (result as T));
        }

        // Execute the operation
        let result: { data: unknown; error: SupabaseError | null };

        switch (state.operation) {
          case 'select':
            result = executeSelect(state, store);
            break;
          case 'insert':
            result = executeInsert(state, store);
            break;
          case 'update':
            result = executeUpdate(state, store);
            break;
          case 'delete':
            result = executeDelete(state, store);
            break;
          case 'upsert':
            result = executeUpsert(state, store);
            break;
          default:
            result = { data: null, error: null };
        }

        return Promise.resolve(onfulfilled ? onfulfilled(result) : (result as T));
      },
    };

    return builder;
  }

  return {
    get queryLog(): readonly QueryLogEntry[] {
      return queryLog;
    },

    from(table: string): MockQueryBuilder {
      return createQueryBuilder(table);
    },

    reset(): void {
      // Clear all data
      for (const key of Object.keys(store)) {
        delete store[key];
      }
      // Restore initial data
      if (options.data) {
        Object.assign(store, JSON.parse(JSON.stringify(options.data)));
      }
      // Clear query log
      queryLog.length = 0;
    },
  };
}

/**
 * Creates a mock Supabase client that rejects all operations with network error.
 * Used for testing graceful degradation and offline scenarios.
 *
 * @returns Mock client that always returns network error
 */
export function createMockSupabaseClientOffline(): MockSupabaseClient {
  const networkError: SupabaseError = {
    code: 'NETWORK_ERROR',
    message: 'Network error: Unable to connect to server',
  };

  const queryLog: QueryLogEntry[] = [];

  // Create a query builder that always returns network error
  function createOfflineQueryBuilder(table: string): MockQueryBuilder {
    const builder: MockQueryBuilder = {
      select() { return builder; },
      insert() { return builder; },
      update() { return builder; },
      delete() { return builder; },
      upsert() { return builder; },
      eq() { return builder; },
      neq() { return builder; },
      gt() { return builder; },
      gte() { return builder; },
      lt() { return builder; },
      lte() { return builder; },
      like() { return builder; },
      ilike() { return builder; },
      is() { return builder; },
      in() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      range() { return builder; },
      single() { return builder; },
      maybeSingle() { return builder; },

      then<T>(
        onfulfilled?: (value: { data: unknown; error: SupabaseError | null }) => T
      ): Promise<T> {
        queryLog.push({
          table,
          operation: 'select',
          filters: [],
          timestamp: Date.now(),
        });

        const result = { data: null, error: networkError };
        return Promise.resolve(onfulfilled ? onfulfilled(result) : (result as T));
      },
    };

    return builder;
  }

  return {
    get queryLog(): readonly QueryLogEntry[] {
      return queryLog;
    },

    from(table: string): MockQueryBuilder {
      return createOfflineQueryBuilder(table);
    },

    reset(): void {
      queryLog.length = 0;
    },
  };
}

// Helper functions for query execution

function executeSelect(
  state: QueryState,
  store: Record<string, unknown[]>
): { data: unknown; error: SupabaseError | null } {
  let data = store[state.table] ?? [];

  // Apply filters
  data = applyFilters(data as Record<string, unknown>[], state.filters);

  // Apply ordering
  if (state.orderBy) {
    const { column, ascending } = state.orderBy;
    data = [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[column];
      const bVal = (b as Record<string, unknown>)[column];
      if (aVal === bVal) return 0;
      // Handle null/undefined values - push them to the end
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      // Compare as strings for consistent ordering
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr < bStr ? -1 : 1;
      return ascending ? cmp : -cmp;
    });
  }

  // Apply range/limit
  if (state.rangeFrom !== null && state.rangeTo !== null) {
    data = data.slice(state.rangeFrom, state.rangeTo + 1);
  } else if (state.limitCount !== null) {
    data = data.slice(0, state.limitCount);
  }

  // Handle single/maybeSingle
  if (state.singleMode) {
    if (data.length === 0) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      };
    }
    if (data.length > 1) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'Multiple rows returned' },
      };
    }
    return { data: data[0], error: null };
  }

  if (state.maybeSingleMode) {
    if (data.length === 0) {
      return { data: null, error: null };
    }
    if (data.length > 1) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'Multiple rows returned' },
      };
    }
    return { data: data[0], error: null };
  }

  return { data, error: null };
}

function executeInsert(
  state: QueryState,
  store: Record<string, unknown[]>
): { data: unknown; error: SupabaseError | null } {
  if (!store[state.table]) {
    store[state.table] = [];
  }

  const rows = Array.isArray(state.data) ? state.data : [state.data];
  const inserted = rows.map((row) => ({
    ...(row as Record<string, unknown>),
    id: (row as Record<string, unknown>)['id'] ?? crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  store[state.table]?.push(...inserted);
  return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
}

function executeUpdate(
  state: QueryState,
  store: Record<string, unknown[]>
): { data: unknown; error: SupabaseError | null } {
  if (!store[state.table]) {
    return { data: [], error: null };
  }

  const matching = applyFilters(
    store[state.table] as Record<string, unknown>[],
    state.filters
  );

  for (const item of matching) {
    Object.assign(item, state.data, { updated_at: new Date().toISOString() });
  }

  return { data: matching, error: null };
}

function executeDelete(
  state: QueryState,
  store: Record<string, unknown[]>
): { data: unknown; error: SupabaseError | null } {
  if (!store[state.table]) {
    return { data: [], error: null };
  }

  const beforeCount = store[state.table]?.length ?? 0;
  const matching = applyFilters(
    store[state.table] as Record<string, unknown>[],
    state.filters
  );

  store[state.table] = (store[state.table] ?? []).filter(
    (item) => !matching.includes(item as Record<string, unknown>)
  );

  const deleted = beforeCount - (store[state.table]?.length ?? 0);
  return { data: { count: deleted }, error: null };
}

function executeUpsert(
  state: QueryState,
  store: Record<string, unknown[]>
): { data: unknown; error: SupabaseError | null } {
  if (!store[state.table]) {
    store[state.table] = [];
  }

  const rows = Array.isArray(state.data) ? state.data : [state.data];
  const results: unknown[] = [];

  for (const row of rows) {
    const rowData = row as Record<string, unknown>;
    const existingIndex = store[state.table]?.findIndex(
      (item) => (item as Record<string, unknown>)['id'] === rowData['id']
    );

    if (existingIndex !== undefined && existingIndex >= 0) {
      // Update existing
      const existing = store[state.table]?.[existingIndex] as Record<string, unknown>;
      Object.assign(existing, rowData, { updated_at: new Date().toISOString() });
      results.push(existing);
    } else {
      // Insert new
      const newRow = {
        ...rowData,
        id: rowData['id'] ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store[state.table]?.push(newRow);
      results.push(newRow);
    }
  }

  return { data: results.length === 1 ? results[0] : results, error: null };
}

function applyFilters(
  data: Record<string, unknown>[],
  filters: Array<{ column: string; operator: string; value: unknown }>
): Record<string, unknown>[] {
  return data.filter((item) => {
    return filters.every((filter) => {
      const itemValue = item[filter.column];

      switch (filter.operator) {
        case 'eq':
          return itemValue === filter.value;
        case 'neq':
          return itemValue !== filter.value;
        case 'gt':
          return itemValue !== undefined && itemValue !== null &&
            (typeof itemValue === 'number' ? itemValue > (filter.value as number) : String(itemValue) > String(filter.value));
        case 'gte':
          return itemValue !== undefined && itemValue !== null &&
            (typeof itemValue === 'number' ? itemValue >= (filter.value as number) : String(itemValue) >= String(filter.value));
        case 'lt':
          return itemValue !== undefined && itemValue !== null &&
            (typeof itemValue === 'number' ? itemValue < (filter.value as number) : String(itemValue) < String(filter.value));
        case 'lte':
          return itemValue !== undefined && itemValue !== null &&
            (typeof itemValue === 'number' ? itemValue <= (filter.value as number) : String(itemValue) <= String(filter.value));
        case 'like':
          return (
            typeof itemValue === 'string' &&
            new RegExp(
              (filter.value as string).replace(/%/g, '.*').replace(/_/g, '.')
            ).test(itemValue)
          );
        case 'ilike':
          return (
            typeof itemValue === 'string' &&
            new RegExp(
              (filter.value as string).replace(/%/g, '.*').replace(/_/g, '.'),
              'i'
            ).test(itemValue)
          );
        case 'is':
          return itemValue === filter.value;
        case 'in':
          return (filter.value as unknown[]).includes(itemValue);
        default:
          return true;
      }
    });
  });
}
