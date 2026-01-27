/**
 * Element Symbol Mapper (T041, FR-014, FR-015, FR-016)
 *
 * Maps diagram element IDs to DocumentSymbols for outline synchronization.
 * Uses naming conventions and AST structure to establish mappings.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import type { DocumentSymbol, Range } from 'vscode-languageserver-types';
import type { ElementSymbolMapping } from './outline-sync-types';

/**
 * Element Symbol Mapper.
 *
 * Establishes bidirectional mappings between:
 * - Diagram element IDs (e.g., "node-Entity-Customer")
 * - DocumentSymbol paths (e.g., ["Model", "Customer"])
 *
 * Mapping strategy:
 * 1. Element IDs typically follow pattern: "node-{Type}-{Name}" or just "{Name}"
 * 2. Symbol paths reflect AST hierarchy
 * 3. Matching is done by name comparison
 */
@injectable()
export class ElementSymbolMapper {
  /** Mappings keyed by document URI */
  protected mappingsByUri = new Map<string, Map<string, ElementSymbolMapping>>();

  /** Reverse lookup: symbol path string → element ID */
  protected reverseMapping = new Map<string, Map<string, string>>();

  /**
   * Register mappings for a document.
   *
   * @param uri - Document URI
   * @param mappings - Element to symbol mappings
   */
  registerMappings(uri: string, mappings: readonly ElementSymbolMapping[]): void {
    const elementMap = new Map<string, ElementSymbolMapping>();
    const symbolMap = new Map<string, string>();

    for (const mapping of mappings) {
      elementMap.set(mapping.elementId, mapping);
      symbolMap.set(this.symbolPathToKey(mapping.symbolPath), mapping.elementId);
    }

    this.mappingsByUri.set(uri, elementMap);
    this.reverseMapping.set(uri, symbolMap);
  }

  /**
   * Clear mappings for a document.
   *
   * @param uri - Document URI
   */
  clearMappings(uri: string): void {
    this.mappingsByUri.delete(uri);
    this.reverseMapping.delete(uri);
  }

  /**
   * Look up a mapping by element ID.
   *
   * @param uri - Document URI
   * @param elementId - Diagram element ID
   * @returns The mapping if found
   */
  getMappingByElementId(uri: string, elementId: string): ElementSymbolMapping | undefined {
    return this.mappingsByUri.get(uri)?.get(elementId);
  }

  /**
   * Look up an element ID by symbol path.
   *
   * @param uri - Document URI
   * @param symbolPath - Path of symbol names
   * @returns Element ID if found
   */
  getElementIdBySymbolPath(uri: string, symbolPath: readonly string[]): string | undefined {
    return this.reverseMapping.get(uri)?.get(this.symbolPathToKey(symbolPath));
  }

  /**
   * Get all mappings for a document.
   *
   * @param uri - Document URI
   * @returns All mappings
   */
  getAllMappings(uri: string): ElementSymbolMapping[] {
    const map = this.mappingsByUri.get(uri);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * Build mappings from DocumentSymbols and element IDs.
   *
   * This method attempts to match elements to symbols by name.
   *
   * @param symbols - DocumentSymbols from LSP
   * @param elementIds - Available diagram element IDs
   * @returns Generated mappings
   */
  buildMappingsFromSymbols(
    symbols: readonly DocumentSymbol[],
    elementIds: readonly string[]
  ): ElementSymbolMapping[] {
    const mappings: ElementSymbolMapping[] = [];
    const elementIdSet = new Set(elementIds);

    // Build a lookup from name to element ID
    const elementByName = new Map<string, string>();
    for (const id of elementIds) {
      const name = this.extractNameFromElementId(id);
      if (name) {
        elementByName.set(name.toLowerCase(), id);
      }
    }

    // Traverse symbols and try to match
    this.traverseSymbols(symbols, [], (symbol, path) => {
      const name = symbol.name.toLowerCase();
      const elementId = elementByName.get(name);

      if (elementId && elementIdSet.has(elementId)) {
        mappings.push({
          elementId,
          symbolPath: [...path, symbol.name],
          range: symbol.range,
          kind: symbol.kind,
        });
      }
    });

    return mappings;
  }

  /**
   * Traverse symbols recursively.
   */
  protected traverseSymbols(
    symbols: readonly DocumentSymbol[],
    parentPath: readonly string[],
    callback: (symbol: DocumentSymbol, path: readonly string[]) => void
  ): void {
    for (const symbol of symbols) {
      callback(symbol, parentPath);

      if (symbol.children && symbol.children.length > 0) {
        this.traverseSymbols(symbol.children, [...parentPath, symbol.name], callback);
      }
    }
  }

  /**
   * Extract element name from ID.
   *
   * Handles patterns like:
   * - "node-Entity-Customer" → "Customer"
   * - "Customer" → "Customer"
   * - "edge-Relationship-uses" → "uses"
   */
  protected extractNameFromElementId(elementId: string): string | undefined {
    // Try to extract from node/edge pattern
    const nodeMatch = elementId.match(/^(?:node|edge)-[^-]+-(.+)$/);
    if (nodeMatch && nodeMatch[1]) {
      return nodeMatch[1];
    }

    // Try simpler pattern: type-name
    const simpleMatch = elementId.match(/^[^-]+-(.+)$/);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1];
    }

    // Use the whole ID as name
    return elementId;
  }

  /**
   * Convert symbol path to a string key for lookup.
   */
  protected symbolPathToKey(path: readonly string[]): string {
    return path.join('::');
  }

  /**
   * Find the best matching element for a range.
   *
   * @param uri - Document URI
   * @param line - Line number (0-based)
   * @param character - Character position (0-based)
   * @returns Best matching element ID
   */
  findElementAtPosition(uri: string, line: number, character: number): string | undefined {
    const mappings = this.getAllMappings(uri);

    // Find mappings that contain the position
    const containing = mappings.filter(m =>
      this.rangeContainsPosition(m.range, line, character)
    );

    if (containing.length === 0) {
      return undefined;
    }

    // Return the most specific (smallest range)
    containing.sort((a, b) => this.rangeSize(a.range) - this.rangeSize(b.range));
    const first = containing[0];
    return first ? first.elementId : undefined;
  }

  /**
   * Check if a range contains a position.
   */
  protected rangeContainsPosition(range: Range, line: number, character: number): boolean {
    if (line < range.start.line || line > range.end.line) {
      return false;
    }

    if (line === range.start.line && character < range.start.character) {
      return false;
    }

    if (line === range.end.line && character > range.end.character) {
      return false;
    }

    return true;
  }

  /**
   * Calculate approximate range size for comparison.
   */
  protected rangeSize(range: Range): number {
    const lines = range.end.line - range.start.line;
    const chars = range.end.character - range.start.character;
    return lines * 1000 + chars;
  }
}
