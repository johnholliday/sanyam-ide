/**
 * Create Node Handler (T075)
 *
 * Handles node creation operations in the diagram.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type { GlspContext } from '@sanyam/types';
import type { GModelNode, Point, Dimension } from '../conversion-types.js';
import { ElementTypes, createNode, createLabel } from '../conversion-types.js';
import type { ApplyResult } from '../providers/gmodel-to-ast-provider.js';
import { defaultGModelToAstProvider } from '../providers/gmodel-to-ast-provider.js';
import type { ElementIdRegistry, StructuralFingerprint } from '../element-id-registry.js';

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
      // Generate UUID-based element ID
      const elementId = this.generateElementId(context, operation);

      // Generate a human-readable name for the AST source text (decoupled from the UUID)
      const uniqueName = this.generateUniqueName(context, operation);

      // Create GModel node (uses UUID as element ID, human-readable name for label)
      const node = this.createGModelNode(context, operation, elementId, uniqueName);

      // Create corresponding AST node (uses human-readable name, not UUID)
      const applyResult = defaultGModelToAstProvider.createNode(
        context,
        operation.elementTypeId,
        operation.location ?? { x: 0, y: 0 },
        {
          ...operation.args,
          name: uniqueName,
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

      // Register UUID in idRegistry so reconciliation can match after reparse
      const idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
      if (idRegistry) {
        const astType = defaultGModelToAstProvider.getAstTypeFromNodeType(context, operation.elementTypeId) ?? operation.elementTypeId;
        const fingerprint: StructuralFingerprint = {
          astType,
          containmentProperty: '',
          siblingIndex: 0,
          parentUuid: 'root',
          name: uniqueName,
        };
        idRegistry.registerNewUuid(elementId, fingerprint);
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
   * Generate a unique element ID (UUID-based).
   */
  generateElementId(_context: GlspContext, _operation: CreateNodeOperation): string {
    return randomUUID();
  },

  /**
   * Generate a unique human-readable name for the AST source text.
   *
   * This is decoupled from the element ID (UUID) — the name appears in
   * grammar source text (e.g., `Actor MyActor "Title"`), while the UUID
   * is used for GModel element identity and position tracking.
   */
  generateUniqueName(context: GlspContext, operation: CreateNodeOperation): string {
    const baseName = operation.args?.name ?? this.getDefaultName(context, operation.elementTypeId);
    let name = baseName;
    let counter = 1;

    // Ensure uniqueness against existing AST node names
    const existingNames = this.getExistingNames(context);
    while (existingNames.has(name)) {
      name = `${baseName}${counter++}`;
    }

    return name;
  },

  /**
   * Get default name for element type.
   *
   * Looks up the manifest's rootTypes to find the AST type name matching
   * the given GLSP element type. Falls back to hardcoded defaults when
   * the manifest lookup fails.
   */
  getDefaultName(context: GlspContext, elementTypeId: string): string {
    // Look up manifest rootTypes for a matching diagramNode.glspType
    const manifest = context.manifest;
    if (manifest?.rootTypes) {
      for (const rootType of manifest.rootTypes) {
        if (rootType.diagramNode?.glspType === elementTypeId) {
          return rootType.astType;
        }
      }
    }

    // Fallback to hardcoded defaults
    if (elementTypeId.includes('entity')) return 'Entity';
    if (elementTypeId.includes('property')) return 'property';
    if (elementTypeId.includes('package')) return 'Package';
    return 'Element';
  },

  /**
   * Get existing element IDs from the GModel.
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
   * Get existing AST node names for name uniqueness checking.
   *
   * Walks the AST tree collecting `node.name` strings, which is distinct
   * from GModel element IDs (UUIDs).
   */
  getExistingNames(context: GlspContext): Set<string> {
    const names = new Set<string>();

    const collectNames = (node: any): void => {
      if (node.name && typeof node.name === 'string') {
        names.add(node.name);
      }
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && '$type' in item) {
              collectNames(item);
            }
          }
        } else if (value && typeof value === 'object' && '$type' in value) {
          collectNames(value);
        }
      }
    };

    if (context.root) {
      collectNames(context.root);
    }

    return names;
  },

  /**
   * Create GModel node.
   *
   * @param context - GLSP context
   * @param operation - Create node operation
   * @param elementId - UUID-based element ID
   * @param displayName - Human-readable name for the label (decoupled from UUID)
   */
  createGModelNode(
    context: GlspContext,
    operation: CreateNodeOperation,
    elementId: string,
    displayName?: string
  ): GModelNode {
    const position = operation.location ?? { x: 100, y: 100 };
    const size = this.getDefaultSize(context, operation.elementTypeId);

    const node = createNode(elementId, operation.elementTypeId, position, size);

    // Add label — use displayName (human-readable) rather than UUID
    const labelText = operation.args?.name ?? displayName ?? elementId;
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
   *
   * Looks up the manifest's rootTypes to find the default size for the
   * matching GLSP element type. Falls back to hardcoded sizes when the
   * manifest lookup fails.
   */
  getDefaultSize(context: GlspContext, elementTypeId: string): Dimension {
    // Look up manifest rootTypes for a matching diagramNode.glspType
    const manifest = context.manifest;
    if (manifest?.rootTypes) {
      for (const rootType of manifest.rootTypes) {
        if (rootType.diagramNode?.glspType === elementTypeId && rootType.diagramNode.defaultSize) {
          return {
            width: rootType.diagramNode.defaultSize.width,
            height: rootType.diagramNode.defaultSize.height,
          };
        }
      }
    }

    // Fallback to hardcoded defaults
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
    const types = new Set<string>([
      ElementTypes.NODE_ENTITY,
      ElementTypes.NODE_PROPERTY,
      ElementTypes.NODE_PACKAGE,
      ElementTypes.NODE_GENERIC,
      // Include base type for fallback
      ElementTypes.NODE,
    ]);

    // Add types from manifest rootTypes
    const manifest = (context as any).manifest;
    if (manifest?.rootTypes) {
      for (const rootType of manifest.rootTypes) {
        if (rootType.diagramNode?.glspType) {
          types.add(rootType.diagramNode.glspType);
        }
      }
    }

    // Add types from manifest diagramTypes
    if (manifest?.diagramTypes) {
      for (const diagramType of manifest.diagramTypes) {
        if (diagramType.nodeTypes) {
          for (const nodeType of diagramType.nodeTypes) {
            if (nodeType.glspType) {
              types.add(nodeType.glspType);
            }
          }
        }
      }
    }

    return [...types];
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
