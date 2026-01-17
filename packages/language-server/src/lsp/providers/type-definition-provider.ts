/**
 * Default Type Definition Provider (T040)
 *
 * Provides go-to-type-definition functionality.
 *
 * @packageDocumentation
 */

import type {
  Location,
  LocationLink,
  TypeDefinitionParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffset, getDocument, isNamed, isReference } from 'langium';

/**
 * Default type definition provider.
 */
export const defaultTypeDefinitionProvider = {
  /**
   * Provide type definition locations for the given position.
   */
  async provide(
    context: LspContext,
    params: TypeDefinitionParams
  ): Promise<Location | Location[] | LocationLink[] | null> {
    const { document, services, token } = context;

    // Check for built-in type definition provider first
    const typeDefProvider = services.lsp.TypeDefinitionProvider;
    if (typeDefProvider) {
      try {
        const result = await typeDefProvider.getTypeDefinition(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium TypeDefinitionProvider:', error);
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

    // Find the type for this node
    const typeNode = findTypeDefinition(cstNode.astNode);
    if (!typeNode) {
      return null;
    }

    // Convert to Location
    const targetDoc = getDocument(typeNode);
    const targetCstNode = typeNode.$cstNode;

    if (!targetDoc || !targetCstNode) {
      return null;
    }

    return {
      uri: targetDoc.uri.toString(),
      range: {
        start: targetDoc.textDocument.positionAt(targetCstNode.offset),
        end: targetDoc.textDocument.positionAt(targetCstNode.offset + targetCstNode.length),
      },
    };
  },
};

/**
 * Find the type definition for an AST node.
 */
function findTypeDefinition(astNode: AstNode): AstNode | null {
  // Check if this node has a type property
  if ('type' in astNode) {
    const type = astNode.type;

    // If it's a reference, resolve it
    if (isReference(type) && type.ref) {
      return type.ref;
    }

    // If it's an AST node directly
    if (typeof type === 'object' && type !== null && '$type' in type) {
      return type as AstNode;
    }
  }

  // Check for extends/implements relationships
  for (const prop of ['extends', 'implements', 'supertype', 'baseType']) {
    if (prop in astNode) {
      const value = (astNode as Record<string, unknown>)[prop];

      if (isReference(value) && value.ref) {
        return value.ref;
      }

      // Handle arrays of references (implements multiple interfaces)
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (isReference(first) && first.ref) {
          return first.ref;
        }
      }
    }
  }

  // If this is a variable/property, look for its declared type
  if (isNamed(astNode)) {
    return findDeclaredType(astNode);
  }

  // Walk up to parent and try again
  if (astNode.$container) {
    return findTypeDefinition(astNode.$container);
  }

  return null;
}

/**
 * Find the declared type for a named element.
 */
function findDeclaredType(node: AstNode): AstNode | null {
  // Look for type annotation patterns
  const typeProps = ['type', 'declaredType', 'typeRef', 'returnType'];

  for (const prop of typeProps) {
    if (prop in node) {
      const typeValue = (node as Record<string, unknown>)[prop];

      if (isReference(typeValue) && typeValue.ref) {
        return typeValue.ref;
      }

      if (typeof typeValue === 'object' && typeValue !== null && '$type' in typeValue) {
        return typeValue as AstNode;
      }
    }
  }

  return null;
}

/**
 * Create a type definition provider with custom logic.
 */
export function createTypeDefinitionProvider(
  customResolver?: (astNode: AstNode) => AstNode | null
): typeof defaultTypeDefinitionProvider {
  if (!customResolver) {
    return defaultTypeDefinitionProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: TypeDefinitionParams
    ): Promise<Location | Location[] | LocationLink[] | null> {
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

      const typeNode = customResolver(cstNode.astNode);
      if (!typeNode) {
        return null;
      }

      const targetDoc = getDocument(typeNode);
      const targetCstNode = typeNode.$cstNode;

      if (!targetDoc || !targetCstNode) {
        return null;
      }

      return {
        uri: targetDoc.uri.toString(),
        range: {
          start: targetDoc.textDocument.positionAt(targetCstNode.offset),
          end: targetDoc.textDocument.positionAt(targetCstNode.offset + targetCstNode.length),
        },
      };
    },
  };
}
