/**
 * GModel to AST Provider (T070)
 *
 * Applies GModel changes back to AST nodes.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type { GlspContext } from '@sanyam/types';
import type { GModelToAstProvider } from '../provider-types.js';
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
export const defaultGModelToAstProvider = {
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
   * Update the bounds (position and/or size) of an AST node.
   */
  updateBounds(
    context: GlspContext,
    elementId: string,
    position?: Point,
    size?: Dimension
  ): ApplyResult {
    const results: ApplyResult[] = [];

    if (position) {
      results.push(this.applyPosition(context, elementId, position));
    }

    if (size) {
      results.push(this.applySize(context, elementId, size));
    }

    // Combine results
    const textEdits = results.flatMap(r => r.textEdits || []);
    const error = results.find(r => !r.success)?.error;

    return {
      success: !error,
      error,
      textEdits: textEdits.length > 0 ? textEdits : undefined,
    };
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
    // Use explicit position from args (text editor drop) or fall back to end-of-document
    const insertPosition = args?.insertAtPosition
      ? { line: args.insertAtPosition.line as number, character: args.insertAtPosition.character as number }
      : this.findInsertPosition(context, astType);

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
  deleteNode(context: GlspContext, elementId: string): ApplyResult {
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
   * Update a property value on an AST node, generating text edits.
   *
   * Uses the CST node tree to locate the property assignment in source text
   * and generates a TextEdit to replace the old value with the new one.
   *
   * @param context - GLSP context
   * @param elementId - Element ID to update
   * @param propertyName - Property name to update
   * @param value - New value
   * @returns ApplyResult with text edits
   */
  updateProperty(
    context: GlspContext,
    elementId: string,
    propertyName: string,
    value: unknown
  ): ApplyResult {
    const astNode = this.findAstNode(context, elementId);
    if (!astNode) {
      return {
        success: false,
        error: `Element not found: ${elementId}`,
      };
    }

    const cstNode = astNode.$cstNode;
    if (!cstNode) {
      return {
        success: false,
        error: 'Cannot find CST node for element',
      };
    }

    const document = context.document;
    const text = document.textDocument.getText();

    // Find the property's CST node by iterating CST children.
    // In Langium's CST, property assignments appear as child nodes
    // whose grammarSource feature matches the property name.
    const propertyCstNode = this.findPropertyCstNode(cstNode, propertyName);

    if (propertyCstNode) {
      // Replace the existing property value in source text
      const formattedValue = this.formatPropertyValueForSource(value, propertyName, astNode);
      const startPos = document.textDocument.positionAt(propertyCstNode.offset);
      const endPos = document.textDocument.positionAt(propertyCstNode.offset + propertyCstNode.length);

      return {
        success: true,
        astNode,
        textEdits: [{
          range: { start: startPos, end: endPos },
          newText: formattedValue,
        }],
      };
    }

    // Property exists in AST but not yet in source text (default value).
    // Insert a new property assignment before the closing brace.
    const formattedValue = this.formatPropertyValueForSource(value, propertyName, astNode);
    const insertText = `  ${propertyName}: ${formattedValue}\n`;
    const insertPosition = this.findPropertyInsertPosition(context, astNode);

    return {
      success: true,
      astNode,
      textEdits: [{
        range: { start: insertPosition, end: insertPosition },
        newText: insertText,
      }],
    };
  },

  /**
   * Find the CST node for a specific property value within a parent CST node.
   *
   * Searches through CST children for nodes whose grammar source indicates
   * they are assignments to the given property name. Returns the value node
   * (not the entire assignment), so text edits replace only the value portion.
   */
  findPropertyCstNode(
    parentCst: import('langium').CstNode,
    propertyName: string
  ): import('langium').CstNode | undefined {
    // Walk the CST tree looking for nodes assigned to this property
    const content = 'content' in parentCst ? (parentCst as any).content : undefined;
    if (!Array.isArray(content)) {
      return undefined;
    }

    for (const child of content) {
      // In Langium 4.x, CST nodes carry grammarSource with a 'feature' property
      // that indicates which AST property the node corresponds to
      const grammarSource = child.grammarSource;
      if (grammarSource && 'name' in grammarSource && grammarSource.name === propertyName) {
        // For compound assignments (keyword + value), return just the value part
        if ('content' in child && Array.isArray(child.content)) {
          // Return the last content child (typically the value token)
          const valueNode = child.content[child.content.length - 1];
          if (valueNode) {
            return valueNode;
          }
        }
        return child;
      }

      // Also check direct feature assignment on leaf nodes
      if (child.feature === propertyName || (child.grammarSource?.feature === propertyName)) {
        return child;
      }
    }

    return undefined;
  },

  /**
   * Format a value for insertion into source text.
   *
   * @param value - The value to format
   * @param propertyName - Property name (for context)
   * @param astNode - The AST node (for type inference)
   * @returns Formatted source text
   */
  formatPropertyValueForSource(
    value: unknown,
    propertyName: string,
    astNode: AstNode
  ): string {
    if (typeof value === 'string') {
      // Check if the current value in AST looks like a reference (has $ref or $refText)
      const currentValue = (astNode as any)[propertyName];
      if (currentValue && typeof currentValue === 'object' &&
          ('$ref' in currentValue || '$refText' in currentValue)) {
        // Reference — use bare identifier (no quotes)
        return String(value);
      }
      // Regular string — quote it
      return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    // Default: treat as bare identifier (enum values, etc.)
    return String(value);
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
    const manifest = (context as any).manifest;

    // Check manifest rootTypes (primary source: rootType.diagramNode.glspType → astType)
    if (manifest?.rootTypes) {
      for (const rootType of manifest.rootTypes as Array<{ astType: string; diagramNode?: { glspType: string } }>) {
        if (rootType.diagramNode?.glspType === nodeType) {
          return rootType.astType;
        }
      }
    }

    // Check manifest diagram.nodeTypes (legacy field)
    if (manifest?.diagram?.nodeTypes) {
      for (const [astType, config] of Object.entries(manifest.diagram.nodeTypes)) {
        if ((config as any).type === nodeType) {
          return astType;
        }
      }
    }

    // Fallback string-based mapping
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
    const manifest = (context as any).manifest;

    // Check manifest rootTypes for a template
    if (manifest?.rootTypes) {
      for (const rootType of manifest.rootTypes as Array<{ astType: string; template?: string }>) {
        if (rootType.astType === astType && rootType.template) {
          return '\n' + rootType.template.replace(/\$\{name\}/g, name);
        }
      }
    }

    // Fallback template-based generation
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
