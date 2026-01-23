/**
 * Layout Provider (T073)
 *
 * Provides automatic layout for diagram elements.
 *
 * @packageDocumentation
 */

import type { GlspContext } from '@sanyam/types';
import type { LayoutProvider } from '../provider-types.js';
import type { GModelElement, GModelNode, GModelEdge, Point, Dimension } from '../conversion-types.js';
import { isNode, isEdge } from '../conversion-types.js';

/**
 * Layout algorithm type.
 */
export type LayoutAlgorithm = 'grid' | 'tree' | 'force' | 'force-directed' | 'layered' | 'none';

/**
 * Layout options.
 */
export interface LayoutOptions {
  /** Layout algorithm to use */
  algorithm: LayoutAlgorithm;
  /** Spacing between nodes */
  nodeSpacing?: number;
  /** Spacing between layers (for tree/layered) */
  layerSpacing?: number;
  /** Padding around the diagram */
  padding?: number;
  /** Direction for tree/layered layouts */
  direction?: 'down' | 'right' | 'up' | 'left';
  /** Whether to detect and handle cycles */
  handleCycles?: boolean;
}

/**
 * Layout result.
 */
export interface LayoutResult {
  /** Updated element positions */
  positions: Map<string, Point>;
  /** Computed edge routing points */
  routingPoints: Map<string, Point[]>;
  /** Total bounds of the layout */
  bounds: { width: number; height: number };
}

/**
 * Default layout options.
 */
const DEFAULT_OPTIONS: LayoutOptions = {
  algorithm: 'grid',
  nodeSpacing: 50,
  layerSpacing: 100,
  padding: 20,
  direction: 'down',
  handleCycles: true,
};

/**
 * Default layout provider implementation.
 */
export const defaultLayoutProvider = {
  /**
   * Apply layout to the entire model.
   */
  layout(context: GlspContext, options?: Partial<LayoutOptions>): LayoutResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const gModel = context.gModel;

    if (!gModel?.children) {
      return {
        positions: new Map(),
        routingPoints: new Map(),
        bounds: { width: 0, height: 0 },
      };
    }

    const nodes = gModel.children.filter(isNode);
    const edges = gModel.children.filter(isEdge);

    let positions: Map<string, Point>;

    switch (opts.algorithm) {
      case 'tree':
        positions = this.layoutTree(nodes, edges, opts);
        break;
      case 'layered':
        positions = this.layoutLayered(nodes, edges, opts);
        break;
      case 'force':
        positions = this.layoutForce(nodes, edges, opts);
        break;
      case 'grid':
      default:
        positions = this.layoutGrid(nodes, opts);
        break;
    }

    // Calculate edge routing
    const routingPoints = this.calculateEdgeRouting(edges, positions, nodes);

    // Calculate bounds
    const bounds = this.calculateBounds(positions, nodes);

    return { positions, routingPoints, bounds };
  },

  /**
   * Layout nodes in a grid pattern.
   */
  layoutGrid(nodes: GModelNode[], options: LayoutOptions): Map<string, Point> {
    const positions = new Map<string, Point>();
    const spacing = options.nodeSpacing || 50;
    const padding = options.padding || 20;

    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(nodes.length));

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const width = node.size?.width || 100;
      const height = node.size?.height || 50;

      positions.set(node.id, {
        x: padding + col * (width + spacing),
        y: padding + row * (height + spacing),
      });
    });

    return positions;
  },

  /**
   * Layout nodes in a tree structure.
   */
  layoutTree(
    nodes: GModelNode[],
    edges: GModelEdge[],
    options: LayoutOptions
  ): Map<string, Point> {
    const positions = new Map<string, Point>();
    const spacing = options.nodeSpacing || 50;
    const layerSpacing = options.layerSpacing || 100;
    const padding = options.padding || 20;

    // Build adjacency map
    const children = new Map<string, string[]>();
    const parents = new Map<string, string>();

    for (const edge of edges) {
      const sourceChildren = children.get(edge.sourceId) || [];
      sourceChildren.push(edge.targetId);
      children.set(edge.sourceId, sourceChildren);
      parents.set(edge.targetId, edge.sourceId);
    }

    // Find root nodes (nodes with no parents)
    const roots = nodes.filter(n => !parents.has(n.id));

    // Detect cycles
    if (options.handleCycles) {
      const visited = new Set<string>();
      const stack = new Set<string>();

      const hasCycle = (nodeId: string): boolean => {
        if (stack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        stack.add(nodeId);

        for (const childId of children.get(nodeId) || []) {
          if (hasCycle(childId)) {
            // Break cycle by removing edge
            const childList = children.get(nodeId) || [];
            const idx = childList.indexOf(childId);
            if (idx >= 0) childList.splice(idx, 1);
          }
        }

        stack.delete(nodeId);
        return false;
      };

      for (const root of roots) {
        hasCycle(root.id);
      }
    }

    // Layout tree level by level
    const nodeWidths = new Map<string, number>();
    for (const node of nodes) {
      nodeWidths.set(node.id, node.size?.width || 100);
    }

    // Calculate subtree widths
    const subtreeWidths = new Map<string, number>();

    const calcWidth = (nodeId: string): number => {
      const childIds = children.get(nodeId) || [];
      if (childIds.length === 0) {
        const width = nodeWidths.get(nodeId) || 100;
        subtreeWidths.set(nodeId, width);
        return width;
      }

      let totalWidth = 0;
      for (const childId of childIds) {
        totalWidth += calcWidth(childId) + spacing;
      }
      totalWidth -= spacing; // Remove last spacing

      const ownWidth = nodeWidths.get(nodeId) || 100;
      const width = Math.max(ownWidth, totalWidth);
      subtreeWidths.set(nodeId, width);
      return width;
    };

    for (const root of roots) {
      calcWidth(root.id);
    }

    // Position nodes
    let currentX = padding;

    const positionSubtree = (nodeId: string, x: number, y: number) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const ownWidth = nodeWidths.get(nodeId) || 100;
      const treeWidth = subtreeWidths.get(nodeId) || ownWidth;

      // Center node in its subtree
      const nodeX = x + (treeWidth - ownWidth) / 2;
      positions.set(nodeId, { x: nodeX, y });

      // Position children
      const childIds = children.get(nodeId) || [];
      let childX = x;
      const childY = y + (node.size?.height || 50) + layerSpacing;

      for (const childId of childIds) {
        const childWidth = subtreeWidths.get(childId) || 100;
        positionSubtree(childId, childX, childY);
        childX += childWidth + spacing;
      }
    };

    for (const root of roots) {
      const treeWidth = subtreeWidths.get(root.id) || 100;
      positionSubtree(root.id, currentX, padding);
      currentX += treeWidth + spacing * 2;
    }

    // Handle orphan nodes (not connected)
    const positioned = new Set(positions.keys());
    let orphanX = padding;
    let orphanY = 0;

    // Find max Y
    for (const pos of positions.values()) {
      orphanY = Math.max(orphanY, pos.y);
    }
    orphanY += layerSpacing * 2;

    for (const node of nodes) {
      if (!positioned.has(node.id)) {
        positions.set(node.id, { x: orphanX, y: orphanY });
        orphanX += (node.size?.width || 100) + spacing;
      }
    }

    return positions;
  },

  /**
   * Layout nodes in layers (simplified Sugiyama-style).
   */
  layoutLayered(
    nodes: GModelNode[],
    edges: GModelEdge[],
    options: LayoutOptions
  ): Map<string, Point> {
    // For simplicity, use tree layout with layer assignment
    return this.layoutTree(nodes, edges, options);
  },

  /**
   * Layout nodes using force-directed algorithm (simplified).
   */
  layoutForce(
    nodes: GModelNode[],
    edges: GModelEdge[],
    options: LayoutOptions
  ): Map<string, Point> {
    const positions = new Map<string, Point>();
    const spacing = options.nodeSpacing || 50;
    const padding = options.padding || 20;

    // Initialize with random positions
    const centerX = 400;
    const centerY = 300;

    for (const node of nodes) {
      positions.set(node.id, {
        x: centerX + (Math.random() - 0.5) * 400,
        y: centerY + (Math.random() - 0.5) * 400,
      });
    }

    // Simplified force simulation
    const iterations = 50;
    const k = spacing * 2; // Optimal distance

    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { fx: number; fy: number }>();

      // Initialize forces
      for (const node of nodes) {
        forces.set(node.id, { fx: 0, fy: 0 });
      }

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        const nodeI = nodes[i];
        if (!nodeI) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeJ = nodes[j];
          if (!nodeJ) continue;
          const pos1 = positions.get(nodeI.id);
          const pos2 = positions.get(nodeJ.id);
          if (!pos1 || !pos2) continue;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = (k * k) / dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          const f1 = forces.get(nodeI.id);
          const f2 = forces.get(nodeJ.id);
          if (!f1 || !f2) continue;

          f1.fx -= fx;
          f1.fy -= fy;
          f2.fx += fx;
          f2.fy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const pos1 = positions.get(edge.sourceId);
        const pos2 = positions.get(edge.targetId);
        if (!pos1 || !pos2) continue;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = dist / k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const f1 = forces.get(edge.sourceId);
        const f2 = forces.get(edge.targetId);

        if (f1) {
          f1.fx += fx;
          f1.fy += fy;
        }
        if (f2) {
          f2.fx -= fx;
          f2.fy -= fy;
        }
      }

      // Apply forces with damping
      const damping = 0.5 * (1 - iter / iterations);
      for (const node of nodes) {
        const pos = positions.get(node.id)!;
        const force = forces.get(node.id)!;

        pos.x += force.fx * damping;
        pos.y += force.fy * damping;
      }
    }

    // Normalize to positive coordinates
    let minX = Infinity, minY = Infinity;
    for (const pos of positions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
    }

    for (const [id, pos] of positions) {
      positions.set(id, {
        x: pos.x - minX + padding,
        y: pos.y - minY + padding,
      });
    }

    return positions;
  },

  /**
   * Calculate edge routing points.
   */
  calculateEdgeRouting(
    edges: GModelEdge[],
    positions: Map<string, Point>,
    nodes: GModelNode[]
  ): Map<string, Point[]> {
    const routingPoints = new Map<string, Point[]>();

    // Simple direct routing (no intermediate points)
    // A real implementation would use orthogonal or polyline routing

    for (const edge of edges) {
      const sourcePos = positions.get(edge.sourceId);
      const targetPos = positions.get(edge.targetId);

      if (sourcePos && targetPos) {
        const sourceNode = nodes.find(n => n.id === edge.sourceId);
        const targetNode = nodes.find(n => n.id === edge.targetId);

        // Calculate connection points on node borders
        const sourceCenter = {
          x: sourcePos.x + (sourceNode?.size?.width || 100) / 2,
          y: sourcePos.y + (sourceNode?.size?.height || 50) / 2,
        };
        const targetCenter = {
          x: targetPos.x + (targetNode?.size?.width || 100) / 2,
          y: targetPos.y + (targetNode?.size?.height || 50) / 2,
        };

        // For now, just use center points as routing
        routingPoints.set(edge.id, [sourceCenter, targetCenter]);
      }
    }

    return routingPoints;
  },

  /**
   * Calculate total bounds of the layout.
   */
  calculateBounds(
    positions: Map<string, Point>,
    nodes: GModelNode[]
  ): { width: number; height: number } {
    let maxX = 0;
    let maxY = 0;

    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (pos) {
        maxX = Math.max(maxX, pos.x + (node.size?.width || 100));
        maxY = Math.max(maxY, pos.y + (node.size?.height || 50));
      }
    }

    return { width: maxX + 20, height: maxY + 20 };
  },
};

/**
 * Create a custom layout provider.
 *
 * @param customBuilder - Custom provider methods
 * @returns A customized provider
 */
export function createLayoutProvider(
  customBuilder?: Partial<LayoutProvider>
): LayoutProvider {
  return {
    ...defaultLayoutProvider,
    ...customBuilder,
  };
}
