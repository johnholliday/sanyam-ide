/**
 * Change Bounds Handler (T077)
 *
 * Handles position and size changes for diagram elements.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { GModelNode, Point, Dimension } from '../conversion-types.js';
import { isNode } from '../conversion-types.js';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider.js';
import { defaultGModelToAstProvider } from '../providers/gmodel-to-ast-provider.js';

/**
 * Change bounds operation.
 */
export interface ChangeBoundsOperation {
  /** Operation kind */
  kind: 'changeBounds';
  /** Element ID */
  elementId: string;
  /** New position */
  newPosition?: Point;
  /** New size */
  newSize?: Dimension;
}

/**
 * Batch change bounds operation.
 */
export interface BatchChangeBoundsOperation {
  /** Operation kind */
  kind: 'changeBounds';
  /** Element bounds changes */
  changes: Array<{
    elementId: string;
    newPosition?: Point;
    newSize?: Dimension;
  }>;
}

/**
 * Result of change bounds operation.
 */
export interface ChangeBoundsResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Changed element IDs */
  changedIds: string[];
  /** Previous positions (for undo) */
  previousPositions?: Map<string, Point>;
  /** Previous sizes (for undo) */
  previousSizes?: Map<string, Dimension>;
  /** Text edits to apply */
  textEdits?: ApplyResult['textEdits'];
  /** Error message if failed */
  error?: string;
}

/**
 * Minimum dimensions for elements.
 */
const MIN_WIDTH = 50;
const MIN_HEIGHT = 30;

/**
 * Change bounds handler.
 */
export const changeBoundsHandler = {
  /**
   * Check if operation can be executed.
   */
  canExecute(context: GlspContext, operation: ChangeBoundsOperation): boolean {
    const element = this.findElement(context, operation.elementId);
    if (!element || !isNode(element)) {
      return false;
    }

    // Validate new size
    if (operation.newSize) {
      if (operation.newSize.width < MIN_WIDTH || operation.newSize.height < MIN_HEIGHT) {
        return false;
      }
    }

    return true;
  },

  /**
   * Execute the change bounds operation.
   */
  execute(context: GlspContext, operation: ChangeBoundsOperation): ChangeBoundsResult {
    if (!this.canExecute(context, operation)) {
      return {
        success: false,
        changedIds: [],
        error: `Cannot change bounds for element '${operation.elementId}'`,
      };
    }

    try {
      const element = this.findElement(context, operation.elementId) as GModelNode;
      const previousPositions = new Map<string, Point>();
      const previousSizes = new Map<string, Dimension>();
      const allTextEdits: ApplyResult['textEdits'] = [];

      // Store previous values
      if (element.position) {
        previousPositions.set(operation.elementId, { ...element.position });
      }
      if (element.size) {
        previousSizes.set(operation.elementId, { ...element.size });
      }

      // Apply position change
      if (operation.newPosition) {
        element.position = { ...operation.newPosition };

        // Update metadata
        if (context.metadata?.positions) {
          context.metadata.positions.set(operation.elementId, element.position);
        }

        // Apply to AST
        const posResult = defaultGModelToAstProvider.applyPosition(
          context,
          operation.elementId,
          operation.newPosition
        );
        if (posResult.textEdits) {
          allTextEdits.push(...posResult.textEdits);
        }
      }

      // Apply size change
      if (operation.newSize) {
        // Enforce minimum size
        element.size = {
          width: Math.max(operation.newSize.width, MIN_WIDTH),
          height: Math.max(operation.newSize.height, MIN_HEIGHT),
        };

        // Update metadata
        if (context.metadata?.sizes) {
          context.metadata.sizes.set(operation.elementId, element.size);
        }

        // Apply to AST
        const sizeResult = defaultGModelToAstProvider.applySize(
          context,
          operation.elementId,
          element.size
        );
        if (sizeResult.textEdits) {
          allTextEdits.push(...sizeResult.textEdits);
        }
      }

      // Increment revision
      if (context.gModel) {
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;
      }

      return {
        success: true,
        changedIds: [operation.elementId],
        previousPositions,
        previousSizes,
        textEdits: allTextEdits,
      };
    } catch (error) {
      return {
        success: false,
        changedIds: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Execute batch change bounds operation.
   */
  executeBatch(
    context: GlspContext,
    operation: BatchChangeBoundsOperation
  ): ChangeBoundsResult {
    const changedIds: string[] = [];
    const previousPositions = new Map<string, Point>();
    const previousSizes = new Map<string, Dimension>();
    const allTextEdits: ApplyResult['textEdits'] = [];
    const errors: string[] = [];

    for (const change of operation.changes) {
      const singleOp: ChangeBoundsOperation = {
        kind: 'changeBounds',
        ...change,
      };

      const result = this.execute(context, singleOp);

      if (result.success) {
        changedIds.push(...result.changedIds);
        if (result.previousPositions) {
          for (const [id, pos] of result.previousPositions) {
            previousPositions.set(id, pos);
          }
        }
        if (result.previousSizes) {
          for (const [id, size] of result.previousSizes) {
            previousSizes.set(id, size);
          }
        }
        if (result.textEdits) {
          allTextEdits.push(...result.textEdits);
        }
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      changedIds,
      previousPositions,
      previousSizes,
      textEdits: allTextEdits,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },

  /**
   * Find element by ID.
   */
  findElement(context: GlspContext, elementId: string): GModelNode | undefined {
    if (!context.gModel?.children) return undefined;

    const search = (elements: any[]): GModelNode | undefined => {
      for (const element of elements) {
        if (element.id === elementId) return element;
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
   * Validate position is within bounds.
   */
  validatePosition(context: GlspContext, position: Point): Point {
    // Ensure non-negative coordinates
    return {
      x: Math.max(0, position.x),
      y: Math.max(0, position.y),
    };
  },

  /**
   * Validate size is within constraints.
   */
  validateSize(context: GlspContext, size: Dimension): Dimension {
    return {
      width: Math.max(MIN_WIDTH, size.width),
      height: Math.max(MIN_HEIGHT, size.height),
    };
  },

  /**
   * Snap position to grid.
   */
  snapToGrid(position: Point, gridSize: number = 10): Point {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  },

  /**
   * Undo the change bounds operation.
   */
  undo(context: GlspContext, result: ChangeBoundsResult): boolean {
    if (!result.success) {
      return false;
    }

    try {
      for (const elementId of result.changedIds) {
        const element = this.findElement(context, elementId);
        if (!element) continue;

        // Restore previous position
        const prevPos = result.previousPositions?.get(elementId);
        if (prevPos) {
          element.position = prevPos;
          if (context.metadata?.positions) {
            context.metadata.positions.set(elementId, prevPos);
          }
        }

        // Restore previous size
        const prevSize = result.previousSizes?.get(elementId);
        if (prevSize) {
          element.size = prevSize;
          if (context.metadata?.sizes) {
            context.metadata.sizes.set(elementId, prevSize);
          }
        }
      }

      // Increment revision
      if (context.gModel) {
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;
      }

      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Create a custom change bounds handler.
 *
 * @param customBuilder - Custom handler methods
 * @returns A customized handler
 */
export function createChangeBoundsHandler(
  customBuilder?: Partial<typeof changeBoundsHandler>
): typeof changeBoundsHandler {
  return {
    ...changeBoundsHandler,
    ...customBuilder,
  };
}
