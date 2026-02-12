/**
 * API Key Route Schemas
 *
 * Zod validation schemas for API key management endpoints.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * API scope enum values.
 */
export const API_SCOPES = ['documents:read', 'documents:write', 'documents:delete'] as const;

/**
 * API scope type.
 */
export type ApiScope = (typeof API_SCOPES)[number];

/**
 * API key ID parameter schema.
 */
export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * List API keys query schema.
 */
export const listApiKeysQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeRevoked: z.coerce.boolean().default(false),
});

/**
 * Create API key request schema.
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Update API key request schema.
 */
export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * Types for validated requests.
 */
export type ApiKeyIdParams = z.infer<typeof apiKeyIdParamSchema>;
export type ListApiKeysQuery = z.infer<typeof listApiKeysQuerySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
