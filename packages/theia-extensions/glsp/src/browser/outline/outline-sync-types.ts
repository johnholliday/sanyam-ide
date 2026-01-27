/**
 * Outline Sync Types (FR-014, FR-015, FR-016)
 *
 * Types for bidirectional selection synchronization between
 * document outline, diagram view, and text editor.
 *
 * @packageDocumentation
 */

import type { DocumentSymbol, Range } from 'vscode-languageserver-types';

// =============================================================================
// Symbol Mapping Types
// =============================================================================

/**
 * Mapping between a diagram element and its corresponding DocumentSymbol.
 */
export interface ElementSymbolMapping {
  /** Diagram element ID */
  readonly elementId: string;

  /** Full path of symbol names from root (e.g., ['Model', 'Entity', 'name']) */
  readonly symbolPath: readonly string[];

  /** Text range of the symbol in the source document */
  readonly range: Range;

  /** DocumentSymbol kind (class, property, etc.) */
  readonly kind: number;

  /** Parent element ID (if any) */
  readonly parentElementId?: string;

  /** Child element IDs */
  readonly childElementIds?: readonly string[];
}

/**
 * Result of looking up a DocumentSymbol from an element ID.
 */
export interface SymbolLookupResult {
  /** Whether the lookup succeeded */
  readonly found: boolean;

  /** The DocumentSymbol if found */
  readonly symbol?: DocumentSymbol;

  /** The mapping info if found */
  readonly mapping?: ElementSymbolMapping;

  /** Error message if lookup failed */
  readonly error?: string;
}

// =============================================================================
// Sync Configuration
// =============================================================================

/**
 * Configuration for outline synchronization behavior.
 */
export interface OutlineSyncConfig {
  /**
   * Whether to sync outline selection to diagram.
   * When an outline item is clicked, select the corresponding diagram element.
   * @default true
   */
  readonly syncOutlineToDiagram: boolean;

  /**
   * Whether to sync outline selection to text editor.
   * When an outline item is clicked, navigate to the symbol in the text editor.
   * @default true
   */
  readonly syncOutlineToTextEditor: boolean;

  /**
   * Whether to sync diagram selection to outline.
   * When a diagram element is selected, highlight it in the outline.
   * @default true
   */
  readonly syncDiagramToOutline: boolean;

  /**
   * Whether to sync text editor cursor to outline.
   * When cursor moves in text editor, highlight corresponding outline item.
   * @default false
   */
  readonly syncTextEditorToOutline: boolean;

  /**
   * Debounce delay in ms for text editor cursor sync.
   * @default 200
   */
  readonly textEditorSyncDebounceMs: number;
}

/**
 * Default outline sync configuration.
 */
export const DEFAULT_OUTLINE_SYNC_CONFIG: OutlineSyncConfig = {
  syncOutlineToDiagram: true,
  syncOutlineToTextEditor: true,
  syncDiagramToOutline: true,
  syncTextEditorToOutline: false,
  textEditorSyncDebounceMs: 200,
};

// =============================================================================
// Sync Events
// =============================================================================

/**
 * Event emitted when outline selection changes.
 */
export interface OutlineSelectionEvent {
  /** Selected symbol paths */
  readonly selectedSymbolPaths: readonly (readonly string[])[];

  /** Source of the selection (outline panel click, diagram sync, etc.) */
  readonly source: 'outline' | 'diagram' | 'textEditor';

  /** Element IDs corresponding to selected symbols (if mapped) */
  readonly elementIds?: readonly string[];
}

/**
 * Event emitted to request navigation to a symbol.
 */
export interface NavigateToSymbolEvent {
  /** Symbol path to navigate to */
  readonly symbolPath: readonly string[];

  /** Target text range */
  readonly range: Range;

  /** Whether to reveal in diagram */
  readonly revealInDiagram: boolean;

  /** Whether to reveal in text editor */
  readonly revealInTextEditor: boolean;

  /** Whether to reveal in outline */
  readonly revealInOutline: boolean;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Service for synchronizing selection between outline, diagram, and text editor.
 */
export interface OutlineSyncService {
  /**
   * Get the configuration.
   */
  getConfig(): OutlineSyncConfig;

  /**
   * Update the configuration.
   */
  setConfig(config: Partial<OutlineSyncConfig>): void;

  /**
   * Register element-symbol mappings for a document.
   *
   * @param uri - Document URI
   * @param mappings - Element to symbol mappings
   */
  registerMappings(uri: string, mappings: readonly ElementSymbolMapping[]): void;

  /**
   * Clear mappings for a document.
   *
   * @param uri - Document URI
   */
  clearMappings(uri: string): void;

  /**
   * Look up a symbol from an element ID.
   *
   * @param uri - Document URI
   * @param elementId - Diagram element ID
   */
  lookupSymbol(uri: string, elementId: string): SymbolLookupResult;

  /**
   * Look up an element ID from a symbol path.
   *
   * @param uri - Document URI
   * @param symbolPath - Path of symbol names
   */
  lookupElement(uri: string, symbolPath: readonly string[]): string | undefined;

  /**
   * Handle selection change from a source.
   * Propagates selection to other views according to config.
   *
   * @param uri - Document URI
   * @param elementIds - Selected element IDs
   * @param source - Source of the selection
   */
  handleSelectionChange(
    uri: string,
    elementIds: readonly string[],
    source: 'outline' | 'diagram' | 'textEditor'
  ): void;

  /**
   * Subscribe to outline selection events.
   */
  onOutlineSelection(callback: (event: OutlineSelectionEvent) => void): { dispose(): void };

  /**
   * Subscribe to navigation events.
   */
  onNavigateToSymbol(callback: (event: NavigateToSymbolEvent) => void): { dispose(): void };
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Service ID for dependency injection.
 */
export const OutlineSyncServiceSymbol = Symbol('OutlineSyncService');
