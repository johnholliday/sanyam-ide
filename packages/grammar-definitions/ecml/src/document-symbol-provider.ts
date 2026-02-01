/**
 * Custom Document Symbol Provider for ECML
 *
 * Provides document outline symbols for the ECML language.
 * Overrides Langium's default provider to ensure proper symbol extraction
 * from the ECML AST structure.
 *
 * @packageDocumentation
 */

import type { AstNode, CstNode, LangiumDocument, MaybePromise } from 'langium';
import { AstUtils } from 'langium';
import type { DocumentSymbolProvider, LangiumServices } from 'langium/lsp';
import type { DocumentSymbol, DocumentSymbolParams, SymbolKind } from 'vscode-languageserver-protocol';

/** AST types that should appear as outline symbols. */
const NAMED_TYPES = new Set([
  'Actor',
  'Activity',
  'Task',
  'Content',
  'Workflow',
  'SecurityGroup',
  'Permission',
  'RetentionLabel',
  'SensitivityLabel',
  'PropertyDeclaration',
]);

/** Map AST type names to LSP SymbolKind values. */
const SYMBOL_KIND_MAP: Record<string, SymbolKind> = {
  Actor: 5,              // Class
  Activity: 6,           // Method
  Task: 6,               // Method
  Content: 8,            // File
  Workflow: 2,           // Module
  SecurityGroup: 11,     // Interface
  Permission: 14,        // Key
  RetentionLabel: 20,    // EnumMember
  SensitivityLabel: 20,  // EnumMember
  PropertyDeclaration: 7, // Property
};

/**
 * Custom ECML Document Symbol Provider.
 *
 * Traverses the ECML AST recursively and produces a hierarchical
 * symbol tree for the outline view.
 */
export class EcmlDocumentSymbolProvider implements DocumentSymbolProvider {
  constructor(_services: LangiumServices) {
    // Registered via ecmlCustomModule in contribution.ts
  }

  getSymbols(
    document: LangiumDocument,
    _params: DocumentSymbolParams
  ): MaybePromise<DocumentSymbol[]> {
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return [];
    }
    return this.buildSymbols(document, rootNode);
  }

  /**
   * Build hierarchical document symbols starting from a given AST node.
   */
  private buildSymbols(document: LangiumDocument, node: AstNode): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];

    for (const child of AstUtils.streamContents(node)) {
      const symbol = this.toDocumentSymbol(document, child);
      if (symbol) {
        symbols.push(symbol);
      } else {
        // If this node isn't named, check its children (e.g., union type wrappers)
        const nested = this.buildSymbols(document, child);
        symbols.push(...nested);
      }
    }
    return symbols;
  }

  /**
   * Convert an AST node to a DocumentSymbol if it's a recognized named type.
   */
  private toDocumentSymbol(document: LangiumDocument, node: AstNode): DocumentSymbol | null {
    const typeName = node.$type;
    if (!NAMED_TYPES.has(typeName)) {
      return null;
    }

    const name = this.getNodeName(node);
    if (!name) {
      return null;
    }

    const cstNode = node.$cstNode;
    if (!cstNode) {
      return null;
    }

    const kind = SYMBOL_KIND_MAP[typeName] ?? 5; // default to Class
    const children = this.buildSymbols(document, node);

    const symbol: DocumentSymbol = {
      name,
      kind,
      detail: typeName,
      range: cstNode.range,
      selectionRange: this.getNameRange(node, cstNode),
      ...(children.length > 0 ? { children } : {}),
    };

    return symbol;
  }

  /**
   * Extract the display name from a node.
   *
   * ECML nodes use `title` (a quoted string) as display text
   * and `name` (an identifier) as the programmatic name.
   * We show `title` when available, falling back to `name`.
   */
  private getNodeName(node: AstNode): string | undefined {
    const record = node as unknown as Record<string, unknown>;
    const title = record['title'];
    const name = record['name'];

    if (typeof title === 'string') {
      // Strip surrounding quotes from TEXT tokens
      return title.replace(/^['"]|['"]$/g, '');
    }
    if (typeof name === 'string') {
      return name;
    }
    // PropertyDeclaration has a nested PropertyName
    if (record['name'] && typeof record['name'] === 'object') {
      const propName = (record['name'] as Record<string, unknown>)['name'];
      if (typeof propName === 'string') {
        return propName;
      }
    }
    return undefined;
  }

  /**
   * Get the selection range for the name portion of the node.
   *
   * Tries to find the CST node for the `name` property specifically.
   * Falls back to the full CST node range.
   */
  private getNameRange(node: AstNode, cstNode: CstNode): DocumentSymbol['selectionRange'] {
    // Try to find the name assignment in the CST
    const record = node as unknown as Record<string, unknown>;
    const nameVal = record['name'];
    if (nameVal && typeof nameVal === 'object' && '$cstNode' in (nameVal as object)) {
      const nameCst = (nameVal as { $cstNode?: CstNode }).$cstNode;
      if (nameCst) {
        return nameCst.range;
      }
    }
    return cstNode.range;
  }
}
