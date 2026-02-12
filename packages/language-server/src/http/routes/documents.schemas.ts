/**
 * Document Route Schemas
 *
 * Zod validation schemas for document API endpoints.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Create document request schema.
 */
export const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  languageId: z.string().min(1).max(64),
  content: z.string().max(10 * 1024 * 1024), // 10MB max
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Update document request schema.
 */
export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().max(10 * 1024 * 1024).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.name !== undefined || data.content !== undefined || data.metadata !== undefined,
  { message: 'At least one field must be provided' }
);

/**
 * Document ID parameter schema.
 */
export const documentIdSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Version number parameter schema.
 */
export const versionParamSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().positive(),
});

/**
 * List documents query schema.
 */
export const listDocumentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).default('next'),
  includeDeleted: z.coerce.boolean().default(false),
});

/**
 * Types for validated requests.
 */
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentIdParams = z.infer<typeof documentIdSchema>;
export type VersionParams = z.infer<typeof versionParamSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
