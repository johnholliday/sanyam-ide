/**
 * Default Document Symbol Provider (T033)
 *
 * Provides document outline by mapping AST to hierarchical symbols.
 *
 * @packageDocumentation
 */

import type {
  DocumentSymbol,
  SymbolInformation,
  DocumentSymbolParams,
  SymbolKind,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { isNamed, streamAllContents } from '../helpers/langium-compat.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default document symbol provider that maps AST to symbols.
 */
export const defaultDocumentSymbolProvider = {
  /**
   * Provide document symbols for the outline view.
   */
  async provide(
    context: LspContext,
    params: DocumentSymbolParams
  ): Promise<DocumentSymbol[] | SymbolInformation[] | null> {
    const { document, services, token } = context;

    // Check for built-in document symbol provider first
    const symbolProvider = services.lsp.DocumentSymbolProvider;
    logger.info({ hasSymbolProvider: !!symbolProvider }, 'documentSymbol: checking Langium provider');
    if (symbolProvider) {
      try {
        const result = await symbolProvider.getSymbols(document, params, token);
        logger.info({ resultLength: result?.length ?? 'null' }, 'documentSymbol: Langium provider result');
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium DocumentSymbolProvider');
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      logger.warn('documentSymbol: no root node');
      return null;
    }

    logger.info({ rootType: rootNode.$type }, 'documentSymbol: building symbols from AST');

    // Build hierarchical document symbols
    const symbols = buildDocumentSymbols(rootNode, document);
    logger.info({ symbolCount: symbols.length }, 'documentSymbol: built symbols');

    return symbols;
  },
};

/**
 * Build hierarchical document symbols from the AST.
 */
function buildDocumentSymbols(
  rootNode: AstNode,
  document: LspContext['document']
): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const nodeToSymbol = new Map<AstNode, DocumentSymbol>();

  // Traverse all AST nodes
  for (const node of streamAllContents(rootNode)) {
    if (!isNamed(node)) {
      continue;
    }

    const cstNode = node.$cstNode;
    if (!cstNode) {
      continue;
    }

    const symbol: DocumentSymbol = {
      name: node.name,
      kind: getSymbolKind(node),
      range: {
        start: document.textDocument.positionAt(cstNode.offset),
        end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
      },
      selectionRange: getSelectionRange(node, document),
      children: [],
    };

    // Add detail based on type
    const detail = getSymbolDetail(node);
    if (detail) {
      symbol.detail = detail;
    }

    nodeToSymbol.set(node, symbol);

    // Find parent symbol
    const parentSymbol = findParentSymbol(node, nodeToSymbol);
    if (parentSymbol) {
      parentSymbol.children!.push(symbol);
    } else {
      symbols.push(symbol);
    }
  }

  // Clean up empty children arrays
  cleanupEmptyChildren(symbols);

  return symbols;
}

/**
 * Get the selection range for a named node (just the name, not the whole node).
 */
function getSelectionRange(
  node: AstNode & { name: string },
  document: LspContext['document']
): DocumentSymbol['selectionRange'] {
  const cstNode = node.$cstNode;
  if (!cstNode) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }

  // Try to find the name node specifically
  // For simplicity, use the full CST node range for now
  // A more sophisticated implementation would find the name token
  return {
    start: document.textDocument.positionAt(cstNode.offset),
    end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
  };
}

/**
 * Map AST node type to symbol kind.
 */
function getSymbolKind(node: AstNode): SymbolKind {
  const type = node.$type.toLowerCase();

  // Common mappings
  if (type.includes('class') || type.includes('entity')) {
    return 5; // SymbolKind.Class
  }
  if (type.includes('interface')) {
    return 11; // SymbolKind.Interface
  }
  if (type.includes('enum')) {
    return 10; // SymbolKind.Enum
  }
  if (type.includes('function') || type.includes('method') || type.includes('rule')) {
    return 6; // SymbolKind.Method
  }
  if (type.includes('property') || type.includes('attribute') || type.includes('field')) {
    return 7; // SymbolKind.Property
  }
  if (type.includes('variable') || type.includes('constant')) {
    return 13; // SymbolKind.Variable
  }
  if (type.includes('module') || type.includes('package') || type.includes('namespace')) {
    return 2; // SymbolKind.Module
  }
  if (type.includes('type')) {
    return 5; // SymbolKind.Class
  }

  // Default to class for named elements
  return 5; // SymbolKind.Class
}

/**
 * Get detail string for a symbol.
 */
function getSymbolDetail(node: AstNode): string | undefined {
  // Try common detail properties
  if ('type' in node && typeof node.type === 'string') {
    return node.type;
  }

  if ('extends' in node) {
    const ext = node.extends;
    if (typeof ext === 'string') {
      return `extends ${ext}`;
    }
    if (typeof ext === 'object' && ext !== null && '$refText' in ext) {
      return `extends ${(ext as { $refText: string }).$refText}`;
    }
  }

  return node.$type;
}

/**
 * Find the parent symbol for a node.
 */
function findParentSymbol(
  node: AstNode,
  nodeToSymbol: Map<AstNode, DocumentSymbol>
): DocumentSymbol | null {
  let current = node.$container;
  while (current) {
    const symbol = nodeToSymbol.get(current);
    if (symbol) {
      return symbol;
    }
    current = current.$container;
  }
  return null;
}

/**
 * Remove empty children arrays for cleaner output.
 */
function cleanupEmptyChildren(symbols: DocumentSymbol[]): void {
  for (const symbol of symbols) {
    if (symbol.children && symbol.children.length === 0) {
      delete symbol.children;
    } else if (symbol.children) {
      cleanupEmptyChildren(symbol.children);
    }
  }
}

/**
 * Create a document symbol provider with custom symbol mapping.
 */
export function createDocumentSymbolProvider(
  customMapper?: (node: AstNode) => { kind: SymbolKind; detail?: string } | null
): typeof defaultDocumentSymbolProvider {
  if (!customMapper) {
    return defaultDocumentSymbolProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: DocumentSymbolParams
    ): Promise<DocumentSymbol[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const symbols: DocumentSymbol[] = [];
      const nodeToSymbol = new Map<AstNode, DocumentSymbol>();

      for (const node of streamAllContents(rootNode)) {
        if (!isNamed(node)) {
          continue;
        }

        const mapped = customMapper(node);
        if (!mapped) {
          continue;
        }

        const cstNode = node.$cstNode;
        if (!cstNode) {
          continue;
        }

        const symbol: DocumentSymbol = {
          name: node.name,
          kind: mapped.kind,
          detail: mapped.detail,
          range: {
            start: document.textDocument.positionAt(cstNode.offset),
            end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
          },
          selectionRange: {
            start: document.textDocument.positionAt(cstNode.offset),
            end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
          },
          children: [],
        };

        nodeToSymbol.set(node, symbol);

        const parentSymbol = findParentSymbol(node, nodeToSymbol);
        if (parentSymbol) {
          parentSymbol.children!.push(symbol);
        } else {
          symbols.push(symbol);
        }
      }

      cleanupEmptyChildren(symbols);
      return symbols;
    },
  };
}
