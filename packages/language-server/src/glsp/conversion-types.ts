/**
 * GLSP Conversion Types (T068)
 *
 * Type definitions for AST to GModel conversion.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';

/**
 * Result of converting an AST node to GModel elements.
 */
export interface ConversionResult {
  /** The main GModel element created */
  element: GModelElement;
  /** Additional child elements created */
  children: GModelElement[];
  /** Edges created from this node's references */
  edges: GModelEdge[];
  /** Any warnings during conversion */
  warnings: string[];
}

/**
 * Context provided to conversion functions.
 */
export interface ConversionContext {
  /** Get the element ID for an AST node */
  getElementId(node: AstNode): string | undefined;
  /** Register an element ID for an AST node */
  registerElementId(node: AstNode, id: string): void;
  /** Get position from metadata */
  getPosition(id: string): Point | undefined;
  /** Get size from metadata */
  getSize(id: string): Dimension | undefined;
  /** Whether the element is collapsed */
  isCollapsed(id: string): boolean;
  /** Get the node mapping for an AST type */
  getNodeMapping(astType: string): NodeMappingConfig | undefined;
  /** Get the edge mapping for a property */
  getEdgeMapping(property: string): EdgeMappingConfig | undefined;
}

/**
 * A 2D point.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A dimension (width and height).
 */
export interface Dimension {
  width: number;
  height: number;
}

/**
 * Bounds combining position and size.
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Base GModel element.
 */
export interface GModelElement {
  id: string;
  type: string;
  children?: GModelElement[];
  cssClasses?: string[];
  trace?: string;
}

/**
 * GModel node with position and size.
 */
export interface GModelNode extends GModelElement {
  position?: Point;
  size?: Dimension;
  layout?: string;
  layoutOptions?: Record<string, any>;
}

/**
 * GModel compartment for grouping children.
 */
export interface GModelCompartment extends GModelElement {
  layout?: string;
  layoutOptions?: Record<string, any>;
}

/**
 * GModel edge connecting nodes.
 */
export interface GModelEdge extends GModelElement {
  sourceId: string;
  targetId: string;
  routerKind?: string;
  routingPoints?: Point[];
}

/**
 * GModel label for text display.
 */
export interface GModelLabel extends GModelElement {
  text: string;
  alignment?: Point;
  edgeAlignment?: 'at-source' | 'at-target' | 'center';
}

/**
 * GModel port for edge connection.
 */
export interface GModelPort extends GModelElement {
  position?: Point;
  size?: Dimension;
}

/**
 * GModel button for actions.
 */
export interface GModelButton extends GModelElement {
  enabled: boolean;
}

/**
 * GModel icon element.
 */
export interface GModelIcon extends GModelElement {
  commandId?: string;
}

/**
 * Configuration for node mapping.
 */
export interface NodeMappingConfig {
  /** GModel node type */
  type: string;
  /** AST property for label */
  labelProperty?: string;
  /** Default width */
  defaultWidth?: number;
  /** Default height */
  defaultHeight?: number;
  /** Layout algorithm for children */
  layout?: 'vbox' | 'hbox' | 'freeform';
  /** Additional CSS classes */
  cssClasses?: string[];
  /** Child node types to include */
  childTypes?: string[];
  /** Whether to create ports */
  createPorts?: boolean;
  /** Port configuration */
  ports?: PortConfig[];
}

/**
 * Configuration for edge mapping.
 */
export interface EdgeMappingConfig {
  /** GModel edge type */
  type: string;
  /** Property path to source */
  sourceProperty?: string;
  /** Property path to target */
  targetProperty?: string;
  /** Property for edge label */
  labelProperty?: string;
  /** Router kind (polyline, manhattan, etc.) */
  routerKind?: string;
}

/**
 * Configuration for ports.
 */
export interface PortConfig {
  /** Port ID suffix */
  idSuffix: string;
  /** Port type */
  type: string;
  /** Port position relative to node */
  position: 'north' | 'south' | 'east' | 'west';
}

/**
 * Element type constants.
 */
export const ElementTypes = {
  // Container types
  GRAPH: 'graph',

  // Node types
  NODE: 'node',
  NODE_ENTITY: 'node:entity',
  NODE_PROPERTY: 'node:property',
  NODE_PACKAGE: 'node:package',
  NODE_GENERIC: 'node:generic',

  // Compartment types
  COMPARTMENT: 'compartment',
  COMPARTMENT_HEADER: 'compartment:header',
  COMPARTMENT_BODY: 'compartment:body',

  // Edge types
  EDGE: 'edge',
  EDGE_REFERENCE: 'edge:reference',
  EDGE_INHERITANCE: 'edge:inheritance',
  EDGE_COMPOSITION: 'edge:composition',
  EDGE_AGGREGATION: 'edge:aggregation',

  // Label types
  LABEL: 'label',
  LABEL_TEXT: 'label:text',
  LABEL_ICON: 'label:icon',
  LABEL_HEADING: 'label:heading',

  // Port types
  PORT: 'port',
  PORT_INPUT: 'port:input',
  PORT_OUTPUT: 'port:output',

  // Button types
  BUTTON: 'button',
  BUTTON_EXPAND: 'button:expand',

  // Icon types
  ICON: 'icon',
} as const;

/**
 * CSS class constants.
 */
export const CssClasses = {
  // Node classes
  SELECTED: 'selected',
  HOVER: 'hover',
  ERROR: 'error',
  WARNING: 'warning',

  // Edge classes
  EDGE_SELECTED: 'edge-selected',
  EDGE_HOVER: 'edge-hover',

  // State classes
  COLLAPSED: 'collapsed',
  EXPANDED: 'expanded',
  HIDDEN: 'hidden',

  // Modifier classes
  READONLY: 'readonly',
  EDITABLE: 'editable',
} as const;

/**
 * Layout options constants.
 */
export const LayoutOptions = {
  // Padding
  PADDING_TOP: 'paddingTop',
  PADDING_BOTTOM: 'paddingBottom',
  PADDING_LEFT: 'paddingLeft',
  PADDING_RIGHT: 'paddingRight',

  // Spacing
  VGAP: 'vGap',
  HGAP: 'hGap',

  // Alignment
  H_ALIGN: 'hAlign',
  V_ALIGN: 'vAlign',

  // Size
  PREF_WIDTH: 'prefWidth',
  PREF_HEIGHT: 'prefHeight',
  MIN_WIDTH: 'minWidth',
  MIN_HEIGHT: 'minHeight',

  // Resize
  RESIZABLE: 'resizable',
} as const;

/**
 * Helper to create a node element.
 */
export function createNode(
  id: string,
  type: string,
  position?: Point,
  size?: Dimension
): GModelNode {
  return {
    id,
    type,
    position: position ?? { x: 0, y: 0 },
    size: size ?? { width: 100, height: 50 },
    children: [],
  };
}

/**
 * Helper to create an edge element.
 */
export function createEdge(
  id: string,
  type: string,
  sourceId: string,
  targetId: string
): GModelEdge {
  return {
    id,
    type,
    sourceId,
    targetId,
    children: [],
  };
}

/**
 * Helper to create a label element.
 */
export function createLabel(id: string, text: string, type?: string): GModelLabel {
  return {
    id,
    type: type ?? ElementTypes.LABEL_TEXT,
    text,
  };
}

/**
 * Helper to create a compartment element.
 */
export function createCompartment(
  id: string,
  type: string,
  layout?: string
): GModelCompartment {
  return {
    id,
    type,
    layout,
    children: [],
  };
}

/**
 * Helper to create a port element.
 */
export function createPort(
  id: string,
  type: string,
  position?: Point
): GModelPort {
  return {
    id,
    type,
    position,
    size: { width: 10, height: 10 },
  };
}

/**
 * Check if an element is a node.
 */
export function isNode(element: GModelElement): element is GModelNode {
  return element.type.startsWith('node');
}

/**
 * Check if an element is an edge.
 */
export function isEdge(element: GModelElement): element is GModelEdge {
  return element.type.startsWith('edge') && 'sourceId' in element;
}

/**
 * Check if an element is a label.
 */
export function isLabel(element: GModelElement): element is GModelLabel {
  return element.type.startsWith('label') && 'text' in element;
}

/**
 * Check if an element is a compartment.
 */
export function isCompartment(element: GModelElement): element is GModelCompartment {
  return element.type.startsWith('compartment');
}
