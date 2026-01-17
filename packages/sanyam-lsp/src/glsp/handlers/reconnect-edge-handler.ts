/**
 * Reconnect Edge Handler (T078)
 *
 * Handles edge reconnection operations in the diagram.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { GModelEdge, GModelNode } from '../conversion-types';
import { isEdge, isNode } from '../conversion-types';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider';

/**
 * Reconnect edge operation.
 */
export interface ReconnectEdgeOperation {
  /** Operation kind */
  kind: 'reconnectEdge';
  /** Edge ID to reconnect */
  edgeId: string;
  /** New source element ID (if reconnecting source) */
  newSourceId?: string;
  /** New target element ID (if reconnecting target) */
  newTargetId?: string;
}

/**
 * Result of reconnect edge operation.
 */
export interface ReconnectEdgeResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Edge ID that was reconnected */
  edgeId?: string;
  /** Previous source ID (for undo) */
  previousSourceId?: string;
  /** Previous target ID (for undo) */
  previousTargetId?: string;
  /** Text edits to apply */
  textEdits?: ApplyResult['textEdits'];
  /** Error message if failed */
  error?: string;
}

/**
 * Reconnect edge handler.
 */
export const reconnectEdgeHandler = {
  /**
   * Check if operation can be executed.
   */
  canExecute(context: GlspContext, operation: ReconnectEdgeOperation): boolean {
    // Find the edge
    const edge = this.findEdge(context, operation.edgeId);
    if (!edge) {
      return false;
    }

    // Must specify at least one of source or target
    if (!operation.newSourceId && !operation.newTargetId) {
      return false;
    }

    // Validate new source exists
    if (operation.newSourceId) {
      const source = this.findNode(context, operation.newSourceId);
      if (!source) {
        return false;
      }
    }

    // Validate new target exists
    if (operation.newTargetId) {
      const target = this.findNode(context, operation.newTargetId);
      if (!target) {
        return false;
      }
    }

    // Check if reconnection is valid for this edge type
    return this.isValidReconnection(context, edge, operation);
  },

  /**
   * Execute the reconnect edge operation.
   */
  execute(context: GlspContext, operation: ReconnectEdgeOperation): ReconnectEdgeResult {
    if (!this.canExecute(context, operation)) {
      return {
        success: false,
        error: `Cannot reconnect edge '${operation.edgeId}'`,
      };
    }

    try {
      const edge = this.findEdge(context, operation.edgeId)!;

      // Store previous values for undo
      const previousSourceId = edge.sourceId;
      const previousTargetId = edge.targetId;

      // Apply new source
      if (operation.newSourceId) {
        edge.sourceId = operation.newSourceId;
      }

      // Apply new target
      if (operation.newTargetId) {
        edge.targetId = operation.newTargetId;
      }

      // Clear routing points (they're no longer valid)
      edge.routingPoints = undefined;
      if (context.metadata?.routingPoints) {
        context.metadata.routingPoints.delete(operation.edgeId);
      }

      // Update AST reference
      const textEdits = this.updateAstReference(
        context,
        operation.edgeId,
        operation.newSourceId ?? previousSourceId,
        operation.newTargetId ?? previousTargetId
      );

      // Increment revision
      if (context.gModel) {
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;
      }

      return {
        success: true,
        edgeId: operation.edgeId,
        previousSourceId,
        previousTargetId,
        textEdits,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Check if reconnection is valid.
   */
  isValidReconnection(
    context: GlspContext,
    edge: GModelEdge,
    operation: ReconnectEdgeOperation
  ): boolean {
    const newSourceId = operation.newSourceId ?? edge.sourceId;
    const newTargetId = operation.newTargetId ?? edge.targetId;

    // Check for valid edge rules from manifest
    const manifest = (context as any).manifest;
    if (manifest?.diagram?.edgeRules) {
      const rule = manifest.diagram.edgeRules[edge.type];
      if (rule) {
        const sourceNode = this.findNode(context, newSourceId);
        const targetNode = this.findNode(context, newTargetId);

        if (sourceNode && rule.validSourceTypes) {
          if (!rule.validSourceTypes.includes(sourceNode.type)) {
            return false;
          }
        }

        if (targetNode && rule.validTargetTypes) {
          if (!rule.validTargetTypes.includes(targetNode.type)) {
            return false;
          }
        }
      }
    }

    return true;
  },

  /**
   * Update AST reference for reconnected edge.
   */
  updateAstReference(
    context: GlspContext,
    edgeId: string,
    newSourceId: string,
    newTargetId: string
  ): ApplyResult['textEdits'] {
    // This would need to:
    // 1. Find the AST reference corresponding to this edge
    // 2. Update the reference target
    // 3. If source changed, move the reference to the new source node

    // For now, return empty edits
    // A full implementation would use the GModelToAstProvider
    return [];
  },

  /**
   * Find edge by ID.
   */
  findEdge(context: GlspContext, edgeId: string): GModelEdge | undefined {
    if (!context.gModel?.children) return undefined;

    for (const element of context.gModel.children) {
      if (element.id === edgeId && isEdge(element)) {
        return element;
      }
    }

    return undefined;
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
   * Undo the reconnect operation.
   */
  undo(context: GlspContext, result: ReconnectEdgeResult): boolean {
    if (!result.success || !result.edgeId) {
      return false;
    }

    const edge = this.findEdge(context, result.edgeId);
    if (!edge) {
      return false;
    }

    // Restore previous connections
    if (result.previousSourceId) {
      edge.sourceId = result.previousSourceId;
    }
    if (result.previousTargetId) {
      edge.targetId = result.previousTargetId;
    }

    // Increment revision
    if (context.gModel) {
      context.gModel.revision = (context.gModel.revision ?? 0) + 1;
    }

    return true;
  },

  /**
   * Get valid reconnection targets for a source.
   */
  getValidTargets(
    context: GlspContext,
    edgeId: string,
    reconnectingSource: boolean
  ): string[] {
    const edge = this.findEdge(context, edgeId);
    if (!edge) return [];

    const validTargets: string[] = [];
    const manifest = (context as any).manifest;
    const rule = manifest?.diagram?.edgeRules?.[edge.type];

    if (!context.gModel?.children) return [];

    const checkNode = (node: GModelNode) => {
      if (reconnectingSource) {
        // Check if node can be a valid source
        if (!rule?.validSourceTypes || rule.validSourceTypes.includes(node.type)) {
          validTargets.push(node.id);
        }
      } else {
        // Check if node can be a valid target
        if (!rule?.validTargetTypes || rule.validTargetTypes.includes(node.type)) {
          validTargets.push(node.id);
        }
      }
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
};

/**
 * Create a custom reconnect edge handler.
 *
 * @param customBuilder - Custom handler methods
 * @returns A customized handler
 */
export function createReconnectEdgeHandler(
  customBuilder?: Partial<typeof reconnectEdgeHandler>
): typeof reconnectEdgeHandler {
  return {
    ...reconnectEdgeHandler,
    ...customBuilder,
  };
}
