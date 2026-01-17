/**
 * Create Node Handler (T075)
 *
 * Handles node creation operations in the diagram.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { GModelNode, Point, Dimension } from '../conversion-types.js';
import { ElementTypes, createNode, createLabel } from '../conversion-types.js';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider.js';
import { defaultGModelToAstProvider } from '../providers/gmodel-to-ast-provider.js';

/**
 * Create node operation.
 */
export interface CreateNodeOperation {
  /** Operation kind */
  kind: 'createNode';
  /** Element type to create */
  elementTypeId: string;
  /** Position to create at */
  location?: Point;
  /** Container element ID */
  containerId?: string;
  /** Additional arguments */
  args?: Record<string, any>;
}

/**
 * Result of create node operation.
 */
export interface CreateNodeResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Created element ID */
  elementId?: string;
  /** Created GModel node */
  node?: GModelNode;
  /** Text edits to apply */
  textEdits?: ApplyResult['textEdits'];
  /** Error message if failed */
  error?: string;
}

/**
 * Create node handler.
 */
export const createNodeHandler = {
  /**
   * Check if operation can be executed.
   */
  canExecute(context: GlspContext, operation: CreateNodeOperation): boolean {
    // Check if element type is supported
    const supportedTypes = this.getSupportedTypes(context);
    if (!supportedTypes.includes(operation.elementTypeId)) {
      return false;
    }

    // Check if container exists (if specified)
    if (operation.containerId) {
      const container = this.findElement(context, operation.containerId);
      if (!container) {
        return false;
      }
    }

    return true;
  },

  /**
   * Execute the create node operation.
   */
  execute(context: GlspContext, operation: CreateNodeOperation): CreateNodeResult {
    if (!this.canExecute(context, operation)) {
      return {
        success: false,
        error: `Cannot create node of type '${operation.elementTypeId}'`,
      };
    }

    try {
      // Generate unique ID
      const elementId = this.generateElementId(context, operation);

      // Create GModel node
      const node = this.createGModelNode(context, operation, elementId);

      // Create corresponding AST node
      const applyResult = defaultGModelToAstProvider.createNode(
        context,
        operation.elementTypeId,
        operation.location ?? { x: 0, y: 0 },
        {
          ...operation.args,
          name: elementId,
        }
      );

      if (!applyResult.success) {
        return {
          success: false,
          error: applyResult.error,
        };
      }

      // Add node to GModel
      this.addNodeToModel(context, node, operation.containerId);

      // Update model state
      if (context.metadata?.positions) {
        context.metadata.positions.set(elementId, node.position!);
      }
      if (context.metadata?.sizes) {
        context.metadata.sizes.set(elementId, node.size!);
      }

      return {
        success: true,
        elementId,
        node,
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
   * Generate a unique element ID.
   */
  generateElementId(context: GlspContext, operation: CreateNodeOperation): string {
    const baseName = operation.args?.name ?? this.getDefaultName(operation.elementTypeId);
    let name = baseName;
    let counter = 1;

    // Ensure uniqueness
    const existingIds = this.getExistingIds(context);
    while (existingIds.has(name)) {
      name = `${baseName}${counter++}`;
    }

    return name;
  },

  /**
   * Get default name for element type.
   */
  getDefaultName(elementTypeId: string): string {
    if (elementTypeId.includes('entity')) return 'Entity';
    if (elementTypeId.includes('property')) return 'property';
    if (elementTypeId.includes('package')) return 'Package';
    return 'Element';
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
   * Create GModel node.
   */
  createGModelNode(
    context: GlspContext,
    operation: CreateNodeOperation,
    elementId: string
  ): GModelNode {
    const position = operation.location ?? { x: 100, y: 100 };
    const size = this.getDefaultSize(operation.elementTypeId);

    const node = createNode(elementId, operation.elementTypeId, position, size);

    // Add label
    const labelText = operation.args?.name ?? elementId;
    node.children = [createLabel(`${elementId}_label`, labelText)];

    // Add type-specific children
    if (operation.elementTypeId.includes('entity')) {
      // Add compartments for entity
      node.children.push({
        id: `${elementId}_attributes`,
        type: 'compartment:attributes',
        children: [],
      });
    }

    return node;
  },

  /**
   * Get default size for element type.
   */
  getDefaultSize(elementTypeId: string): Dimension {
    if (elementTypeId.includes('entity')) {
      return { width: 150, height: 80 };
    }
    if (elementTypeId.includes('property')) {
      return { width: 100, height: 30 };
    }
    if (elementTypeId.includes('package')) {
      return { width: 200, height: 150 };
    }
    return { width: 100, height: 50 };
  },

  /**
   * Add node to GModel.
   */
  addNodeToModel(
    context: GlspContext,
    node: GModelNode,
    containerId?: string
  ): void {
    if (!context.gModel) return;

    if (containerId) {
      // Add to container
      const container = this.findElement(context, containerId);
      if (container && container.children) {
        container.children.push(node);
      }
    } else {
      // Add to root
      context.gModel.children.push(node);
    }

    // Increment revision
    context.gModel.revision = (context.gModel.revision ?? 0) + 1;
  },

  /**
   * Find element by ID.
   */
  findElement(context: GlspContext, elementId: string): any | undefined {
    if (!context.gModel?.children) return undefined;

    const search = (elements: any[]): any | undefined => {
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
   * Get supported element types.
   */
  getSupportedTypes(context: GlspContext): string[] {
    const types = [
      ElementTypes.NODE_ENTITY,
      ElementTypes.NODE_PROPERTY,
      ElementTypes.NODE_PACKAGE,
      ElementTypes.NODE_GENERIC,
    ];

    // Add types from manifest
    const manifest = (context as any).manifest;
    if (manifest?.diagram?.nodeTypes) {
      for (const config of Object.values(manifest.diagram.nodeTypes)) {
        types.push((config as any).type);
      }
    }

    return types;
  },

  /**
   * Undo the create operation.
   */
  undo(context: GlspContext, result: CreateNodeResult): boolean {
    if (!result.success || !result.elementId) {
      return false;
    }

    // Remove node from model
    if (context.gModel?.children) {
      const index = context.gModel.children.findIndex(
        c => c.id === result.elementId
      );
      if (index >= 0) {
        context.gModel.children.splice(index, 1);
        context.gModel.revision = (context.gModel.revision ?? 0) + 1;
        return true;
      }
    }

    return false;
  },
};

/**
 * Create a custom create node handler.
 *
 * @param customBuilder - Custom handler methods
 * @returns A customized handler
 */
export function createCreateNodeHandler(
  customBuilder?: Partial<typeof createNodeHandler>
): typeof createNodeHandler {
  return {
    ...createNodeHandler,
    ...customBuilder,
  };
}
