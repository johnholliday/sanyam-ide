/**
 * Shares API Routes
 *
 * REST endpoints for document sharing operations.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentShare, CreateShareRequest } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';
import {
  validateJson,
  validateParam,
  validateQuery,
  getValidatedJson,
  getValidatedParam,
  getValidatedQuery,
} from '../middleware/validation.js';
import { ApiErrors } from '../middleware/error-handler.js';
import {
  createShareSchema,
  updateShareSchema,
  documentIdParamSchema,
  shareIdParamSchema,
  listSharesQuerySchema,
  type CreateShareInput,
  type UpdateShareInput,
  type DocumentIdParams,
  type ShareIdParams,
  type ListSharesQuery,
} from './shares.schemas.js';

const logger = createLogger({ name: 'SharesRoutes' });

/**
 * Dependencies for share routes.
 */
export interface ShareRouteDependencies {
  /** Function to create user-scoped Supabase client */
  createClient: (accessToken: string) => SupabaseClient;
}

/**
 * Create share routes.
 *
 * @param deps - Route dependencies
 * @returns Hono app with share routes
 */
export function createShareRoutes(deps: ShareRouteDependencies): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  /**
   * GET /documents/:id/shares - List document shares
   */
  app.get(
    '/:id/shares',
    validateParam(documentIdParamSchema),
    validateQuery(listSharesQuerySchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const query = getValidatedQuery<ListSharesQuery>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user has access to document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id, owner_id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        // Only owner can list shares
        if (doc.owner_id !== user.id) {
          return ApiErrors.forbidden('Only document owner can view shares');
        }

        // List shares
        let sharesQuery = client
          .from('document_shares')
          .select('*')
          .eq('document_id', params.id)
          .order('created_at', { ascending: false });

        if (!query.includeExpired) {
          sharesQuery = sharesQuery.or('expires_at.is.null,expires_at.gt.now()');
        }

        const { data: shares, error: sharesError } = await sharesQuery;

        if (sharesError) {
          logger.error({ err: sharesError }, 'Failed to list shares');
          return ApiErrors.internal(sharesError.message);
        }

        return c.json(shares as DocumentShare[]);
      } catch (err) {
        logger.error({ err }, 'Error listing shares');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * POST /documents/:id/shares - Create a new share (Pro+ only)
   */
  app.post(
    '/:id/shares',
    validateParam(documentIdParamSchema),
    validateJson(createShareSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      // Check tier - sharing requires Pro or higher
      if (user.tier === 'free') {
        return ApiErrors.featureNotAvailable('document_sharing', 'pro', user.tier);
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const input = getValidatedJson<CreateShareInput>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user owns the document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id, owner_id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        if (doc.owner_id !== user.id) {
          return ApiErrors.forbidden('Only document owner can share');
        }

        // Look up user by email
        const { data: targetUser, error: userError } = await client
          .from('user_profiles')
          .select('id, email')
          .eq('email', input.email)
          .single();

        if (userError || !targetUser) {
          return ApiErrors.notFound('User', input.email);
        }

        // Cannot share with self
        if (targetUser.id === user.id) {
          return ApiErrors.validationError('Cannot share document with yourself');
        }

        // Check if share already exists
        const { data: existing } = await client
          .from('document_shares')
          .select('id')
          .eq('document_id', params.id)
          .eq('shared_with_id', targetUser.id)
          .single();

        if (existing) {
          return ApiErrors.duplicateEntry('Share already exists for this user');
        }

        // Create share
        const { data: share, error: shareError } = await client
          .from('document_shares')
          .insert({
            document_id: params.id,
            shared_with_id: targetUser.id,
            permission: input.permission,
            expires_at: input.expiresAt ?? null,
          })
          .select()
          .single();

        if (shareError) {
          logger.error({ err: shareError }, 'Failed to create share');
          return ApiErrors.internal(shareError.message);
        }

        c.status(201);
        return c.json(share as DocumentShare);
      } catch (err) {
        logger.error({ err }, 'Error creating share');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * PUT /documents/:id/shares/:shareId - Update a share
   */
  app.put(
    '/:id/shares/:shareId',
    validateParam(shareIdParamSchema),
    validateJson(updateShareSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<ShareIdParams>(c);
      const input = getValidatedJson<UpdateShareInput>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user owns the document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id, owner_id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        if (doc.owner_id !== user.id) {
          return ApiErrors.forbidden('Only document owner can update shares');
        }

        // Update share
        const { data: share, error: shareError } = await client
          .from('document_shares')
          .update({
            ...(input.permission !== undefined && { permission: input.permission }),
            ...(input.expiresAt !== undefined && { expires_at: input.expiresAt }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.shareId)
          .eq('document_id', params.id)
          .select()
          .single();

        if (shareError) {
          if (shareError.code === 'PGRST116') {
            return ApiErrors.notFound('Share', params.shareId);
          }
          logger.error({ err: shareError }, 'Failed to update share');
          return ApiErrors.internal(shareError.message);
        }

        return c.json(share as DocumentShare);
      } catch (err) {
        logger.error({ err }, 'Error updating share');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * DELETE /documents/:id/shares/:shareId - Revoke a share
   */
  app.delete(
    '/:id/shares/:shareId',
    validateParam(shareIdParamSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<ShareIdParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user owns the document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id, owner_id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        if (doc.owner_id !== user.id) {
          return ApiErrors.forbidden('Only document owner can revoke shares');
        }

        // Delete share
        const { error: deleteError } = await client
          .from('document_shares')
          .delete()
          .eq('id', params.shareId)
          .eq('document_id', params.id);

        if (deleteError) {
          logger.error({ err: deleteError }, 'Failed to delete share');
          return ApiErrors.internal(deleteError.message);
        }

        c.status(204);
        return c.body(null);
      } catch (err) {
        logger.error({ err }, 'Error deleting share');
        return ApiErrors.internal();
      }
    }
  );

  return app;
}
