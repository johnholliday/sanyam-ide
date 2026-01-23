/**
 * Default Rename Provider (T034)
 *
 * Provides symbol renaming using Langium's RenameProvider.
 *
 * @packageDocumentation
 */

import type {
  WorkspaceEdit,
  RenameParams,
  PrepareRenameParams,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffsetSafe, getDocument, isNamed } from '../helpers/langium-compat.js';

/**
 * Default rename provider that uses Langium's rename service.
 */
export const defaultRenameProvider = {
  /**
   * Prepare a rename operation - check if rename is valid at position.
   */
  async prepare(
    context: LspContext,
    params: PrepareRenameParams
  ): Promise<Range | { range: Range; placeholder: string } | null> {
    const { document, services, token } = context;

    // Check for built-in rename provider first
    const renameProvider = services.lsp.RenameProvider;
    if (renameProvider && 'prepareRename' in renameProvider) {
      try {
        const result = await (renameProvider as { prepareRename: (doc: unknown, params: PrepareRenameParams, token: unknown) => Promise<Range | { range: Range; placeholder: string } | null> }).prepareRename(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium RenameProvider.prepareRename:', error);
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

    // Check if this is a renameable element
    const target = findRenameableElement(cstNode.astNode);
    if (!target) {
      return null;
    }

    // Get the name range
    const nameRange = getNameRange(target, document);
    if (!nameRange) {
      return null;
    }

    return {
      range: nameRange,
      placeholder: target.name,
    };
  },

  /**
   * Perform the rename operation.
   */
  async provide(
    context: LspContext,
    params: RenameParams
  ): Promise<WorkspaceEdit | null> {
    const { document, services, shared, token } = context;

    // Check for built-in rename provider first
    const renameProvider = services.lsp.RenameProvider;
    if (renameProvider) {
      try {
        const result = await renameProvider.rename(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium RenameProvider:', error);
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

    // Find the element to rename
    const target = findRenameableElement(cstNode.astNode);
    if (!target) {
      return null;
    }

    // Validate the new name
    if (!isValidName(params.newName)) {
      return null;
    }

    // Build workspace edit with all changes
    const edits = await buildRenameEdits(target, params.newName, shared);

    return edits;
  },
};

/**
 * Find a renameable element at or containing the given AST node.
 */
function findRenameableElement(
  astNode: AstNode
): (AstNode & { name: string }) | null {
  // Check if this node is named
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
 * Get the range of the name in a named element.
 */
function getNameRange(
  target: AstNode & { name: string },
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
 * Validate that a name is valid for the language.
 */
function isValidName(name: string): boolean {
  // Basic validation - must be non-empty and start with letter or underscore
  if (!name || name.length === 0) {
    return false;
  }

  // Must match identifier pattern
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return identifierPattern.test(name);
}

/**
 * Build workspace edits for renaming an element.
 */
async function buildRenameEdits(
  target: AstNode & { name: string },
  newName: string,
  shared: LspContext['shared']
): Promise<WorkspaceEdit> {
  const changes: { [uri: string]: TextEdit[] } = {};

  // Add edit for the definition
  const targetDoc = getDocument(target);
  const targetCstNode = target.$cstNode;
  if (targetDoc && targetCstNode) {
    const uri = targetDoc.uri.toString();
    if (!changes[uri]) {
      changes[uri] = [];
    }

    // Find the name within the CST node
    // For now, assume the name is at the start of the node
    const text = targetDoc.textDocument.getText({
      start: targetDoc.textDocument.positionAt(targetCstNode.offset),
      end: targetDoc.textDocument.positionAt(targetCstNode.offset + targetCstNode.length),
    });

    const nameIndex = text.indexOf(target.name);
    if (nameIndex >= 0) {
      const nameStart = targetCstNode.offset + nameIndex;
      changes[uri].push({
        range: {
          start: targetDoc.textDocument.positionAt(nameStart),
          end: targetDoc.textDocument.positionAt(nameStart + target.name.length),
        },
        newText: newName,
      });
    }
  }

  // Find and add edits for all references
  // Note: In Langium 4.x, References is on language-specific services, not shared services
  const references: { findReferences?: (target: AstNode) => Iterable<{ sourceNode: AstNode }> } | undefined = undefined;
  if (references && 'findReferences' in references) {
    try {
      const finder = references as { findReferences: (target: AstNode) => Iterable<{ sourceNode: AstNode }> };
      for (const ref of finder.findReferences(target)) {
        const refDoc = getDocument(ref.sourceNode);
        const refCstNode = ref.sourceNode.$cstNode;
        if (refDoc && refCstNode) {
          const uri = refDoc.uri.toString();
          if (!changes[uri]) {
            changes[uri] = [];
          }

          // Find the reference text
          const text = refDoc.textDocument.getText({
            start: refDoc.textDocument.positionAt(refCstNode.offset),
            end: refDoc.textDocument.positionAt(refCstNode.offset + refCstNode.length),
          });

          const nameIndex = text.indexOf(target.name);
          if (nameIndex >= 0) {
            const nameStart = refCstNode.offset + nameIndex;
            changes[uri].push({
              range: {
                start: refDoc.textDocument.positionAt(nameStart),
                end: refDoc.textDocument.positionAt(nameStart + target.name.length),
              },
              newText: newName,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error finding references for rename:', error);
    }
  }

  return { changes };
}

/**
 * Create a rename provider with custom validation.
 */
export function createRenameProvider(
  customValidator?: (name: string, target: AstNode) => boolean
): typeof defaultRenameProvider {
  if (!customValidator) {
    return defaultRenameProvider;
  }

  return {
    ...defaultRenameProvider,
    async provide(
      context: LspContext,
      params: RenameParams
    ): Promise<WorkspaceEdit | null> {
      const { document, shared } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const target = findRenameableElement(cstNode.astNode);
      if (!target) {
        return null;
      }

      // Use custom validator
      if (!customValidator(params.newName, target)) {
        return null;
      }

      return buildRenameEdits(target, params.newName, shared);
    },
  };
}
