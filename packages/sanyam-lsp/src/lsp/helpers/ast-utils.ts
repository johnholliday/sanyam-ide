/**
 * AST Utility Helpers (T053)
 *
 * Utilities for working with Langium AST nodes.
 *
 * @packageDocumentation
 */

import type { AstNode, CstNode, LangiumDocument } from 'langium';
import { isNamed, getDocument, streamAllContents, findLeafNodeAtOffset } from 'langium';

/**
 * Get the name of an AST node if it has one.
 *
 * @param node - The AST node
 * @returns The name or undefined if not named
 */
export function getNodeName(node: AstNode): string | undefined {
  if (isNamed(node)) {
    return node.name;
  }
  return undefined;
}

/**
 * Get the path from the root to a node.
 *
 * @param node - The AST node
 * @returns Array of nodes from root to this node
 */
export function getNodePath(node: AstNode): AstNode[] {
  const path: AstNode[] = [];
  let current: AstNode | undefined = node;

  while (current) {
    path.unshift(current);
    current = current.$container;
  }

  return path;
}

/**
 * Get the depth of a node in the AST tree.
 *
 * @param node - The AST node
 * @returns Depth from root (root = 0)
 */
export function getNodeDepth(node: AstNode): number {
  let depth = 0;
  let current: AstNode | undefined = node.$container;

  while (current) {
    depth++;
    current = current.$container;
  }

  return depth;
}

/**
 * Find all descendants of a given type.
 *
 * @param root - The root node to search from
 * @param type - The AST type to find
 * @returns Array of matching nodes
 */
export function findDescendantsByType<T extends AstNode>(
  root: AstNode,
  type: string
): T[] {
  const results: T[] = [];

  for (const node of streamAllContents(root)) {
    if (node.$type === type) {
      results.push(node as T);
    }
  }

  return results;
}

/**
 * Find all named descendants.
 *
 * @param root - The root node to search from
 * @returns Array of named nodes
 */
export function findNamedDescendants(root: AstNode): (AstNode & { name: string })[] {
  const results: (AstNode & { name: string })[] = [];

  for (const node of streamAllContents(root)) {
    if (isNamed(node)) {
      results.push(node);
    }
  }

  return results;
}

/**
 * Find the first ancestor of a given type.
 *
 * @param node - The starting node
 * @param type - The AST type to find
 * @returns The matching ancestor or undefined
 */
export function findAncestorByType<T extends AstNode>(
  node: AstNode,
  type: string
): T | undefined {
  let current: AstNode | undefined = node.$container;

  while (current) {
    if (current.$type === type) {
      return current as T;
    }
    current = current.$container;
  }

  return undefined;
}

/**
 * Find the first named ancestor.
 *
 * @param node - The starting node
 * @returns The named ancestor or undefined
 */
export function findNamedAncestor(
  node: AstNode
): (AstNode & { name: string }) | undefined {
  let current: AstNode | undefined = node.$container;

  while (current) {
    if (isNamed(current)) {
      return current;
    }
    current = current.$container;
  }

  return undefined;
}

/**
 * Get the root node from any node in the tree.
 *
 * @param node - The starting node
 * @returns The root node
 */
export function getRoot(node: AstNode): AstNode {
  let current = node;
  while (current.$container) {
    current = current.$container;
  }
  return current;
}

/**
 * Check if one node is an ancestor of another.
 *
 * @param ancestor - Potential ancestor node
 * @param descendant - Potential descendant node
 * @returns True if ancestor is an ancestor of descendant
 */
export function isAncestor(ancestor: AstNode, descendant: AstNode): boolean {
  let current: AstNode | undefined = descendant.$container;

  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.$container;
  }

  return false;
}

/**
 * Get the property name that holds a child node in its parent.
 *
 * @param child - The child node
 * @returns The property name or undefined
 */
export function getContainerProperty(child: AstNode): string | undefined {
  const parent = child.$container;
  if (!parent) {
    return undefined;
  }

  for (const [key, value] of Object.entries(parent)) {
    if (key.startsWith('$')) continue;

    if (value === child) {
      return key;
    }

    if (Array.isArray(value) && value.includes(child)) {
      return key;
    }
  }

  return undefined;
}

/**
 * Get the index of a child in its parent's array property.
 *
 * @param child - The child node
 * @returns The index or -1 if not in an array
 */
export function getContainerIndex(child: AstNode): number {
  const parent = child.$container;
  if (!parent) {
    return -1;
  }

  for (const value of Object.values(parent)) {
    if (Array.isArray(value)) {
      const index = value.indexOf(child);
      if (index >= 0) {
        return index;
      }
    }
  }

  return -1;
}

/**
 * Get all children of a node (direct descendants only).
 *
 * @param node - The parent node
 * @returns Array of child nodes
 */
export function getChildren(node: AstNode): AstNode[] {
  const children: AstNode[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;

    if (typeof value === 'object' && value !== null && '$type' in value) {
      children.push(value as AstNode);
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'object' && item !== null && '$type' in item) {
          children.push(item as AstNode);
        }
      }
    }
  }

  return children;
}

/**
 * Get siblings of a node (nodes with the same parent).
 *
 * @param node - The node
 * @returns Array of sibling nodes (excluding the input node)
 */
export function getSiblings(node: AstNode): AstNode[] {
  const parent = node.$container;
  if (!parent) {
    return [];
  }

  const children = getChildren(parent);
  return children.filter(child => child !== node);
}

/**
 * Visit all nodes in the AST with a callback.
 *
 * @param root - The root node
 * @param callback - Called for each node, return false to stop traversal
 */
export function visitNodes(
  root: AstNode,
  callback: (node: AstNode) => boolean | void
): void {
  for (const node of streamAllContents(root)) {
    const result = callback(node);
    if (result === false) {
      break;
    }
  }
}

/**
 * Find a node at a specific offset in the document.
 *
 * @param document - The Langium document
 * @param offset - The offset in the document
 * @returns The CST node at the offset or undefined
 */
export function findNodeAtOffset(
  document: LangiumDocument,
  offset: number
): CstNode | undefined {
  const root = document.parseResult?.value;
  if (!root?.$cstNode) {
    return undefined;
  }

  return findLeafNodeAtOffset(root.$cstNode, offset);
}

/**
 * Get the text of a node from the document.
 *
 * @param node - The AST node
 * @returns The text or undefined if CST node not available
 */
export function getNodeText(node: AstNode): string | undefined {
  const cstNode = node.$cstNode;
  if (!cstNode) {
    return undefined;
  }

  const doc = getDocument(node);
  if (!doc) {
    return undefined;
  }

  return doc.textDocument.getText({
    start: doc.textDocument.positionAt(cstNode.offset),
    end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
  });
}
