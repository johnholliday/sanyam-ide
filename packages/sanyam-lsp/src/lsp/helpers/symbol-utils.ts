/**
 * Symbol Utility Helpers (T056)
 *
 * Utilities for working with LSP symbols.
 *
 * @packageDocumentation
 */

import type {
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
  Location,
  Range,
} from 'vscode-languageserver';
import type { AstNode, LangiumDocument } from 'langium';
import { isNamed, streamAllContents, getDocument } from 'langium';

/**
 * Symbol kind mappings from common AST types.
 */
export const SYMBOL_KIND_MAP: Record<string, SymbolKind> = {
  // Types
  class: 5, // Class
  interface: 11, // Interface
  enum: 10, // Enum
  struct: 23, // Struct
  type: 5, // Class (closest match)
  entity: 5, // Class

  // Members
  method: 6, // Method
  function: 12, // Function
  property: 7, // Property
  field: 8, // Field
  attribute: 7, // Property
  variable: 13, // Variable
  constant: 14, // Constant

  // Other
  namespace: 3, // Namespace
  module: 2, // Module
  package: 4, // Package
  rule: 12, // Function
  terminal: 6, // Method
  parameter: 13, // Variable
  enumMember: 22, // EnumMember
};

/**
 * Get symbol kind for an AST node type.
 *
 * @param nodeType - The AST node type (e.g., 'Class', 'Property')
 * @returns The corresponding LSP SymbolKind
 */
export function getSymbolKindForType(nodeType: string): SymbolKind {
  const lowerType = nodeType.toLowerCase();

  // Check direct mapping
  if (SYMBOL_KIND_MAP[lowerType]) {
    return SYMBOL_KIND_MAP[lowerType];
  }

  // Check if type contains known keywords
  for (const [key, kind] of Object.entries(SYMBOL_KIND_MAP)) {
    if (lowerType.includes(key)) {
      return kind;
    }
  }

  // Default to class for named elements
  return 5; // SymbolKind.Class
}

/**
 * Create a DocumentSymbol from an AST node.
 *
 * @param node - The AST node
 * @param document - The Langium document
 * @returns DocumentSymbol or undefined if not a valid symbol
 */
export function createDocumentSymbol(
  node: AstNode,
  document: LangiumDocument
): DocumentSymbol | undefined {
  if (!isNamed(node)) {
    return undefined;
  }

  const cstNode = node.$cstNode;
  if (!cstNode) {
    return undefined;
  }

  const range: Range = {
    start: document.textDocument.positionAt(cstNode.offset),
    end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
  };

  return {
    name: node.name,
    kind: getSymbolKindForType(node.$type),
    range,
    selectionRange: range,
    detail: node.$type,
    children: [],
  };
}

/**
 * Create a SymbolInformation from an AST node.
 *
 * @param node - The AST node
 * @param document - The Langium document
 * @returns SymbolInformation or undefined if not a valid symbol
 */
export function createSymbolInformation(
  node: AstNode,
  document: LangiumDocument
): SymbolInformation | undefined {
  if (!isNamed(node)) {
    return undefined;
  }

  const cstNode = node.$cstNode;
  if (!cstNode) {
    return undefined;
  }

  const location: Location = {
    uri: document.uri.toString(),
    range: {
      start: document.textDocument.positionAt(cstNode.offset),
      end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
  };

  // Get container name
  let containerName: string | undefined;
  if (node.$container && isNamed(node.$container)) {
    containerName = node.$container.name;
  }

  return {
    name: node.name,
    kind: getSymbolKindForType(node.$type),
    location,
    containerName,
  };
}

/**
 * Collect all document symbols from an AST.
 *
 * @param root - The root AST node
 * @param document - The Langium document
 * @returns Array of DocumentSymbol with hierarchical structure
 */
export function collectDocumentSymbols(
  root: AstNode,
  document: LangiumDocument
): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const nodeToSymbol = new Map<AstNode, DocumentSymbol>();

  for (const node of streamAllContents(root)) {
    const symbol = createDocumentSymbol(node, document);
    if (!symbol) {
      continue;
    }

    nodeToSymbol.set(node, symbol);

    // Find parent symbol
    let parent: AstNode | undefined = node.$container;
    while (parent) {
      const parentSymbol = nodeToSymbol.get(parent);
      if (parentSymbol) {
        parentSymbol.children!.push(symbol);
        break;
      }
      parent = parent.$container;
    }

    // No parent found, add to root level
    if (!parent) {
      symbols.push(symbol);
    }
  }

  // Clean up empty children arrays
  const cleanup = (syms: DocumentSymbol[]) => {
    for (const sym of syms) {
      if (sym.children && sym.children.length === 0) {
        delete sym.children;
      } else if (sym.children) {
        cleanup(sym.children);
      }
    }
  };
  cleanup(symbols);

  return symbols;
}

/**
 * Collect all symbols as flat list.
 *
 * @param root - The root AST node
 * @param document - The Langium document
 * @returns Array of SymbolInformation (flat list)
 */
export function collectSymbolInformation(
  root: AstNode,
  document: LangiumDocument
): SymbolInformation[] {
  const symbols: SymbolInformation[] = [];

  for (const node of streamAllContents(root)) {
    const symbol = createSymbolInformation(node, document);
    if (symbol) {
      symbols.push(symbol);
    }
  }

  return symbols;
}

/**
 * Filter symbols by kind.
 *
 * @param symbols - Array of symbols
 * @param kinds - Kinds to include
 * @returns Filtered array of symbols
 */
export function filterSymbolsByKind<T extends DocumentSymbol | SymbolInformation>(
  symbols: T[],
  kinds: SymbolKind[]
): T[] {
  return symbols.filter(s => kinds.includes(s.kind));
}

/**
 * Filter symbols by name pattern.
 *
 * @param symbols - Array of symbols
 * @param pattern - Name pattern (supports wildcards: * and ?)
 * @returns Filtered array of symbols
 */
export function filterSymbolsByName<T extends DocumentSymbol | SymbolInformation>(
  symbols: T[],
  pattern: string
): T[] {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*') // * matches any chars
    .replace(/\?/g, '.'); // ? matches single char

  const regex = new RegExp(`^${regexPattern}$`, 'i');

  return symbols.filter(s => regex.test(s.name));
}

/**
 * Search symbols by query string.
 *
 * @param symbols - Array of symbols
 * @param query - Search query (case-insensitive substring match)
 * @returns Matching symbols sorted by relevance
 */
export function searchSymbols<T extends DocumentSymbol | SymbolInformation>(
  symbols: T[],
  query: string
): T[] {
  if (!query) {
    return symbols;
  }

  const lowerQuery = query.toLowerCase();

  // Score each symbol
  const scored = symbols.map(symbol => {
    const lowerName = symbol.name.toLowerCase();
    let score = 0;

    // Exact match
    if (lowerName === lowerQuery) {
      score = 100;
    }
    // Starts with query
    else if (lowerName.startsWith(lowerQuery)) {
      score = 80;
    }
    // Contains query
    else if (lowerName.includes(lowerQuery)) {
      score = 60;
    }
    // Initials match (e.g., "gc" matches "GetCustomer")
    else {
      const initials = symbol.name
        .split(/(?=[A-Z])/)
        .map(w => w[0])
        .join('')
        .toLowerCase();
      if (initials.includes(lowerQuery)) {
        score = 40;
      }
    }

    return { symbol, score };
  });

  // Filter and sort by score
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.symbol);
}

/**
 * Flatten nested document symbols into a flat array.
 *
 * @param symbols - Hierarchical document symbols
 * @returns Flat array of all symbols
 */
export function flattenDocumentSymbols(
  symbols: DocumentSymbol[]
): DocumentSymbol[] {
  const result: DocumentSymbol[] = [];

  const flatten = (syms: DocumentSymbol[]) => {
    for (const sym of syms) {
      result.push(sym);
      if (sym.children) {
        flatten(sym.children);
      }
    }
  };

  flatten(symbols);
  return result;
}

/**
 * Get symbol at a specific position.
 *
 * @param symbols - Hierarchical document symbols
 * @param line - Line number
 * @param character - Character offset
 * @returns The most specific symbol containing the position
 */
export function getSymbolAtPosition(
  symbols: DocumentSymbol[],
  line: number,
  character: number
): DocumentSymbol | undefined {
  const containsPosition = (range: Range): boolean => {
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
  };

  const findDeepest = (syms: DocumentSymbol[]): DocumentSymbol | undefined => {
    for (const sym of syms) {
      if (containsPosition(sym.range)) {
        // Check children first for more specific match
        if (sym.children) {
          const child = findDeepest(sym.children);
          if (child) {
            return child;
          }
        }
        return sym;
      }
    }
    return undefined;
  };

  return findDeepest(symbols);
}
