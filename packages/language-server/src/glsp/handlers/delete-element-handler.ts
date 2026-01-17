/**
 * Delete Element Handler (T076)
 *
 * Handles element deletion operations in the diagram.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { GModelElement, GModelEdge } from '../conversion-types.js';
import { isEdge } from '../conversion-types.js';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider.js';
import { defaultGModelToAstProvider } from '../providers/gmodel-to-ast-provider.js';

/**
 * Delete element operation.
 */
export interface DeleteElementOperation {
  /** Operation kind */
  kind: 'delete';
  /** Element IDs to delete */
  elementIds: string[];
}

/**
 * Result of delete element operation.
 */
export interface DeleteElementResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Deleted element IDs */
  deletedIds: string[];
  /** Deleted elements (for undo) */
  deletedElements?: GModelElement[];
  /** Text edits to apply */
  textEdits?: ApplyResult['textEdits'];
  /** Error message if failed */
  error?: string;
}

/**
 * Delete element handler.
 */
export const deleteElementHandler = {
  /**
   * Check if operation can be executed.
   */
  canExecute(context: GlspContext, operation: DeleteElementOperation): boolean {
    if (operation.elementIds.length === 0) {
      return false;
    }

    // Check all elements exist
    for (const id of operation.elementIds) {
      if (!this.findElement(context, id)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Execute the delete element operation.
   */
  execute(context: GlspContext, operation: DeleteElementOperation): DeleteElementResult {
    if (!this.canExecute(context, operation)) {
      return {
        success: false,
        deletedIds: [],
        error: 'Cannot delete: one or more elements not found',
      };
    }

    try {
      const deletedIds: string[] = [];
      const deletedElements: GModelElement[] = [];
      const allTextEdits: ApplyResult['textEdits'] = [];

      // Also delete connected edges
      const edgesToDelete = this.findConnectedEdges(context, operation.elementIds);
      const allIdsToDelete = [...operation.elementIds, ...edgesToDelete];

      // Delete each element
      for (const elementId of allIdsToDelete) {
        const element = this.findElement(context, elementId);
        if (!element) continue;

        // Delete from AST first
        const applyResult = defaultGModelToAstProvider.deleteElement(context, elementId);
        if (applyResult.textEdits) {
          allTextEdits.push(...applyResult.textEdits);
        }

        // Remove from GModel
        const removed = this.removeElement(context, elementId);
        if (removed) {
          deletedIds.push(elementId);
          deletedElements.push(removed);
        }

        // Clean up metadata
        this.cleanupMetadata(context, elementId);
      }

      // Increment revision
      if (context.gModel) {
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;
      }

      return {
        success: true,
        deletedIds,
        deletedElements,
        textEdits: allTextEdits,
      };
    } catch (error) {
      return {
        success: false,
        deletedIds: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Find connected edges to delete.
   */
  findConnectedEdges(context: GlspContext, nodeIds: string[]): string[] {
    const edgeIds: string[] = [];
    const nodeIdSet = new Set(nodeIds);

    if (!context.gModel?.children) return edgeIds;

    for (const element of context.gModel.children) {
      if (isEdge(element)) {
        // Delete edge if source or target is being deleted
        if (nodeIdSet.has(element.sourceId) || nodeIdSet.has(element.targetId)) {
          edgeIds.push(element.id);
        }
      }
    }

    return edgeIds;
  },

  /**
   * Remove element from GModel.
   */
  removeElement(context: GlspContext, elementId: string): GModelElement | undefined {
    if (!context.gModel?.children) return undefined;

    const removeFromArray = (elements: GModelElement[]): GModelElement | undefined => {
      const index = elements.findIndex(e => e.id === elementId);
      if (index >= 0) {
        return elements.splice(index, 1)[0];
      }

      // Search in children
      for (const element of elements) {
        if (element.children) {
          const removed = removeFromArray(element.children);
          if (removed) return removed;
        }
      }

      return undefined;
    };

    return removeFromArray(context.gModel.children);
  },

  /**
   * Find element by ID.
   */
  findElement(context: GlspContext, elementId: string): GModelElement | undefined {
    if (!context.gModel?.children) return undefined;

    const search = (elements: GModelElement[]): GModelElement | undefined => {
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
   * Clean up metadata for deleted element.
   */
  cleanupMetadata(context: GlspContext, elementId: string): void {
    if (context.metadata) {
      context.metadata.positions?.delete(elementId);
      context.metadata.sizes?.delete(elementId);
      context.metadata.routingPoints?.delete(elementId);
      context.metadata.collapsed?.delete(elementId);
    }
  },

  /**
   * Undo the delete operation.
   */
  undo(context: GlspContext, result: DeleteElementResult): boolean {
    if (!result.success || !result.deletedElements) {
      return false;
    }

    // Re-add deleted elements
    if (context.gModel?.children) {
      for (const element of result.deletedElements) {
        context.gModel.children.push(element);
      }
      context.gModel.revision = (context.gModel.revision ?? 0) + 1;
      return true;
    }

    return false;
  },

  /**
   * Get elements that would be deleted (preview).
   */
  getElementsToDelete(context: GlspContext, operation: DeleteElementOperation): string[] {
    const edgesToDelete = this.findConnectedEdges(context, operation.elementIds);
    return [...operation.elementIds, ...edgesToDelete];
  },
};

/**
 * Create a custom delete element handler.
 *
 * @param customBuilder - Custom handler methods
 * @returns A customized handler
 */
export function createDeleteElementHandler(
  customBuilder?: Partial<typeof deleteElementHandler>
): typeof deleteElementHandler {
  return {
    ...deleteElementHandler,
    ...customBuilder,
  };
}
