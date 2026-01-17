/**
 * Default References Provider (T032)
 *
 * Provides find-all-references functionality using Langium's ReferenceFinder.
 *
 * @packageDocumentation
 */

import type {
  Location,
  ReferenceParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffset, getDocument, isNamed } from 'langium';

/**
 * Default references provider that uses Langium's reference finding.
 */
export const defaultReferencesProvider = {
  /**
   * Find all references to the element at the given position.
   */
  async provide(
    context: LspContext,
    params: ReferenceParams
  ): Promise<Location[] | null> {
    const { document, services, shared, token } = context;

    // Check for built-in references provider first
    const referencesProvider = services.lsp.ReferencesProvider;
    if (referencesProvider) {
      try {
        const result = await referencesProvider.getReferences(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium ReferencesProvider:', error);
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

    // Find the target element (could be a reference or a definition)
    const targetElement = findTargetElement(cstNode.astNode);
    if (!targetElement) {
      return null;
    }

    // Find all references using the reference finder
    const references = await findAllReferences(
      targetElement,
      shared,
      params.context.includeDeclaration
    );

    return references;
  },
};

/**
 * Find the target element for reference search.
 *
 * If at a reference, returns the referenced element.
 * If at a definition, returns the definition.
 */
function findTargetElement(astNode: AstNode): AstNode | null {
  // Check if this is a named element (definition)
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
 * Find all references to a target element across the workspace.
 */
async function findAllReferences(
  target: AstNode,
  shared: LspContext['shared'],
  includeDeclaration: boolean
): Promise<Location[]> {
  const locations: Location[] = [];

  // Get all documents in the workspace
  const documents = shared.workspace.LangiumDocuments;

  // Get the reference finder
  const references = shared.References;

  // If we have a reference finder, use it
  if (references && 'findReferences' in references) {
    try {
      const finder = references as { findReferences: (target: AstNode) => Iterable<{ sourceNode: AstNode; targetNode: AstNode }> };
      for (const ref of finder.findReferences(target)) {
        const sourceDoc = getDocument(ref.sourceNode);
        const sourceCstNode = ref.sourceNode.$cstNode;
        if (sourceDoc && sourceCstNode) {
          locations.push({
            uri: sourceDoc.uri.toString(),
            range: {
              start: sourceDoc.textDocument.positionAt(sourceCstNode.offset),
              end: sourceDoc.textDocument.positionAt(
                sourceCstNode.offset + sourceCstNode.length
              ),
            },
          });
        }
      }
    } catch (error) {
      console.error('Error finding references:', error);
    }
  }

  // Add the declaration if requested
  if (includeDeclaration) {
    const targetDoc = getDocument(target);
    const targetCstNode = target.$cstNode;
    if (targetDoc && targetCstNode) {
      // Check if declaration is already in the list
      const declUri = targetDoc.uri.toString();
      const declOffset = targetCstNode.offset;
      const alreadyIncluded = locations.some(
        loc => loc.uri === declUri &&
               targetDoc.textDocument.offsetAt(loc.range.start) === declOffset
      );

      if (!alreadyIncluded) {
        locations.unshift({
          uri: declUri,
          range: {
            start: targetDoc.textDocument.positionAt(declOffset),
            end: targetDoc.textDocument.positionAt(declOffset + targetCstNode.length),
          },
        });
      }
    }
  }

  return locations;
}

/**
 * Create a references provider with custom logic.
 */
export function createReferencesProvider(
  customFinder?: (target: AstNode, shared: LspContext['shared']) => Promise<Location[]>
): typeof defaultReferencesProvider {
  if (!customFinder) {
    return defaultReferencesProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: ReferenceParams
    ): Promise<Location[] | null> {
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

      const targetElement = findTargetElement(cstNode.astNode);
      if (!targetElement) {
        return null;
      }

      const references = await customFinder(targetElement, shared);

      // Add declaration if requested and not already included
      if (params.context.includeDeclaration) {
        const targetDoc = getDocument(targetElement);
        const targetCstNode = targetElement.$cstNode;
        if (targetDoc && targetCstNode) {
          const declUri = targetDoc.uri.toString();
          const declOffset = targetCstNode.offset;
          const alreadyIncluded = references.some(
            loc => loc.uri === declUri &&
                   targetDoc.textDocument.offsetAt(loc.range.start) === declOffset
          );

          if (!alreadyIncluded) {
            references.unshift({
              uri: declUri,
              range: {
                start: targetDoc.textDocument.positionAt(declOffset),
                end: targetDoc.textDocument.positionAt(declOffset + targetCstNode.length),
              },
            });
          }
        }
      }

      return references;
    },
  };
}
