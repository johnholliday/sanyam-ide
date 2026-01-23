/**
 * Default Selection Range Provider (T048)
 *
 * Provides smart selection expansion based on AST structure.
 *
 * @packageDocumentation
 */

import type {
  SelectionRange,
  SelectionRangeParams,
  Position,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode, CstNode } from 'langium';
import { findLeafNodeAtOffsetSafe } from '../helpers/langium-compat.js';

/**
 * Default selection range provider.
 */
export const defaultSelectionRangeProvider = {
  /**
   * Provide selection ranges for the given positions.
   */
  async provide(
    context: LspContext,
    params: SelectionRangeParams
  ): Promise<SelectionRange[] | null> {
    const { document, services, token } = context;

    // Note: Langium 4.x doesn't provide a SelectionRangeProvider
    // We use our own implementation below

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    const selectionRanges: SelectionRange[] = [];

    for (const position of params.positions) {
      const range = buildSelectionRangeAtPosition(position, rootNode, document);
      if (range) {
        selectionRanges.push(range);
      }
    }

    return selectionRanges.length > 0 ? selectionRanges : null;
  },
};

/**
 * Build selection range hierarchy at a position.
 */
function buildSelectionRangeAtPosition(
  position: Position,
  rootNode: AstNode,
  document: LspContext['document']
): SelectionRange | null {
  // Get offset from position
  const offset = document.textDocument.offsetAt(position);

  // Find the CST node at the position
  const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
  if (!cstNode) {
    return null;
  }

  // Build hierarchy from leaf to root
  return buildSelectionRangeFromCstNode(cstNode, document);
}

/**
 * Build selection range hierarchy from a CST node up to the root.
 */
function buildSelectionRangeFromCstNode(
  cstNode: CstNode,
  document: LspContext['document']
): SelectionRange | null {
  // Collect all ancestor ranges
  const ranges: { start: number; length: number }[] = [];
  let current: CstNode | undefined = cstNode;

  while (current) {
    // Only add if it's a meaningful range (different from previous)
    const lastRange = ranges[ranges.length - 1];
    if (!lastRange || current.offset !== lastRange.start || current.length !== lastRange.length) {
      ranges.push({ start: current.offset, length: current.length });
    }
    current = current.container;
  }

  if (ranges.length === 0) {
    return null;
  }

  // Build nested SelectionRange from innermost to outermost
  let parent: SelectionRange | undefined;

  // Start from outermost (root) and work inward
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i]!;
    const selectionRange: SelectionRange = {
      range: {
        start: document.textDocument.positionAt(range.start),
        end: document.textDocument.positionAt(range.start + range.length),
      },
      parent,
    };
    parent = selectionRange;
  }

  return parent ?? null;
}

/**
 * Create a selection range provider with custom logic.
 */
export function createSelectionRangeProvider(
  customBuilder?: (
    astNode: AstNode,
    document: LspContext['document']
  ) => SelectionRange | null
): typeof defaultSelectionRangeProvider {
  if (!customBuilder) {
    return defaultSelectionRangeProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: SelectionRangeParams
    ): Promise<SelectionRange[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const selectionRanges: SelectionRange[] = [];

      for (const position of params.positions) {
        const offset = document.textDocument.offsetAt(position);
        const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);

        if (cstNode?.astNode) {
          const range = customBuilder(cstNode.astNode, document);
          if (range) {
            selectionRanges.push(range);
          }
        }
      }

      return selectionRanges.length > 0 ? selectionRanges : null;
    },
  };
}
