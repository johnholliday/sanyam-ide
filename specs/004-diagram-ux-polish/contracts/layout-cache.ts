/**
 * Layout Cache API Contracts
 *
 * Defines the API for diagram layout persistence.
 * These contracts are implemented by DiagramLayoutStorageService.
 *
 * @packageDocumentation
 */

// =============================================================================
// Data Types
// =============================================================================

/**
 * Position in diagram coordinates.
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Dimensions of an element.
 */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Layout information for a single diagram element.
 */
export interface ElementLayout {
  /** Position in diagram coordinates */
  readonly position: Position;
  /** Optional size (if resizable) */
  readonly size?: Size;
}

/**
 * Complete layout data for a diagram.
 */
export interface DiagramLayout {
  /** Schema version for future migrations */
  readonly version: 1;
  /** URI of the source document */
  readonly uri: string;
  /** Timestamp of last save (ms since epoch) */
  readonly timestamp: number;
  /** Element layouts keyed by element ID */
  readonly elements: Record<string, ElementLayout>;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Service for persisting and retrieving diagram layouts.
 *
 * Implementations should:
 * - Use Theia's StorageService for persistence
 * - Handle version migrations
 * - Debounce saves to avoid excessive writes
 */
export interface DiagramLayoutStorageService {
  /**
   * Load saved layout for a document.
   *
   * @param uri - Document URI
   * @returns Layout data or undefined if none saved
   */
  loadLayout(uri: string): Promise<DiagramLayout | undefined>;

  /**
   * Save layout for a document immediately.
   *
   * @param uri - Document URI
   * @param elements - Element layouts to save
   */
  saveLayout(uri: string, elements: Record<string, ElementLayout>): Promise<void>;

  /**
   * Save layout with debouncing.
   * Multiple calls within the debounce window are coalesced.
   *
   * @param uri - Document URI
   * @param elements - Element layouts to save
   */
  saveLayoutDebounced(uri: string, elements: Record<string, ElementLayout>): void;

  /**
   * Clear saved layout for a document.
   *
   * @param uri - Document URI
   */
  clearLayout(uri: string): Promise<void>;

  /**
   * Check if layout exists for a document.
   *
   * @param uri - Document URI
   * @returns True if layout is saved
   */
  hasLayout(uri: string): Promise<boolean>;
}

// =============================================================================
// Storage Key Format
// =============================================================================

/**
 * Storage key prefix for layout data.
 * Full key format: `sanyam.diagram.layout:{uriHash}`
 */
export const LAYOUT_STORAGE_PREFIX = 'sanyam.diagram.layout:';

/**
 * Generate storage key for a document URI.
 *
 * @param uri - Document URI
 * @returns Storage key
 */
export function getLayoutStorageKey(uri: string): string {
  // Simple hash function for URI
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${LAYOUT_STORAGE_PREFIX}${Math.abs(hash).toString(16)}`;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default debounce delay for layout saves (ms).
 */
export const DEFAULT_SAVE_DEBOUNCE_MS = 500;

/**
 * Current layout schema version.
 */
export const CURRENT_LAYOUT_VERSION = 1;
