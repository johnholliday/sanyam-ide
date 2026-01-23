/**
 * Langium 4.x Compatibility Helpers
 *
 * In Langium 4.x, many utility functions moved into namespaces.
 * This module re-exports them for easier imports in provider files.
 *
 * @packageDocumentation
 */

import { AstUtils, CstUtils, GrammarUtils } from 'langium';
import type { AstNode, CstNode, LangiumDocument } from 'langium';

// Re-export from AstUtils namespace
export const streamAllContents = AstUtils.streamAllContents;
export const getDocument = AstUtils.getDocument;
export const findRootNode = AstUtils.findRootNode;
export const hasContainerOfType = AstUtils.hasContainerOfType;
export const getContainerOfType = AstUtils.getContainerOfType;
export const linkContentToContainer = AstUtils.linkContentToContainer;

// Re-export from CstUtils namespace
export const findLeafNodeAtOffset = CstUtils.findLeafNodeAtOffset;
export const findDeclarationNodeAtOffset = CstUtils.findDeclarationNodeAtOffset;
export const findCommentNode = CstUtils.findCommentNode;
export const findLeafNodeBeforeOffset = CstUtils.findLeafNodeBeforeOffset;
export const tokenToRange = CstUtils.tokenToRange;
export const toDocumentSegment = CstUtils.toDocumentSegment;

// Re-export from GrammarUtils namespace
export const findNodeForProperty = GrammarUtils.findNodeForProperty;
export const findNodeForKeyword = GrammarUtils.findNodeForKeyword;
export const findNodesForProperty = GrammarUtils.findNodesForProperty;
export const findAssignment = GrammarUtils.findAssignment;
export const getEntryRule = GrammarUtils.getEntryRule;

// Helper types for common patterns
export type Named = AstNode & { name: string };

/**
 * Check if an AST node has a name property.
 */
export function isNamed(node: AstNode): node is Named {
  return 'name' in node && typeof (node as Record<string, unknown>)['name'] === 'string';
}

/**
 * Get the document from an AST node, with type narrowing.
 */
export function getDocumentSafe(node: AstNode | undefined): LangiumDocument | undefined {
  if (!node) return undefined;
  return getDocument(node);
}

/**
 * Safely access properties on an AST node.
 * Provides a way to access dynamic properties in a type-safe manner.
 */
export function getAstProperty<T>(node: AstNode, property: string): T | undefined {
  return (node as unknown as Record<string, T>)[property];
}

/**
 * Check if a node has a specific property.
 */
export function hasAstProperty(node: AstNode, property: string): boolean {
  return property in node;
}

/**
 * Safely find a leaf node at offset.
 * Returns undefined if no node found or rootCst is undefined.
 */
export function findLeafNodeAtOffsetSafe(rootCst: CstNode | undefined, offset: number): CstNode | undefined {
  if (!rootCst) return undefined;
  return findLeafNodeAtOffset(rootCst, offset);
}

/**
 * Convert an AST node to a record for property access.
 * This provides a type-safe way to access dynamic properties.
 */
export function asRecord(node: AstNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>;
}

/**
 * Get a typed value from an AST node's property.
 */
export function getTypedProperty<T>(node: AstNode, property: string): T | undefined {
  const value = asRecord(node)[property];
  return value as T | undefined;
}
