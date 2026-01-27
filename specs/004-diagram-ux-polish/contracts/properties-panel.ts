/**
 * Properties Panel API Contracts
 *
 * Defines the API for the diagram properties panel feature.
 * Includes property extraction, display, and editing.
 *
 * @packageDocumentation
 */

// =============================================================================
// Property Types
// =============================================================================

/**
 * Type of a property value.
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
// Request/Response Types
// =============================================================================

/**
 * Request to get properties for selected elements.
 */
export interface GetPropertiesRequest {
  /** Document URI */
  readonly uri: string;

  /** Element IDs to inspect */
  readonly elementIds: readonly string[];
}

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
 * Request to update a property value.
 */
export interface PropertyUpdateRequest {
  /** Document URI */
  readonly uri: string;

  /** Element ID(s) to update */
  readonly elementIds: readonly string[];

  /** Property name to update */
  readonly property: string;

  /** New value */
  readonly value: unknown;
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
 * Service for extracting and updating properties.
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
   * @param request - Request with URI and element IDs
   * @returns Properties result
   */
  getProperties(request: GetPropertiesRequest): Promise<PropertiesResult>;

  /**
   * Update a property value.
   *
   * @param request - Update request
   * @returns Update result
   */
  updateProperty(request: PropertyUpdateRequest): Promise<PropertyUpdateResult>;
}

// =============================================================================
// Classification Types
// =============================================================================

/**
 * Classification of an AST field.
 */
export type FieldClassification = 'property' | 'child';

/**
 * Override for automatic property/child classification.
 */
export interface PropertyOverride {
  /** AST property name */
  readonly property: string;
  /** Override classification */
  readonly classification: FieldClassification;
}

/**
 * Classify a field value using default heuristics.
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
 * Classify a field with override support.
 *
 * @param fieldName - Field name
 * @param fieldValue - Field value
 * @param overrides - Classification overrides
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
