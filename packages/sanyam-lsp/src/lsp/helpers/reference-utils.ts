/**
 * Reference Utility Helpers (T055)
 *
 * Utilities for working with Langium references.
 *
 * @packageDocumentation
 */

import type { AstNode, CstNode, Reference, LangiumDocument } from 'langium';
import { isReference, getDocument, streamAllContents, isNamed } from 'langium';

/**
 * Information about a reference.
 */
export interface ReferenceInfo {
  /** The reference object */
  reference: Reference;
  /** The node containing the reference */
  container: AstNode;
  /** The property name containing the reference */
  property: string;
  /** The index if in an array, undefined otherwise */
  index?: number;
  /** The resolved target (may be undefined if unresolved) */
  target?: AstNode;
  /** The reference text as written in source */
  text: string;
}

/**
 * Get all references in an AST node.
 *
 * @param node - The AST node to search
 * @param includeNested - Whether to include references in nested nodes
 * @returns Array of reference information
 */
export function findReferences(
  node: AstNode,
  includeNested: boolean = false
): ReferenceInfo[] {
  const references: ReferenceInfo[] = [];

  const processNode = (current: AstNode) => {
    for (const [key, value] of Object.entries(current)) {
      if (key.startsWith('$')) continue;

      if (isReference(value)) {
        references.push({
          reference: value,
          container: current,
          property: key,
          target: value.ref,
          text: value.$refText,
        });
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (isReference(item)) {
            references.push({
              reference: item,
              container: current,
              property: key,
              index: i,
              target: item.ref,
              text: item.$refText,
            });
          }
        }
      }
    }
  };

  if (includeNested) {
    for (const descendant of streamAllContents(node)) {
      processNode(descendant);
    }
  } else {
    processNode(node);
  }

  return references;
}

/**
 * Get all unresolved references in an AST.
 *
 * @param root - The root node to search
 * @returns Array of unresolved references
 */
export function findUnresolvedReferences(root: AstNode): ReferenceInfo[] {
  const references = findReferences(root, true);
  return references.filter(ref => ref.target === undefined);
}

/**
 * Find all references to a specific target node.
 *
 * @param target - The target node to find references to
 * @param searchRoot - The root node to search within
 * @returns Array of references pointing to the target
 */
export function findReferencesTo(
  target: AstNode,
  searchRoot: AstNode
): ReferenceInfo[] {
  const targetName = isNamed(target) ? target.name : undefined;
  const references = findReferences(searchRoot, true);

  return references.filter(ref => {
    // Check direct reference
    if (ref.target === target) {
      return true;
    }
    // Check by name as fallback
    if (targetName && ref.text === targetName) {
      return true;
    }
    return false;
  });
}

/**
 * Get the CST node for a reference.
 *
 * @param ref - The reference
 * @returns The CST node or undefined
 */
export function getReferenceCstNode(ref: Reference): CstNode | undefined {
  return ref.$refNode;
}

/**
 * Check if a reference is resolved.
 *
 * @param ref - The reference to check
 * @returns True if the reference is resolved
 */
export function isResolved(ref: Reference): boolean {
  return ref.ref !== undefined;
}

/**
 * Get the target of a reference, throwing if unresolved.
 *
 * @param ref - The reference
 * @returns The resolved target
 * @throws Error if reference is unresolved
 */
export function getTarget<T extends AstNode>(ref: Reference<T>): T {
  if (ref.ref === undefined) {
    throw new Error(`Unresolved reference: ${ref.$refText}`);
  }
  return ref.ref;
}

/**
 * Try to get the target of a reference.
 *
 * @param ref - The reference
 * @returns The resolved target or undefined
 */
export function tryGetTarget<T extends AstNode>(
  ref: Reference<T>
): T | undefined {
  return ref.ref;
}

/**
 * Get the URI of the document containing a reference's target.
 *
 * @param ref - The reference
 * @returns The target document URI or undefined
 */
export function getTargetUri(ref: Reference): string | undefined {
  const target = ref.ref;
  if (!target) {
    return undefined;
  }

  const doc = getDocument(target);
  return doc?.uri.toString();
}

/**
 * Check if a reference crosses document boundaries.
 *
 * @param ref - The reference
 * @param sourceNode - The node containing the reference
 * @returns True if the reference targets a different document
 */
export function isCrossDocumentReference(
  ref: Reference,
  sourceNode: AstNode
): boolean {
  const target = ref.ref;
  if (!target) {
    return false;
  }

  const sourceDoc = getDocument(sourceNode);
  const targetDoc = getDocument(target);

  if (!sourceDoc || !targetDoc) {
    return false;
  }

  return sourceDoc.uri.toString() !== targetDoc.uri.toString();
}

/**
 * Group references by their property name.
 *
 * @param references - Array of references
 * @returns Map from property name to references
 */
export function groupReferencesByProperty(
  references: ReferenceInfo[]
): Map<string, ReferenceInfo[]> {
  const grouped = new Map<string, ReferenceInfo[]>();

  for (const ref of references) {
    const existing = grouped.get(ref.property);
    if (existing) {
      existing.push(ref);
    } else {
      grouped.set(ref.property, [ref]);
    }
  }

  return grouped;
}

/**
 * Group references by their target.
 *
 * @param references - Array of references
 * @returns Map from target node to references
 */
export function groupReferencesByTarget(
  references: ReferenceInfo[]
): Map<AstNode, ReferenceInfo[]> {
  const grouped = new Map<AstNode, ReferenceInfo[]>();

  for (const ref of references) {
    if (!ref.target) continue;

    const existing = grouped.get(ref.target);
    if (existing) {
      existing.push(ref);
    } else {
      grouped.set(ref.target, [ref]);
    }
  }

  return grouped;
}

/**
 * Get reference text, handling both resolved and unresolved cases.
 *
 * @param ref - The reference
 * @returns The reference text
 */
export function getReferenceText(ref: Reference): string {
  // Prefer the name of the resolved target
  if (ref.ref && isNamed(ref.ref)) {
    return ref.ref.name;
  }
  // Fall back to the source text
  return ref.$refText;
}

/**
 * Count references to each named element in an AST.
 *
 * @param root - The root node to search
 * @returns Map from element name to reference count
 */
export function countReferencesPerElement(
  root: AstNode
): Map<string, number> {
  const counts = new Map<string, number>();
  const references = findReferences(root, true);

  for (const ref of references) {
    if (ref.target && isNamed(ref.target)) {
      const name = ref.target.name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return counts;
}
