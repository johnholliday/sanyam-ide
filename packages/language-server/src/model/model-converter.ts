/**
 * Model Converter (T123)
 *
 * Converts Langium AST nodes to JSON-serializable structures.
 * Handles:
 * - Circular reference detection and handling
 * - Internal Langium property filtering ($container, $document, etc.)
 * - Configurable depth limits
 * - ID generation for cross-references
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type { ConvertOptions, ConvertResult } from '@sanyam/types';

/**
 * Internal Langium properties that should be excluded from serialization.
 */
const INTERNAL_PROPERTIES = new Set([
  '$container',
  '$containerProperty',
  '$containerIndex',
  '$document',
  '$cstNode',
  '$refNode',
  '$refText',
  '$nodeDescription',
]);

/**
 * Properties that should always be included for node identification.
 */
const IDENTITY_PROPERTIES = new Set(['$type', '$id']);

/**
 * Default conversion options.
 */
const DEFAULT_OPTIONS: Required<ConvertOptions> = {
  maxDepth: 100,
  excludeProperties: [],
  includeProperties: [],
  includeIds: true,
  handleCircular: true,
};

/**
 * Context used during conversion to track visited nodes.
 */
interface ConversionContext {
  /** Nodes currently being visited (for cycle detection) */
  visiting: Set<unknown>;
  /** Map from visited node to generated ID */
  nodeIds: Map<unknown, string>;
  /** Counter for generating unique IDs */
  idCounter: number;
  /** Circular references found during conversion */
  circularRefs: string[];
  /** Current depth in the traversal */
  depth: number;
  /** Merged options */
  options: Required<ConvertOptions>;
}

/**
 * Model converter for AST to JSON serialization.
 */
export class ModelConverter {
  /**
   * Convert an AST node to a JSON-serializable structure.
   *
   * @param ast - The AST node to convert
   * @param options - Conversion options
   * @returns Conversion result with data and circular reference info
   */
  convert(ast: AstNode | unknown, options?: ConvertOptions): ConvertResult {
    const ctx: ConversionContext = {
      visiting: new Set(),
      nodeIds: new Map(),
      idCounter: 0,
      circularRefs: [],
      depth: 0,
      options: { ...DEFAULT_OPTIONS, ...options },
    };

    const data = this.convertValue(ast, ctx);

    return {
      data,
      hasCircular: ctx.circularRefs.length > 0,
      circularRefs: ctx.circularRefs.length > 0 ? ctx.circularRefs : undefined,
    };
  }

  /**
   * Sanitize an AST node by removing internal Langium properties.
   * Simpler version of convert() that just filters properties.
   *
   * @param ast - The AST node to sanitize
   * @returns Sanitized object
   */
  sanitize(ast: unknown): unknown {
    return this.convert(ast, {
      handleCircular: true,
      includeIds: true,
    }).data;
  }

  /**
   * Convert a value, handling all types appropriately.
   */
  private convertValue(value: unknown, ctx: ConversionContext): unknown {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return this.convertArray(value, ctx);
    }

    // Handle objects (including AST nodes)
    return this.convertObject(value, ctx);
  }

  /**
   * Convert an array.
   */
  private convertArray(arr: unknown[], ctx: ConversionContext): unknown[] {
    // Check depth limit
    if (ctx.depth >= ctx.options.maxDepth) {
      return ['[max depth reached]'];
    }

    ctx.depth++;
    const result = arr.map(item => this.convertValue(item, ctx));
    ctx.depth--;

    return result;
  }

  /**
   * Convert an object, handling circular references.
   */
  private convertObject(obj: object, ctx: ConversionContext): unknown {
    // Check depth limit
    if (ctx.depth >= ctx.options.maxDepth) {
      return { $truncated: true, $reason: 'max depth reached' };
    }

    // Handle circular references
    if (ctx.options.handleCircular && ctx.visiting.has(obj)) {
      const existingId = ctx.nodeIds.get(obj);
      if (existingId) {
        ctx.circularRefs.push(existingId);
        return { $ref: existingId };
      }
      return { $circular: true };
    }

    // Mark as visiting
    ctx.visiting.add(obj);

    // Generate ID for this node if it's an AST node
    const isAstNode = this.isAstNode(obj);
    let nodeId: string | undefined;
    if (isAstNode && ctx.options.includeIds) {
      nodeId = this.getOrCreateId(obj, ctx);
    }

    // Convert all properties
    const result: Record<string, unknown> = {};

    // Add $id if this is an AST node and IDs are enabled
    if (nodeId && ctx.options.includeIds) {
      result.$id = nodeId;
    }

    ctx.depth++;

    for (const [key, value] of Object.entries(obj)) {
      // Skip internal Langium properties ($-prefixed non-identity, _-prefixed private)
      if (INTERNAL_PROPERTIES.has(key) || (key.startsWith('_') && key.length > 1)) {
        continue;
      }

      // Always include identity properties
      if (IDENTITY_PROPERTIES.has(key)) {
        result[key] = value;
        continue;
      }

      // Check include/exclude lists
      if (!this.shouldIncludeProperty(key, ctx.options)) {
        continue;
      }

      // Convert the value
      result[key] = this.convertValue(value, ctx);
    }

    ctx.depth--;

    // Remove from visiting
    ctx.visiting.delete(obj);

    return result;
  }

  /**
   * Check if an object is an AST node (has $type property).
   */
  private isAstNode(obj: object): obj is AstNode {
    return '$type' in obj && typeof (obj as AstNode).$type === 'string';
  }

  /**
   * Get or create an ID for an AST node.
   */
  private getOrCreateId(node: object, ctx: ConversionContext): string {
    let id = ctx.nodeIds.get(node);
    if (!id) {
      // Try to use existing $id or name, otherwise generate
      const astNode = node as AstNode & { name?: string; $id?: string };
      if (astNode.$id) {
        id = astNode.$id;
      } else if (astNode.name && astNode.$type) {
        id = `${astNode.$type}-${astNode.name}`;
      } else {
        id = `node-${++ctx.idCounter}`;
      }
      ctx.nodeIds.set(node, id);
    }
    return id;
  }

  /**
   * Check if a property should be included based on options.
   */
  private shouldIncludeProperty(key: string, options: Required<ConvertOptions>): boolean {
    // If include list is specified, only include listed properties
    if (options.includeProperties.length > 0) {
      return options.includeProperties.includes(key);
    }

    // Check exclude list
    if (options.excludeProperties.includes(key)) {
      return false;
    }

    return true;
  }
}

/**
 * Create a new ModelConverter instance.
 */
export function createModelConverter(): ModelConverter {
  return new ModelConverter();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find a node by ID in a converted AST.
 *
 * @param ast - The AST root to search
 * @param id - The node ID to find
 * @returns The node if found, undefined otherwise
 */
export function findNodeById(ast: unknown, id: string): unknown | undefined {
  if (!ast || typeof ast !== 'object') {
    return undefined;
  }

  const node = ast as Record<string, unknown>;

  // Check if this is the node
  if (node.$id === id || node.name === id.replace(/-\d+$/, '')) {
    return node;
  }

  // Search in all properties
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNodeById(item, id);
        if (found) return found;
      }
    } else if (typeof value === 'object' && value !== null) {
      const found = findNodeById(value, id);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Find all nodes of a specific type in a converted AST.
 *
 * @param ast - The AST root to search
 * @param type - The $type value to find
 * @returns Array of matching nodes
 */
export function findNodesByType(ast: unknown, type: string): unknown[] {
  const results: unknown[] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;

    // Check if this node matches
    if (obj.$type === type) {
      results.push(node);
    }

    // Traverse all properties
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (typeof value === 'object' && value !== null) {
        traverse(value);
      }
    }
  }

  traverse(ast);
  return results;
}

/**
 * Get a node by path (e.g., 'elements[0].name').
 *
 * @param ast - The AST root
 * @param path - Dot-notation path with array indices
 * @returns The value at the path, or undefined
 */
export function getNodeByPath(ast: unknown, path: string): unknown | undefined {
  const parts = path.match(/[^.\[\]]+|\[\d+\]/g) ?? [];
  let current: unknown = ast;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    if (part.startsWith('[') && part.endsWith(']')) {
      // Array index
      const index = parseInt(part.slice(1, -1), 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      // Property access
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}
