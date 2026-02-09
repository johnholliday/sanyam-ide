/**
 * @sanyam/types - Document Reference Types
 *
 * This file defines types for referencing documents in API operations.
 * Supports multiple document storage backends.
 *
 * @packageDocumentation
 */

// =============================================================================
// Document Reference Types
// =============================================================================

/**
 * Reference to a document via file:// URI.
 *
 * URIs can be:
 * - Absolute: `file:///absolute/path/to/model.ecml`
 * - Relative to workspace root: `file://model.ecml` (resolved against SANYAM_WORKSPACE_ROOT)
 */
export interface FileUriReference {
  /** File URI (file:// scheme) */
  readonly uri: string;
}

/**
 * Reference to a document via inline content.
 *
 * Used when the document doesn't exist on disk, such as:
 * - Pasting DSL content directly into an API call
 * - Processing temporary or generated content
 */
export interface InlineContentReference {
  /** The DSL content to process */
  readonly content: string;

  /**
   * Virtual file name with extension.
   * Used to determine the language and create ephemeral document.
   *
   * @example 'temp.ecml', 'inline-model.spdk'
   */
  readonly fileName: string;
}

// Phase 2 will add:
// /**
//  * Reference to a document stored in Supabase.
//  * Uses sanyam:// URI scheme.
//  */
// export interface SupabaseReference {
//   /** Supabase document URI (sanyam:// scheme) */
//   readonly uri: `sanyam://${string}`;
// }

/**
 * Union type for all document reference methods.
 *
 * @example
 * ```typescript
 * // File URI reference
 * const fileRef: DocumentReference = { uri: 'file:///workspace/model.ecml' };
 *
 * // Inline content reference
 * const inlineRef: DocumentReference = {
 *   content: 'Actor Admin "Administrator" "Admin user"',
 *   fileName: 'inline.ecml'
 * };
 * ```
 */
export type DocumentReference = FileUriReference | InlineContentReference;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a reference is a file URI reference.
 */
export function isFileUriReference(ref: DocumentReference): ref is FileUriReference {
  return 'uri' in ref && typeof ref.uri === 'string';
}

/**
 * Type guard to check if a reference is an inline content reference.
 */
export function isInlineContentReference(ref: DocumentReference): ref is InlineContentReference {
  return 'content' in ref && 'fileName' in ref;
}

// =============================================================================
// API Request Types
// =============================================================================

/**
 * Base request type for operation invocations via REST API.
 */
export interface OperationRequestBase {
  /** Document reference (file URI or inline content) */
  readonly document: DocumentReference;

  /** Selected element IDs for operations that act on specific elements */
  readonly selectedIds?: readonly string[];

  /** Operation-specific input fields */
  readonly input?: Record<string, unknown>;
}

/**
 * Shorthand request type that accepts a URI string directly.
 * Supported for convenience in REST API calls.
 */
export interface OperationRequestShorthand {
  /** File URI as string (shorthand for { uri: string }) */
  readonly uri: string;

  /** Selected element IDs for operations that act on specific elements */
  readonly selectedIds?: readonly string[];

  /** Operation-specific input fields */
  readonly input?: Record<string, unknown>;
}

/**
 * Full operation request type supporting both full and shorthand formats.
 */
export type OperationRequest = OperationRequestBase | OperationRequestShorthand;

/**
 * Normalize an operation request to the base format.
 */
export function normalizeOperationRequest(request: OperationRequest): OperationRequestBase {
  if ('document' in request) {
    return request;
  }

  const result: OperationRequestBase = {
    document: { uri: request.uri },
  };

  if (request.selectedIds !== undefined) {
    (result as { selectedIds?: readonly string[] }).selectedIds = request.selectedIds;
  }

  if (request.input !== undefined) {
    (result as { input?: Record<string, unknown> }).input = request.input;
  }

  return result;
}
