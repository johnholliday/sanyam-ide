/**
 * Property Provider (T027, T028, FR-009 to FR-013)
 *
 * Extracts and updates properties from AST nodes for the properties panel.
 * Uses hybrid heuristic + manifest override classification.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type {
  GlspContext,
  GlspPropertyDescriptor,
  GlspPropertyType,
  GrammarManifest,
  PropertyOverride,
  FieldClassification,
} from '@sanyam/types';
import { classifyFieldValue } from '@sanyam/types';

/**
 * Result of property extraction.
 */
export interface PropertyExtractionResult {
  /** Element IDs inspected */
  elementIds: string[];
  /** Extracted property descriptors */
  properties: GlspPropertyDescriptor[];
  /** Type label for display */
  typeLabel: string;
  /** Whether multiple elements selected */
  isMultiSelect: boolean;
  /** Error if extraction failed */
  error?: string;
}

/**
 * Result of property update.
 */
export interface PropertyUpdateResult {
  /** Whether update succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Updated properties after change */
  properties?: GlspPropertyDescriptor[];
}

/**
 * T028: Classify a field using hybrid heuristic + manifest overrides.
 *
 * Default heuristics:
 * - string, number, boolean → property
 * - null, undefined → property
 * - objects with $ref or $refText → property (reference)
 * - arrays → child
 * - other objects → child
 *
 * @param fieldName - Name of the field
 * @param fieldValue - Value of the field
 * @param overrides - Property overrides from manifest
 * @returns Classification ('property' or 'child')
 */
export function classifyField(
  fieldName: string,
  fieldValue: unknown,
  overrides?: readonly PropertyOverride[]
): FieldClassification {
  // First check for explicit override
  if (overrides) {
    const override = overrides.find(o => o.property === fieldName);
    if (override) {
      return override.classification;
    }
  }

  // Skip internal/system fields
  if (fieldName.startsWith('$') || fieldName.startsWith('_')) {
    return 'child'; // Treat as non-property
  }

  // Use default heuristic
  return classifyFieldValue(fieldValue);
}

/**
 * Determine property type from value.
 *
 * @param value - Property value
 * @returns Property type for form control selection
 */
export function determinePropertyType(value: unknown): GlspPropertyType {
  if (value === null || value === undefined) {
    return 'string';
  }

  const type = typeof value;

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      // Check for reference
      if (value && ('$ref' in (value as object) || '$refText' in (value as object))) {
        return 'reference';
      }
      // Fall through for other objects
      return 'string';
    default:
      return 'string';
  }
}

/**
 * Convert field name to display label (camelCase → Title Case).
 *
 * @param fieldName - Field name in camelCase
 * @returns Human-readable label
 */
export function fieldNameToLabel(fieldName: string): string {
  // Handle common abbreviations
  const abbrevs = ['id', 'url', 'uri', 'api', 'http', 'html', 'css', 'js'];

  // Insert space before capital letters
  let label = fieldName.replace(/([A-Z])/g, ' $1');

  // Handle lowercase followed by uppercase
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Capitalize first letter
  label = label.charAt(0).toUpperCase() + label.slice(1);

  // Handle common abbreviations - uppercase them
  for (const abbrev of abbrevs) {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
    label = label.replace(regex, abbrev.toUpperCase());
  }

  return label.trim();
}

/**
 * Extract property value for serialization.
 * Handles references specially.
 *
 * @param value - Raw property value
 * @returns Serializable value
 */
export function extractPropertyValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Handle Langium references
    if ('$refText' in obj) {
      return obj.$refText;
    }
    if ('$ref' in obj && typeof obj.$ref === 'object' && obj.$ref) {
      const ref = obj.$ref as Record<string, unknown>;
      return ref.name || ref.$refText || '';
    }
  }

  return value;
}

/**
 * Property Provider for extracting and updating element properties.
 */
export class PropertyProvider {
  /**
   * Extract properties from AST nodes.
   *
   * @param context - GLSP context
   * @param elementIds - Element IDs to extract properties from
   * @param manifest - Optional grammar manifest for overrides
   * @returns Property extraction result
   */
  extractProperties(
    context: GlspContext,
    elementIds: string[],
    manifest?: GrammarManifest
  ): PropertyExtractionResult {
    if (!elementIds || elementIds.length === 0) {
      return {
        elementIds: [],
        properties: [],
        typeLabel: 'No selection',
        isMultiSelect: false,
      };
    }

    const root = context.root;
    if (!root) {
      return {
        elementIds,
        properties: [],
        typeLabel: 'No model',
        isMultiSelect: false,
        error: 'No AST root available',
      };
    }

    // Find AST nodes for element IDs
    const nodes = this.findNodesById(root, elementIds);

    if (nodes.length === 0) {
      return {
        elementIds,
        properties: [],
        typeLabel: 'Elements not found',
        isMultiSelect: false,
        error: 'Could not find AST nodes for selected elements',
      };
    }

    const isMultiSelect = nodes.length > 1;

    // Get type label
    const types = new Set(nodes.map(n => this.getNodeTypeName(n)));
    const typeLabel = isMultiSelect
      ? types.size === 1
        ? `${nodes.length} ${Array.from(types)[0]}s`
        : `${nodes.length} elements`
      : Array.from(types)[0] || 'Unknown';

    // Extract properties
    const propertyOverrides = manifest?.diagramTypes?.[0]?.propertyOverrides;

    if (isMultiSelect) {
      // For multi-select, find common properties
      const properties = this.extractCommonProperties(nodes, propertyOverrides);
      return {
        elementIds,
        properties,
        typeLabel,
        isMultiSelect,
      };
    } else {
      // Single selection - nodes[0] is guaranteed to exist since nodes.length > 0
      const firstNode = nodes[0];
      if (!firstNode) {
        return {
          elementIds,
          properties: [],
          typeLabel: 'Error',
          isMultiSelect,
          error: 'No node found',
        };
      }
      const properties = this.extractNodeProperties(firstNode, propertyOverrides);
      return {
        elementIds,
        properties,
        typeLabel,
        isMultiSelect,
      };
    }
  }

  /**
   * Update a property value on AST nodes.
   *
   * @param context - GLSP context
   * @param elementIds - Element IDs to update
   * @param propertyName - Property to update
   * @param value - New value
   * @returns Update result
   */
  updateProperty(
    context: GlspContext,
    elementIds: string[],
    propertyName: string,
    value: unknown
  ): PropertyUpdateResult {
    const root = context.root;
    if (!root) {
      return { success: false, error: 'No AST root available' };
    }

    const nodes = this.findNodesById(root, elementIds);
    if (nodes.length === 0) {
      return { success: false, error: 'Could not find AST nodes' };
    }

    try {
      // Update property on each node
      for (const node of nodes) {
        (node as any)[propertyName] = value;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Find AST nodes by element IDs.
   * Element IDs typically match node names or are derived from them.
   */
  protected findNodesById(root: AstNode, elementIds: string[]): AstNode[] {
    const nodes: AstNode[] = [];
    const idSet = new Set(elementIds);

    // Traverse the AST
    this.traverseAst(root, (node: AstNode) => {
      const nodeId = this.getNodeId(node);
      if (nodeId && idSet.has(nodeId)) {
        nodes.push(node);
      }
    });

    return nodes;
  }

  /**
   * Traverse AST recursively.
   */
  protected traverseAst(node: AstNode, callback: (node: AstNode) => void): void {
    callback(node);

    // Traverse children
    for (const key of Object.keys(node)) {
      if (key.startsWith('$')) continue;

      const value = (node as any)[key];

      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.isAstNode(item)) {
            this.traverseAst(item, callback);
          }
        }
      } else if (this.isAstNode(value)) {
        this.traverseAst(value, callback);
      }
    }
  }

  /**
   * Check if value is an AST node.
   */
  protected isAstNode(value: unknown): value is AstNode {
    return value !== null && typeof value === 'object' && '$type' in (value as object);
  }

  /**
   * Get ID for an AST node (typically the 'name' property).
   */
  protected getNodeId(node: AstNode): string | undefined {
    const nodeAny = node as any;
    return nodeAny.name || nodeAny.id || undefined;
  }

  /**
   * Get type name for an AST node.
   */
  protected getNodeTypeName(node: AstNode): string {
    return (node as any).$type || 'Unknown';
  }

  /**
   * Extract properties from a single node.
   */
  protected extractNodeProperties(
    node: AstNode,
    overrides?: readonly PropertyOverride[]
  ): GlspPropertyDescriptor[] {
    const properties: GlspPropertyDescriptor[] = [];

    for (const key of Object.keys(node)) {
      // Skip internal fields
      if (key.startsWith('$') || key.startsWith('_')) {
        continue;
      }

      const value = (node as any)[key];
      const classification = classifyField(key, value, overrides);

      // Only include fields classified as properties
      if (classification === 'property') {
        properties.push({
          name: key,
          label: fieldNameToLabel(key),
          type: determinePropertyType(value),
          value: extractPropertyValue(value),
          readOnly: false,
        });
      }
    }

    return properties;
  }

  /**
   * Extract common properties from multiple nodes (FR-010).
   * Only returns properties that exist on ALL selected nodes.
   */
  protected extractCommonProperties(
    nodes: AstNode[],
    overrides?: readonly PropertyOverride[]
  ): GlspPropertyDescriptor[] {
    if (nodes.length === 0) return [];

    const firstNode = nodes[0];
    if (!firstNode) return [];

    if (nodes.length === 1) return this.extractNodeProperties(firstNode, overrides);

    // Get properties from first node
    const firstProps = this.extractNodeProperties(firstNode, overrides);

    // Filter to only include properties that exist on all nodes
    return firstProps.filter(prop => {
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        const nodeProps = this.extractNodeProperties(node, overrides);
        if (!nodeProps.find(p => p.name === prop.name && p.type === prop.type)) {
          return false;
        }
      }
      return true;
    }).map(prop => {
      // For multi-select, check if values are the same
      const values = nodes.map(node => extractPropertyValue((node as any)[prop.name]));
      const allSame = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));

      return {
        ...prop,
        value: allSame ? values[0] : undefined, // undefined indicates mixed values
        description: allSame ? prop.description : '(Mixed values)',
      };
    });
  }
}

/**
 * Create a property provider instance.
 */
export function createPropertyProvider(): PropertyProvider {
  return new PropertyProvider();
}

/**
 * Default property provider instance.
 */
export const defaultPropertyProvider = createPropertyProvider();
