/**
 * AST to GModel Provider (T069)
 *
 * Converts AST nodes to GModel elements.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import { AstUtils } from 'langium';
import { createLogger } from '@sanyam/logger';

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
  GModelLabel,
  GModelPort,
  Point,
  Dimension,
  NodeMappingConfig,
  NodeShape,
} from '../conversion-types.js';
import { ElementTypes, createNode, createEdge, createLabel, createPort } from '../conversion-types.js';

/**
 * Default AST to GModel provider implementation.
 */
export const defaultAstToGModelProvider = {
  /**
   * Convert an entire AST to GModel.
   */
  convert(context: GlspContext): GModelRoot {
    const root = context.root;
    const nodes: GModelNode[] = [];
    const edges: GModelEdge[] = [];
    const nodeMap = new Map<AstNode, string>();
    let nodeIndex = 0;

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

    // First pass: create nodes
    for (const astNode of streamAllContents(root)) {
      const node = this.createNode(context, astNode);
      if (node) {
        nodes.push(node);
        nodeMap.set(astNode, node.id);
        nodeIndex++;
        logger.trace({ nodeId: node.id, nodeType: node.type }, 'Created node');
      }
    }

    // Second pass: create edges from containment (parent-child) relationships
    for (const astNode of streamAllContents(root)) {
      const childId = nodeMap.get(astNode);
      if (!childId) continue;

      // Create edge from parent to child (containment)
      const container = astNode.$container;
      if (container) {
        const parentId = nodeMap.get(container);
        if (parentId) {
          const edge = this.createEdge(context, parentId, childId, 'contains');
          edges.push(edge);
          logger.trace({ parentId, childId }, 'Created containment edge');
        }
      }

      // Also check for cross-references
      const nodeEdges = this.createEdgesFromReferences(context, astNode, nodeMap);
      edges.push(...nodeEdges);
    }

    logger.info({ nodeCount: nodes.length, edgeCount: edges.length }, 'Conversion complete');

    return {
      id: `root_${context.document.uri.toString()}`,
      type: ElementTypes.GRAPH,
      children: [...nodes, ...edges],
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

    const id = this.getNodeId(astNode);
    const type = this.getNodeType(context, astNode);
    const position = this.getPosition(context, astNode);
    const size = this.getSize(context, astNode);
    const label = this.getLabel(astNode);
    const cssClasses = this.getCssClasses(context, astNode);
    const shape = this.getShape(context, astNode);

    const node = createNode(id, type, position, size, cssClasses, shape);
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

    return createEdge(id, type, sourceId, targetId);
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
    const id = this.getNodeId(astNode);

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
    const id = this.getNodeId(astNode);

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
    if (manifest?.rootTypes) {
      const rootType = manifest.rootTypes.find((rt: any) => rt.astType === astNode.$type);
      if (rootType?.diagramNode?.defaultSize) {
        return rootType.diagramNode.defaultSize;
      }
    }
    return { width: 100, height: 50 };
  },

  /**
   * Get a unique ID for an AST node.
   * Builds a path-like ID using parent names to ensure uniqueness.
   */
  getNodeId(astNode: AstNode): string {
    // Build a path from root to this node using named ancestors
    const pathParts: string[] = [];

    // Walk up the tree to build the path
    let current: AstNode | undefined = astNode;
    while (current) {
      if (isNamed(current)) {
        pathParts.unshift(current.name);
      }
      current = current.$container;
    }

    // If we have a path, use it
    if (pathParts.length > 0) {
      return pathParts.join('.');
    }

    // Fallback: Generate ID from type and position in document
    const cstNode = astNode.$cstNode;
    if (cstNode) {
      return `${astNode.$type}_${cstNode.offset}`;
    }

    return `${astNode.$type}_${Math.random().toString(36).substr(2, 9)}`;
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
