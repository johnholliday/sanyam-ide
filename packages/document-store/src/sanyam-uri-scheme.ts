/**
 * Sanyam URI Scheme Handler
 *
 * Handles `sanyam://` URIs for cloud document resolution.
 *
 * URI Format: sanyam://documents/{documentId}[/versions/{versionNumber}]
 * Asset URIs: sanyam://documents/{documentId}/assets/* (not yet supported)
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { SANYAM_URI_SCHEME, ASSETS_PATH_SEGMENT } from '@sanyam/types';

/**
 * DI token for SanyamUriScheme.
 */
export const SanyamUriScheme = Symbol('SanyamUriScheme');

/**
 * Parsed Sanyam URI components.
 */
export interface ParsedSanyamUri {
  /** Document ID */
  readonly documentId: string;

  /** Version number (optional) */
  readonly versionNumber?: number;

  /** Asset path (optional) */
  readonly assetPath?: string;

  /** Whether this is an asset URI */
  readonly isAsset: boolean;
}

/**
 * URI resolution result.
 */
export interface UriResolutionResult {
  readonly success: boolean;
  readonly content?: string;
  readonly mimeType?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Interface for Sanyam URI scheme handler.
 */
export interface SanyamUriScheme {
  /**
   * Check if a URI is a Sanyam cloud URI.
   *
   * @param uri - URI to check
   * @returns True if this is a sanyam:// URI
   */
  isSanyamUri(uri: string): boolean;

  /**
   * Parse a Sanyam URI into its components.
   *
   * @param uri - URI to parse
   * @returns Parsed URI or null if invalid
   */
  parseUri(uri: string): ParsedSanyamUri | null;

  /**
   * Build a Sanyam URI from components.
   *
   * @param documentId - Document ID
   * @param versionNumber - Optional version number
   * @returns Sanyam URI string
   */
  buildUri(documentId: string, versionNumber?: number): string;

  /**
   * Build an asset URI.
   *
   * @param documentId - Document ID
   * @param assetPath - Path to asset within document
   * @returns Sanyam asset URI string
   */
  buildAssetUri(documentId: string, assetPath: string): string;

  /**
   * Resolve a Sanyam URI to its content.
   *
   * @param uri - URI to resolve
   * @param accessToken - User's access token
   * @returns Resolution result
   */
  resolve(uri: string, accessToken: string): Promise<UriResolutionResult>;
}

/**
 * Document store interface (for dependency injection).
 */
export interface DocumentStoreForUri {
  getDocument(accessToken: string, documentId: string): Promise<{
    success: boolean;
    data?: { content: string };
    error?: { code: string; message: string };
  }>;
  getVersion(accessToken: string, documentId: string, versionNumber: number): Promise<{
    success: boolean;
    data?: { content: string };
    error?: { code: string; message: string };
  }>;
}

/**
 * DI token for document store (used by URI handler).
 */
export const DocumentStoreForUri = Symbol('DocumentStoreForUri');

/**
 * Default implementation of SanyamUriScheme.
 */
@injectable()
export class SanyamUriSchemeImpl implements SanyamUriScheme {
  @inject(DocumentStoreForUri)
  private readonly documentStore!: DocumentStoreForUri;

  /**
   * URI regex pattern.
   * Matches: sanyam://documents/{uuid}[/versions/{number}][/assets/path]
   */
  private readonly uriPattern = new RegExp(
    `^${SANYAM_URI_SCHEME}://documents/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})` +
    `(?:/versions/(\\d+))?` +
    `(?:/${ASSETS_PATH_SEGMENT}/(.+))?$`,
    'i'
  );

  isSanyamUri(uri: string): boolean {
    return uri.startsWith(`${SANYAM_URI_SCHEME}://`);
  }

  parseUri(uri: string): ParsedSanyamUri | null {
    if (!this.isSanyamUri(uri)) {
      return null;
    }

    const match = uri.match(this.uriPattern);
    if (!match) {
      return null;
    }

    const [, documentId, versionStr, assetPath] = match;
    if (!documentId) {
      return null;
    }

    return {
      documentId,
      versionNumber: versionStr ? parseInt(versionStr, 10) : undefined,
      assetPath: assetPath || undefined,
      isAsset: !!assetPath,
    };
  }

  buildUri(documentId: string, versionNumber?: number): string {
    const base = `${SANYAM_URI_SCHEME}://documents/${documentId}`;
    return versionNumber !== undefined ? `${base}/versions/${versionNumber}` : base;
  }

  buildAssetUri(documentId: string, assetPath: string): string {
    // Normalize asset path (remove leading slashes)
    const normalizedPath = assetPath.replace(/^\/+/, '');
    return `${SANYAM_URI_SCHEME}://documents/${documentId}/${ASSETS_PATH_SEGMENT}/${normalizedPath}`;
  }

  async resolve(uri: string, accessToken: string): Promise<UriResolutionResult> {
    const parsed = this.parseUri(uri);
    if (!parsed) {
      return {
        success: false,
        error: {
          code: 'INVALID_URI',
          message: `Invalid Sanyam URI format: ${uri}`,
        },
      };
    }

    // Asset URIs are not yet supported (FR-022, FR-023)
    if (parsed.isAsset) {
      return {
        success: false,
        error: {
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'Asset storage is not yet supported. This feature is planned for a future release.',
        },
      };
    }

    // Resolve document or version
    if (parsed.versionNumber !== undefined) {
      const result = await this.documentStore.getVersion(
        accessToken,
        parsed.documentId,
        parsed.versionNumber
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        content: result.data!.content,
        mimeType: 'text/plain',
      };
    } else {
      const result = await this.documentStore.getDocument(accessToken, parsed.documentId);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        content: result.data!.content,
        mimeType: 'text/plain',
      };
    }
  }
}

/**
 * Create a SanyamUriScheme instance without DI (for testing).
 *
 * @param documentStore - Document store implementation
 * @returns SanyamUriScheme instance
 */
export function createSanyamUriScheme(documentStore: DocumentStoreForUri): SanyamUriScheme {
  const handler = new SanyamUriSchemeImpl();
  (handler as any).documentStore = documentStore;
  return handler;
}
