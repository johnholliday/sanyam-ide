/**
 * Documents API Routes
 *
 * REST endpoints for cloud document CRUD operations.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CloudDocument,
  DocumentVersion,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  PaginatedResponse,
} from '@sanyam/types';
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
import {
  ApiErrors,
  sendError,
} from '../middleware/error-handler.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdSchema,
  versionParamSchema,
  listDocumentsQuerySchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type DocumentIdParams,
  type VersionParams,
  type ListDocumentsQuery,
} from './documents.schemas.js';

const logger = createLogger({ name: 'DocumentsRoutes' });

/**
 * Dependencies for document routes.
 */
export interface DocumentRouteDependencies {
  /** Function to create user-scoped Supabase client */
  createClient: (accessToken: string) => SupabaseClient;

  /** Function to get anonymous client (for tier limits) */
  getAnonClient: () => SupabaseClient;
}

/**
 * Create document routes.
 *
 * @param deps - Route dependencies
 * @returns Hono app with document routes
 */
export function createDocumentRoutes(deps: DocumentRouteDependencies): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  /**
   * GET /documents - List user's documents
   */
  app.get(
    '/',
    validateQuery(listDocumentsQuerySchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const query = getValidatedQuery<ListDocumentsQuery>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        const limit = query.limit;
        let dbQuery = client
          .from('documents')
          .select('*', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(limit + 1);

        // Filter out deleted unless requested
        if (!query.includeDeleted) {
          dbQuery = dbQuery.is('deleted_at', null);
        }

        // Apply cursor if provided
        if (query.cursor) {
          try {
            const decoded = Buffer.from(query.cursor, 'base64').toString('utf-8');
            const delimiterIndex = decoded.indexOf('|');
            if (delimiterIndex > 0) {
              const cursorDate = decoded.slice(0, delimiterIndex);
              const cursorId = decoded.slice(delimiterIndex + 1);
              dbQuery = dbQuery.or(
                `updated_at.lt.${cursorDate},and(updated_at.eq.${cursorDate},id.lt.${cursorId})`
              );
            }
          } catch {
            return ApiErrors.invalidCursor();
          }
        }

        const { data, error, count } = await dbQuery;

        if (error) {
          logger.error({ err: error }, 'Failed to list documents');
          return ApiErrors.internal(error.message);
        }

        const hasMore = (data?.length ?? 0) > limit;
        const items = hasMore ? data!.slice(0, limit) : (data ?? []);

        // Build next cursor
        let nextCursor: string | null = null;
        if (hasMore && items.length > 0) {
          const lastItem = items[items.length - 1];
          nextCursor = Buffer.from(`${lastItem.updated_at}|${lastItem.id}`).toString('base64');
        }

        const response: PaginatedResponse<CloudDocument> = {
          data: items as CloudDocument[],
          pagination: {
            next_cursor: nextCursor,
            prev_cursor: null,
            total_count: count ?? 0,
          },
        };

        return c.json(response);
      } catch (err) {
        logger.error({ err }, 'Error listing documents');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * POST /documents - Create a new document
   */
  app.post(
    '/',
    validateJson(createDocumentSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const input = getValidatedJson<CreateDocumentInput>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      // Check tier limits
      const tierCheck = await checkTierLimits(client, deps.getAnonClient(), user.id, input.content);
      if (!tierCheck.allowed) {
        return ApiErrors.tierLimitExceeded(
          `${tierCheck.limitType} limit exceeded`,
          {
            current: tierCheck.current!,
            limit: tierCheck.limit!,
            tier: tierCheck.tier!,
          }
        );
      }

      try {
        const { data, error } = await client
          .from('documents')
          .insert({
            name: input.name,
            language_id: input.languageId,
            content: input.content,
            metadata: input.metadata ?? {},
          })
          .select()
          .single();

        if (error) {
          logger.error({ err: error }, 'Failed to create document');
          return ApiErrors.internal(error.message);
        }

        c.status(201);
        return c.json(data as CloudDocument);
      } catch (err) {
        logger.error({ err }, 'Error creating document');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * GET /documents/:id - Get a document by ID
   */
  app.get(
    '/:id',
    validateParam(documentIdSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        const { data, error } = await client
          .from('documents')
          .select()
          .eq('id', params.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return ApiErrors.notFound('Document', params.id);
          }
          logger.error({ err: error }, 'Failed to get document');
          return ApiErrors.internal(error.message);
        }

        // Set ETag header for caching
        c.header('ETag', `"${data.version}"`);

        return c.json(data as CloudDocument);
      } catch (err) {
        logger.error({ err }, 'Error getting document');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * PUT /documents/:id - Update a document
   */
  app.put(
    '/:id',
    validateParam(documentIdSchema),
    validateJson(updateDocumentSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const input = getValidatedJson<UpdateDocumentInput>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      // Get expected version from If-Match header
      const ifMatch = c.req.header('If-Match');
      let expectedVersion: number | undefined;
      if (ifMatch) {
        const match = ifMatch.match(/^"?(\d+)"?$/);
        if (match) {
          expectedVersion = parseInt(match[1]!, 10);
        }
      }

      const client = deps.createClient(accessToken);

      // Check content size if updating
      if (input.content) {
        const tierCheck = await checkTierLimits(
          client,
          deps.getAnonClient(),
          user.id,
          input.content,
          true
        );
        if (!tierCheck.allowed) {
          return ApiErrors.tierLimitExceeded(
            `${tierCheck.limitType} limit exceeded`,
            {
              current: tierCheck.current!,
              limit: tierCheck.limit!,
              tier: tierCheck.tier!,
            }
          );
        }
      }

      try {
        let query = client.from('documents').update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.content !== undefined && { content: input.content }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
          updated_at: new Date().toISOString(),
        });

        query = query.eq('id', params.id);

        // Optimistic locking
        if (expectedVersion !== undefined) {
          query = query.eq('version', expectedVersion);
        }

        const { data, error } = await query.select().single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Check if version mismatch
            const { data: current } = await client
              .from('documents')
              .select('version')
              .eq('id', params.id)
              .single();

            if (current && expectedVersion !== undefined && current.version !== expectedVersion) {
              return ApiErrors.optimisticLockConflict(current.version, expectedVersion);
            }
            return ApiErrors.notFound('Document', params.id);
          }
          logger.error({ err: error }, 'Failed to update document');
          return ApiErrors.internal(error.message);
        }

        return c.json(data as CloudDocument);
      } catch (err) {
        logger.error({ err }, 'Error updating document');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * DELETE /documents/:id - Soft delete a document
   */
  app.delete(
    '/:id',
    validateParam(documentIdSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        const { error } = await client
          .from('documents')
          .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .is('deleted_at', null);

        if (error) {
          logger.error({ err: error }, 'Failed to delete document');
          return ApiErrors.internal(error.message);
        }

        c.status(204);
        return c.body(null);
      } catch (err) {
        logger.error({ err }, 'Error deleting document');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * POST /documents/:id/restore - Restore a deleted document (Pro+)
   */
  app.post(
    '/:id/restore',
    validateParam(documentIdSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      // Check tier - restore requires Pro or higher
      if (user.tier === 'free') {
        return ApiErrors.featureNotAvailable('restore_document', 'pro', user.tier);
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        const { data, error } = await client
          .from('documents')
          .update({
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .not('deleted_at', 'is', null)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return ApiErrors.notFound('Document', params.id);
          }
          logger.error({ err: error }, 'Failed to restore document');
          return ApiErrors.internal(error.message);
        }

        return c.json(data as CloudDocument);
      } catch (err) {
        logger.error({ err }, 'Error restoring document');
        return ApiErrors.internal();
      }
    }
  );

  /**
   * GET /documents/:id/versions - List document versions
   */
  app.get(
    '/:id/versions',
    validateParam(documentIdSchema),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return ApiErrors.unauthorized();
      }

      const params = getValidatedParam<DocumentIdParams>(c);
      const accessToken = c.req.header('Authorization')?.slice(7);
      if (!accessToken) {
        return ApiErrors.unauthorized();
      }

      const client = deps.createClient(accessToken);

      try {
        const { data, error } = await client
          .from('document_versions')
          .select()
          .eq('document_id', params.id)
          .order('version_number', { ascending: false });

        if (error) {
          logger.error({ err: error }, 'Failed to list versions');
          return ApiErrors.internal(error.message);
        }

        return c.json(data as DocumentVersion[]);
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
        const { data, error } = await client
          .from('document_versions')
          .select()
          .eq('document_id', params.id)
          .eq('version_number', params.versionNumber)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return ApiErrors.notFound('Version');
          }
          logger.error({ err: error }, 'Failed to get version');
          return ApiErrors.internal(error.message);
        }

        return c.json(data as DocumentVersion);
      } catch (err) {
        logger.error({ err }, 'Error getting version');
        return ApiErrors.internal();
      }
    }
  );

  return app;
}

/**
 * Check tier limits for document operations.
 */
async function checkTierLimits(
  client: SupabaseClient,
  anonClient: SupabaseClient,
  userId: string,
  content: string,
  isUpdate = false
): Promise<{
  allowed: boolean;
  limitType?: string;
  current?: number;
  limit?: number;
  tier?: string;
}> {
  // Get user profile
  const { data: profile } = await client
    .from('user_profiles')
    .select('tier, document_count, storage_used_bytes')
    .single();

  if (!profile) {
    return { allowed: false, limitType: 'unknown', tier: 'unknown' };
  }

  // Get tier limits
  const { data: limits } = await anonClient
    .from('tier_limits')
    .select()
    .eq('tier', profile.tier)
    .single();

  if (!limits) {
    return { allowed: false, limitType: 'unknown', tier: profile.tier };
  }

  const contentSize = new TextEncoder().encode(content).length;

  // Check document count (only for create)
  if (!isUpdate && profile.document_count >= limits.max_documents) {
    return {
      allowed: false,
      limitType: 'document_count',
      current: profile.document_count,
      limit: limits.max_documents,
      tier: profile.tier,
    };
  }

  // Check storage quota
  if (profile.storage_used_bytes + contentSize > limits.max_storage_bytes) {
    return {
      allowed: false,
      limitType: 'storage_quota',
      current: profile.storage_used_bytes,
      limit: limits.max_storage_bytes,
      tier: profile.tier,
    };
  }

  // Check document size
  if (contentSize > limits.max_document_size_bytes) {
    return {
      allowed: false,
      limitType: 'document_size',
      current: contentSize,
      limit: limits.max_document_size_bytes,
      tier: profile.tier,
    };
  }

  return { allowed: true };
}
