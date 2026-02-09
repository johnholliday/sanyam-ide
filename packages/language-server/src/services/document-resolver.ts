/**
 * Unified Document Resolver
 *
 * Resolves document references to LangiumDocument instances.
 * Supports multiple document reference types:
 * - file:// URIs (resolved against workspace root)
 * - Inline content (creates ephemeral documents)
 *
 * @packageDocumentation
 */

import type { LangiumDocument, LangiumSharedCoreServices } from 'langium';
import type { DocumentReference } from '@sanyam/types';
import { URI } from 'langium';
import * as path from 'path';
import { isFileUriReference, isInlineContentReference } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'DocumentResolver' });

/**
 * Configuration for the document resolver.
 */
export interface DocumentResolverConfig {
  /** Root directory for file:// URI resolution */
  readonly workspaceRoot?: string;
}

/**
 * Unified document resolver for grammar operations.
 *
 * Provides a consistent way to resolve document references to
 * LangiumDocument instances, regardless of the reference type.
 */
export class UnifiedDocumentResolver {
  private readonly workspaceRoot: string;
  private readonly services: LangiumSharedCoreServices;

  constructor(services: LangiumSharedCoreServices, config?: DocumentResolverConfig) {
    this.services = services;
    this.workspaceRoot = config?.workspaceRoot ?? process.env['SANYAM_WORKSPACE_ROOT'] ?? '/workspace';
    logger.debug({ workspaceRoot: this.workspaceRoot }, 'Document resolver initialized');
  }

  /**
   * Resolve a document reference to a LangiumDocument.
   *
   * @param ref - Document reference (file URI or inline content)
   * @returns The resolved LangiumDocument
   * @throws Error if the document cannot be resolved
   */
  async resolve(ref: DocumentReference): Promise<LangiumDocument> {
    if (isFileUriReference(ref)) {
      return this.resolveFileUri(ref.uri);
    } else if (isInlineContentReference(ref)) {
      return this.resolveInlineContent(ref.content, ref.fileName);
    }

    // TypeScript exhaustive check
    const _never: never = ref;
    throw new Error(`Unknown document reference type: ${JSON.stringify(_never)}`);
  }

  /**
   * Resolve a file:// URI to a LangiumDocument.
   *
   * First checks the LSP document cache, then loads from disk if not cached.
   *
   * @param uriString - File URI string
   * @returns The resolved LangiumDocument
   */
  private async resolveFileUri(uriString: string): Promise<LangiumDocument> {
    const uri = URI.parse(uriString);

    // Check LSP document cache first
    const cached = this.services.workspace.LangiumDocuments.getDocument(uri);
    if (cached) {
      logger.debug({ uri: uriString }, 'Document found in cache');
      return cached;
    }

    // Resolve file path against workspace root
    const filePath = this.resolveFilePath(uriString);
    const fileUri = URI.file(filePath);

    logger.debug({ uri: uriString, filePath }, 'Loading document from disk');

    // Load document via Langium's document factory
    const document = await this.services.workspace.LangiumDocuments.getOrCreateDocument(fileUri);
    return document;
  }

  /**
   * Create an ephemeral document from inline content.
   *
   * @param content - DSL content string
   * @param fileName - Virtual file name with extension
   * @returns The created LangiumDocument
   */
  private async resolveInlineContent(content: string, fileName: string): Promise<LangiumDocument> {
    // Create a unique virtual URI to avoid collisions
    const timestamp = Date.now();
    const virtualUri = URI.parse(`inmemory:///${timestamp}-${fileName}`);

    logger.debug({ fileName, contentLength: content.length }, 'Creating ephemeral document');

    // Create document from content string
    const document = this.services.workspace.LangiumDocumentFactory.fromString(
      content,
      virtualUri
    );

    // Build the document to parse it
    await this.services.workspace.DocumentBuilder.build([document]);

    return document;
  }

  /**
   * Resolve a file URI to an absolute file path.
   *
   * @param uriString - File URI string
   * @returns Absolute file path
   */
  private resolveFilePath(uriString: string): string {
    const uri = URI.parse(uriString);

    if (uri.scheme !== 'file') {
      throw new Error(`Unsupported URI scheme: ${uri.scheme}. Only file:// URIs are supported.`);
    }

    // If path is absolute, use it directly
    if (path.isAbsolute(uri.path)) {
      return uri.path;
    }

    // Resolve relative path against workspace root
    return path.join(this.workspaceRoot, uri.path);
  }

  /**
   * Get the workspace root directory.
   *
   * Used by CRUD operations to determine where to store files.
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Check if a document exists in the cache.
   *
   * @param uri - Document URI
   * @returns True if the document is cached
   */
  hasDocument(uri: string): boolean {
    return this.services.workspace.LangiumDocuments.hasDocument(URI.parse(uri));
  }

  /**
   * Get a document from the cache without loading from disk.
   *
   * @param uri - Document URI
   * @returns The cached document or undefined
   */
  getCached(uri: string): LangiumDocument | undefined {
    return this.services.workspace.LangiumDocuments.getDocument(URI.parse(uri));
  }
}
