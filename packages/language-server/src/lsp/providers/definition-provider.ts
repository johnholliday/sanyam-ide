/**
 * Default Definition Provider (T031)
 *
 * Provides go-to-definition functionality using Langium's reference resolution.
 *
 * @packageDocumentation
 */

import type {
  Location,
  LocationLink,
  DefinitionParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode, CstNode, Reference } from 'langium';
import { findLeafNodeAtOffsetSafe, getDocument, isNamed } from '../helpers/langium-compat.js';
import { isReference } from 'langium';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default definition provider that uses Langium's reference resolution.
 */
export const defaultDefinitionProvider = {
  /**
   * Provide definition locations for the given position.
   */
  async provide(
    context: LspContext,
    params: DefinitionParams
  ): Promise<Location | Location[] | LocationLink[] | null> {
    const { document, services, token } = context;

    // Check for built-in definition provider first
    const definitionProvider = services.lsp.DefinitionProvider;
    if (definitionProvider) {
      try {
        const result = await definitionProvider.getDefinition(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium DefinitionProvider');
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
    if (!cstNode) {
      return null;
    }

    // Get the AST node
    const astNode = cstNode.astNode;
    if (!astNode) {
      return null;
    }

    // Try to find a reference at this position
    const definition = findDefinitionTarget(astNode, cstNode, services);
    if (!definition) {
      return null;
    }

    // Convert to Location
    const targetDoc = getDocument(definition);
    if (!targetDoc) {
      return null;
    }

    const targetCstNode = definition.$cstNode;
    if (!targetCstNode) {
      return null;
    }

    const location: Location = {
      uri: targetDoc.uri.toString(),
      range: {
        start: targetDoc.textDocument.positionAt(targetCstNode.offset),
        end: targetDoc.textDocument.positionAt(targetCstNode.offset + targetCstNode.length),
      },
    };

    return location;
  },
};

/**
 * Find the definition target for an AST node.
 *
 * If the node is a reference, returns the referenced element.
 * If the node is a definition, returns itself.
 */
function findDefinitionTarget(
  astNode: AstNode,
  cstNode: CstNode,
  services: LspContext['services']
): AstNode | null {
  // Check if this node has a reference property
  // Walk up through the AST to find references
  const refInfo = findReferenceAtCstNode(astNode, cstNode);
  if (refInfo) {
    const resolved = refInfo.ref;
    if (resolved) {
      return resolved;
    }
  }

  // If the node itself is a named element, return it (definition site)
  if (isNamed(astNode)) {
    return astNode;
  }

  // Check parent for named elements
  if (astNode.$container && isNamed(astNode.$container)) {
    return astNode.$container;
  }

  return null;
}

/**
 * Find a reference at the given CST node position.
 */
function findReferenceAtCstNode(
  astNode: AstNode,
  cstNode: CstNode
): Reference | null {
  // Check all properties of the AST node for references
  for (const [key, value] of Object.entries(astNode)) {
    if (key.startsWith('$')) continue;

    if (isReference(value)) {
      // Check if this reference's CST node matches
      const refCstNode = value.$refNode;
      if (refCstNode && doesCstNodeContain(refCstNode, cstNode)) {
        return value;
      }
    }

    // Handle arrays of references
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isReference(item)) {
          const refCstNode = item.$refNode;
          if (refCstNode && doesCstNodeContain(refCstNode, cstNode)) {
            return item;
          }
        }
      }
    }
  }

  // Check parent node
  if (astNode.$container) {
    return findReferenceAtCstNode(astNode.$container, cstNode);
  }

  return null;
}

/**
 * Check if a CST node contains another CST node.
 */
function doesCstNodeContain(parent: CstNode, child: CstNode): boolean {
  return (
    parent.offset <= child.offset &&
    parent.offset + parent.length >= child.offset + child.length
  );
}

/**
 * Create a definition provider with custom logic.
 *
 * @param customResolver - Custom function to resolve definitions
 * @returns A configured definition provider
 */
export function createDefinitionProvider(
  customResolver?: (
    astNode: AstNode,
    services: LspContext['services']
  ) => AstNode | null
): typeof defaultDefinitionProvider {
  if (!customResolver) {
    return defaultDefinitionProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: DefinitionParams
    ): Promise<Location | Location[] | LocationLink[] | null> {
      const { document, services } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const definition = customResolver(cstNode.astNode, services);
      if (!definition) {
        return null;
      }

      const targetDoc = getDocument(definition);
      if (!targetDoc || !definition.$cstNode) {
        return null;
      }

      return {
        uri: targetDoc.uri.toString(),
        range: {
          start: targetDoc.textDocument.positionAt(definition.$cstNode.offset),
          end: targetDoc.textDocument.positionAt(
            definition.$cstNode.offset + definition.$cstNode.length
          ),
        },
      };
    },
  };
}
