/**
 * @sanyam/types - Properties Service Type Definitions
 *
 * Defines the API contracts for the properties panel feature.
 * Includes property extraction, display, and editing (FR-009 to FR-013).
 *
 * @packageDocumentation
 */

import type { FieldClassification, PropertyOverride } from './grammar-manifest.js';

// =============================================================================
// Property Types
// =============================================================================

/**
 * Type of a property value for form control selection.
 */
export type PropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'reference';

/**
 * Validation rules for a property.
 */
export interface PropertyValidation {
  /** Whether the property is required */
  readonly required?: boolean;
  /** Regex pattern for string validation */
  readonly pattern?: string;
  /** Minimum value for numbers */
  readonly min?: number;
  /** Maximum value for numbers */
  readonly max?: number;
  /** Minimum length for strings */
  readonly minLength?: number;
  /** Maximum length for strings */
  readonly maxLength?: number;
}

/**
 * Descriptor for a property displayed in the properties panel.
 */
export interface PropertyDescriptor {
  /** Property name (AST field name) */
  readonly name: string;

  /** Display label for the property */
  readonly label: string;

  /** Value type determines form control */
  readonly type: PropertyType;

  /** Current value */
  readonly value: unknown;

  /** For enum type: available options */
  readonly options?: readonly string[];

  /** For reference type: valid target types */
  readonly referenceTypes?: readonly string[];

  /** Whether property is read-only */
  readonly readOnly?: boolean;

  /** Validation rules */
  readonly validation?: PropertyValidation;

  /** Help text / description */
  readonly description?: string;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Result of property extraction.
 */
export interface PropertiesResult {
  /** Element ID(s) being inspected */
  readonly elementIds: readonly string[];

  /** Available properties (common to all selected if multi-select) */
  readonly properties: readonly PropertyDescriptor[];

  /** Type label for display (e.g., "Entity" or "3 Entities") */
  readonly typeLabel: string;

  /** Whether multiple elements are selected */
  readonly isMultiSelect: boolean;

  /** Error message if extraction failed */
  readonly error?: string;
}

/**
 * Result of a property update operation.
 */
export interface PropertyUpdateResult {
  /** Whether update succeeded */
  readonly success: boolean;

  /** Error message if failed */
  readonly error?: string;

  /** Updated property descriptors (for refresh) */
  readonly properties?: readonly PropertyDescriptor[];
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Service for extracting and updating element properties (FR-009, FR-010, FR-012).
 *
 * Implementations should:
 * - Extract properties from AST nodes
 * - Apply property/child classification rules
 * - Handle multi-select by finding common properties
 * - Update AST text when properties change
 */
export interface PropertiesService {
  /**
   * Get properties for selected elements.
   *
   * For multi-select, only properties common to all selected elements
   * are returned (FR-010).
   *
   * @param uri - Document URI
   * @param elementIds - Element IDs to inspect
   * @returns Properties result
   */
  getProperties(uri: string, elementIds: readonly string[]): Promise<PropertiesResult>;

  /**
   * Update a property value.
   *
   * For multi-select, the value is applied to all selected elements (FR-010).
   *
   * @param uri - Document URI
   * @param elementIds - Element IDs to update
   * @param property - Property name to update
   * @param value - New value
   * @returns Update result
   */
  updateProperty(
    uri: string,
    elementIds: readonly string[],
    property: string,
    value: unknown
  ): Promise<PropertyUpdateResult>;
}

// =============================================================================
// Classification Utilities
// =============================================================================

/**
 * Classify a field value using default heuristics (FR-011).
 *
 * Default rules:
 * - string, number, boolean → property
 * - null, undefined → property
 * - objects with $ref or $refText → property (reference)
 * - arrays → child
 * - other objects → child
 *
 * @param value - Field value to classify
 * @returns Classification
 */
export function classifyFieldValue(value: unknown): FieldClassification {
  if (value === null || value === undefined) {
    return 'property';
  }

  const type = typeof value;

  if (type === 'string' || type === 'number' || type === 'boolean') {
    return 'property';
  }

  if (Array.isArray(value)) {
    return 'child';
  }

  if (type === 'object') {
    // Check if it's a Langium reference
    const obj = value as Record<string, unknown>;
    if ('$ref' in obj || '$refText' in obj) {
      return 'property';
    }
    return 'child';
  }

  return 'property';
}

/**
 * Classify a field with override support (FR-011).
 *
 * @param fieldName - Field name
 * @param fieldValue - Field value
 * @param overrides - Classification overrides from grammar manifest
 * @returns Classification
 */
export function classifyField(
  fieldName: string,
  fieldValue: unknown,
  overrides: readonly PropertyOverride[]
): FieldClassification {
  // Check for explicit override
  const override = overrides.find(o => o.property === fieldName);
  if (override) {
    return override.classification;
  }

  // Use default heuristic
  return classifyFieldValue(fieldValue);
}

// =============================================================================
// UI Constants
// =============================================================================

/**
 * Properties panel widget ID.
 */
export const PROPERTIES_PANEL_ID = 'sanyam-properties-panel';

/**
 * Properties panel view container ID.
 */
export const PROPERTIES_PANEL_VIEW_CONTAINER_ID = 'sanyam-properties-view-container';

/**
 * Command IDs for properties panel.
 */
export const PropertiesPanelCommands = {
  TOGGLE: 'sanyam.propertiesPanel.toggle',
  FOCUS: 'sanyam.propertiesPanel.focus',
  REFRESH: 'sanyam.propertiesPanel.refresh',
} as const;

// =============================================================================
// Port Utilities (FR-023, FR-024, FR-025)
// =============================================================================

import type { PortConfig, ConnectionRule } from './grammar-manifest.js';

/**
 * Default port style.
 */
export const DEFAULT_PORT_STYLE = 'circle' as const;

/**
 * Default port offset (center of edge).
 */
export const DEFAULT_PORT_OFFSET = 0.5;

/**
 * Port size in pixels (radius for circle, half-width for square/diamond).
 */
export const PORT_SIZE = 5;

/**
 * CSS classes for port elements.
 */
export const PortCssClasses = {
  PORT: 'sanyam-port',
  PORT_VALID_TARGET: 'sanyam-port-valid-target',
  PORT_INVALID_TARGET: 'sanyam-port-invalid-target',
  PORT_HOVER: 'sanyam-port-hover',
} as const;

/**
 * Check if a port allows a specific edge type.
 *
 * @param port - Port configuration
 * @param edgeType - Edge type to check
 * @returns True if connection is allowed
 */
export function portAllowsEdgeType(port: PortConfig, edgeType: string): boolean {
  if (!port.allowedConnections || port.allowedConnections.length === 0) {
    return true; // No restrictions
  }
  return port.allowedConnections.includes(edgeType);
}

/**
 * Check if a connection rule matches a given scenario.
 *
 * @param rule - Connection rule to check
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns True if rule matches
 */
export function ruleMatches(
  rule: ConnectionRule,
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): boolean {
  // Check self-connection
  if (isSelfConnection && !rule.allowSelfConnection) {
    return false;
  }

  // Check source type
  if (rule.sourceType !== '*' && rule.sourceType !== sourceType) {
    return false;
  }

  // Check source port
  if (rule.sourcePort !== undefined && rule.sourcePort !== '*') {
    if (rule.sourcePort !== sourcePort) {
      return false;
    }
  }

  // Check target type
  if (rule.targetType !== '*' && rule.targetType !== targetType) {
    return false;
  }

  // Check target port
  if (rule.targetPort !== undefined && rule.targetPort !== '*') {
    if (rule.targetPort !== targetPort) {
      return false;
    }
  }

  return true;
}

/**
 * Find matching connection rules for a scenario.
 *
 * @param rules - All connection rules
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns Matching rules
 */
export function findMatchingRules(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): ConnectionRule[] {
  return rules.filter(rule =>
    ruleMatches(rule, sourceType, sourcePort, targetType, targetPort, isSelfConnection)
  );
}

/**
 * Check if a connection is valid according to rules.
 *
 * @param rules - Connection rules to check against
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns True if at least one rule matches
 */
export function isConnectionValid(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): boolean {
  return findMatchingRules(
    rules,
    sourceType,
    sourcePort,
    targetType,
    targetPort,
    isSelfConnection
  ).length > 0;
}

/**
 * Get the edge type to create for a valid connection.
 * Returns the edge type from the first matching rule.
 *
 * @param rules - Connection rules
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns Edge type or undefined if no rule matches
 */
export function getEdgeTypeForConnection(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): string | undefined {
  const matching = findMatchingRules(
    rules,
    sourceType,
    sourcePort,
    targetType,
    targetPort,
    isSelfConnection
  );
  const firstMatch = matching[0];
  return firstMatch ? firstMatch.edgeType : undefined;
}

/**
 * Calculate port position on a node.
 *
 * @param nodeWidth - Node width in pixels
 * @param nodeHeight - Node height in pixels
 * @param port - Port configuration
 * @returns Port position relative to node origin
 */
export function calculatePortPosition(
  nodeWidth: number,
  nodeHeight: number,
  port: PortConfig
): { x: number; y: number } {
  const offset = port.offset ?? DEFAULT_PORT_OFFSET;

  switch (port.position) {
    case 'top':
      return { x: nodeWidth * offset, y: 0 };
    case 'bottom':
      return { x: nodeWidth * offset, y: nodeHeight };
    case 'left':
      return { x: 0, y: nodeHeight * offset };
    case 'right':
      return { x: nodeWidth, y: nodeHeight * offset };
  }
}
