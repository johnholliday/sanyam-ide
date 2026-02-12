/**
 * Factory functions for creating test document data.
 */

/**
 * Request payload for creating a document.
 */
export interface CreateDocumentRequest {
  /** Document name */
  name: string;
  /** Language identifier (e.g., 'sanyam', 'json') */
  languageId: string;
  /** Document content */
  content: string;
}

/**
 * Cloud document entity structure.
 */
export interface CloudDocument {
  /** Unique document ID */
  id: string;
  /** Owner user ID */
  user_id: string;
  /** Document name */
  name: string;
  /** Language identifier */
  language_id: string;
  /** Document content */
  content: string;
  /** Version number (incremented on each update) */
  version: number;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Soft delete timestamp (null if not deleted) */
  deleted_at: string | null;
}

/**
 * Builds a CreateDocumentRequest with sensible defaults.
 *
 * @param overrides - Partial values to override defaults
 * @returns CreateDocumentRequest
 *
 * @example
 * ```typescript
 * const request = buildCreateDocumentRequest({ name: 'My Document' });
 * // { name: 'My Document', languageId: 'sanyam', content: '# Default content' }
 * ```
 */
export function buildCreateDocumentRequest(
  overrides?: Partial<CreateDocumentRequest>
): CreateDocumentRequest {
  return {
    name: 'Test Document',
    languageId: 'sanyam',
    content: '# Test document content\n\nThis is a test document.',
    ...overrides,
  };
}

/**
 * Builds a CloudDocument with sensible defaults.
 *
 * @param overrides - Partial values to override defaults
 * @returns CloudDocument
 *
 * @example
 * ```typescript
 * const doc = buildDocument({ name: 'Custom Name', version: 2 });
 * ```
 */
export function buildDocument(overrides?: Partial<CloudDocument>): CloudDocument {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    name: 'Test Document',
    language_id: 'sanyam',
    content: '# Test document content\n\nThis is a test document.',
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}
