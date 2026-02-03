/**
 * Property Provider (T027, T028, FR-009 to FR-013)
 *
 * Extracts and updates properties from AST nodes for the properties panel.
 * Uses hybrid heuristic + manifest override classification.
 * Supports recursive extraction of arrays and nested objects up to MAX_PROPERTY_DEPTH.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type {
  GlspContext,
  GlspPropertyDescriptor,
  GlspPropertyType,
  GlspTextEdit,
  GrammarManifest,
  PropertyOverride,
  FieldClassification,
} from '@sanyam/types';
import { classifyFieldValue } from '@sanyam/types';
import type { ElementIdRegistry } from '../element-id-registry.js';
import { defaultGModelToAstProvider } from './gmodel-to-ast-provider.js';

/**
 * Maximum recursion depth for nested property extraction.
 * Covers all existing grammars (arrays of objects with scalar fields = 2 levels).
 */
export const MAX_PROPERTY_DEPTH = 3;

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
  /** Text edits to apply to the document */
  edits?: GlspTextEdit[];
  /** Updated properties after change */
  properties?: GlspPropertyDescriptor[];
}

/**
 * Parsed segment of a dot-path property reference.
 */
export interface PropertyPathSegment {
  /** Field name */
  name: string;
  /** Array index (present only for array access like `scores[1]`) */
  index?: number;
}

/**
 * T028: Classify a field using hybrid heuristic + manifest overrides.
 *
 * Default heuristics (updated):
 * - string, number, boolean → property
 * - null, undefined → property
 * - objects with $ref or $refText → property (reference)
 * - arrays → property (shown in panel as paneldynamic)
 * - other objects → property (shown in panel as nested panel)
 *
 * Grammars can force 'child' via propertyOverrides to hide specific fields.
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
 * Determine property type from value, including array and object types.
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
      if (Array.isArray(value)) {
        return 'array';
      }
      // Check for reference
      if (value && ('$ref' in (value as object) || '$refText' in (value as object))) {
        return 'reference';
      }
      // Check if it's an AST node (has $type)
      if (value && '$type' in (value as object)) {
        return 'object';
      }
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
 * Strip internal ($-prefixed) properties from an AST node,
 * returning a plain object suitable for SurveyJS data binding.
 *
 * @param node - AST node to serialize
 * @returns Plain object with only user-facing fields
 */
export function serializeAstNodeValue(node: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith('$') || key.startsWith('_')) {
      continue;
    }
    result[key] = serializeFieldValue(node[key]);
  }
  return result;
}

/**
 * Recursively serialize a single field value, stripping AST internals.
 * Handles primitives, references, nested AST nodes, and arrays.
 *
 * @param val - Raw field value from AST
 * @returns JSON-safe serialized value
 */
function serializeFieldValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val !== 'object') {
    return val; // primitive
  }

  if (Array.isArray(val)) {
    return val.map(item => serializeFieldValue(item));
  }

  const obj = val as Record<string, unknown>;

  // Langium reference — extract display text
  if ('$refText' in obj) {
    return obj.$refText;
  }
  if ('$ref' in obj) {
    const ref = obj.$ref as Record<string, unknown>;
    return ref.name || ref.$refText || '';
  }

  // Nested AST node or plain object — recurse, stripping $-prefixed keys
  return serializeAstNodeValue(obj);
}

/**
 * Check if an array contains Langium reference objects.
 * References have $refText or $ref but no $type.
 *
 * @param arr - Array to check
 * @returns True if the first element looks like a reference
 */
function isReferenceArray(arr: unknown[]): boolean {
  if (arr.length === 0) {
    return false;
  }
  const first = arr[0];
  if (!first || typeof first !== 'object') {
    return false;
  }
  const obj = first as Record<string, unknown>;
  return ('$refText' in obj || '$ref' in obj);
}

/**
 * Check if all elements in an array share the same $type (non-polymorphic).
 *
 * @param arr - Array to check
 * @returns The common $type string, or undefined if polymorphic or empty
 */
function getUniformElementType(arr: unknown[]): string | undefined {
  if (arr.length === 0) {
    return undefined;
  }
  const first = arr[0];
  if (!first || typeof first !== 'object' || !('$type' in (first as object))) {
    return undefined;
  }
  const firstType = (first as Record<string, unknown>).$type as string;
  for (let i = 1; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== 'object' || !('$type' in (item as object))) {
      return undefined;
    }
    if ((item as Record<string, unknown>).$type !== firstType) {
      return undefined; // Polymorphic — skip
    }
  }
  return firstType;
}

/**
 * Parse a dot-path property reference into segments.
 *
 * Examples:
 * - `"name"` → `[{name: 'name'}]`
 * - `"scores[1].notes"` → `[{name: 'scores', index: 1}, {name: 'notes'}]`
 * - `"requirements[2].description"` → `[{name: 'requirements', index: 2}, {name: 'description'}]`
 *
 * @param path - Dot-path property string
 * @returns Parsed segments
 */
export function parsePropertyPath(path: string): PropertyPathSegment[] {
  const segments: PropertyPathSegment[] = [];
  // Split on dots, but handle array brackets
  const parts = path.split('.');

  for (const part of parts) {
    const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (bracketMatch) {
      segments.push({
        name: bracketMatch[1]!,
        index: parseInt(bracketMatch[2]!, 10),
      });
    } else {
      segments.push({ name: part });
    }
  }

  return segments;
}

/**
 * Navigate from an AST node through a property path, returning
 * the target child AST node and the leaf property name.
 *
 * @param astNode - Starting AST node
 * @param segments - Parsed path segments (all except the last are navigated)
 * @returns The target AST node and the leaf property name, or undefined if navigation fails
 */
export function navigateToProperty(
  astNode: AstNode,
  segments: PropertyPathSegment[]
): { targetNode: AstNode; leafProperty: string } | undefined {
  if (segments.length === 0) {
    return undefined;
  }

  if (segments.length === 1) {
    const seg = segments[0]!;
    return { targetNode: astNode, leafProperty: seg.name };
  }

  // Navigate through all segments except the last
  let current: unknown = astNode;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    const fieldValue = (current as Record<string, unknown>)[seg.name];

    if (seg.index !== undefined) {
      // Array access
      if (!Array.isArray(fieldValue) || seg.index >= fieldValue.length) {
        return undefined;
      }
      current = fieldValue[seg.index];
    } else {
      // Direct field access
      current = fieldValue;
    }
  }

  if (!current || typeof current !== 'object' || !('$type' in (current as object))) {
    return undefined;
  }

  const lastSegment = segments[segments.length - 1]!;
  return { targetNode: current as AstNode, leafProperty: lastSegment.name };
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

    // Find AST nodes for element IDs (using id registry for UUID-based lookups)
    const idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    const nodes = this.findNodesById(root, elementIds, idRegistry);

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
   * Supports dot-path property names for nested field updates
   * (e.g., `"scores[1].notes"`).
   *
   * @param context - GLSP context
   * @param elementIds - Element IDs to update
   * @param propertyName - Property name (simple or dot-path)
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

    const idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    const nodes = this.findNodesById(root, elementIds, idRegistry);
    if (nodes.length === 0) {
      return { success: false, error: 'Could not find AST nodes' };
    }

    // Check if this is a dot-path property reference
    const isDotPath = propertyName.includes('.') || propertyName.includes('[');

    try {
      const allEdits: GlspTextEdit[] = [];

      if (isDotPath) {
        // Dot-path: navigate to the target child AST node and update the leaf property
        const segments = parsePropertyPath(propertyName);

        for (const node of nodes) {
          const nav = navigateToProperty(node, segments);
          if (!nav) {
            return { success: false, error: `Cannot navigate to property path: ${propertyName}` };
          }

          // Find the element ID for the target child node (for CST-based text editing)
          // The child node may not have its own element ID, so we use the parent's CST context
          const result = defaultGModelToAstProvider.updateProperty(
            context,
            // Pass a synthetic lookup that resolves to the target child node
            '__dot_path_target__',
            nav.leafProperty,
            value
          );

          // If the synthetic lookup fails, fall back to direct CST manipulation on the child
          if (!result.success) {
            // Direct AST update as fallback
            (nav.targetNode as unknown as Record<string, unknown>)[nav.leafProperty] = value;

            // Generate text edit from the child's CST node
            const cstNode = nav.targetNode.$cstNode;
            if (cstNode) {
              const propertyCstNode = defaultGModelToAstProvider.findPropertyCstNode(cstNode, nav.leafProperty);
              if (propertyCstNode) {
                const formattedValue = defaultGModelToAstProvider.formatPropertyValueForSource(
                  value, nav.leafProperty, nav.targetNode
                );
                const document = context.document;
                const startPos = document.textDocument.positionAt(propertyCstNode.offset);
                const endPos = document.textDocument.positionAt(propertyCstNode.offset + propertyCstNode.length);
                allEdits.push({
                  range: { start: startPos, end: endPos },
                  newText: formattedValue,
                });
              } else {
                // Property not yet in source — insert before closing brace
                const formattedValue = defaultGModelToAstProvider.formatPropertyValueForSource(
                  value, nav.leafProperty, nav.targetNode
                );
                const insertText = `  ${nav.leafProperty}: ${formattedValue}\n`;
                const insertPosition = defaultGModelToAstProvider.findPropertyInsertPosition(context, nav.targetNode);
                allEdits.push({
                  range: { start: insertPosition, end: insertPosition },
                  newText: insertText,
                });
              }
            }
          } else {
            if (result.textEdits) {
              allEdits.push(...result.textEdits);
            }
            // Update AST in memory
            (nav.targetNode as unknown as Record<string, unknown>)[nav.leafProperty] = value;
          }
        }
      } else {
        // Simple property name — existing behavior
        for (const elementId of elementIds) {
          const result = defaultGModelToAstProvider.updateProperty(
            context,
            elementId,
            propertyName,
            value
          );

          if (!result.success) {
            return { success: false, error: result.error };
          }

          if (result.textEdits) {
            allEdits.push(...result.textEdits);
          }
        }

        // Also update AST in memory for immediate consistency
        for (const node of nodes) {
          (node as any)[propertyName] = value;
        }
      }

      return {
        success: true,
        edits: allEdits.length > 0 ? allEdits : undefined,
      };
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
  protected findNodesById(root: AstNode, elementIds: string[], idRegistry?: ElementIdRegistry): AstNode[] {
    const nodes: AstNode[] = [];
    const idSet = new Set(elementIds);

    // First try: resolve UUIDs via the id registry (primary path when diagram uses UUIDs)
    if (idRegistry) {
      for (const id of elementIds) {
        const astNode = idRegistry.getAstNode(id);
        if (astNode) {
          nodes.push(astNode);
          idSet.delete(id);
        }
      }
    }

    // Second try: fall back to name-based matching for any remaining IDs
    if (idSet.size > 0) {
      this.traverseAst(root, (node: AstNode) => {
        const nodeId = this.getNodeId(node);
        if (nodeId && idSet.has(nodeId)) {
          nodes.push(node);
        }
      });
    }

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
   * Extract properties from a single node, with recursive support
   * for arrays and nested objects.
   *
   * @param node - AST node to extract from
   * @param overrides - Property overrides from manifest
   * @returns Array of property descriptors
   */
  protected extractNodeProperties(
    node: AstNode,
    overrides?: readonly PropertyOverride[]
  ): GlspPropertyDescriptor[] {
    return this.extractPropertiesRecursive(node, overrides, 0, '');
  }

  /**
   * Recursively extract properties from a node, up to MAX_PROPERTY_DEPTH.
   *
   * Nested object fields are prefixed with dot-path notation (e.g. `roles.roles`)
   * so that SurveyJS data keys are unique across the flat `model.data` namespace.
   * Array (paneldynamic) children are NOT prefixed — paneldynamic scopes its own data.
   *
   * @param node - AST node
   * @param overrides - Property overrides
   * @param depth - Current recursion depth
   * @param parentPrefix - Dot-path prefix from parent object fields
   * @returns Property descriptors
   */
  protected extractPropertiesRecursive(
    node: AstNode,
    overrides: readonly PropertyOverride[] | undefined,
    depth: number,
    parentPrefix: string = ''
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
      if (classification !== 'property') {
        continue;
      }

      const prefixedName = parentPrefix ? `${parentPrefix}.${key}` : key;
      const propType = determinePropertyType(value);

      if (propType === 'array' && Array.isArray(value)) {
        // Array of AST nodes
        if (depth >= MAX_PROPERTY_DEPTH) {
          continue; // Stop recursing
        }

        if (value.length === 0) {
          // Empty array — we can't infer element type, show as read-only
          properties.push({
            name: prefixedName,
            label: fieldNameToLabel(key),
            type: 'array',
            value: [],
            children: [],
            readOnly: true,
            description: 'Empty array',
          });
        } else if (isReferenceArray(value)) {
          // Array of Langium references — show as comma-separated string
          const refTexts = value.map((item: unknown) => {
            const obj = item as Record<string, unknown>;
            if ('$refText' in obj) {
              return String(obj.$refText);
            }
            if ('$ref' in obj && typeof obj.$ref === 'object' && obj.$ref) {
              const ref = obj.$ref as Record<string, unknown>;
              return String(ref.name || ref.$refText || '');
            }
            return '';
          });
          properties.push({
            name: prefixedName,
            label: fieldNameToLabel(key),
            type: 'string',
            value: refTexts.join(', '),
            readOnly: true,
            description: `${refTexts.length} reference(s)`,
          });
        } else if (this.isAstNode(value[0])) {
          const elementType = getUniformElementType(value);
          if (!elementType) {
            continue; // Polymorphic array — skip
          }

          // Extract children template from first element
          // Arrays (paneldynamic) scope their own data — do NOT pass prefix to children
          const firstElement = value[0] as AstNode;
          const childDescriptors = this.extractPropertiesRecursive(firstElement, overrides, depth + 1, '');

          // Serialize all array elements as plain objects for SurveyJS data binding
          const serializedElements = value.map((item: unknown) =>
            serializeAstNodeValue(item as unknown as Record<string, unknown>)
          );

          properties.push({
            name: prefixedName,
            label: fieldNameToLabel(key),
            type: 'array',
            value: serializedElements,
            children: childDescriptors,
            elementType,
            readOnly: false,
          });
        } else {
          // Array of primitives — show as comma-separated string
          properties.push({
            name: prefixedName,
            label: fieldNameToLabel(key),
            type: 'string',
            value: value.map(String).join(', '),
            readOnly: true,
          });
        }
      } else if (propType === 'object' && value && typeof value === 'object' && this.isAstNode(value)) {
        // Nested AST object
        if (depth >= MAX_PROPERTY_DEPTH) {
          continue; // Stop recursing
        }

        const childDescriptors = this.extractPropertiesRecursive(value as AstNode, overrides, depth + 1, prefixedName);
        const serializedValue = serializeAstNodeValue(value as unknown as Record<string, unknown>);

        properties.push({
          name: prefixedName,
          label: fieldNameToLabel(key),
          type: 'object',
          value: serializedValue,
          children: childDescriptors,
          readOnly: false,
        });
      } else {
        // Scalar / reference — same as before
        properties.push({
          name: prefixedName,
          label: fieldNameToLabel(key),
          type: propType,
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
      const allSame = values.every(v => {
        try {
          return JSON.stringify(v) === JSON.stringify(values[0]);
        } catch {
          return false; // Circular or non-serializable — treat as different
        }
      });

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
