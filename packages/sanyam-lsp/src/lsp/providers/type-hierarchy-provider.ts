/**
 * Default Type Hierarchy Provider (T044)
 *
 * Provides type hierarchy for classes/interfaces.
 *
 * @packageDocumentation
 */

import type {
  TypeHierarchyItem,
  TypeHierarchyPrepareParams,
  SymbolKind,
} from 'vscode-languageserver';
import type { LspContext, WorkspaceContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffset, getDocument, isNamed, isReference, streamAllContents } from 'langium';

/**
 * Default type hierarchy provider.
 */
export const defaultTypeHierarchyProvider = {
  /**
   * Prepare type hierarchy items for the given position.
   */
  async prepare(
    context: LspContext,
    params: TypeHierarchyPrepareParams
  ): Promise<TypeHierarchyItem[] | null> {
    const { document, services, token } = context;

    // Check for built-in type hierarchy provider
    const typeHierarchyProvider = services.lsp.TypeHierarchyProvider;
    if (typeHierarchyProvider && 'prepareTypeHierarchy' in typeHierarchyProvider) {
      try {
        const result = await (typeHierarchyProvider as { prepareTypeHierarchy: (doc: unknown, params: TypeHierarchyPrepareParams, token: unknown) => Promise<TypeHierarchyItem[] | null> }).prepareTypeHierarchy(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium TypeHierarchyProvider.prepare:', error);
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

    // Find a type element at this position
    const typeNode = findTypeElement(cstNode.astNode);
    if (!typeNode) {
      return null;
    }

    // Build type hierarchy item
    const item = buildTypeHierarchyItem(typeNode, document);
    if (!item) {
      return null;
    }

    return [item];
  },

  /**
   * Find supertypes (parent classes/interfaces).
   */
  async supertypes(
    item: TypeHierarchyItem,
    context: WorkspaceContext
  ): Promise<TypeHierarchyItem[] | null> {
    const { shared, token } = context;

    // Find the type by URI and position
    const doc = shared.workspace.LangiumDocuments.getDocument(item.uri);
    if (!doc) {
      return null;
    }

    const rootNode = doc.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Find the type at the item position
    const offset = doc.textDocument.positionAt(item.selectionRange.start);
    const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    const typeNode = findTypeElement(cstNode.astNode);
    if (!typeNode) {
      return null;
    }

    // Find supertypes
    const supertypes = findSupertypes(typeNode, shared);

    return supertypes.length > 0 ? supertypes : null;
  },

  /**
   * Find subtypes (child classes/implementations).
   */
  async subtypes(
    item: TypeHierarchyItem,
    context: WorkspaceContext
  ): Promise<TypeHierarchyItem[] | null> {
    const { shared, token } = context;

    // Find the type by URI and position
    const doc = shared.workspace.LangiumDocuments.getDocument(item.uri);
    if (!doc) {
      return null;
    }

    const rootNode = doc.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Find the type at the item position
    const offset = doc.textDocument.positionAt(item.selectionRange.start);
    const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    const typeNode = findTypeElement(cstNode.astNode);
    if (!typeNode) {
      return null;
    }

    // Find subtypes across workspace
    const subtypes = await findSubtypes(typeNode, shared);

    return subtypes.length > 0 ? subtypes : null;
  },
};

/**
 * Find a type element (class, interface, entity) at or containing the given node.
 */
function findTypeElement(astNode: AstNode): AstNode | null {
  let current: AstNode | undefined = astNode;

  while (current) {
    const type = current.$type.toLowerCase();
    if (
      type.includes('class') ||
      type.includes('interface') ||
      type.includes('entity') ||
      type.includes('type') ||
      type.includes('struct') ||
      type.includes('enum')
    ) {
      if (isNamed(current)) {
        return current;
      }
    }
    current = current.$container;
  }

  return null;
}

/**
 * Build a type hierarchy item from an AST node.
 */
function buildTypeHierarchyItem(
  node: AstNode,
  document: LspContext['document']
): TypeHierarchyItem | null {
  if (!isNamed(node)) {
    return null;
  }

  const cstNode = node.$cstNode;
  if (!cstNode) {
    return null;
  }

  const doc = getDocument(node);
  if (!doc) {
    return null;
  }

  return {
    name: node.name,
    kind: getSymbolKind(node),
    uri: doc.uri.toString(),
    range: {
      start: doc.textDocument.positionAt(cstNode.offset),
      end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
    selectionRange: {
      start: doc.textDocument.positionAt(cstNode.offset),
      end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
    data: {
      type: node.$type,
    },
  };
}

/**
 * Get symbol kind for a type node.
 */
function getSymbolKind(node: AstNode): SymbolKind {
  const type = node.$type.toLowerCase();

  if (type.includes('interface')) {
    return 11; // SymbolKind.Interface
  }
  if (type.includes('class')) {
    return 5; // SymbolKind.Class
  }
  if (type.includes('enum')) {
    return 10; // SymbolKind.Enum
  }
  if (type.includes('struct')) {
    return 23; // SymbolKind.Struct
  }

  return 5; // SymbolKind.Class (default)
}

/**
 * Find supertypes of a type node.
 */
function findSupertypes(
  typeNode: AstNode,
  shared: WorkspaceContext['shared']
): TypeHierarchyItem[] {
  const supertypes: TypeHierarchyItem[] = [];

  // Check extends/implements properties
  const superProps = ['extends', 'implements', 'supertype', 'superTypes', 'baseType'];

  for (const prop of superProps) {
    if (!(prop in typeNode)) {
      continue;
    }

    const value = (typeNode as Record<string, unknown>)[prop];

    // Single supertype
    if (isReference(value) && value.ref) {
      const doc = getDocument(value.ref);
      if (doc) {
        const item = buildTypeHierarchyItem(value.ref, doc);
        if (item) {
          supertypes.push(item);
        }
      }
    }

    // Multiple supertypes
    if (Array.isArray(value)) {
      for (const ref of value) {
        if (isReference(ref) && ref.ref) {
          const doc = getDocument(ref.ref);
          if (doc) {
            const item = buildTypeHierarchyItem(ref.ref, doc);
            if (item) {
              supertypes.push(item);
            }
          }
        }
      }
    }
  }

  return supertypes;
}

/**
 * Find subtypes of a type node across the workspace.
 */
async function findSubtypes(
  typeNode: AstNode,
  shared: WorkspaceContext['shared']
): Promise<TypeHierarchyItem[]> {
  const subtypes: TypeHierarchyItem[] = [];
  const targetName = isNamed(typeNode) ? typeNode.name : null;

  if (!targetName) {
    return subtypes;
  }

  // Search all documents
  const documents = shared.workspace.LangiumDocuments;

  for (const doc of documents.all) {
    const rootNode = doc.parseResult?.value;
    if (!rootNode) {
      continue;
    }

    // Find all types that extend/implement this type
    for (const node of streamAllContents(rootNode)) {
      if (isSubtypeOf(node, typeNode, targetName)) {
        const item = buildTypeHierarchyItem(node, doc);
        if (item) {
          subtypes.push(item);
        }
      }
    }
  }

  return subtypes;
}

/**
 * Check if a node is a subtype of the target.
 */
function isSubtypeOf(
  node: AstNode,
  target: AstNode,
  targetName: string
): boolean {
  // Skip the target itself
  if (node === target) {
    return false;
  }

  // Must be a type element
  if (!findTypeElement(node)) {
    return false;
  }

  // Check extends/implements relationships
  const superProps = ['extends', 'implements', 'supertype', 'superTypes', 'baseType'];

  for (const prop of superProps) {
    if (!(prop in node)) {
      continue;
    }

    const value = (node as Record<string, unknown>)[prop];

    if (isReference(value)) {
      if (value.ref === target || value.$refText === targetName) {
        return true;
      }
    }

    if (Array.isArray(value)) {
      for (const ref of value) {
        if (isReference(ref)) {
          if (ref.ref === target || ref.$refText === targetName) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Create a type hierarchy provider with custom logic.
 */
export function createTypeHierarchyProvider(
  customPrepare?: (astNode: AstNode) => AstNode | null
): typeof defaultTypeHierarchyProvider {
  if (!customPrepare) {
    return defaultTypeHierarchyProvider;
  }

  return {
    ...defaultTypeHierarchyProvider,
    async prepare(
      context: LspContext,
      params: TypeHierarchyPrepareParams
    ): Promise<TypeHierarchyItem[] | null> {
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

      const typeNode = customPrepare(cstNode.astNode);
      if (!typeNode) {
        return null;
      }

      const item = buildTypeHierarchyItem(typeNode, document);
      return item ? [item] : null;
    },
  };
}
