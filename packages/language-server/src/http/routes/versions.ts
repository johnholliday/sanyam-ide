/**
 * Versions API Routes
 *
 * REST endpoints for document version history operations.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentVersion } from '@sanyam/types';
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
  documentIdParamSchema,
  versionParamSchema,
  listVersionsQuerySchema,
  restoreVersionSchema,
  type DocumentIdParams,
  type VersionParams,
  type ListVersionsQuery,
  type RestoreVersionInput,
} from './versions.schemas.js';

const logger = createLogger({ name: 'VersionsRoutes' });

/**
 * Dependencies for version routes.
 */
export interface VersionRouteDependencies {
  /** Function to create user-scoped Supabase client */
  createClient: (accessToken: string) => SupabaseClient;
}

/**
 * Create version routes.
 *
 * @param deps - Route dependencies
 * @returns Hono app with version routes
 */
export function createVersionRoutes(deps: VersionRouteDependencies): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  /**
   * GET /documents/:id/versions - List document versions
   */
  app.get(
    '/:id/versions',
    validateParam(documentIdParamSchema),
    validateQuery(listVersionsQuerySchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const query = getValidatedQuery<ListVersionsQuery>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user has access to document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        // List versions
        let versionsQuery = client
          .from('document_versions')
          .select('*')
          .eq('document_id', params.id)
          .order('version_number', { ascending: false })
          .limit(query.limit);

        if (!query.includeExpired) {
          versionsQuery = versionsQuery.or('expires_at.is.null,expires_at.gt.now()');
        }

        const { data: versions, error: versionsError } = await versionsQuery;

        if (versionsError) {
          logger.error({ err: versionsError }, 'Failed to list versions');
          return ApiErrors.internal(versionsError.message);
        }

        return c.json(versions as DocumentVersion[]);
      } catch (err) {
        logger.error({ err }, 'Error listing versions');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * GET /documents/:id/versions/:versionNumber - Get specific version
   */
  app.get(
    '/:id/versions/:versionNumber',
    validateParam(versionParamSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<VersionParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user has access to document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        // Get version
        const { data: version, error: versionError } = await client
          .from('document_versions')
          .select('*')
          .eq('document_id', params.id)
          .eq('version_number', params.versionNumber)
          .single();

        if (versionError) {
          if (versionError.code === 'PGRST116') {
            return ApiErrors.notFound('Version');
          }
          logger.error({ err: versionError }, 'Failed to get version');
          return ApiErrors.internal(versionError.message);
        }

        return c.json(version as DocumentVersion);
      } catch (err) {
        logger.error({ err }, 'Error getting version');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * POST /documents/:id/versions/:versionNumber/restore - Restore a version
   */
  app.post(
    '/:id/versions/:versionNumber/restore',
    validateParam(versionParamSchema),
    validateJson(restoreVersionSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<VersionParams>(c);
      const input = getValidatedJson<RestoreVersionInput>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Verify user owns the document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('id, owner_id, version')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        if (doc.owner_id !== user.id) {
          return ApiErrors.forbidden('Only document owner can restore versions');
        }

        // Get the version to restore
        const { data: version, error: versionError } = await client
          .from('document_versions')
          .select('content')
          .eq('document_id', params.id)
          .eq('version_number', params.versionNumber)
          .single();

        if (versionError || !version) {
          return ApiErrors.notFound('Version');
        }

        // Update document with version content
        const { data: updated, error: updateError } = await client
          .from('documents')
          .update({
            content: version.content,
            updated_at: new Date().toISOString(),
            // Note: version increment is handled by trigger
          })
          .eq('id', params.id)
          .select()
          .single();

        if (updateError) {
          logger.error({ err: updateError }, 'Failed to restore version');
          return ApiErrors.internal(updateError.message);
        }

        return c.json({
          message: `Restored to version ${params.versionNumber}`,
          document: updated,
        });
      } catch (err) {
        logger.error({ err }, 'Error restoring version');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * GET /documents/:id/versions/:versionNumber/diff - Compare version with current
   */
  app.get(
    '/:id/versions/:versionNumber/diff',
    validateParam(versionParamSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<VersionParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        // Get current document
        const { data: doc, error: docError } = await client
          .from('documents')
          .select('content, version')
          .eq('id', params.id)
          .single();

        if (docError || !doc) {
          return ApiErrors.notFound('Document', params.id);
        }

        // Get version
        const { data: version, error: versionError } = await client
          .from('document_versions')
          .select('content, version_number')
          .eq('document_id', params.id)
          .eq('version_number', params.versionNumber)
          .single();

        if (versionError || !version) {
          return ApiErrors.notFound('Version');
        }

        // Return both contents for client-side diffing
        return c.json({
          current: {
            version: doc.version,
            content: doc.content,
          },
          historical: {
            version: version.version_number,
            content: version.content,
          },
        });
      } catch (err) {
        logger.error({ err }, 'Error getting version diff');
        return ApiErrors.internal();
      }
    }
  );

  return app;
}
