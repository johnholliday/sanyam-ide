/**
 * Outline Sync Service (T040, T042, T043, T044, FR-014, FR-015, FR-016)
 *
 * Coordinates selection synchronization between document outline,
 * diagram view, and text editor.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Disposable, DisposableCollection } from '@theia/core/lib/common';
import { EditorManager } from '@theia/editor/lib/browser';
import type { Range, Position } from 'vscode-languageserver-types';

import {
  type OutlineSyncConfig,
  type OutlineSelectionEvent,
  type NavigateToSymbolEvent,
  type ElementSymbolMapping,
  type SymbolLookupResult,
  DEFAULT_OUTLINE_SYNC_CONFIG,
  OutlineSyncServiceSymbol,
} from './outline-sync-types';
import { ElementSymbolMapper } from './element-symbol-mapper';

/**
 * Outline Sync Service Implementation.
 *
 * Provides bidirectional selection synchronization:
 * - T042: Outline → Diagram (select element when outline item clicked)
 * - T043: Outline → Text Editor (navigate to symbol when outline item clicked)
 * - T044: Diagram → Outline (highlight outline item when element selected)
 */
@injectable()
export class OutlineSyncServiceImpl implements Disposable {
  protected readonly logger = createLogger({ name: 'OutlineSync' });

  /** Current configuration */
  protected config: OutlineSyncConfig = { ...DEFAULT_OUTLINE_SYNC_CONFIG };

  /** Disposables */
  protected readonly toDispose = new DisposableCollection();

  /** Event emitters */
  protected readonly onOutlineSelectionEmitter = new Emitter<OutlineSelectionEvent>();
  protected readonly onNavigateToSymbolEmitter = new Emitter<NavigateToSymbolEvent>();
  protected readonly onDiagramSelectionRequestEmitter = new Emitter<{
    uri: string;
    elementIds: string[];
  }>();

  /** Debounce timer for text editor sync */
  protected textEditorSyncTimer: ReturnType<typeof setTimeout> | undefined;

  /** Currently syncing flag to prevent loops */
  protected isSyncing = false;

  @inject(ElementSymbolMapper)
  protected readonly symbolMapper: ElementSymbolMapper;

  @inject(EditorManager)
  protected readonly editorManager: EditorManager;

  @postConstruct()
  protected init(): void {
    this.toDispose.push(this.onOutlineSelectionEmitter);
    this.toDispose.push(this.onNavigateToSymbolEmitter);
    this.toDispose.push(this.onDiagramSelectionRequestEmitter);
  }

  /**
   * Get the current configuration.
   */
  getConfig(): OutlineSyncConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration.
   */
  setConfig(config: Partial<OutlineSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Register element-symbol mappings for a document.
   */
  registerMappings(uri: string, mappings: readonly ElementSymbolMapping[]): void {
    this.symbolMapper.registerMappings(uri, mappings);
  }

  /**
   * Clear mappings for a document.
   */
  clearMappings(uri: string): void {
    this.symbolMapper.clearMappings(uri);
  }

  /**
   * Look up a symbol from an element ID.
   */
  lookupSymbol(uri: string, elementId: string): SymbolLookupResult {
    const mapping = this.symbolMapper.getMappingByElementId(uri, elementId);

    if (!mapping) {
      return { found: false, error: `No mapping found for element: ${elementId}` };
    }

    return {
      found: true,
      mapping,
      // Note: full DocumentSymbol would require fetching from LSP
    };
  }

  /**
   * Look up an element ID from a symbol path.
   */
  lookupElement(uri: string, symbolPath: readonly string[]): string | undefined {
    return this.symbolMapper.getElementIdBySymbolPath(uri, symbolPath);
  }

  /**
   * T042/T043/T044: Handle selection change from a source.
   * Propagates selection to other views according to configuration.
   */
  handleSelectionChange(
    uri: string,
    elementIds: readonly string[],
    source: 'outline' | 'diagram' | 'textEditor'
  ): void {
    // Prevent infinite loops
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      switch (source) {
        case 'outline':
          this.handleOutlineSelection(uri, elementIds);
          break;
        case 'diagram':
          this.handleDiagramSelection(uri, elementIds);
          break;
        case 'textEditor':
          this.handleTextEditorSelection(uri, elementIds);
          break;
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * T042/T043: Handle selection from outline panel.
   * Syncs to diagram and/or text editor.
   */
  protected handleOutlineSelection(uri: string, elementIds: readonly string[]): void {
    // Get symbol paths for the elements
    const symbolPaths: (readonly string[])[] = [];
    for (const elementId of elementIds) {
      const mapping = this.symbolMapper.getMappingByElementId(uri, elementId);
      if (mapping) {
        symbolPaths.push(mapping.symbolPath);
      }
    }

    // T042: Sync to diagram
    if (this.config.syncOutlineToDiagram) {
      this.onDiagramSelectionRequestEmitter.fire({
        uri,
        elementIds: [...elementIds],
      });
    }

    // T043: Sync to text editor
    if (this.config.syncOutlineToTextEditor && elementIds.length > 0) {
      const firstElementId = elementIds[0];
      if (firstElementId) {
        const mapping = this.symbolMapper.getMappingByElementId(uri, firstElementId);
        if (mapping) {
          this.navigateToRange(uri, mapping.range);
        }
      }
    }

    // Emit outline selection event
    this.onOutlineSelectionEmitter.fire({
      selectedSymbolPaths: symbolPaths,
      source: 'outline',
      elementIds: [...elementIds],
    });
  }

  /**
   * T044: Handle selection from diagram.
   * Syncs to outline (highlights corresponding outline item).
   */
  protected handleDiagramSelection(uri: string, elementIds: readonly string[]): void {
    if (!this.config.syncDiagramToOutline) {
      return;
    }

    // Get symbol paths for the elements
    const symbolPaths: (readonly string[])[] = [];
    for (const elementId of elementIds) {
      const mapping = this.symbolMapper.getMappingByElementId(uri, elementId);
      if (mapping) {
        symbolPaths.push(mapping.symbolPath);
      }
    }

    // Emit outline selection event to highlight in outline
    this.onOutlineSelectionEmitter.fire({
      selectedSymbolPaths: symbolPaths,
      source: 'diagram',
      elementIds: [...elementIds],
    });
  }

  /**
   * Handle selection from text editor cursor position.
   * Debounced to avoid excessive updates while typing.
   */
  protected handleTextEditorSelection(uri: string, elementIds: readonly string[]): void {
    if (!this.config.syncTextEditorToOutline) {
      return;
    }

    // Clear existing timer
    if (this.textEditorSyncTimer) {
      clearTimeout(this.textEditorSyncTimer);
    }

    // Debounce
    this.textEditorSyncTimer = setTimeout(() => {
      const symbolPaths: (readonly string[])[] = [];
      for (const elementId of elementIds) {
        const mapping = this.symbolMapper.getMappingByElementId(uri, elementId);
        if (mapping) {
          symbolPaths.push(mapping.symbolPath);
        }
      }

      this.onOutlineSelectionEmitter.fire({
        selectedSymbolPaths: symbolPaths,
        source: 'textEditor',
        elementIds: [...elementIds],
      });
    }, this.config.textEditorSyncDebounceMs);
  }

  /**
   * Navigate text editor to a range.
   */
  protected async navigateToRange(uri: string, range: Range): Promise<void> {
    try {
      // Open or reveal the editor
      const editor = await this.editorManager.open(
        new (await import('@theia/core')).URI(uri),
        { selection: this.rangeToSelection(range) }
      );

      if (editor) {
        // Reveal the range
        const theiaEditor = editor.editor;
        if (theiaEditor && 'revealRange' in theiaEditor) {
          (theiaEditor as any).revealRange(this.rangeToSelection(range));
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to navigate to range');
    }
  }

  /**
   * Convert LSP Range to editor selection.
   */
  protected rangeToSelection(range: Range): { start: Position; end: Position } {
    return {
      start: { line: range.start.line, character: range.start.character },
      end: { line: range.end.line, character: range.end.character },
    };
  }

  /**
   * Find element at cursor position.
   */
  findElementAtPosition(uri: string, line: number, character: number): string | undefined {
    return this.symbolMapper.findElementAtPosition(uri, line, character);
  }

  /**
   * Subscribe to outline selection events.
   */
  onOutlineSelection(callback: (event: OutlineSelectionEvent) => void): Disposable {
    return this.onOutlineSelectionEmitter.event(callback);
  }

  /**
   * Subscribe to navigation events.
   */
  onNavigateToSymbol(callback: (event: NavigateToSymbolEvent) => void): Disposable {
    return this.onNavigateToSymbolEmitter.event(callback);
  }

  /**
   * Subscribe to diagram selection requests.
   * Used by diagram widget to respond to outline/text editor selections.
   */
  onDiagramSelectionRequest(callback: (event: { uri: string; elementIds: string[] }) => void): Disposable {
    return this.onDiagramSelectionRequestEmitter.event(callback);
  }

  /**
   * Dispose the service.
   */
  dispose(): void {
    if (this.textEditorSyncTimer) {
      clearTimeout(this.textEditorSyncTimer);
    }
    this.toDispose.dispose();
  }
}

/**
 * Export the service symbol for DI binding.
 */
export { OutlineSyncServiceSymbol };
