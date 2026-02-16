/**
 * AST to GModel Provider (T069)
 *
 * Converts AST nodes to GModel elements.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type { AstNode } from 'langium';
import { AstUtils } from 'langium';
import { createLogger } from '@sanyam/logger';
import { ElementIdRegistry } from '../element-id-registry.js';

// Langium 4.x exports these via AstUtils namespace
const { streamAllContents } = AstUtils;

const logger = createLogger({ name: 'AstToGModel' });

// Helper to check if an AST node has a name property
function isNamed(node: AstNode): node is AstNode & { name: string } {
  return 'name' in node && typeof (node as any).name === 'string';
}
import type { GlspContext, GModelRoot, GrammarManifest, PortConfig, PortPosition } from '@sanyam/types';
import type { AstToGModelProvider } from '../provider-types.js';
import type {
  GModelNode,
  GModelEdge,
  GModelElement,
  GModelLabel,
  GModelPort,
  Point,
  Dimension,
  NodeMappingConfig,
  NodeShape,
} from '../conversion-types.js';
import {
  ElementTypes,
  createNode,
  createEdge,
  createLabel,
  createPort,
  createCompartment,
  createButton,
} from '../conversion-types.js';

/**
 * Default AST to GModel provider implementation.
 */
export const defaultAstToGModelProvider = {
  /**
   * Convert an entire AST to GModel.
   *
   * Uses a three-pass conversion:
   * 1. Create all nodes, detecting containers and adding header/body compartments
   * 2. Determine parent-child nesting via findDiagrammedAncestor; nest into
   *    containers or fall back to containment edges for non-containers
   * 3. Populate container body compartments with nested children
   */
  convert(context: GlspContext): GModelRoot {
    const root = context.root;
    const nodes: GModelNode[] = [];
    const edges: GModelEdge[] = [];
    const nodeMap = new Map<AstNode, string>();
    const containerIds = new Set<string>();
    const childToParent = new Map<string, string>();

    // Initialize sourceRanges on metadata if not present
    if (context.metadata && !context.metadata.sourceRanges) {
      context.metadata.sourceRanges = new Map();
    }

    // Ensure a UUID registry is always available so every node gets a unique ID.
    // When the persistent registry hasn't been loaded yet (e.g. first parse before
    // model state is initialised), create a fresh one on the context.
    let idRegistry: ElementIdRegistry | undefined = (context as any).idRegistry;
    if (!idRegistry && root) {
      idRegistry = new ElementIdRegistry();
      (context as any).idRegistry = idRegistry;
    }
    if (idRegistry && root) {
      idRegistry.reconcile(root, context.document);
    }

    // Return empty model if no root
    if (!root) {
      logger.debug('No root AST node, returning empty model');
      return {
        id: `root_${context.document.uri.toString()}`,
        type: ElementTypes.GRAPH,
        children: [],
        revision: (context.gModel?.revision ?? 0) + 1,
      };
    }

    // ── Pass 1: Create all nodes ──────────────────────────────────────────────
    // Detect container types and restructure them with header/body compartments.
    for (const astNode of streamAllContents(root)) {
      const node = this.createNode(context, astNode);
      if (node) {
        // Detect containers and add header/body compartment structure
        if (this.isContainerType(context, astNode)) {
          this.convertToContainerNode(context, node, astNode);
          containerIds.add(node.id);
        }

        nodes.push(node);
        nodeMap.set(astNode, node.id);

        // Record source range from CST node for outline mapping
        this.recordSourceRange(context, astNode, node.id);

        logger.trace({
          nodeId: node.id,
          nodeType: node.type,
          isContainer: containerIds.has(node.id),
        }, 'Created node');
      }
    }

    // ── Pass 2: Determine nesting and create edges ────────────────────────────
    // For each node, find its diagrammed ancestor (walks up $container chain,
    // skipping intermediate wrapper AST nodes like TaskBlock, ActorBlock).
    // If the ancestor is a container, record for nesting; otherwise create
    // a containment edge.
    for (const astNode of streamAllContents(root)) {
      const childId = nodeMap.get(astNode);
      if (!childId) continue;

      const parentAstNode = this.findDiagrammedAncestor(astNode, nodeMap);
      if (parentAstNode) {
        const parentId = nodeMap.get(parentAstNode)!;
        if (containerIds.has(parentId)) {
          // Parent is a container → nest child inside it
          childToParent.set(childId, parentId);
        } else {
          // Parent is NOT a container → create containment edge
          const edge = this.createEdge(context, parentId, childId, 'contains');
          edges.push(edge);
          logger.trace({ parentId, childId }, 'Created containment edge');
        }
      }

      // Create cross-reference edges
      const nodeEdges = this.createEdgesFromReferences(context, astNode, nodeMap);
      edges.push(...nodeEdges);
    }

    // ── Pass 3: Nest children into container body compartments ────────────────
    // Build parent → children mapping, then populate body compartments.
    // Collapsed containers keep their children hidden (not in the body).
    const parentToChildren = new Map<string, GModelNode[]>();
    for (const [childId, parentId] of childToParent) {
      if (!parentToChildren.has(parentId)) {
        parentToChildren.set(parentId, []);
      }
      const childNode = nodes.find(n => n.id === childId);
      if (childNode) {
        parentToChildren.get(parentId)!.push(childNode);
      }
    }

    for (const [parentId, children] of parentToChildren) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (!parentNode) continue;

      // Find the body compartment (only present when not collapsed)
      const bodyCompartment = parentNode.children?.find(
        (c: GModelElement) => c.type === ElementTypes.COMPARTMENT_BODY
      );
      if (bodyCompartment) {
        if (!bodyCompartment.children) {
          bodyCompartment.children = [];
        }
        bodyCompartment.children.push(...children);
      }
    }

    // Collect top-level nodes (those not nested inside a container)
    const nestedIds = new Set(childToParent.keys());
    const topLevelNodes = nodes.filter(n => !nestedIds.has(n.id));

    logger.info({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      containerCount: containerIds.size,
      nestedCount: nestedIds.size,
      sourceRangeCount: context.metadata?.sourceRanges?.size ?? 0,
    }, 'Conversion complete');

    return {
      id: `root_${context.document.uri.toString()}`,
      type: ElementTypes.GRAPH,
      children: [...topLevelNodes, ...edges],
      revision: (context.gModel?.revision ?? 0) + 1,
    };
  },

  /**
   * Create a GModel node from an AST node.
   */
  createNode(context: GlspContext, astNode: AstNode): GModelNode | undefined {
    // Only convert named nodes by default
    if (!isNamed(astNode)) {
      return undefined;
    }

    // Only types with explicit diagramNode config in the manifest become diagram nodes
    const manifest = (context as any).manifest as GrammarManifest | undefined;
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find(rt => rt.astType === astNode.$type);
      if (!rootType?.diagramNode) {
        return undefined;
      }
    }

    const id = this.getNodeId(astNode, context);
    const type = this.getNodeType(context, astNode);
    const position = this.getPosition(context, astNode);
    const size = this.getSize(context, astNode);
    const label = this.getLabel(astNode);
    const cssClasses = this.getCssClasses(context, astNode);
    const shape = this.getShape(context, astNode);

    const node = createNode(id, type, position, size, cssClasses, shape);

    // Propagate icon name and optional SVG path from manifest for node view rendering.
    // The icon is positioned independently by the view (not grouped with the label),
    // so label size estimation does not include icon width.
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find(rt => rt.astType === astNode.$type);
      if (rootType?.icon) {
        (node as any).icon = rootType.icon;
      }
      if (rootType?.iconSvg) {
        (node as any).iconSvg = rootType.iconSvg;
      }
    }

    node.children = [createLabel(`${id}_label`, label)];

    // T063: Generate ports from manifest if defined
    const ports = this.createPorts(context, astNode, id, size);
    if (ports.length > 0) {
      node.children.push(...ports);
    }

    return node;
  },

  /**
   * Create a GModel edge from a reference.
   */
  createEdge(
    context: GlspContext,
    sourceId: string,
    targetId: string,
    property: string
  ): GModelEdge {
    const id = `${sourceId}_${property}_${targetId}`;
    const type = this.getEdgeType(context, property);
    const edge = createEdge(id, type, sourceId, targetId);

    // Add `dashed` CSS class if the manifest marks this edge type as dashed
    const edgeTypeConfig = this.getEdgeTypeConfig(context, type);
    if (edgeTypeConfig?.dashed) {
      edge.cssClasses = [...(edge.cssClasses || []), 'dashed'];
    }

    // Add edge label from property name (strip array index suffix like [0])
    const labelText = property.replace(/\[\d+\]$/, '');
    if (labelText) {
      edge.children = [createLabel(`${id}_label`, labelText, ElementTypes.LABEL_TEXT)];
    }

    return edge;
  },

  /**
   * Create edges from references in an AST node.
   *
   * Langium grammar rules like `members+=[Actor:ID]` may create intermediate
   * child AST nodes that wrap the actual reference arrays. This method recurses
   * into non-named child AST nodes to find references at any depth.
   */
  createEdgesFromReferences(
    context: GlspContext,
    astNode: AstNode,
    nodeMap: Map<AstNode, string>
  ): GModelEdge[] {
    const edges: GModelEdge[] = [];
    const sourceId = nodeMap.get(astNode);
    if (!sourceId) return edges;

    this.collectReferences(context, astNode, sourceId, nodeMap, edges, new Set());

    return edges;
  },

  /**
   * Recursively collect references from an AST node and its non-named children.
   */
  collectReferences(
    context: GlspContext,
    astNode: AstNode,
    sourceId: string,
    nodeMap: Map<AstNode, string>,
    edges: GModelEdge[],
    visited: Set<unknown>
  ): void {
    if (visited.has(astNode)) return;
    visited.add(astNode);

    for (const [key, value] of Object.entries(astNode)) {
      if (key.startsWith('$')) continue;

      // Single reference
      if (this.isReference(value)) {
        const target = value.ref;
        if (target) {
          const targetId = nodeMap.get(target);
          if (targetId) {
            edges.push(this.createEdge(context, sourceId, targetId, key));
          }
        }
        continue;
      }

      // Array — may contain references or child AST nodes
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (this.isReference(item)) {
            if (item.ref) {
              const targetId = nodeMap.get(item.ref);
              if (targetId) {
                edges.push(this.createEdge(context, sourceId, targetId, `${key}[${i}]`));
              }
            }
          } else if (this.isChildAstNode(item, nodeMap)) {
            // Recurse into non-named child AST nodes in arrays
            this.collectReferences(context, item, sourceId, nodeMap, edges, visited);
          }
        }
        continue;
      }

      // Non-named child AST node (wrapper) — recurse into it
      if (this.isChildAstNode(value, nodeMap)) {
        this.collectReferences(context, value, sourceId, nodeMap, edges, visited);
      }
    }
  },

  /**
   * Check if a value is a child AST node that should be recursed into.
   * Returns true for AST nodes that are NOT independently mapped (not named nodes
   * in the nodeMap), meaning they are wrapper/intermediate nodes whose references
   * should be attributed to their parent.
   */
  isChildAstNode(value: unknown, nodeMap: Map<AstNode, string>): value is AstNode {
    return (
      value !== null &&
      typeof value === 'object' &&
      '$type' in value &&
      !nodeMap.has(value as AstNode)
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Container Node Helpers
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if an AST node's type is marked as a container in the manifest.
   *
   * Container types render children inside a body compartment with an
   * expand/collapse button in the header.
   */
  isContainerType(context: GlspContext, astNode: AstNode): boolean {
    const manifest = (context as any).manifest as GrammarManifest | undefined;
    if (!manifest?.rootTypes) return false;
    const rootType = manifest.rootTypes.find(rt => rt.astType === astNode.$type);
    return rootType?.diagramNode?.isContainer === true;
  },

  /**
   * Walk up the AST $container chain to find the nearest ancestor
   * that exists in the nodeMap (i.e., is a diagrammed node).
   *
   * This handles intermediate wrapper AST nodes like TaskBlock, ActorBlock,
   * ContentBlock that sit between the parent and child in the grammar but
   * are not themselves diagram nodes.
   */
  findDiagrammedAncestor(astNode: AstNode, nodeMap: Map<AstNode, string>): AstNode | undefined {
    let current = astNode.$container;
    while (current) {
      if (nodeMap.has(current)) {
        return current;
      }
      current = current.$container;
    }
    return undefined;
  },

  /**
   * Restructure a node into a container with header and body compartments.
   *
   * Container node structure:
   * ```
   * GModelNode (container, layout: 'vbox')
   *   ├── GModelCompartment (header, layout: 'hbox')
   *   │   ├── GModelButton (expand/collapse)
   *   │   └── GModelLabel (heading)
   *   └── GModelCompartment (body, layout: 'freeform')  [omitted when collapsed]
   *       ├── GModelNode (child 1)
   *       └── GModelNode (child 2)
   * ```
   *
   * Existing children (label, ports) are replaced by the compartment structure.
   * Ports are preserved and re-attached to the outer container node.
   */
  convertToContainerNode(context: GlspContext, node: GModelNode, astNode: AstNode): void {
    const id = node.id;
    const label = this.getLabel(astNode);
    const collapsed = this.isCollapsed(context, id);

    // Propagate icon name and optional SVG path from manifest for header rendering
    const manifest = (context as any).manifest as GrammarManifest | undefined;
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find(rt => rt.astType === astNode.$type);
      if (rootType?.icon) {
        (node as any).icon = rootType.icon;
      }
      if (rootType?.iconSvg) {
        (node as any).iconSvg = rootType.iconSvg;
      }
    }

    // Save any ports from existing children (created by createPorts)
    const existingPorts = (node.children ?? []).filter(
      (c: GModelElement) => c.type.startsWith('port')
    );

    // NOTE: Do NOT set node.layout here.  sprotty-elk's transformCompartment()
    // uses the parent's `layout` property to accumulate padding from compartment
    // positions/sizes.  Since compartments have Sprotty's default size {-1, -1},
    // the padding formula produces massive values (containerWidth+1 per compartment).
    // Our ELK nodeOptions() already sets elk.padding explicitly, and our custom
    // view handles positioning manually (needsClientLayout: false), so the layout
    // property serves no purpose.

    // Add container CSS classes
    if (!node.cssClasses) {
      node.cssClasses = [];
    }
    node.cssClasses.push('sanyam-container');
    if (collapsed) {
      node.cssClasses.push('collapsed');
    }

    // Propagate expanded state to client for SanyamContainerNodeImpl
    (node as any).expanded = !collapsed;

    // Set container size based on collapsed state.
    // Collapsed containers are header-only (32px tall).
    // Expanded containers use the manifest default; ELK will auto-size to fit children.
    // Width must accommodate the header: padding(8) + icon(16) + gap(6) + label + gap(6) + button(16) + padding(8).
    const HEADER_FIXED_WIDTH = 60;
    const CHAR_WIDTH_ESTIMATE = 10; // conservative estimate for 14px font-weight:600
    const strippedLabel = label.replace(/^"|"$/g, '');
    const labelMinWidth = Math.ceil(
      HEADER_FIXED_WIDTH + Math.max(strippedLabel.length, 3) * CHAR_WIDTH_ESTIMATE
    );
    const containerWidth = Math.max(labelMinWidth, node.size?.width ?? 160);
    if (collapsed) {
      node.size = { width: containerWidth, height: 32 };
    } else {
      // For expanded, set a small initial height so ELK auto-sizes purely
      // from children + padding.  The manifest's defaultSize (e.g. 80) is
      // too large and causes ELK to preserve excessive height even when
      // children only need minimal space.
      node.size = { width: containerWidth, height: 60 };
    }

    // Create header compartment (no layout — our view positions elements manually)
    const header = createCompartment(
      `${id}_header`,
      ElementTypes.COMPARTMENT_HEADER,
    );

    // Add expand/collapse button
    const expandButton = createButton(
      `${id}_expand`,
      ElementTypes.BUTTON_EXPAND,
      true
    );
    header.children = header.children ?? [];
    header.children.push(expandButton);

    // Add heading label
    const headingLabel = createLabel(
      `${id}_header_label`,
      label,
      ElementTypes.LABEL_HEADING
    );
    header.children.push(headingLabel);

    // Build new children: header + body (when expanded) + preserved ports
    node.children = [header];

    if (!collapsed) {
      // Create body compartment (no layout — ELK positions children via elk.padding)
      const body = createCompartment(
        `${id}_body`,
        ElementTypes.COMPARTMENT_BODY,
      );
      node.children.push(body);
    }

    // Re-attach preserved ports
    if (existingPorts.length > 0) {
      node.children.push(...existingPorts);
    }
  },

  /**
   * Check if a container node is collapsed.
   */
  isCollapsed(context: GlspContext, elementId: string): boolean {
    return !(context.metadata?.expanded?.has(elementId) ?? false);
  },

  /**
   * Get the label text for an AST node.
   */
  getLabel(astNode: AstNode): string {
    if (isNamed(astNode)) {
      return astNode.name;
    }
    return astNode.$type;
  },

  /**
   * Get the position for an AST node.
   */
  getPosition(context: GlspContext, astNode: AstNode): Point {
    const id = this.getNodeId(astNode, context);

    // Check metadata first
    const metadataPos = context.metadata?.positions?.get(id);
    if (metadataPos) {
      return metadataPos;
    }

    // Check AST for position
    const astPos = (astNode as any).position;
    if (astPos && typeof astPos.x === 'number' && typeof astPos.y === 'number') {
      return astPos;
    }

    // Default position
    return { x: 0, y: 0 };
  },

  /**
   * Get the size for an AST node.
   */
  getSize(context: GlspContext, astNode: AstNode): Dimension {
    const id = this.getNodeId(astNode, context);

    // Check metadata first
    const metadataSize = context.metadata?.sizes?.get(id);
    if (metadataSize) {
      return metadataSize;
    }

    // Check AST for size
    const astSize = (astNode as any).size;
    if (astSize && typeof astSize.width === 'number' && typeof astSize.height === 'number') {
      return astSize;
    }

    // Default size based on node type
    return this.getDefaultSize(context, astNode);
  },

  /**
   * Get the default size for a node type.
   */
  getDefaultSize(context: GlspContext, astNode: AstNode): Dimension {
    // Check manifest for size mapping in rootTypes
    const manifest = (context as any).manifest;
    let baseSize: Dimension = { width: 100, height: 50 };
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find((rt: any) => rt.astType === astNode.$type);
      if (rootType?.diagramNode?.defaultSize) {
        baseSize = rootType.diagramNode.defaultSize;
      }
    }

    // Non-rectangular shapes need larger bounding boxes because the polygon
    // doesn't fill the entire rectangular area that ELK allocates.
    const shape = this.getShape(context, astNode);
    if (shape === 'diamond') {
      // The inscribed rectangle of a diamond is W/2 × H/2, so roughly double.
      return { width: Math.round(baseSize.width * 1.8), height: Math.round(baseSize.height * 1.8) };
    }
    if (shape === 'hexagon') {
      // 20% inset on each side at top/bottom → need ~1.4× width.
      return { width: Math.round(baseSize.width * 1.4), height: baseSize.height };
    }

    return baseSize;
  },

  /**
   * Get a unique ID for an AST node.
   *
   * Uses the ElementIdRegistry (UUID-based) if available on the context,
   * falling back to legacy path-based IDs otherwise.
   */
  getNodeId(astNode: AstNode, context?: GlspContext): string {
    // Try UUID from registry first
    const idRegistry: ElementIdRegistry | undefined = context ? (context as any).idRegistry : undefined;
    if (idRegistry) {
      const uuid = idRegistry.getUuid(astNode);
      if (uuid) {
        return uuid;
      }
    }

    // Fallback: legacy path-based ID (idRegistry should always be available during normal conversion)
    logger.warn({ astType: astNode.$type }, 'Using legacy path-based ID — idRegistry unavailable');
    return computeLegacyPathId(astNode);
  },

  /**
   * Get the GModel node type for an AST node.
   */
  getNodeType(context: GlspContext, astNode: AstNode): string {
    // Check manifest for type mapping in rootTypes
    const manifest = (context as any).manifest;
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find((rt: any) => rt.astType === astNode.$type);
      if (rootType?.diagramNode?.glspType) {
        return rootType.diagramNode.glspType;
      }
    }

    // Default type based on AST type
    const lowerType = astNode.$type.toLowerCase();
    if (lowerType.includes('entity') || lowerType.includes('class')) {
      return ElementTypes.NODE_ENTITY;
    }
    if (lowerType.includes('property') || lowerType.includes('attribute')) {
      return ElementTypes.NODE_PROPERTY;
    }
    if (lowerType.includes('package') || lowerType.includes('module')) {
      return ElementTypes.NODE_PACKAGE;
    }

    return ElementTypes.NODE_GENERIC;
  },

  /**
   * Get the GModel edge type for a reference property.
   */
  getEdgeType(context: GlspContext, property: string): string {
    // Check manifest for edge type mapping in diagramTypes
    const manifest = (context as any).manifest;
    if (manifest?.diagramTypes?.[0]?.edgeTypes) {
      // First try to find a specific edge type for this property
      const edgeType = manifest.diagramTypes[0].edgeTypes.find(
        (et: any) => et.glspType === `edge:${property}`
      );
      if (edgeType) {
        return edgeType.glspType;
      }
      // Otherwise use first available edge type
      if (manifest.diagramTypes[0].edgeTypes.length > 0) {
        return manifest.diagramTypes[0].edgeTypes[0].glspType;
      }
    }

    // Default edge type
    return ElementTypes.EDGE_REFERENCE;
  },

  /**
   * Look up the EdgeTypeConfig for a given GLSP edge type from the manifest.
   */
  getEdgeTypeConfig(context: GlspContext, glspType: string): { dashed?: boolean } | undefined {
    const manifest = (context as any).manifest;
    if (manifest?.diagramTypes?.[0]?.edgeTypes) {
      return manifest.diagramTypes[0].edgeTypes.find(
        (et: any) => et.glspType === glspType
      );
    }
    return undefined;
  },

  /**
   * Get CSS classes for an AST node from the manifest.
   */
  getCssClasses(context: GlspContext, astNode: AstNode): string[] | undefined {
    const manifest = (context as any).manifest;
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find((rt: any) => rt.astType === astNode.$type);
      if (rootType?.diagramNode?.cssClass) {
        return [rootType.diagramNode.cssClass];
      }
    }
    return undefined;
  },

  /**
   * Get the visual shape for an AST node from the manifest.
   */
  getShape(context: GlspContext, astNode: AstNode): NodeShape {
    const manifest = (context as any).manifest;
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find((rt: any) => rt.astType === astNode.$type);
      if (rootType?.diagramNode?.shape) {
        return rootType.diagramNode.shape as NodeShape;
      }
    }
    // Default to rectangle
    return 'rectangle';
  },

  /**
   * Record source range from an AST node's CST node into metadata.sourceRanges.
   *
   * Converts offset/length to LSP line/character positions using the document's
   * TextDocument, enabling range-based outline↔diagram mapping on the client.
   */
  recordSourceRange(context: GlspContext, astNode: AstNode, elementId: string): void {
    const cstNode = astNode.$cstNode;
    if (!cstNode || !context.metadata?.sourceRanges) {
      return;
    }
    const textDocument = context.document.textDocument;
    if (!textDocument) {
      return;
    }
    const start = textDocument.positionAt(cstNode.offset);
    const end = textDocument.positionAt(cstNode.offset + cstNode.length);
    context.metadata.sourceRanges.set(elementId, { start, end });
  },

  /**
   * Check if a value is a Langium reference.
   */
  isReference(value: any): value is { ref?: AstNode; $refText: string } {
    return (
      value !== null &&
      typeof value === 'object' &&
      '$refText' in value
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // T063, T064: Port Generation
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * T063: Create ports for a node from manifest configuration.
   *
   * Reads rootTypes[].diagramNode.ports to generate SPort elements.
   *
   * @param context - GLSP context with manifest
   * @param astNode - AST node being converted
   * @param nodeId - Parent node ID
   * @param nodeSize - Parent node size
   * @returns Array of port elements
   */
  createPorts(
    context: GlspContext,
    astNode: AstNode,
    nodeId: string,
    nodeSize: Dimension
  ): GModelPort[] {
    const manifest = (context as any).manifest as GrammarManifest | undefined;
    if (!manifest?.rootTypes) {
      return [];
    }

    // Find the root type config for this AST type
    const rootType = manifest.rootTypes.find(rt => rt.astType === astNode.$type);
    if (!rootType?.diagramNode?.ports) {
      return [];
    }

    const ports: GModelPort[] = [];
    const portConfigs = rootType.diagramNode.ports;

    for (const portConfig of portConfigs) {
      const portId = `${nodeId}_port_${portConfig.id}`;
      const portType = this.getPortType(portConfig);
      const position = this.calculatePortPosition(portConfig, nodeSize);

      const port = createPort(portId, portType, position);

      // Add CSS classes for styling
      port.cssClasses = [
        `sanyam-port-${portConfig.style ?? 'circle'}`,
        `sanyam-port-position-${portConfig.position}`,
      ];

      // Store port config in trace for connection validation
      (port as any).portConfig = portConfig;

      ports.push(port);
    }

    return ports;
  },

  /**
   * Get the GLSP type for a port based on its configuration.
   */
  getPortType(portConfig: PortConfig): string {
    // Determine type based on position (input = left/top, output = right/bottom)
    const isInput = portConfig.position === 'left' || portConfig.position === 'top';
    return isInput ? ElementTypes.PORT_INPUT : ElementTypes.PORT_OUTPUT;
  },

  /**
   * T064: Calculate port position on node boundary.
   *
   * @param portConfig - Port configuration from manifest
   * @param nodeSize - Parent node dimensions
   * @returns Port position relative to node origin
   */
  calculatePortPosition(portConfig: PortConfig, nodeSize: Dimension): Point {
    const offset = portConfig.offset ?? 0.5; // Default to center
    const portSize = 10; // Standard port size
    const halfPort = portSize / 2;

    switch (portConfig.position) {
      case 'top':
        return {
          x: nodeSize.width * offset - halfPort,
          y: -halfPort,
        };

      case 'bottom':
        return {
          x: nodeSize.width * offset - halfPort,
          y: nodeSize.height - halfPort,
        };

      case 'left':
        return {
          x: -halfPort,
          y: nodeSize.height * offset - halfPort,
        };

      case 'right':
        return {
          x: nodeSize.width - halfPort,
          y: nodeSize.height * offset - halfPort,
        };

      default:
        // Default to right side center
        return {
          x: nodeSize.width - halfPort,
          y: nodeSize.height / 2 - halfPort,
        };
    }
  },
};

/**
 * Compute a legacy path-based ID for an AST node.
 *
 * This was the original ID scheme: walk up the tree concatenating named ancestors
 * with dots (e.g., "Model.Customer"). Preserved for v1 → v2 layout migration.
 *
 * @param astNode - The AST node
 * @returns Legacy path-based ID
 */
export function computeLegacyPathId(astNode: AstNode): string {
  const pathParts: string[] = [];

  let current: AstNode | undefined = astNode;
  while (current) {
    if (isNamed(current)) {
      pathParts.unshift(current.name);
    }
    current = current.$container;
  }

  if (pathParts.length > 0) {
    return pathParts.join('.');
  }

  const cstNode = astNode.$cstNode;
  if (cstNode) {
    return `${astNode.$type}_${cstNode.offset}`;
  }

  return `${astNode.$type}_${randomUUID()}`;
}

/**
 * Create a custom AST to GModel provider.
 *
 * @param customBuilder - Custom conversion function
 * @returns A customized provider
 */
export function createAstToGModelProvider(
  customBuilder?: Partial<AstToGModelProvider>
): AstToGModelProvider {
  return {
    ...defaultAstToGModelProvider,
    ...customBuilder,
  };
}
