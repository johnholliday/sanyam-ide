/**
 * Property Utilities (T029, FR-009 to FR-013)
 *
 * Frontend utilities for the properties panel.
 *
 * @packageDocumentation
 */

import type { GlspPropertyDescriptor, GlspPropertyType } from '@sanyam/types';

/**
 * Format a property value for display.
 *
 * @param value - Property value
 * @param type - Property type
 * @returns Formatted string
 */
export function formatPropertyValue(value: unknown, type: GlspPropertyType): string {
  if (value === undefined) {
    return '(Mixed values)';
  }
  if (value === null) {
    return '';
  }

  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'reference':
      // References are stored as strings after extraction
      return String(value);
    case 'enum':
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Parse user input to the appropriate type.
 *
 * @param input - User input string
 * @param type - Target property type
 * @returns Parsed value
 */
export function parsePropertyValue(input: string, type: GlspPropertyType): unknown {
  switch (type) {
    case 'boolean':
      return input.toLowerCase() === 'true' || input === '1';
    case 'number':
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    case 'reference':
    case 'enum':
    case 'string':
    default:
      return input;
  }
}

/**
 * Get input type for HTML input element.
 *
 * @param type - Property type
 * @returns HTML input type
 */
export function getInputType(type: GlspPropertyType): string {
  switch (type) {
    case 'boolean':
      return 'checkbox';
    case 'number':
      return 'number';
    default:
      return 'text';
  }
}

/**
 * Group properties by category.
 *
 * @param properties - Property descriptors
 * @returns Grouped properties
 */
export function groupProperties(
  properties: readonly GlspPropertyDescriptor[]
): Map<string, GlspPropertyDescriptor[]> {
  const groups = new Map<string, GlspPropertyDescriptor[]>();

  for (const prop of properties) {
    // Use first word of label as category, or 'General' for short names
    const category = prop.label.includes(' ')
      ? prop.label.split(' ')[0] || 'General'
      : 'General';

    const group = groups.get(category) || [];
    group.push(prop);
    groups.set(category, group);
  }

  // Sort 'General' to be first
  const sortedGroups = new Map<string, GlspPropertyDescriptor[]>();
  if (groups.has('General')) {
    sortedGroups.set('General', groups.get('General')!);
    groups.delete('General');
  }

  // Add remaining groups alphabetically
  const sortedKeys = Array.from(groups.keys()).sort();
  for (const key of sortedKeys) {
    sortedGroups.set(key, groups.get(key)!);
  }

  return sortedGroups;
}

/**
 * Check if a property has a mixed value (multi-select scenario).
 *
 * @param prop - Property descriptor
 * @returns True if value is mixed
 */
export function isMixedValue(prop: GlspPropertyDescriptor): boolean {
  return prop.value === undefined && prop.description === '(Mixed values)';
}

/**
 * Validate a property value.
 *
 * @param value - Value to validate
 * @param prop - Property descriptor
 * @returns Validation error or undefined if valid
 */
export function validatePropertyValue(
  value: string,
  prop: GlspPropertyDescriptor
): string | undefined {
  // Check required
  if (!value && prop.readOnly !== true) {
    // Allow empty for optional fields
    return undefined;
  }

  // Type-specific validation
  switch (prop.type) {
    case 'number':
      if (value && isNaN(parseFloat(value))) {
        return 'Must be a number';
      }
      break;
    case 'enum':
      if (prop.options && !prop.options.includes(value)) {
        return `Must be one of: ${prop.options.join(', ')}`;
      }
      break;
    case 'reference':
      // Reference validation would require server-side check
      break;
  }

  return undefined;
}

/**
 * CSS classes for property form elements.
 */
export const PropertyFormClasses = {
  CONTAINER: 'sanyam-properties-panel',
  HEADER: 'sanyam-properties-header',
  CONTENT: 'sanyam-properties-content',
  GROUP: 'sanyam-properties-group',
  GROUP_HEADER: 'sanyam-properties-group-header',
  FIELD: 'sanyam-properties-field',
  LABEL: 'sanyam-properties-label',
  INPUT: 'sanyam-properties-input',
  INPUT_ERROR: 'sanyam-properties-input-error',
  CHECKBOX: 'sanyam-properties-checkbox',
  SELECT: 'sanyam-properties-select',
  EMPTY: 'sanyam-properties-empty',
  LOADING: 'sanyam-properties-loading',
} as const;
