/**
 * Zod Validation Middleware
 *
 * Type-safe request validation using Zod schemas.
 *
 * @packageDocumentation
 */

import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { z, ZodError, ZodSchema } from 'zod';
import type { HonoEnv } from '../types.js';
import { ApiErrors } from './error-handler.js';

/**
 * Validation target: where to find the data to validate.
 */
export type ValidationTarget = 'json' | 'query' | 'param' | 'header';

/**
 * Validated data stored in context.
 */
declare module 'hono' {
  interface ContextVariableMap {
    validatedJson: unknown;
    validatedQuery: unknown;
    validatedParam: unknown;
    validatedHeader: unknown;
  }
}

/**
 * Format Zod errors into a user-friendly record.
 *
 * @param error - Zod validation error
 * @returns Record of field paths to error messages
 */
function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    errors[path] = issue.message;
  }

  return errors;
}

/**
 * Create validation middleware for request body (JSON).
 *
 * @param schema - Zod schema for validation
 * @returns Hono middleware
 *
 * @example
 * ```ts
 * const schema = z.object({ name: z.string(), count: z.number() });
 * app.post('/items', validateJson(schema), async (c) => {
 *   const data = c.get('validatedJson') as z.infer<typeof schema>;
 *   // data is type-safe
 * });
 * ```
 */
export function validateJson<T extends ZodSchema>(schema: T) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      ApiErrors.validationError('Invalid JSON body');
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      ApiErrors.validationError('Validation failed', errors);
    }

    c.set('validatedJson', result.data);
    await next();
  });
}

/**
 * Create validation middleware for query parameters.
 *
 * @param schema - Zod schema for validation
 * @returns Hono middleware
 *
 * @example
 * ```ts
 * const schema = z.object({ page: z.coerce.number().default(1) });
 * app.get('/items', validateQuery(schema), async (c) => {
 *   const query = c.get('validatedQuery') as z.infer<typeof schema>;
 * });
 * ```
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      ApiErrors.validationError('Invalid query parameters', errors);
    }

    c.set('validatedQuery', result.data);
    await next();
  });
}

/**
 * Create validation middleware for path parameters.
 *
 * @param schema - Zod schema for validation
 * @returns Hono middleware
 *
 * @example
 * ```ts
 * const schema = z.object({ id: z.string().uuid() });
 * app.get('/items/:id', validateParam(schema), async (c) => {
 *   const params = c.get('validatedParam') as z.infer<typeof schema>;
 * });
 * ```
 */
export function validateParam<T extends ZodSchema>(schema: T) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      ApiErrors.validationError('Invalid path parameters', errors);
    }

    c.set('validatedParam', result.data);
    await next();
  });
}

/**
 * Create validation middleware for headers.
 *
 * @param schema - Zod schema for validation
 * @returns Hono middleware
 *
 * @example
 * ```ts
 * const schema = z.object({ 'x-api-version': z.string() });
 * app.get('/items', validateHeader(schema), async (c) => {
 *   const headers = c.get('validatedHeader') as z.infer<typeof schema>;
 * });
 * ```
 */
export function validateHeader<T extends ZodSchema>(schema: T) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    // Convert headers to plain object
    const headerObj: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headerObj[key.toLowerCase()] = value;
    });

    const result = schema.safeParse(headerObj);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      ApiErrors.validationError('Invalid headers', errors);
    }

    c.set('validatedHeader', result.data);
    await next();
  });
}

/**
 * Type helper to extract validated data type from schema.
 */
export type ValidatedData<T extends ZodSchema> = z.infer<T>;

/**
 * Helper to get validated JSON from context with proper typing.
 *
 * @param c - Hono context
 * @returns Validated data
 */
export function getValidatedJson<T>(c: Context<HonoEnv>): T {
  return c.get('validatedJson') as T;
}

/**
 * Helper to get validated query from context with proper typing.
 *
 * @param c - Hono context
 * @returns Validated data
 */
export function getValidatedQuery<T>(c: Context<HonoEnv>): T {
  return c.get('validatedQuery') as T;
}

/**
 * Helper to get validated params from context with proper typing.
 *
 * @param c - Hono context
 * @returns Validated data
 */
export function getValidatedParam<T>(c: Context<HonoEnv>): T {
  return c.get('validatedParam') as T;
}

/**
 * Helper to get validated headers from context with proper typing.
 *
 * @param c - Hono context
 * @returns Validated data
 */
export function getValidatedHeader<T>(c: Context<HonoEnv>): T {
  return c.get('validatedHeader') as T;
}
