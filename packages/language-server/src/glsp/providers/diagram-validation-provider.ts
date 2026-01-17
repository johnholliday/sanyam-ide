/**
 * Diagram Validation Provider (T072)
 *
 * Validates diagram models and provides diagnostic markers.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import { streamAllContents, isNamed } from 'langium';
import type { GlspContext, DiagramValidationProvider } from '@sanyam/types';
import type { GModelElement, GModelNode, GModelEdge, Point } from '../conversion-types.js';
import { isNode, isEdge } from '../conversion-types.js';

/**
 * Validation marker severity.
 */
export type MarkerSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Validation marker for diagram elements.
 */
export interface DiagramMarker {
  /** Element ID the marker applies to */
  elementId: string;
  /** Marker severity */
  severity: MarkerSeverity;
  /** Marker message */
  message: string;
  /** Marker code/type */
  code?: string;
  /** Source of the marker */
  source?: string;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  /** All markers from validation */
  markers: DiagramMarker[];
  /** Whether the model is valid (no errors) */
  isValid: boolean;
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
}

/**
 * Default diagram validation provider implementation.
 */
export const defaultDiagramValidationProvider: DiagramValidationProvider = {
  /**
   * Validate the entire diagram model.
   */
  validate(context: GlspContext): ValidationResult {
    const markers: DiagramMarker[] = [];

    // Validate nodes
    const gModel = context.gModel;
    if (gModel?.children) {
      for (const element of gModel.children) {
        if (isNode(element)) {
          markers.push(...this.validateNode(context, element));
        }
        if (isEdge(element)) {
          markers.push(...this.validateEdge(context, element, gModel.children));
        }
      }
    }

    // Validate AST constraints
    markers.push(...this.validateAstConstraints(context));

    // Validate layout constraints
    markers.push(...this.validateLayoutConstraints(context));

    // Count by severity
    let errorCount = 0;
    let warningCount = 0;
    for (const marker of markers) {
      if (marker.severity === 'error') errorCount++;
      if (marker.severity === 'warning') warningCount++;
    }

    return {
      markers,
      isValid: errorCount === 0,
      errorCount,
      warningCount,
    };
  },

  /**
   * Validate a single element.
   */
  validateElement(context: GlspContext, elementId: string): DiagramMarker[] {
    const element = this.findElement(context, elementId);
    if (!element) {
      return [];
    }

    if (isNode(element)) {
      return this.validateNode(context, element);
    }
    if (isEdge(element)) {
      return this.validateEdge(context, element, context.gModel?.children || []);
    }

    return [];
  },

  /**
   * Validate a node element.
   */
  validateNode(context: GlspContext, node: GModelNode): DiagramMarker[] {
    const markers: DiagramMarker[] = [];

    // Check for valid position
    if (node.position) {
      if (node.position.x < 0 || node.position.y < 0) {
        markers.push({
          elementId: node.id,
          severity: 'warning',
          message: 'Node has negative position coordinates',
          code: 'NEGATIVE_POSITION',
          source: 'diagram-validation',
        });
      }
    }

    // Check for valid size
    if (node.size) {
      if (node.size.width <= 0 || node.size.height <= 0) {
        markers.push({
          elementId: node.id,
          severity: 'error',
          message: 'Node has invalid size (width and height must be positive)',
          code: 'INVALID_SIZE',
          source: 'diagram-validation',
        });
      }
    }

    // Check for label
    const hasLabel = node.children?.some(c => c.type.includes('label'));
    if (!hasLabel) {
      markers.push({
        elementId: node.id,
        severity: 'hint',
        message: 'Node has no label',
        code: 'MISSING_LABEL',
        source: 'diagram-validation',
      });
    }

    return markers;
  },

  /**
   * Validate an edge element.
   */
  validateEdge(
    context: GlspContext,
    edge: GModelEdge,
    allElements: GModelElement[]
  ): DiagramMarker[] {
    const markers: DiagramMarker[] = [];

    // Check source exists
    const sourceExists = allElements.some(
      e => e.id === edge.sourceId && isNode(e)
    );
    if (!sourceExists) {
      markers.push({
        elementId: edge.id,
        severity: 'error',
        message: `Edge source '${edge.sourceId}' not found`,
        code: 'MISSING_SOURCE',
        source: 'diagram-validation',
      });
    }

    // Check target exists
    const targetExists = allElements.some(
      e => e.id === edge.targetId && isNode(e)
    );
    if (!targetExists) {
      markers.push({
        elementId: edge.id,
        severity: 'error',
        message: `Edge target '${edge.targetId}' not found`,
        code: 'MISSING_TARGET',
        source: 'diagram-validation',
      });
    }

    // Check for self-loops (may be valid, just warn)
    if (edge.sourceId === edge.targetId) {
      markers.push({
        elementId: edge.id,
        severity: 'info',
        message: 'Edge is a self-loop',
        code: 'SELF_LOOP',
        source: 'diagram-validation',
      });
    }

    return markers;
  },

  /**
   * Validate AST-level constraints.
   */
  validateAstConstraints(context: GlspContext): DiagramMarker[] {
    const markers: DiagramMarker[] = [];
    const root = context.root;
    const names = new Map<string, AstNode[]>();

    // Check for duplicate names
    for (const node of streamAllContents(root)) {
      if (isNamed(node)) {
        const existing = names.get(node.name) || [];
        existing.push(node);
        names.set(node.name, existing);
      }
    }

    for (const [name, nodes] of names) {
      if (nodes.length > 1) {
        for (const node of nodes) {
          const elementId = this.getElementId(context, node);
          if (elementId) {
            markers.push({
              elementId,
              severity: 'error',
              message: `Duplicate name: '${name}'`,
              code: 'DUPLICATE_NAME',
              source: 'diagram-validation',
            });
          }
        }
      }
    }

    // Include LSP diagnostics
    const diagnostics = context.document.diagnostics || [];
    for (const diag of diagnostics) {
      // Map diagnostic to element if possible
      const elementId = this.findElementAtPosition(context, diag.range.start);
      if (elementId) {
        markers.push({
          elementId,
          severity: this.mapDiagnosticSeverity(diag.severity),
          message: diag.message,
          code: diag.code?.toString(),
          source: diag.source || 'langium',
        });
      }
    }

    return markers;
  },

  /**
   * Validate layout constraints.
   */
  validateLayoutConstraints(context: GlspContext): DiagramMarker[] {
    const markers: DiagramMarker[] = [];
    const gModel = context.gModel;
    if (!gModel?.children) return markers;

    const nodes = gModel.children.filter(isNode);

    // Check for overlapping nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (this.nodesOverlap(nodes[i], nodes[j])) {
          markers.push({
            elementId: nodes[i].id,
            severity: 'warning',
            message: `Node overlaps with '${nodes[j].id}'`,
            code: 'OVERLAPPING_NODES',
            source: 'diagram-validation',
          });
        }
      }
    }

    // Check for nodes outside visible area (if bounds defined)
    const bounds = (context as any).diagramBounds;
    if (bounds) {
      for (const node of nodes) {
        if (node.position && (
          node.position.x + (node.size?.width || 0) > bounds.width ||
          node.position.y + (node.size?.height || 0) > bounds.height
        )) {
          markers.push({
            elementId: node.id,
            severity: 'info',
            message: 'Node is outside visible diagram area',
            code: 'OUTSIDE_BOUNDS',
            source: 'diagram-validation',
          });
        }
      }
    }

    return markers;
  },

  /**
   * Check if two nodes overlap.
   */
  nodesOverlap(a: GModelNode, b: GModelNode): boolean {
    if (!a.position || !b.position || !a.size || !b.size) {
      return false;
    }

    const aLeft = a.position.x;
    const aRight = a.position.x + a.size.width;
    const aTop = a.position.y;
    const aBottom = a.position.y + a.size.height;

    const bLeft = b.position.x;
    const bRight = b.position.x + b.size.width;
    const bTop = b.position.y;
    const bBottom = b.position.y + b.size.height;

    return !(aRight <= bLeft || bRight <= aLeft || aBottom <= bTop || bBottom <= aTop);
  },

  /**
   * Find an element by ID.
   */
  findElement(context: GlspContext, elementId: string): GModelElement | undefined {
    const gModel = context.gModel;
    if (!gModel) return undefined;

    const search = (elements: GModelElement[]): GModelElement | undefined => {
      for (const element of elements) {
        if (element.id === elementId) return element;
        if (element.children) {
          const found = search(element.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return search(gModel.children || []);
  },

  /**
   * Get element ID for an AST node.
   */
  getElementId(context: GlspContext, astNode: AstNode): string | undefined {
    const modelState = (context as any).modelState;
    if (modelState?.getElementId) {
      return modelState.getElementId(astNode);
    }
    if (isNamed(astNode)) {
      return astNode.name;
    }
    return undefined;
  },

  /**
   * Find element at a document position.
   */
  findElementAtPosition(
    context: GlspContext,
    position: { line: number; character: number }
  ): string | undefined {
    const offset = context.document.textDocument.offsetAt(position);
    const root = context.root;

    for (const node of streamAllContents(root)) {
      const cstNode = node.$cstNode;
      if (cstNode && cstNode.offset <= offset && offset < cstNode.offset + cstNode.length) {
        return this.getElementId(context, node);
      }
    }

    return undefined;
  },

  /**
   * Map LSP diagnostic severity to marker severity.
   */
  mapDiagnosticSeverity(severity?: number): MarkerSeverity {
    switch (severity) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'hint';
      default: return 'error';
    }
  },
};

/**
 * Create a custom diagram validation provider.
 *
 * @param customBuilder - Custom provider methods
 * @returns A customized provider
 */
export function createDiagramValidationProvider(
  customBuilder?: Partial<DiagramValidationProvider>
): DiagramValidationProvider {
  return {
    ...defaultDiagramValidationProvider,
    ...customBuilder,
  };
}
