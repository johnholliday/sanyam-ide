/**
 * GModel to AST Provider (T070)
 *
 * Applies GModel changes back to AST nodes.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type { GlspContext, GModelToAstProvider } from '@sanyam/types';
import type {
  GModelElement,
  GModelNode,
  GModelEdge,
  Point,
  Dimension,
} from '../conversion-types.js';
import { isNode, isEdge } from '../conversion-types.js';

/**
 * Result of applying GModel changes to AST.
 */
export interface ApplyResult {
  /** Whether the apply was successful */
  success: boolean;
  /** The modified AST node */
  astNode?: AstNode;
  /** Error message if failed */
  error?: string;
  /** Text edits to apply to the document */
  textEdits?: TextEdit[];
}

/**
 * Text edit to apply to document.
 */
export interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

/**
 * Default GModel to AST provider implementation.
 */
export const defaultGModelToAstProvider: GModelToAstProvider = {
  /**
   * Apply a position change from GModel to AST.
   */
  applyPosition(
    context: GlspContext,
    elementId: string,
    position: Point
  ): ApplyResult {
    // Update metadata storage
    if (context.metadata?.positions) {
      context.metadata.positions.set(elementId, position);
    }

    // Find corresponding AST node
    const astNode = this.findAstNode(context, elementId);
    if (!astNode) {
      return {
        success: true,
        // Position is metadata-only, no AST node needed
      };
    }

    // If AST has position property, update it
    if ('position' in astNode) {
      (astNode as any).position = position;
      return {
        success: true,
        astNode,
        textEdits: this.generatePositionEdits(context, astNode, position),
      };
    }

    return { success: true };
  },

  /**
   * Apply a size change from GModel to AST.
   */
  applySize(
    context: GlspContext,
    elementId: string,
    size: Dimension
  ): ApplyResult {
    // Update metadata storage
    if (context.metadata?.sizes) {
      context.metadata.sizes.set(elementId, size);
    }

    // Find corresponding AST node
    const astNode = this.findAstNode(context, elementId);
    if (!astNode) {
      return { success: true };
    }

    // If AST has size property, update it
    if ('size' in astNode) {
      (astNode as any).size = size;
      return {
        success: true,
        astNode,
        textEdits: this.generateSizeEdits(context, astNode, size),
      };
    }

    return { success: true };
  },

  /**
   * Create a new AST node from GModel.
   */
  createNode(
    context: GlspContext,
    nodeType: string,
    position: Point,
    args?: Record<string, any>
  ): ApplyResult {
    // Determine AST type from GModel node type
    const astType = this.getAstTypeFromNodeType(context, nodeType);
    if (!astType) {
      return {
        success: false,
        error: `Unknown node type: ${nodeType}`,
      };
    }

    // Create AST node structure
    const name = args?.name ?? this.generateNodeName(context, astType);
    const newAstNode: any = {
      $type: astType,
      name,
    };

    // Generate text to insert
    const insertText = this.generateNodeText(context, astType, name, args);
    const insertPosition = this.findInsertPosition(context, astType);

    return {
      success: true,
      astNode: newAstNode,
      textEdits: [{
        range: {
          start: insertPosition,
          end: insertPosition,
        },
        newText: insertText,
      }],
    };
  },

  /**
   * Create a new AST reference (edge) from GModel.
   */
  createEdge(
    context: GlspContext,
    edgeType: string,
    sourceId: string,
    targetId: string,
    args?: Record<string, any>
  ): ApplyResult {
    const sourceNode = this.findAstNode(context, sourceId);
    const targetNode = this.findAstNode(context, targetId);

    if (!sourceNode || !targetNode) {
      return {
        success: false,
        error: `Source or target node not found`,
      };
    }

    // Determine property name for the reference
    const propertyName = args?.propertyName ?? this.getDefaultReferenceProperty(context, edgeType);
    const targetName = (targetNode as any).name;

    // Generate text edit to add reference
    const referenceText = this.generateReferenceText(context, propertyName, targetName);
    const insertPosition = this.findPropertyInsertPosition(context, sourceNode);

    return {
      success: true,
      textEdits: [{
        range: {
          start: insertPosition,
          end: insertPosition,
        },
        newText: referenceText,
      }],
    };
  },

  /**
   * Delete an AST node corresponding to a GModel element.
   */
  deleteElement(context: GlspContext, elementId: string): ApplyResult {
    const astNode = this.findAstNode(context, elementId);
    if (!astNode) {
      return { success: true }; // Already deleted or never existed
    }

    const cstNode = astNode.$cstNode;
    if (!cstNode) {
      return {
        success: false,
        error: 'Cannot find CST node for deletion',
      };
    }

    // Calculate deletion range
    const document = context.document;
    const startPos = document.textDocument.positionAt(cstNode.offset);
    const endPos = document.textDocument.positionAt(cstNode.offset + cstNode.length);

    return {
      success: true,
      textEdits: [{
        range: {
          start: startPos,
          end: endPos,
        },
        newText: '',
      }],
    };
  },

  /**
   * Rename an AST node.
   */
  renameElement(context: GlspContext, elementId: string, newName: string): ApplyResult {
    const astNode = this.findAstNode(context, elementId);
    if (!astNode || !('name' in astNode)) {
      return {
        success: false,
        error: 'Element not found or not nameable',
      };
    }

    // Find the name token in CST
    const cstNode = astNode.$cstNode;
    if (!cstNode) {
      return {
        success: false,
        error: 'Cannot find CST node',
      };
    }

    // Find the name position
    const oldName = (astNode as any).name;
    const text = context.document.textDocument.getText();
    const nodeText = text.substring(cstNode.offset, cstNode.offset + cstNode.length);
    const nameIndex = nodeText.indexOf(oldName);

    if (nameIndex === -1) {
      return {
        success: false,
        error: 'Cannot find name in CST',
      };
    }

    const startOffset = cstNode.offset + nameIndex;
    const endOffset = startOffset + oldName.length;

    return {
      success: true,
      textEdits: [{
        range: {
          start: context.document.textDocument.positionAt(startOffset),
          end: context.document.textDocument.positionAt(endOffset),
        },
        newText: newName,
      }],
    };
  },

  /**
   * Find the AST node corresponding to an element ID.
   */
  findAstNode(context: GlspContext, elementId: string): AstNode | undefined {
    // Check model state mapping
    const modelState = (context as any).modelState;
    if (modelState?.getAstNode) {
      return modelState.getAstNode(elementId);
    }

    // Fallback: search by name
    const root = context.root;
    const search = (node: any): AstNode | undefined => {
      if (node.name === elementId) {
        return node;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && '$type' in item) {
              const found = search(item);
              if (found) return found;
            }
          }
        } else if (value && typeof value === 'object' && '$type' in value) {
          const found = search(value);
          if (found) return found;
        }
      }
      return undefined;
    };

    return search(root);
  },

  /**
   * Get AST type from GModel node type.
   */
  getAstTypeFromNodeType(context: GlspContext, nodeType: string): string | undefined {
    // Check manifest for reverse mapping
    const manifest = (context as any).manifest;
    if (manifest?.diagram?.nodeTypes) {
      for (const [astType, config] of Object.entries(manifest.diagram.nodeTypes)) {
        if ((config as any).type === nodeType) {
          return astType;
        }
      }
    }

    // Default mapping
    if (nodeType.includes('entity')) return 'Entity';
    if (nodeType.includes('property')) return 'Property';
    if (nodeType.includes('package')) return 'Package';

    return undefined;
  },

  /**
   * Get default reference property name.
   */
  getDefaultReferenceProperty(context: GlspContext, edgeType: string): string {
    if (edgeType.includes('inheritance')) return 'extends';
    if (edgeType.includes('composition')) return 'contains';
    return 'ref';
  },

  /**
   * Generate a unique node name.
   */
  generateNodeName(context: GlspContext, astType: string): string {
    let counter = 1;
    let name = `${astType}${counter}`;

    // Check for uniqueness
    const existingNames = new Set<string>();
    const collectNames = (node: any) => {
      if (node.name) {
        existingNames.add(node.name);
      }
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              collectNames(item);
            }
          }
        } else if (value && typeof value === 'object') {
          collectNames(value);
        }
      }
    };
    collectNames(context.root);

    while (existingNames.has(name)) {
      counter++;
      name = `${astType}${counter}`;
    }

    return name;
  },

  /**
   * Generate text for a new node.
   */
  generateNodeText(
    context: GlspContext,
    astType: string,
    name: string,
    args?: Record<string, any>
  ): string {
    // Simple template-based generation
    // A real implementation would use Langium's serializer
    const lowerType = astType.toLowerCase();

    if (lowerType === 'entity' || lowerType === 'class') {
      return `\n\nentity ${name} {\n}\n`;
    }
    if (lowerType === 'property' || lowerType === 'attribute') {
      const type = args?.type ?? 'string';
      return `  ${name}: ${type}\n`;
    }

    return `\n${astType.toLowerCase()} ${name} {\n}\n`;
  },

  /**
   * Generate text for a reference property.
   */
  generateReferenceText(
    context: GlspContext,
    propertyName: string,
    targetName: string
  ): string {
    return `  ${propertyName}: ${targetName}\n`;
  },

  /**
   * Find position to insert a new node.
   */
  findInsertPosition(
    context: GlspContext,
    astType: string
  ): { line: number; character: number } {
    // Insert at end of document
    const text = context.document.textDocument.getText();
    return context.document.textDocument.positionAt(text.length);
  },

  /**
   * Find position to insert a property in a node.
   */
  findPropertyInsertPosition(
    context: GlspContext,
    astNode: AstNode
  ): { line: number; character: number } {
    const cstNode = astNode.$cstNode;
    if (!cstNode) {
      return { line: 0, character: 0 };
    }

    // Find closing brace position
    const text = context.document.textDocument.getText();
    const nodeText = text.substring(cstNode.offset, cstNode.offset + cstNode.length);
    const braceIndex = nodeText.lastIndexOf('}');

    if (braceIndex > 0) {
      const insertOffset = cstNode.offset + braceIndex;
      return context.document.textDocument.positionAt(insertOffset);
    }

    return context.document.textDocument.positionAt(cstNode.offset + cstNode.length);
  },

  /**
   * Generate text edits for position changes (if stored in AST).
   */
  generatePositionEdits(
    context: GlspContext,
    astNode: AstNode,
    position: Point
  ): TextEdit[] {
    // Position is typically metadata, not stored in DSL text
    return [];
  },

  /**
   * Generate text edits for size changes (if stored in AST).
   */
  generateSizeEdits(
    context: GlspContext,
    astNode: AstNode,
    size: Dimension
  ): TextEdit[] {
    // Size is typically metadata, not stored in DSL text
    return [];
  },
};

/**
 * Create a custom GModel to AST provider.
 *
 * @param customBuilder - Custom provider methods
 * @returns A customized provider
 */
export function createGModelToAstProvider(
  customBuilder?: Partial<GModelToAstProvider>
): GModelToAstProvider {
  return {
    ...defaultGModelToAstProvider,
    ...customBuilder,
  };
}
