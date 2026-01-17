/**
 * Default Implementation Provider (T041)
 *
 * Provides go-to-implementation functionality.
 *
 * @packageDocumentation
 */

import type {
  Location,
  LocationLink,
  ImplementationParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffset, getDocument, isNamed, isReference, streamAllContents } from 'langium';

/**
 * Default implementation provider.
 */
export const defaultImplementationProvider = {
  /**
   * Provide implementation locations for the given position.
   */
  async provide(
    context: LspContext,
    params: ImplementationParams
  ): Promise<Location | Location[] | LocationLink[] | null> {
    const { document, services, shared, token } = context;

    // Check for built-in implementation provider first
    const implProvider = services.lsp.ImplementationProvider;
    if (implProvider) {
      try {
        const result = await implProvider.getImplementation(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium ImplementationProvider:', error);
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

    // Find the target element (interface/abstract class)
    const target = findTargetForImplementation(cstNode.astNode);
    if (!target) {
      return null;
    }

    // Find all implementations across the workspace
    const implementations = await findImplementations(target, shared);

    if (implementations.length === 0) {
      return null;
    }

    return implementations;
  },
};

/**
 * Find the target element for finding implementations.
 */
function findTargetForImplementation(astNode: AstNode): AstNode | null {
  // If this is a named element, use it
  if (isNamed(astNode)) {
    // Check if it's an interface or abstract type
    const type = astNode.$type.toLowerCase();
    if (
      type.includes('interface') ||
      type.includes('abstract') ||
      type.includes('protocol') ||
      type.includes('trait')
    ) {
      return astNode;
    }

    // Also check for abstract modifier
    if ('abstract' in astNode && astNode.abstract) {
      return astNode;
    }

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
 * Find all implementations of a target element across the workspace.
 */
async function findImplementations(
  target: AstNode,
  shared: LspContext['shared']
): Promise<Location[]> {
  const locations: Location[] = [];
  const targetName = isNamed(target) ? target.name : null;

  if (!targetName) {
    return locations;
  }

  // Search all documents in the workspace
  const documents = shared.workspace.LangiumDocuments;

  for (const doc of documents.all) {
    const rootNode = doc.parseResult?.value;
    if (!rootNode) {
      continue;
    }

    // Find all nodes that implement/extend the target
    for (const node of streamAllContents(rootNode)) {
      if (isImplementationOf(node, target, targetName)) {
        const cstNode = node.$cstNode;
        if (cstNode) {
          locations.push({
            uri: doc.uri.toString(),
            range: {
              start: doc.textDocument.positionAt(cstNode.offset),
              end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
            },
          });
        }
      }
    }
  }

  return locations;
}

/**
 * Check if a node implements the target.
 */
function isImplementationOf(
  node: AstNode,
  target: AstNode,
  targetName: string
): boolean {
  // Skip the target itself
  if (node === target) {
    return false;
  }

  // Check implements/extends relationships
  const implementsProps = ['implements', 'extends', 'supertype', 'baseType', 'superTypes'];

  for (const prop of implementsProps) {
    if (!(prop in node)) {
      continue;
    }

    const value = (node as Record<string, unknown>)[prop];

    // Single reference
    if (isReference(value)) {
      if (value.ref === target) {
        return true;
      }
      // Check by name as fallback
      if (value.$refText === targetName) {
        return true;
      }
    }

    // Array of references
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isReference(item)) {
          if (item.ref === target) {
            return true;
          }
          if (item.$refText === targetName) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Create an implementation provider with custom logic.
 */
export function createImplementationProvider(
  customFinder?: (target: AstNode, shared: LspContext['shared']) => Promise<Location[]>
): typeof defaultImplementationProvider {
  if (!customFinder) {
    return defaultImplementationProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: ImplementationParams
    ): Promise<Location | Location[] | LocationLink[] | null> {
      const { document, shared } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const target = findTargetForImplementation(cstNode.astNode);
      if (!target) {
        return null;
      }

      const implementations = await customFinder(target, shared);

      if (implementations.length === 0) {
        return null;
      }

      return implementations;
    },
  };
}
