/**
 * Default Hover Provider (T030)
 *
 * Provides hover information showing AST node name, type, and documentation.
 *
 * @packageDocumentation
 */

import type {
  Hover,
  HoverParams,
  MarkupContent,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode, CstNode } from 'langium';
import { findLeafNodeAtOffsetSafe, getDocument, isNamed } from '../helpers/langium-compat.js';

/**
 * Default hover provider that shows AST node information.
 */
export const defaultHoverProvider = {
  /**
   * Provide hover information for the given position.
   */
  async provide(
    context: LspContext,
    params: HoverParams
  ): Promise<Hover | null> {
    const { document, services, token } = context;

    // Check for built-in hover provider first
    const hoverProvider = services.lsp.HoverProvider;
    if (hoverProvider) {
      try {
        const result = await hoverProvider.getHoverContent(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium HoverProvider:', error);
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
    const cstNode = findLeafNodeAtOffsetSafe(document.parseResult.value.$cstNode, offset);
    if (!cstNode) {
      return null;
    }

    // Get the AST node containing this CST node
    const astNode = cstNode.astNode;
    if (!astNode) {
      return null;
    }

    // Build hover content
    const content = buildHoverContent(astNode, cstNode, services);
    if (!content) {
      return null;
    }

    // Calculate the range for the hovered element
    const range = {
      start: document.textDocument.positionAt(cstNode.offset),
      end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
    };

    return {
      contents: content,
      range,
    };
  },
};

/**
 * Build markdown hover content for an AST node.
 */
function buildHoverContent(
  astNode: AstNode,
  cstNode: CstNode,
  services: LspContext['services']
): MarkupContent | null {
  const lines: string[] = [];

  // Get the AST node type
  const nodeType = astNode.$type;
  if (nodeType) {
    lines.push(`**${nodeType}**`);
  }

  // Get the name if this is a named element
  if (isNamed(astNode)) {
    lines.push(`\n*Name:* \`${astNode.name}\``);
  }

  // Try to get documentation from the AST node
  const documentation = getNodeDocumentation(astNode);
  if (documentation) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(documentation);
  }

  // Add container information
  const container = astNode.$container;
  if (container) {
    const containerType = container.$type;
    const containerName = isNamed(container) ? ` \`${container.name}\`` : '';
    lines.push('');
    lines.push(`*Contained in:* ${containerType}${containerName}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    kind: 'markdown',
    value: lines.join('\n'),
  };
}

/**
 * Extract documentation from an AST node.
 *
 * Looks for JSDoc-style comments or description properties.
 */
function getNodeDocumentation(astNode: AstNode): string | null {
  // Check for a description property
  if ('description' in astNode && typeof astNode.description === 'string') {
    return astNode.description;
  }

  // Check for a documentation property
  if ('documentation' in astNode && typeof astNode.documentation === 'string') {
    return astNode.documentation;
  }

  // Check for JSDoc-style comments in the CST
  const cstNode = astNode.$cstNode;
  if (cstNode) {
    const doc = getDocument(astNode);
    if (doc) {
      // Look for hidden tokens (comments) before the node
      const text = doc.textDocument.getText({
        start: doc.textDocument.positionAt(Math.max(0, cstNode.offset - 500)),
        end: doc.textDocument.positionAt(cstNode.offset),
      });

      // Find JSDoc-style comment
      const jsdocMatch = text.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);
      if (jsdocMatch && jsdocMatch[1]) {
        // Clean up the JSDoc content
        return jsdocMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*\*\s?/, ''))
          .join('\n')
          .trim();
      }

      // Find single-line comment
      const lineCommentMatch = text.match(/\/\/\s*(.+?)\s*$/);
      if (lineCommentMatch && lineCommentMatch[1]) {
        return lineCommentMatch[1];
      }
    }
  }

  return null;
}

/**
 * Create a hover provider with custom content builder.
 *
 * @param customBuilder - Custom function to build hover content
 * @returns A configured hover provider
 */
export function createHoverProvider(
  customBuilder?: (astNode: AstNode, services: LspContext['services']) => MarkupContent | null
): typeof defaultHoverProvider {
  if (!customBuilder) {
    return defaultHoverProvider;
  }

  return {
    async provide(context: LspContext, params: HoverParams): Promise<Hover | null> {
      const { document, services } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffsetSafe(document.parseResult.value.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const content = customBuilder(cstNode.astNode, services);
      if (!content) {
        return null;
      }

      return {
        contents: content,
        range: {
          start: document.textDocument.positionAt(cstNode.offset),
          end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
        },
      };
    },
  };
}
