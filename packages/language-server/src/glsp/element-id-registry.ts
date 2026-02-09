/**
 * Element ID Registry
 *
 * Provides persistent UUID-based element IDs with structural reconciliation.
 * Replaces fragile path-based IDs with UUIDs that survive renames, reparses,
 * and edit sessions.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type { AstNode, LangiumDocument } from 'langium';
import { AstUtils } from 'langium';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'ElementIdRegistry' });

// ═══════════════════════════════════════════════════════════════════════════════
// DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Structural fingerprint of an AST node for reconciliation.
 *
 * Captures the structural position of a node within its AST tree,
 * enabling stable UUID reassignment after reparses.
 */
export interface StructuralFingerprint {
  /** AST type name, e.g., "Entity" */
  astType: string;
  /** Property name on parent that contains this node, e.g., "entities" */
  containmentProperty: string;
  /** Index among same-typed siblings within that property */
  siblingIndex: number;
  /** Parent node's UUID (or "root" for top-level nodes) */
  parentUuid: string;
  /** Node name for heuristic matching — NOT used for identity */
  name?: string;
  /** CST offset for tie-breaking */
  lastOffset?: number;
}

/**
 * Serialized layout data for the id registry (stored in .layout.json).
 */
export interface IdRegistryLayoutData {
  /** Fast exact-match lookup: fingerprintKey → UUID */
  idMap: Record<string, string>;
  /** Full fingerprints for fuzzy reconciliation: UUID → fingerprint */
  fingerprints: Record<string, StructuralFingerprint>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a deterministic fingerprint key for exact matching.
 *
 * Format: `"{parentUuid}/{containmentProperty}/{siblingIndex}/{astType}"`
 *
 * @param fp - The structural fingerprint
 * @returns Deterministic string key
 */
export function fingerprintKey(fp: StructuralFingerprint): string {
  return `${fp.parentUuid}/${fp.containmentProperty}/${fp.siblingIndex}/${fp.astType}`;
}

/**
 * Check if an AST node has a name property.
 */
function getNodeName(node: AstNode): string | undefined {
  if ('name' in node && typeof (node as Record<string, unknown>).name === 'string') {
    return (node as Record<string, unknown>).name as string;
  }
  return undefined;
}

/**
 * Compute the fuzzy match score between a fingerprint and a stored fingerprint.
 *
 * Scoring:
 *   astType match:              40 pts (required)
 *   parentUuid match:           25 pts
 *   containmentProperty match:  15 pts
 *   name match:                 10 pts
 *   siblingIndex match:         10 pts
 *   Threshold:                  55 pts minimum
 *
 * @returns Score (0–100), or 0 if astType doesn't match
 */
function fuzzyScore(candidate: StructuralFingerprint, stored: StructuralFingerprint): number {
  // Type match is required
  if (candidate.astType !== stored.astType) {
    return 0;
  }

  let score = 40;

  if (candidate.parentUuid === stored.parentUuid) {
    score += 25;
  }
  if (candidate.containmentProperty === stored.containmentProperty) {
    score += 15;
  }
  if (candidate.name !== undefined && stored.name !== undefined && candidate.name === stored.name) {
    score += 10;
  }
  if (candidate.siblingIndex === stored.siblingIndex) {
    score += 10;
  }

  return score;
}

/** Minimum fuzzy score to accept a match. */
const FUZZY_THRESHOLD = 55;

// ═══════════════════════════════════════════════════════════════════════════════
// ELEMENT ID REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry that assigns persistent UUIDs to AST nodes via structural reconciliation.
 *
 * On each reparse, `reconcile()` runs a 3-pass algorithm:
 *   1. Exact fingerprint match → reuse existing UUID
 *   2. Fuzzy match (type + parent + name scoring) → reuse UUID
 *   3. Unmatched nodes → assign new UUID via `crypto.randomUUID()`
 */
export class ElementIdRegistry {
  /** Stored fingerprints from last reconciliation / loaded data: uuid → fingerprint */
  private storedFingerprints = new Map<string, StructuralFingerprint>();

  /** Fast exact-match index: fingerprintKey → uuid */
  private exactIndex = new Map<string, string>();

  /** Transient mapping from current AST nodes to their assigned UUIDs */
  private astNodeToUuid = new WeakMap<AstNode, string>();

  /** Reverse mapping for the current reconciliation: uuid → AstNode */
  private uuidToAstNode = new Map<string, AstNode>();

  /**
   * Get the UUID assigned to an AST node.
   *
   * @param astNode - The AST node
   * @returns UUID string, or undefined if not yet reconciled
   */
  getUuid(astNode: AstNode): string | undefined {
    return this.astNodeToUuid.get(astNode);
  }

  /**
   * Get the AST node assigned to a UUID.
   *
   * @param uuid - The UUID string
   * @returns The AST node, or undefined if not found
   */
  getAstNode(uuid: string): AstNode | undefined {
    return this.uuidToAstNode.get(uuid);
  }

  /**
   * Pre-register a UUID with a structural fingerprint.
   *
   * Used by creation handlers to register a newly created element's UUID
   * so the next reconciliation pass (after reparse) can match it via
   * exact fingerprint lookup instead of assigning a new UUID.
   *
   * @param uuid - The UUID to register
   * @param fingerprint - The structural fingerprint for the new element
   */
  registerNewUuid(uuid: string, fingerprint: StructuralFingerprint): void {
    this.storedFingerprints.set(uuid, fingerprint);
    this.exactIndex.set(fingerprintKey(fingerprint), uuid);
  }

  /**
   * Reconcile freshly-parsed AST nodes against stored fingerprints.
   *
   * This is the core algorithm that assigns stable UUIDs to AST nodes.
   * Must be called before `getUuid()` will return results.
   *
   * @param root - Root AST node of the parsed document
   * @param document - The Langium document
   */
  reconcile(root: AstNode, document: LangiumDocument): void {
    // Clear transient state
    this.astNodeToUuid = new WeakMap();
    this.uuidToAstNode.clear();

    // Compute fingerprints for all current AST nodes.
    // We process top-down (BFS/DFS) so parents get UUIDs before children.
    const nodeFingerprints: Array<{ node: AstNode; fp: StructuralFingerprint }> = [];

    // Assign root UUID first
    const rootUuid = this.resolveRootUuid();
    this.astNodeToUuid.set(root, rootUuid);
    this.uuidToAstNode.set(rootUuid, root);

    // Collect all descendant nodes with their fingerprints
    for (const node of AstUtils.streamAllContents(root)) {
      const fp = this.computeFingerprint(node);
      nodeFingerprints.push({ node, fp });
    }

    // Track which stored UUIDs have been claimed
    const claimedUuids = new Set<string>();
    claimedUuids.add(rootUuid);

    // Track unmatched nodes for pass 2 and 3
    const unmatchedAfterPass1: Array<{ node: AstNode; fp: StructuralFingerprint }> = [];

    // ─── Pass 1: Exact fingerprint match ───
    for (const entry of nodeFingerprints) {
      const key = fingerprintKey(entry.fp);
      const existingUuid = this.exactIndex.get(key);

      if (existingUuid && !claimedUuids.has(existingUuid)) {
        // Exact match found
        this.astNodeToUuid.set(entry.node, existingUuid);
        this.uuidToAstNode.set(existingUuid, entry.node);
        claimedUuids.add(existingUuid);
      } else {
        unmatchedAfterPass1.push(entry);
      }
    }

    // ─── Pass 2: Fuzzy match ───
    const unmatchedAfterPass2: Array<{ node: AstNode; fp: StructuralFingerprint }> = [];

    // Build list of unclaimed stored fingerprints for fuzzy matching
    const unclaimedStored = new Map<string, StructuralFingerprint>();
    for (const [uuid, fp] of this.storedFingerprints) {
      if (!claimedUuids.has(uuid)) {
        unclaimedStored.set(uuid, fp);
      }
    }

    for (const entry of unmatchedAfterPass1) {
      let bestUuid: string | undefined;
      let bestScore = 0;

      for (const [uuid, storedFp] of unclaimedStored) {
        const score = fuzzyScore(entry.fp, storedFp);
        if (score >= FUZZY_THRESHOLD && score > bestScore) {
          bestScore = score;
          bestUuid = uuid;
        }
      }

      if (bestUuid) {
        this.astNodeToUuid.set(entry.node, bestUuid);
        this.uuidToAstNode.set(bestUuid, entry.node);
        claimedUuids.add(bestUuid);
        unclaimedStored.delete(bestUuid);
      } else {
        unmatchedAfterPass2.push(entry);
      }
    }

    // ─── Pass 3: New UUIDs for unmatched nodes ───
    for (const entry of unmatchedAfterPass2) {
      const newUuid = randomUUID();
      this.astNodeToUuid.set(entry.node, newUuid);
      this.uuidToAstNode.set(newUuid, entry.node);
    }

    // Update stored fingerprints and exact index with current state
    this.storedFingerprints.clear();
    this.exactIndex.clear();

    // Store root fingerprint
    const rootFp: StructuralFingerprint = {
      astType: root.$type,
      containmentProperty: '',
      siblingIndex: 0,
      parentUuid: 'root',
      name: getNodeName(root),
    };
    this.storedFingerprints.set(rootUuid, rootFp);
    this.exactIndex.set(fingerprintKey(rootFp), rootUuid);

    // Store all descendant fingerprints
    for (const node of AstUtils.streamAllContents(root)) {
      const uuid = this.astNodeToUuid.get(node);
      if (uuid) {
        const fp = this.computeFingerprint(node);
        this.storedFingerprints.set(uuid, fp);
        this.exactIndex.set(fingerprintKey(fp), uuid);
      }
    }

    logger.info(
      {
        event: 'uuid:reconcile',
        total: nodeFingerprints.length,
        exactMatched: nodeFingerprints.length - unmatchedAfterPass1.length,
        fuzzyMatched: unmatchedAfterPass1.length - unmatchedAfterPass2.length,
        newUuids: unmatchedAfterPass2.length,
        registrySize: this.storedFingerprints.size,
      },
      'UUID reconciliation complete'
    );
  }

  /**
   * Compute a structural fingerprint for an AST node.
   *
   * Uses Langium's `$container`, `$containerProperty`, `$containerIndex`, and `$type`
   * to determine the node's structural position.
   *
   * @param node - The AST node
   * @returns Structural fingerprint
   */
  private computeFingerprint(node: AstNode): StructuralFingerprint {
    const container = node.$container;
    const parentUuid = container ? (this.astNodeToUuid.get(container) ?? 'unknown') : 'root';

    return {
      astType: node.$type,
      containmentProperty: node.$containerProperty ?? '',
      siblingIndex: node.$containerIndex ?? 0,
      parentUuid,
      name: getNodeName(node),
      lastOffset: node.$cstNode?.offset,
    };
  }

  /**
   * Resolve the UUID for the root node.
   *
   * Looks for a stored fingerprint with parentUuid === 'root',
   * or generates a new UUID.
   *
   * @returns UUID for the root node
   */
  private resolveRootUuid(): string {
    // Check if we have a stored root
    for (const [uuid, fp] of this.storedFingerprints) {
      if (fp.parentUuid === 'root' && fp.containmentProperty === '') {
        return uuid;
      }
    }
    return randomUUID();
  }

  /**
   * Load persisted id registry data from layout storage.
   *
   * @param data - Serialized id registry data
   */
  loadFromLayoutData(data: IdRegistryLayoutData): void {
    this.storedFingerprints.clear();
    this.exactIndex.clear();

    if (data.fingerprints) {
      for (const [uuid, fp] of Object.entries(data.fingerprints)) {
        this.storedFingerprints.set(uuid, fp);
      }
    }

    if (data.idMap) {
      for (const [key, uuid] of Object.entries(data.idMap)) {
        this.exactIndex.set(key, uuid);
      }
    }

    logger.debug(
      { fingerprintCount: this.storedFingerprints.size, indexSize: this.exactIndex.size },
      'Loaded id registry from layout data'
    );
  }

  /**
   * Export the current registry state for persistence.
   *
   * @returns Serialized id registry data
   */
  exportToLayoutData(): IdRegistryLayoutData {
    const idMap: Record<string, string> = {};
    for (const [key, uuid] of this.exactIndex) {
      idMap[key] = uuid;
    }

    const fingerprints: Record<string, StructuralFingerprint> = {};
    for (const [uuid, fp] of this.storedFingerprints) {
      fingerprints[uuid] = fp;
    }

    return { idMap, fingerprints };
  }

  /**
   * Build a mapping from legacy path-based IDs to UUIDs.
   *
   * Used during v1 → v2 layout migration to rekey element positions.
   *
   * @param root - Root AST node
   * @param computeLegacyId - Function that computes the old path-based ID
   * @returns Map from legacy ID to UUID
   */
  buildLegacyIdMapping(
    root: AstNode,
    computeLegacyId: (node: AstNode) => string
  ): Map<string, string> {
    const mapping = new Map<string, string>();

    // Map root
    const rootUuid = this.astNodeToUuid.get(root);
    if (rootUuid) {
      const legacyId = computeLegacyId(root);
      mapping.set(legacyId, rootUuid);
    }

    // Map all descendants
    for (const node of AstUtils.streamAllContents(root)) {
      const uuid = this.astNodeToUuid.get(node);
      if (uuid) {
        const legacyId = computeLegacyId(node);
        mapping.set(legacyId, uuid);
      }
    }

    return mapping;
  }

  /**
   * Clear all stored state.
   */
  clear(): void {
    this.storedFingerprints.clear();
    this.exactIndex.clear();
    this.astNodeToUuid = new WeakMap();
    this.uuidToAstNode.clear();
  }
}
