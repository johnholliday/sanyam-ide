/**
 * Create Edge Handler (T079)
 *
 * Handles edge creation operations in the diagram.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { GModelEdge, GModelNode, Point } from '../conversion-types';
import { ElementTypes, createEdge, createLabel, isNode } from '../conversion-types';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider';
import { defaultGModelToAstProvider } from '../providers/gmodel-to-ast-provider';

/**
 * Create edge operation.
 */
export interface CreateEdgeOperation {
  /** Operation kind */
  kind: 'createEdge';
  /** Element type to create */
  elementTypeId: string;
  /** Source element ID */
  sourceElementId: string;
  /** Target element ID */
  targetElementId: string;
  /** Routing points */
  routingPoints?: Point[];
  /** Additional arguments */
  args?: Record<string, any>;
}

/**
 * Result of create edge operation.
 */
export interface CreateEdgeResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Created edge ID */
  edgeId?: string;
  /** Created GModel edge */
  edge?: GModelEdge;
  /** Text edits to apply */
  textEdits?: ApplyResult['textEdits'];
  /** Error message if failed */
  error?: string;
}

/**
 * Create edge handler.
 */
export const createEdgeHandler = {
  /**
   * Check if operation can be executed.
   */
  canExecute(context: GlspContext, operation: CreateEdgeOperation): boolean {
    // Check if element type is supported
    const supportedTypes = this.getSupportedTypes(context);
    if (!supportedTypes.includes(operation.elementTypeId)) {
      return false;
    }

    // Check source exists
    const source = this.findNode(context, operation.sourceElementId);
    if (!source) {
      return false;
    }

    // Check target exists
    const target = this.findNode(context, operation.targetElementId);
    if (!target) {
      return false;
    }

    // Check if edge is valid between these nodes
    return this.isValidConnection(context, operation, source, target);
  },

  /**
   * Execute the create edge operation.
   */
  execute(context: GlspContext, operation: CreateEdgeOperation): CreateEdgeResult {
    if (!this.canExecute(context, operation)) {
      return {
        success: false,
        error: `Cannot create edge from '${operation.sourceElementId}' to '${operation.targetElementId}'`,
      };
    }

    try {
      // Generate unique ID
      const edgeId = this.generateEdgeId(context, operation);

      // Create GModel edge
      const edge = this.createGModelEdge(context, operation, edgeId);

      // Create corresponding AST reference
      const applyResult = defaultGModelToAstProvider.createEdge(
        context,
        operation.elementTypeId,
        operation.sourceElementId,
        operation.targetElementId,
        operation.args
      );

      if (!applyResult.success) {
        return {
          success: false,
          error: applyResult.error,
        };
      }

      // Add edge to GModel
      this.addEdgeToModel(context, edge);

      // Store routing points in metadata
      if (operation.routingPoints && context.metadata?.routingPoints) {
        context.metadata.routingPoints.set(edgeId, operation.routingPoints);
      }

      return {
        success: true,
        edgeId,
        edge,
        textEdits: applyResult.textEdits,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Generate a unique edge ID.
   */
  generateEdgeId(context: GlspContext, operation: CreateEdgeOperation): string {
    const baseId = `${operation.sourceElementId}_to_${operation.targetElementId}`;
    let id = baseId;
    let counter = 1;

    // Ensure uniqueness
    const existingIds = this.getExistingIds(context);
    while (existingIds.has(id)) {
      id = `${baseId}_${counter++}`;
    }

    return id;
  },

  /**
   * Get existing element IDs.
   */
  getExistingIds(context: GlspContext): Set<string> {
    const ids = new Set<string>();

    const collectIds = (elements: any[]) => {
      for (const element of elements) {
        ids.add(element.id);
        if (element.children) {
          collectIds(element.children);
        }
      }
    };

    if (context.gModel?.children) {
      collectIds(context.gModel.children);
    }

    return ids;
  },

  /**
   * Create GModel edge.
   */
  createGModelEdge(
    context: GlspContext,
    operation: CreateEdgeOperation,
    edgeId: string
  ): GModelEdge {
    const edge = createEdge(
      edgeId,
      operation.elementTypeId,
      operation.sourceElementId,
      operation.targetElementId
    );

    // Add routing points if provided
    if (operation.routingPoints) {
      edge.routingPoints = operation.routingPoints;
    }

    // Add label if specified
    if (operation.args?.label) {
      edge.children = [createLabel(`${edgeId}_label`, operation.args.label)];
    }

    return edge;
  },

  /**
   * Add edge to GModel.
   */
  addEdgeToModel(context: GlspContext, edge: GModelEdge): void {
    if (!context.gModel) return;

    context.gModel.children.push(edge);

    // Increment revision
    context.gModel.revision = (context.gModel.revision ?? 0) + 1;
  },

  /**
   * Find node by ID.
   */
  findNode(context: GlspContext, nodeId: string): GModelNode | undefined {
    if (!context.gModel?.children) return undefined;

    const search = (elements: any[]): GModelNode | undefined => {
      for (const element of elements) {
        if (element.id === nodeId && isNode(element)) {
          return element;
        }
        if (element.children) {
          const found = search(element.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return search(context.gModel.children);
  },

  /**
   * Check if connection is valid between nodes.
   */
  isValidConnection(
    context: GlspContext,
    operation: CreateEdgeOperation,
    source: GModelNode,
    target: GModelNode
  ): boolean {
    // Check manifest rules
    const manifest = (context as any).manifest;
    if (manifest?.diagram?.edgeRules) {
      const rule = manifest.diagram.edgeRules[operation.elementTypeId];
      if (rule) {
        // Check source type
        if (rule.validSourceTypes && !rule.validSourceTypes.includes(source.type)) {
          return false;
        }
        // Check target type
        if (rule.validTargetTypes && !rule.validTargetTypes.includes(target.type)) {
          return false;
        }
        // Check for forbidden connections
        if (rule.forbiddenConnections) {
          for (const forbidden of rule.forbiddenConnections) {
            if (forbidden.source === source.type && forbidden.target === target.type) {
              return false;
            }
          }
        }
      }
    }

    // Check for duplicate edges
    if (!this.allowDuplicateEdges(context, operation.elementTypeId)) {
      const existingEdge = this.findExistingEdge(
        context,
        operation.sourceElementId,
        operation.targetElementId,
        operation.elementTypeId
      );
      if (existingEdge) {
        return false;
      }
    }

    return true;
  },

  /**
   * Check if duplicate edges are allowed.
   */
  allowDuplicateEdges(context: GlspContext, edgeType: string): boolean {
    const manifest = (context as any).manifest;
    return manifest?.diagram?.edgeRules?.[edgeType]?.allowDuplicates ?? false;
  },

  /**
   * Find existing edge between nodes.
   */
  findExistingEdge(
    context: GlspContext,
    sourceId: string,
    targetId: string,
    edgeType: string
  ): GModelEdge | undefined {
    if (!context.gModel?.children) return undefined;

    for (const element of context.gModel.children) {
      if (
        'sourceId' in element &&
        element.sourceId === sourceId &&
        element.targetId === targetId &&
        element.type === edgeType
      ) {
        return element as GModelEdge;
      }
    }

    return undefined;
  },

  /**
   * Get supported edge types.
   */
  getSupportedTypes(context: GlspContext): string[] {
    const types = [
      ElementTypes.EDGE_REFERENCE,
      ElementTypes.EDGE_INHERITANCE,
      ElementTypes.EDGE_COMPOSITION,
      ElementTypes.EDGE_AGGREGATION,
    ];

    // Add types from manifest
    const manifest = (context as any).manifest;
    if (manifest?.diagram?.edgeTypes) {
      for (const config of Object.values(manifest.diagram.edgeTypes)) {
        types.push((config as any).type);
      }
    }

    return types;
  },

  /**
   * Get valid targets for edge creation from a source.
   */
  getValidTargets(
    context: GlspContext,
    sourceId: string,
    edgeType: string
  ): string[] {
    const source = this.findNode(context, sourceId);
    if (!source) return [];

    const validTargets: string[] = [];
    const manifest = (context as any).manifest;
    const rule = manifest?.diagram?.edgeRules?.[edgeType];

    if (!context.gModel?.children) return [];

    const checkNode = (node: GModelNode) => {
      // Check target type constraints
      if (rule?.validTargetTypes && !rule.validTargetTypes.includes(node.type)) {
        return;
      }

      // Check for duplicate if not allowed
      if (!this.allowDuplicateEdges(context, edgeType)) {
        const existing = this.findExistingEdge(context, sourceId, node.id, edgeType);
        if (existing) return;
      }

      validTargets.push(node.id);
    };

    const collectNodes = (elements: any[]) => {
      for (const element of elements) {
        if (isNode(element)) {
          checkNode(element);
        }
        if (element.children) {
          collectNodes(element.children);
        }
      }
    };

    collectNodes(context.gModel.children);
    return validTargets;
  },

  /**
   * Undo the create edge operation.
   */
  undo(context: GlspContext, result: CreateEdgeResult): boolean {
    if (!result.success || !result.edgeId) {
      return false;
    }

    // Remove edge from model
    if (context.gModel?.children) {
      const index = context.gModel.children.findIndex(
        c => c.id === result.edgeId
      );
      if (index >= 0) {
        context.gModel.children.splice(index, 1);
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;

        // Clean up metadata
        if (context.metadata?.routingPoints) {
          context.metadata.routingPoints.delete(result.edgeId);
        }

        return true;
      }
    }

    return false;
  },
};

/**
 * Create a custom create edge handler.
 *
 * @param customBuilder - Custom handler methods
 * @returns A customized handler
 */
export function createCreateEdgeHandler(
  customBuilder?: Partial<typeof createEdgeHandler>
): typeof createEdgeHandler {
  return {
    ...createEdgeHandler,
    ...customBuilder,
  };
}
