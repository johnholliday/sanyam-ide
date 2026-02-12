/**
 * Version Route Schemas
 *
 * Zod validation schemas for document version API endpoints.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Document ID parameter schema.
 */
export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Version parameter schema.
 */
export const versionParamSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().positive(),
});

/**
 * List versions query schema.
 */
export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  includeExpired: z.coerce.boolean().default(false),
});

/**
 * Restore version request schema.
 */
export const restoreVersionSchema = z.object({
  createNewVersion: z.boolean().default(true),
  comment: z.string().max(500).optional(),
});

/**
 * Types for validated requests.
 */
export type DocumentIdParams = z.infer<typeof documentIdParamSchema>;
export type VersionParams = z.infer<typeof versionParamSchema>;
export type ListVersionsQuery = z.infer<typeof listVersionsQuerySchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
