/**
 * Default Folding Range Provider (T036)
 *
 * Provides code folding ranges based on AST structure.
 *
 * @packageDocumentation
 */

import type {
  FoldingRange,
  FoldingRangeParams,
  FoldingRangeKind,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { streamAllContents } from '../helpers/langium-compat.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default folding range provider that creates folds for AST blocks.
 */
export const defaultFoldingRangeProvider = {
  /**
   * Provide folding ranges for the document.
   */
  async provide(
    context: LspContext,
    params: FoldingRangeParams
  ): Promise<FoldingRange[] | null> {
    const { document, services, token } = context;

    // Check for built-in folding range provider first
    const foldingProvider = services.lsp.FoldingRangeProvider;
    if (foldingProvider) {
      try {
        const result = await foldingProvider.getFoldingRanges(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium FoldingRangeProvider');
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    const foldingRanges: FoldingRange[] = [];

    // Add folding ranges for AST nodes
    for (const node of streamAllContents(rootNode)) {
      const range = createFoldingRangeForNode(node, document);
      if (range) {
        foldingRanges.push(range);
      }
    }

    // Add folding ranges for comments
    const commentRanges = findCommentFoldingRanges(document);
    foldingRanges.push(...commentRanges);

    // Add folding ranges for import sections
    const importRanges = findImportFoldingRanges(rootNode, document);
    foldingRanges.push(...importRanges);

    // Sort by start line for better editor behavior
    foldingRanges.sort((a, b) => a.startLine - b.startLine);

    return foldingRanges;
  },
};

/**
 * Create a folding range for an AST node if it spans multiple lines.
 */
function createFoldingRangeForNode(
  node: AstNode,
  document: LspContext['document']
): FoldingRange | null {
  const cstNode = node.$cstNode;
  if (!cstNode) {
    return null;
  }

  const startPos = document.textDocument.positionAt(cstNode.offset);
  const endPos = document.textDocument.positionAt(cstNode.offset + cstNode.length);

  // Only create fold if it spans at least 2 lines
  if (endPos.line <= startPos.line) {
    return null;
  }

  // Determine the folding kind
  const kind = getFoldingKind(node);

  return {
    startLine: startPos.line,
    startCharacter: startPos.character,
    endLine: endPos.line,
    endCharacter: endPos.character,
    kind,
  };
}

/**
 * Determine the folding range kind based on AST node type.
 */
function getFoldingKind(node: AstNode): FoldingRangeKind | undefined {
  const type = node.$type.toLowerCase();

  // Import-like nodes
  if (type.includes('import') || type.includes('include') || type.includes('using')) {
    return 'imports';
  }

  // Comment-like nodes
  if (type.includes('comment') || type.includes('documentation')) {
    return 'comment';
  }

  // Region-like nodes
  if (type.includes('region') || type.includes('section')) {
    return 'region';
  }

  return undefined;
}

/**
 * Find folding ranges for comment blocks.
 */
function findCommentFoldingRanges(document: LspContext['document']): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  const text = document.textDocument.getText();
  const lines = text.split('\n');

  let blockCommentStart: number | null = null;
  let lineCommentStart: number | null = null;
  let lastLineCommentLine: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';

    // Handle block comments
    if (line.startsWith('/*')) {
      blockCommentStart = i;
    }
    if (line.endsWith('*/') && blockCommentStart !== null) {
      if (i > blockCommentStart) {
        ranges.push({
          startLine: blockCommentStart,
          endLine: i,
          kind: 'comment',
        });
      }
      blockCommentStart = null;
    }

    // Handle consecutive line comments
    if (line.startsWith('//')) {
      if (lineCommentStart === null) {
        lineCommentStart = i;
      }
      lastLineCommentLine = i;
    } else {
      if (lineCommentStart !== null && lastLineCommentLine !== null) {
        if (lastLineCommentLine - lineCommentStart >= 2) {
          ranges.push({
            startLine: lineCommentStart,
            endLine: lastLineCommentLine,
            kind: 'comment',
          });
        }
      }
      lineCommentStart = null;
      lastLineCommentLine = null;
    }
  }

  // Handle unclosed comment at end of file
  if (lineCommentStart !== null && lastLineCommentLine !== null) {
    if (lastLineCommentLine - lineCommentStart >= 2) {
      ranges.push({
        startLine: lineCommentStart,
        endLine: lastLineCommentLine,
        kind: 'comment',
      });
    }
  }

  return ranges;
}

/**
 * Find folding ranges for import sections.
 */
function findImportFoldingRanges(
  rootNode: AstNode,
  document: LspContext['document']
): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Find all import-like nodes
  const imports: AstNode[] = [];
  for (const node of streamAllContents(rootNode)) {
    const type = node.$type.toLowerCase();
    if (type.includes('import') || type.includes('include') || type.includes('using')) {
      imports.push(node);
    }
  }

  // If there are multiple consecutive imports, create a single fold for all of them
  if (imports.length >= 2) {
    const firstImport = imports[0];
    const lastImport = imports[imports.length - 1];

    if (firstImport?.$cstNode && lastImport?.$cstNode) {
      const startPos = document.textDocument.positionAt(firstImport.$cstNode.offset);
      const endPos = document.textDocument.positionAt(
        lastImport.$cstNode.offset + lastImport.$cstNode.length
      );

      if (endPos.line > startPos.line) {
        ranges.push({
          startLine: startPos.line,
          endLine: endPos.line,
          kind: 'imports',
        });
      }
    }
  }

  return ranges;
}

/**
 * Create a folding range provider with custom folding logic.
 */
export function createFoldingRangeProvider(
  customFoldingRules?: (node: AstNode) => boolean
): typeof defaultFoldingRangeProvider {
  if (!customFoldingRules) {
    return defaultFoldingRangeProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: FoldingRangeParams
    ): Promise<FoldingRange[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const foldingRanges: FoldingRange[] = [];

      for (const node of streamAllContents(rootNode)) {
        // Use custom rules to determine if node should be foldable
        if (!customFoldingRules(node)) {
          continue;
        }

        const range = createFoldingRangeForNode(node, document);
        if (range) {
          foldingRanges.push(range);
        }
      }

      // Add standard comment ranges
      const commentRanges = findCommentFoldingRanges(document);
      foldingRanges.push(...commentRanges);

      foldingRanges.sort((a, b) => a.startLine - b.startLine);

      return foldingRanges;
    },
  };
}
