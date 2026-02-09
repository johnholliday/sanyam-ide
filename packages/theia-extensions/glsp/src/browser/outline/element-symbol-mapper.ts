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
   * Build mappings from source ranges and DocumentSymbols.
   *
   * For each element's source range, finds the most specific (smallest)
   * DocumentSymbol whose range contains the element's start position.
   * This is grammar-agnostic and immune to name/title mismatches.
   *
   * @param symbols - DocumentSymbols from LSP
   * @param sourceRanges - Map of element ID to source range (LSP positions)
   * @returns Generated mappings
   */
  buildMappingsFromRanges(
    symbols: readonly DocumentSymbol[],
    sourceRanges: ReadonlyMap<string, Range>
  ): ElementSymbolMapping[] {
    const mappings: ElementSymbolMapping[] = [];

    // Flatten all symbols with their paths for efficient lookup
    const flatSymbols: Array<{ symbol: DocumentSymbol; path: string[] }> = [];
    this.flattenSymbols(symbols, [], flatSymbols);

    for (const [elementId, sourceRange] of sourceRanges) {
      // Find the most specific symbol containing this element's start position
      let bestMatch: { symbol: DocumentSymbol; path: string[]; size: number } | undefined;

      for (const { symbol, path } of flatSymbols) {
        if (this.rangeContainsPosition(symbol.range, sourceRange.start.line, sourceRange.start.character)) {
          const size = this.rangeSize(symbol.range);
          if (!bestMatch || size < bestMatch.size) {
            bestMatch = { symbol, path, size };
          }
        }
      }

      if (bestMatch) {
        mappings.push({
          elementId,
          symbolPath: [...bestMatch.path, bestMatch.symbol.name],
          range: bestMatch.symbol.range,
          kind: bestMatch.symbol.kind,
        });
      }
    }

    // Diagnostic: if we have sourceRanges but produced zero mappings,
    // log a sample to help debug range-matching issues.
    if (mappings.length === 0 && sourceRanges.size > 0) {
      const sampleRange = sourceRanges.entries().next().value;
      const sampleSymbol = flatSymbols[0];
      console.warn('[ElementSymbolMapper] buildMappingsFromRanges produced 0 mappings', {
        sourceRangeCount: sourceRanges.size,
        symbolCount: flatSymbols.length,
        sampleSourceRange: sampleRange,
        sampleSymbol: sampleSymbol ? { name: sampleSymbol.symbol.name, range: sampleSymbol.symbol.range } : undefined,
      });
    }

    return mappings;
  }

  /**
   * Flatten symbol tree into a list with paths.
   */
  protected flattenSymbols(
    symbols: readonly DocumentSymbol[],
    parentPath: string[],
    result: Array<{ symbol: DocumentSymbol; path: string[] }>
  ): void {
    for (const symbol of symbols) {
      result.push({ symbol, path: parentPath });
      if (symbol.children && symbol.children.length > 0) {
        this.flattenSymbols(symbol.children, [...parentPath, symbol.name], result);
      }
    }
  }

  /**
   * Build mappings from DocumentSymbols and element IDs.
   *
   * This method attempts to match elements to symbols by name.
   * Used as fallback when sourceRanges are not available.
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

    // Detect if all element IDs appear to be UUIDs — name-based matching
    // is impossible for random UUIDs. Return empty so the caller falls
    // through to sourceRange-based matching.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (elementIds.length > 0 && elementIds.every(id => UUID_RE.test(id))) {
      console.warn('[ElementSymbolMapper] All element IDs are UUIDs — name-based matching skipped. Caller should use buildMappingsFromRanges instead.');
      return [];
    }

    // Build lookups from element names to element IDs.
    // We index by exact lowercase name AND by normalized name (no spaces/special chars)
    // to handle cases where element IDs use identifiers (e.g., "LegalReviewer")
    // but symbol names use display titles (e.g., "Legal Reviewer").
    const elementByExactName = new Map<string, string>();
    const elementByNormalized = new Map<string, string>();
    for (const id of elementIds) {
      const name = this.extractNameFromElementId(id);
      if (name) {
        elementByExactName.set(name.toLowerCase(), id);
        elementByNormalized.set(this.normalizeName(name), id);
      }
    }

    // Traverse symbols and try to match using multiple strategies:
    // 1. Exact lowercase match
    // 2. Normalized match (strip non-alphanumeric, lowercase)
    // 3. Suffix match (normalized symbol name ends with normalized element name)
    this.traverseSymbols(symbols, [], (symbol, path) => {
      const exactKey = symbol.name.toLowerCase();
      const normalizedKey = this.normalizeName(symbol.name);

      // Strategy 1 & 2: exact or normalized match
      let elementId = elementByExactName.get(exactKey)
        ?? elementByNormalized.get(normalizedKey);

      // Strategy 3: substring match — handles cases like:
      // - element "Requester" matching symbol "Contract Requester" (suffix)
      // - element "CanReview" matching symbol "Can Review Role" (prefix)
      if (!elementId) {
        let bestMatch: { id: string; len: number } | undefined;
        for (const [normalizedElemName, id] of elementByNormalized) {
          if (normalizedKey.includes(normalizedElemName) && elementIdSet.has(id)) {
            // Prefer longer element name matches to avoid false positives
            if (!bestMatch || normalizedElemName.length > bestMatch.len) {
              bestMatch = { id, len: normalizedElemName.length };
            }
          }
        }
        if (bestMatch) {
          elementId = bestMatch.id;
        }
      }

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
   * Normalize a name for fuzzy matching by stripping all non-alphanumeric
   * characters and lowercasing. This maps both "LegalReviewer" and
   * "Legal Reviewer" to "legalreviewer".
   */
  protected normalizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
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
