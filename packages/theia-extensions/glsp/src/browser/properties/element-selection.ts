/**
 * Element Property Selection Type
 *
 * Typed selection object carried by Theia's SelectionService to drive
 * the built-in property view with diagram/outline/text editor selections.
 *
 * @packageDocumentation
 */

/**
 * Selection object representing one or more diagram elements.
 * Published to Theia's SelectionService so the property view can react.
 */
export interface ElementPropertySelection {
  readonly kind: 'element-property-selection';
  /** Document URI for the selected elements */
  readonly uri: string;
  /** Diagram element IDs */
  readonly elementIds: string[];
  /** Which view originated the selection */
  readonly source: 'diagram' | 'outline' | 'textEditor';
}

export namespace ElementPropertySelection {
  /**
   * Type guard for ElementPropertySelection.
   *
   * @param obj - Object to test
   * @returns True if obj is an ElementPropertySelection
   */
  export function is(obj: unknown): obj is ElementPropertySelection {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const candidate = obj as Record<string, unknown>;
    return candidate['kind'] === 'element-property-selection'
      && typeof candidate['uri'] === 'string'
      && Array.isArray(candidate['elementIds'])
      && typeof candidate['source'] === 'string';
  }
}
