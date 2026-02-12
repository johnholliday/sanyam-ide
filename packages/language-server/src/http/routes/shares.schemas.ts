/**
 * Share Route Schemas
 *
 * Zod validation schemas for document sharing API endpoints.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Share permission levels.
 */
export const sharePermissionSchema = z.enum(['view', 'edit', 'admin']);

/**
 * Create share request schema.
 */
export const createShareSchema = z.object({
  email: z.string().email('Invalid email address'),
  permission: sharePermissionSchema.default('view'),
  message: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Update share request schema.
 */
export const updateShareSchema = z.object({
  permission: sharePermissionSchema.optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine(
  (data) => data.permission !== undefined || data.expiresAt !== undefined,
  { message: 'At least one field must be provided' }
);

/**
 * Document ID parameter schema.
 */
export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Share ID parameter schema.
 */
export const shareIdParamSchema = z.object({
  id: z.string().uuid(),
  shareId: z.string().uuid(),
});

/**
 * List shares query schema.
 */
export const listSharesQuerySchema = z.object({
  includeExpired: z.coerce.boolean().default(false),
});

/**
 * Types for validated requests.
 */
export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;
export type SharePermission = z.infer<typeof sharePermissionSchema>;
export type DocumentIdParams = z.infer<typeof documentIdParamSchema>;
export type ShareIdParams = z.infer<typeof shareIdParamSchema>;
export type ListSharesQuery = z.infer<typeof listSharesQuerySchema>;
