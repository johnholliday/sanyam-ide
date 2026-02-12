/**
 * Cloud Document Store
 *
 * Storage service for cloud documents with tier limit enforcement.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CloudDocument,
  DocumentVersion,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  TierLimits,
  PaginatedResponse,
  PaginationParams,
} from '@sanyam/types';
import {
  SupabaseClientFactory,
  type SupabaseClientFactory as SupabaseClientFactoryType,
} from './supabase-client-factory.js';

/**
 * DI token for CloudDocumentStore.
 */
export const CloudDocumentStore = Symbol('CloudDocumentStore');

/**
 * Document storage result.
 */
export interface DocumentStoreResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

/**
 * Tier check result.
 */
export interface TierCheckResult {
  readonly allowed: boolean;
  readonly limitType?: 'document_count' | 'storage_quota' | 'document_size';
  readonly current?: number;
  readonly limit?: number;
  readonly tier?: string;
}

/**
 * Interface for cloud document storage.
 */
export interface CloudDocumentStore {
  /**
   * Create a new cloud document.
   *
   * @param accessToken - User's access token
   * @param request - Create document request
   * @returns Created document or error
   */
  createDocument(
    accessToken: string,
    request: CreateDocumentRequest
  ): Promise<DocumentStoreResult<CloudDocument>>;

  /**
   * Update an existing cloud document.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @param request - Update request
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated document or error
   */
  updateDocument(
    accessToken: string,
    documentId: string,
    request: UpdateDocumentRequest,
    expectedVersion?: number
  ): Promise<DocumentStoreResult<CloudDocument>>;

  /**
   * Soft delete a document (move to trash).
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @returns Success or error
   */
  deleteDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<void>>;

  /**
   * Permanently delete a document (hard delete).
   * Requires Pro tier or higher.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @returns Success or error
   */
  permanentlyDeleteDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<void>>;

  /**
   * Restore a soft-deleted document.
   * Requires Pro tier or higher.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @returns Restored document or error
   */
  restoreDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<CloudDocument>>;

  /**
   * Get a document by ID.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @returns Document or error
   */
  getDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<CloudDocument>>;

  /**
   * List user's documents with pagination.
   *
   * @param accessToken - User's access token
   * @param options - Pagination and filter options
   * @returns Paginated document list
   */
  listDocuments(
    accessToken: string,
    options?: PaginationParams & { includeDeleted?: boolean }
  ): Promise<DocumentStoreResult<PaginatedResponse<CloudDocument>>>;

  /**
   * List document versions.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @returns Document versions
   */
  listVersions(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<DocumentVersion[]>>;

  /**
   * Get a specific document version.
   *
   * @param accessToken - User's access token
   * @param documentId - Document ID
   * @param versionNumber - Version number
   * @returns Version content
   */
  getVersion(
    accessToken: string,
    documentId: string,
    versionNumber: number
  ): Promise<DocumentStoreResult<DocumentVersion>>;

  /**
   * Check if user can perform an action based on tier limits.
   *
   * @param accessToken - User's access token
   * @param action - Action to check
   * @param contentSize - Size of content (for size checks)
   * @returns Whether action is allowed
   */
  checkTierLimit(
    accessToken: string,
    action: 'create_document' | 'upload_content',
    contentSize?: number
  ): Promise<TierCheckResult>;

  /**
   * Get user's current tier limits.
   *
   * @param accessToken - User's access token
   * @returns Tier limits or error
   */
  getTierLimits(accessToken: string): Promise<DocumentStoreResult<TierLimits>>;
}

/**
 * Default implementation of CloudDocumentStore.
 */
@injectable()
export class CloudDocumentStoreImpl implements CloudDocumentStore {
  @inject(SupabaseClientFactory)
  private readonly clientFactory!: SupabaseClientFactoryType;

  async createDocument(
    accessToken: string,
    request: CreateDocumentRequest
  ): Promise<DocumentStoreResult<CloudDocument>> {
    // Check tier limits first
    const contentSize = new TextEncoder().encode(request.content).length;
    const tierCheck = await this.checkTierLimit(accessToken, 'create_document', contentSize);

    if (!tierCheck.allowed) {
      return {
        success: false,
        error: {
          code: 'TIER_LIMIT_EXCEEDED',
          message: `${tierCheck.limitType} limit exceeded`,
          details: {
            current: tierCheck.current,
            limit: tierCheck.limit,
            tier: tierCheck.tier,
          },
        },
      };
    }

    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { data, error } = await client
        .from('documents')
        .insert({
          name: request.name,
          language_id: request.languageId,
          content: request.content,
          metadata: request.metadata ?? {},
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true, data: this.mapDocument(data) };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async updateDocument(
    accessToken: string,
    documentId: string,
    request: UpdateDocumentRequest,
    expectedVersion?: number
  ): Promise<DocumentStoreResult<CloudDocument>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    // Check content size if updating content
    if (request.content) {
      const contentSize = new TextEncoder().encode(request.content).length;
      const tierCheck = await this.checkTierLimit(accessToken, 'upload_content', contentSize);

      if (!tierCheck.allowed) {
        return {
          success: false,
          error: {
            code: 'TIER_LIMIT_EXCEEDED',
            message: `${tierCheck.limitType} limit exceeded`,
            details: {
              current: tierCheck.current,
              limit: tierCheck.limit,
              tier: tierCheck.tier,
            },
          },
        };
      }
    }

    try {
      // Build update query
      let query = client.from('documents').update({
        ...(request.name !== undefined && { name: request.name }),
        ...(request.content !== undefined && { content: request.content }),
        ...(request.metadata !== undefined && { metadata: request.metadata }),
        updated_at: new Date().toISOString(),
      });

      // Add ID filter
      query = query.eq('id', documentId);

      // Add version check if provided (optimistic locking)
      if (expectedVersion !== undefined) {
        query = query.eq('version', expectedVersion);
      }

      const { data, error, count } = await query.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - check if version mismatch
          const current = await this.getDocument(accessToken, documentId);
          if (current.success && current.data && expectedVersion !== undefined) {
            return {
              success: false,
              error: {
                code: 'OPTIMISTIC_LOCK_CONFLICT',
                message: 'Document was modified by another user',
                details: {
                  current_version: current.data.version,
                  your_version: expectedVersion,
                },
              },
            };
          }
        }
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true, data: this.mapDocument(data) };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async deleteDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<void>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { error } = await client
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async permanentlyDeleteDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<void>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { error } = await client
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async restoreDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<CloudDocument>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { data, error } = await client
        .from('documents')
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .not('deleted_at', 'is', null)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true, data: this.mapDocument(data) };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async getDocument(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<CloudDocument>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { data, error } = await client
        .from('documents')
        .select()
        .eq('id', documentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
          };
        }
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true, data: this.mapDocument(data) };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async listDocuments(
    accessToken: string,
    options?: PaginationParams & { includeDeleted?: boolean }
  ): Promise<DocumentStoreResult<PaginatedResponse<CloudDocument>>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const limit = options?.limit ?? 20;
      let query = client
        .from('documents')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .limit(limit + 1);

      // Filter out deleted unless requested
      if (!options?.includeDeleted) {
        query = query.is('deleted_at', null);
      }

      // Apply cursor if provided
      if (options?.cursor) {
        // Decode cursor (format: updated_at|id)
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf-8');
        const [cursorDate, cursorId] = decoded.split('|');
        if (cursorDate && cursorId) {
          query = query.or(
            `updated_at.lt.${cursorDate},and(updated_at.eq.${cursorDate},id.lt.${cursorId})`
          );
        }
      }

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      const hasMore = (data?.length ?? 0) > limit;
      const items = hasMore ? data!.slice(0, limit) : (data ?? []);

      // Build next cursor
      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = Buffer.from(`${lastItem.updated_at}|${lastItem.id}`).toString('base64');
      }

      return {
        success: true,
        data: {
          data: items.map((d) => this.mapDocument(d)),
          pagination: {
            next_cursor: nextCursor,
            prev_cursor: null, // Simplified - no prev cursor
            total_count: count ?? 0,
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async listVersions(
    accessToken: string,
    documentId: string
  ): Promise<DocumentStoreResult<DocumentVersion[]>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { data, error } = await client
        .from('document_versions')
        .select()
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (error) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return {
        success: true,
        data: (data ?? []).map((v) => this.mapVersion(v)),
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async getVersion(
    accessToken: string,
    documentId: string,
    versionNumber: number
  ): Promise<DocumentStoreResult<DocumentVersion>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      const { data, error } = await client
        .from('document_versions')
        .select()
        .eq('document_id', documentId)
        .eq('version_number', versionNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: { code: 'VERSION_NOT_FOUND', message: 'Version not found' },
          };
        }
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        };
      }

      return { success: true, data: this.mapVersion(data) };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  async checkTierLimit(
    accessToken: string,
    action: 'create_document' | 'upload_content',
    contentSize?: number
  ): Promise<TierCheckResult> {
    const limitsResult = await this.getTierLimits(accessToken);
    if (!limitsResult.success || !limitsResult.data) {
      return { allowed: false, limitType: 'document_count', tier: 'unknown' };
    }

    const limits = limitsResult.data;
    const client = this.clientFactory.createUserScopedClient(accessToken);

    // Get user's current usage
    const { data: profile } = await client
      .from('user_profiles')
      .select('document_count, storage_used_bytes')
      .single();

    const currentDocCount = profile?.document_count ?? 0;
    const currentStorage = profile?.storage_used_bytes ?? 0;

    // Check document count limit
    if (action === 'create_document') {
      if (currentDocCount >= limits.max_documents) {
        return {
          allowed: false,
          limitType: 'document_count',
          current: currentDocCount,
          limit: limits.max_documents,
          tier: limits.tier,
        };
      }
    }

    // Check storage quota
    if (contentSize) {
      if (currentStorage + contentSize > limits.max_storage_bytes) {
        return {
          allowed: false,
          limitType: 'storage_quota',
          current: currentStorage,
          limit: limits.max_storage_bytes,
          tier: limits.tier,
        };
      }

      // Check single document size
      if (contentSize > limits.max_document_size_bytes) {
        return {
          allowed: false,
          limitType: 'document_size',
          current: contentSize,
          limit: limits.max_document_size_bytes,
          tier: limits.tier,
        };
      }
    }

    return { allowed: true };
  }

  async getTierLimits(accessToken: string): Promise<DocumentStoreResult<TierLimits>> {
    const client = this.clientFactory.createUserScopedClient(accessToken);

    try {
      // Get user's tier from profile
      const { data: profile, error: profileError } = await client
        .from('user_profiles')
        .select('tier')
        .single();

      if (profileError) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: profileError.message },
        };
      }

      const tier = profile?.tier ?? 'free';

      // Get limits for this tier (public table)
      const anonClient = this.clientFactory.getAnonClient();
      const { data: limits, error: limitsError } = await anonClient
        .from('tier_limits')
        .select()
        .eq('tier', tier)
        .single();

      if (limitsError || !limits) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tier limits' },
        };
      }

      return { success: true, data: limits as TierLimits };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(err) },
      };
    }
  }

  /**
   * Map database row to CloudDocument type.
   */
  private mapDocument(row: Record<string, unknown>): CloudDocument {
    return {
      id: row['id'] as string,
      owner_id: row['owner_id'] as string,
      name: row['name'] as string,
      language_id: row['language_id'] as string,
      content: row['content'] as string,
      content_size_bytes: row['content_size_bytes'] as number,
      metadata: row['metadata'] as Record<string, unknown>,
      version: row['version'] as number,
      created_at: row['created_at'] as string,
      updated_at: row['updated_at'] as string,
      deleted_at: row['deleted_at'] as string | null,
    };
  }

  /**
   * Map database row to DocumentVersion type.
   */
  private mapVersion(row: Record<string, unknown>): DocumentVersion {
    return {
      id: row['id'] as string,
      document_id: row['document_id'] as string,
      version_number: row['version_number'] as number,
      content: row['content'] as string,
      content_size_bytes: row['content_size_bytes'] as number,
      created_by: row['created_by'] as string,
      created_at: row['created_at'] as string,
      expires_at: row['expires_at'] as string | null,
    };
  }
}
