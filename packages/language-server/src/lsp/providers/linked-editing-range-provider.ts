/**
 * Default Linked Editing Range Provider (T049)
 *
 * Provides synchronized editing for related text ranges.
 *
 * @packageDocumentation
 */

import type {
  LinkedEditingRanges,
  LinkedEditingRangeParams,
  Range,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode, CstNode, Reference } from 'langium';
import { findLeafNodeAtOffset, isNamed, isReference, streamAllContents } from 'langium';

/**
 * Default linked editing range provider.
 */
export const defaultLinkedEditingRangeProvider = {
  /**
   * Provide linked editing ranges for synchronized editing.
   */
  async provide(
    context: LspContext,
    params: LinkedEditingRangeParams
  ): Promise<LinkedEditingRanges | null> {
    const { document, services, token } = context;

    // Check for built-in linked editing provider first
    const linkedEditingProvider = services.lsp.LinkedEditingRangeProvider;
    if (linkedEditingProvider) {
      try {
        const result = await linkedEditingProvider.getLinkedEditingRanges(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium LinkedEditingRangeProvider:', error);
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
    const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    // Find linked ranges
    const ranges = findLinkedRanges(cstNode.astNode, cstNode, rootNode, document);
    if (!ranges || ranges.length < 2) {
      return null;
    }

    return {
      ranges,
      // Only allow identifier-like characters
      wordPattern: '[a-zA-Z_][a-zA-Z0-9_]*',
    };
  },
};

/**
 * Find all linked ranges for synchronized editing.
 */
function findLinkedRanges(
  astNode: AstNode,
  cstNode: CstNode,
  rootNode: AstNode,
  document: LspContext['document']
): Range[] | null {
  // Find the target element
  const target = findEditTarget(astNode, cstNode);
  if (!target) {
    return null;
  }

  const ranges: Range[] = [];
  const targetName = isNamed(target) ? target.name : null;

  if (!targetName) {
    return null;
  }

  // Add the definition itself
  const targetCstNode = target.$cstNode;
  if (targetCstNode) {
    const nameRange = findNameRange(target, document);
    if (nameRange) {
      ranges.push(nameRange);
    }
  }

  // Find all references in the same document
  for (const node of streamAllContents(rootNode)) {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;

      if (isReference(value)) {
        if (value.ref === target || value.$refText === targetName) {
          const refNode = value.$refNode;
          if (refNode) {
            ranges.push({
              start: document.textDocument.positionAt(refNode.offset),
              end: document.textDocument.positionAt(refNode.offset + refNode.length),
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
                ranges.push({
                  start: document.textDocument.positionAt(refNode.offset),
                  end: document.textDocument.positionAt(refNode.offset + refNode.length),
                });
              }
            }
          }
        }
      }
    }
  }

  return ranges;
}

/**
 * Find the target element for linked editing.
 */
function findEditTarget(astNode: AstNode, cstNode: CstNode): AstNode | null {
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
  for (const [key, value] of Object.entries(astNode)) {
    if (key.startsWith('$')) continue;

    if (isReference(value)) {
      const refNode = value.$refNode;
      if (refNode && containsOffset(refNode, cstNode.offset)) {
        return value;
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isReference(item)) {
          const refNode = item.$refNode;
          if (refNode && containsOffset(refNode, cstNode.offset)) {
            return item;
          }
        }
      }
    }
  }

  if (astNode.$container) {
    return findReferenceAtPosition(astNode.$container, cstNode);
  }

  return null;
}

/**
 * Check if a CST node contains an offset.
 */
function containsOffset(node: CstNode, offset: number): boolean {
  return offset >= node.offset && offset < node.offset + node.length;
}

/**
 * Find the range of just the name in a named element.
 */
function findNameRange(
  target: AstNode,
  document: LspContext['document']
): Range | null {
  const cstNode = target.$cstNode;
  if (!cstNode) {
    return null;
  }

  // For simplicity, use the full CST node range
  // A more sophisticated implementation would find just the name token
  return {
    start: document.textDocument.positionAt(cstNode.offset),
    end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
  };
}

/**
 * Create a linked editing range provider with custom logic.
 */
export function createLinkedEditingRangeProvider(
  customFinder?: (
    astNode: AstNode,
    document: LspContext['document']
  ) => Range[] | null
): typeof defaultLinkedEditingRangeProvider {
  if (!customFinder) {
    return defaultLinkedEditingRangeProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: LinkedEditingRangeParams
    ): Promise<LinkedEditingRanges | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const ranges = customFinder(cstNode.astNode, document);
      if (!ranges || ranges.length < 2) {
        return null;
      }

      return {
        ranges,
        wordPattern: '[a-zA-Z_][a-zA-Z0-9_]*',
      };
    },
  };
}
