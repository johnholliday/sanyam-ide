/**
 * GLSP Provider Types (Internal)
 *
 * Internal type definitions for GLSP provider implementations.
 * These are implementation types, not part of the public contract.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import type { GlspContext, GModelRoot } from '@sanyam/types';
import type {
  GModelNode,
  GModelEdge,
  GModelLabel,
  Point,
  Dimension,
} from './conversion-types.js';

/**
 * AST to GModel provider interface.
 */
export interface AstToGModelProvider {
  /** Convert entire AST to GModel */
  convert(context: GlspContext): GModelRoot;
  /** Create a node from an AST node */
  createNode(context: GlspContext, astNode: AstNode): GModelNode | undefined;
  /** Create an edge from a reference */
  createEdge(
    context: GlspContext,
    sourceId: string,
    targetId: string,
    property: string
  ): GModelEdge;
  /** Create edges from references */
  createEdgesFromReferences(
    context: GlspContext,
    astNode: AstNode,
    nodeMap: Map<AstNode, string>
  ): GModelEdge[];
  /** Get label text */
  getLabel(astNode: AstNode): string;
  /** Get node position */
  getPosition(context: GlspContext, astNode: AstNode): Point;
  /** Get node size */
  getSize(context: GlspContext, astNode: AstNode): Dimension;
  /** Get default size */
  getDefaultSize(context: GlspContext, astNode: AstNode): Dimension;
  /** Get node ID */
  getNodeId(astNode: AstNode): string;
  /** Get GModel node type */
  getNodeType(context: GlspContext, astNode: AstNode): string;
  /** Get GModel edge type */
  getEdgeType(context: GlspContext, property: string): string;
  /** Check if value is a reference */
  isReference(value: any): value is { ref?: AstNode; $refText: string };
}

/**
 * GModel to AST provider interface.
 */
export interface GModelToAstProvider {
  /** Apply changes from diagram to AST */
  applyChanges?(context: GlspContext, changes: any): void;
  /** Create a node in AST */
  createNode(
    context: GlspContext,
    elementTypeId: string,
    position: Point,
    args?: Record<string, any>
  ): ApplyResult;
  /** Delete a node from AST */
  deleteNode(context: GlspContext, elementId: string): ApplyResult;
  /** Update node bounds */
  updateBounds(
    context: GlspContext,
    elementId: string,
    position?: Point,
    size?: Dimension
  ): ApplyResult;
  /** Create an edge in AST */
  createEdge(
    context: GlspContext,
    elementTypeId: string,
    sourceId: string,
    targetId: string,
    args?: Record<string, any>
  ): ApplyResult;
}

/**
 * Result of applying a change to the AST.
 */
export interface ApplyResult {
  success: boolean;
  error?: string;
  textEdits?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
  }>;
}

/**
 * Tool palette provider interface.
 */
export interface ToolPaletteProvider {
  /** Get tool palette for context */
  getToolPalette(context: GlspContext): ToolPalette;
}

/**
 * Tool palette structure.
 */
export interface ToolPalette {
  groups: ToolPaletteGroup[];
  defaultTool?: string;
}

/**
 * Tool palette group.
 */
export interface ToolPaletteGroup {
  id: string;
  label: string;
  icon?: string;
  children: (ToolPaletteItem | ToolPaletteGroup)[];
  collapsed?: boolean;
}

/**
 * Tool palette item.
 */
export interface ToolPaletteItem {
  id: string;
  label: string;
  icon?: string;
  sortString?: string;
  action: ToolPaletteAction;
}

/**
 * Tool palette action.
 */
export interface ToolPaletteAction {
  kind: 'create-node' | 'create-edge' | 'delete' | 'custom';
  elementTypeId?: string;
  args?: Record<string, unknown>;
}

/**
 * Validation provider interface.
 */
export interface DiagramValidationProvider {
  /** Validate the diagram */
  validate(context: GlspContext): ValidationResult;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  markers: ValidationMarker[];
  isValid: boolean;
  errorCount: number;
  warningCount: number;
}

/**
 * Validation marker.
 */
export interface ValidationMarker {
  elementId: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
}

/**
 * Layout provider interface.
 */
export interface LayoutProvider {
  /** Apply layout to diagram */
  layout(context: GlspContext, options?: Partial<LayoutOptions>): LayoutResult;
}

/**
 * Layout options.
 */
export interface LayoutOptions {
  algorithm: 'grid' | 'tree' | 'force' | 'layered' | 'none';
  direction?: 'down' | 'right' | 'up' | 'left';
  padding?: number;
  nodeSpacing?: number;
  layerSpacing?: number;
  handleCycles?: boolean;
}

/**
 * Layout result.
 */
export interface LayoutResult {
  positions: Map<string, Point>;
  routingPoints: Map<string, Point[]>;
  bounds: { width: number; height: number };
}

/**
 * Context menu provider interface.
 */
export interface ContextMenuProvider {
  /** Get context menu for selected elements */
  getContextMenu(
    context: GlspContext,
    selectedIds: string[],
    position?: { x: number; y: number }
  ): ContextMenu;
}

/**
 * Context menu structure.
 */
export interface ContextMenu {
  items: ContextMenuItem[];
  position?: { x: number; y: number };
}

/**
 * Context menu item.
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  group?: string;
  sortString?: string;
  children?: ContextMenuItem[];
  enabled?: boolean;
  visible?: boolean;
  action?: ContextMenuAction;
}

/**
 * Context menu action.
 */
export interface ContextMenuAction {
  kind: string;
  elementTypeId?: string;
  args?: Record<string, unknown>;
}
