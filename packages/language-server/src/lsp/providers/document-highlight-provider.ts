/**
 * Default Document Highlight Provider (T042)
 *
 * Provides document highlighting for occurrences of a symbol.
 *
 * @packageDocumentation
 */

import type {
  DocumentHighlight,
  DocumentHighlightParams,
  DocumentHighlightKind,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode, CstNode, Reference } from 'langium';
import { findLeafNodeAtOffsetSafe, isNamed, streamAllContents } from '../helpers/langium-compat.js';
import { isReference } from 'langium';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default document highlight provider.
 */
export const defaultDocumentHighlightProvider = {
  /**
   * Provide document highlights for the given position.
   */
  async provide(
    context: LspContext,
    params: DocumentHighlightParams
  ): Promise<DocumentHighlight[] | null> {
    const { document, services, token } = context;

    // Check for built-in highlight provider first
    const highlightProvider = services.lsp.DocumentHighlightProvider;
    if (highlightProvider) {
      try {
        const result = await highlightProvider.getDocumentHighlight(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium DocumentHighlightProvider');
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Get offset from position
    const offset = document.textDocument.offsetAt(params.position);

    // Find the CST node at the position
    const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    // Find the target element to highlight
    const target = findHighlightTarget(cstNode.astNode, cstNode);
    if (!target) {
      return null;
    }

    // Find all occurrences in this document
    const highlights = findOccurrencesInDocument(target, rootNode, document);

    return highlights.length > 0 ? highlights : null;
  },
};

/**
 * Find the target element for highlighting.
 */
function findHighlightTarget(astNode: AstNode, cstNode: CstNode): AstNode | null {
  // Check if cursor is on a reference
  const ref = findReferenceAtPosition(astNode, cstNode);
  if (ref && ref.ref) {
    return ref.ref;
  }

  // Check if cursor is on a named element (definition)
  if (isNamed(astNode)) {
    return astNode;
  }

  // Walk up to find a named parent
  let current: AstNode | undefined = astNode;
  while (current) {
    if (isNamed(current)) {
      return current;
    }
    current = current.$container;
  }

  return null;
}

/**
 * Find a reference at the cursor position.
 */
function findReferenceAtPosition(astNode: AstNode, cstNode: CstNode): Reference | null {
  // Check all properties for references
  for (const [key, value] of Object.entries(astNode)) {
    if (key.startsWith('$')) continue;

    if (isReference(value)) {
      const refNode = value.$refNode;
      if (refNode && containsPosition(refNode, cstNode.offset)) {
        return value;
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isReference(item)) {
          const refNode = item.$refNode;
          if (refNode && containsPosition(refNode, cstNode.offset)) {
            return item;
          }
        }
      }
    }
  }

  // Check parent
  if (astNode.$container) {
    return findReferenceAtPosition(astNode.$container, cstNode);
  }

  return null;
}

/**
 * Check if a CST node contains a position.
 */
function containsPosition(node: CstNode, offset: number): boolean {
  return offset >= node.offset && offset < node.offset + node.length;
}

/**
 * Find all occurrences of a target element in the document.
 */
function findOccurrencesInDocument(
  target: AstNode,
  rootNode: AstNode,
  document: LspContext['document']
): DocumentHighlight[] {
  const highlights: DocumentHighlight[] = [];
  const targetName = isNamed(target) ? target.name : null;

  if (!targetName) {
    return highlights;
  }

  // Add highlight for the definition itself
  if (target.$cstNode) {
    highlights.push({
      range: {
        start: document.textDocument.positionAt(target.$cstNode.offset),
        end: document.textDocument.positionAt(target.$cstNode.offset + target.$cstNode.length),
      },
      kind: 2, // DocumentHighlightKind.Write (definition)
    });
  }

  // Find all references in the document
  for (const node of streamAllContents(rootNode)) {
    // Check all properties for references to target
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;

      if (isReference(value)) {
        if (value.ref === target || value.$refText === targetName) {
          const refNode = value.$refNode;
          if (refNode) {
            highlights.push({
              range: {
                start: document.textDocument.positionAt(refNode.offset),
                end: document.textDocument.positionAt(refNode.offset + refNode.length),
              },
              kind: 1, // DocumentHighlightKind.Read
            });
          }
        }
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (isReference(item)) {
            if (item.ref === target || item.$refText === targetName) {
              const refNode = item.$refNode;
              if (refNode) {
                highlights.push({
                  range: {
                    start: document.textDocument.positionAt(refNode.offset),
                    end: document.textDocument.positionAt(refNode.offset + refNode.length),
                  },
                  kind: 1, // DocumentHighlightKind.Read
                });
              }
            }
          }
        }
      }
    }
  }

  return highlights;
}

/**
 * Create a document highlight provider with custom logic.
 */
export function createDocumentHighlightProvider(
  customHighlighter?: (
    target: AstNode,
    document: LspContext['document']
  ) => DocumentHighlight[]
): typeof defaultDocumentHighlightProvider {
  if (!customHighlighter) {
    return defaultDocumentHighlightProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: DocumentHighlightParams
    ): Promise<DocumentHighlight[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const target = findHighlightTarget(cstNode.astNode, cstNode);
      if (!target) {
        return null;
      }

      const highlights = customHighlighter(target, document);

      return highlights.length > 0 ? highlights : null;
    },
  };
}
