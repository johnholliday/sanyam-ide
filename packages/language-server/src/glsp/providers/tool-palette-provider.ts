/**
 * Tool Palette Provider (T071, T055-T060)
 *
 * Generates tool palette configuration from manifest.
 * Reads from rootTypes[].diagramNode, diagramTypes[].nodeTypes,
 * and diagramTypes[].edgeTypes for grammar-driven tool generation.
 *
 * @packageDocumentation
 */

import type { GlspContext, GrammarManifest, RootTypeConfig, DiagramTypeConfig, NodeTypeConfig, EdgeTypeConfig } from '@sanyam/types';
import type { ToolPaletteProvider } from '../provider-types.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'ToolPalette' });

/**
 * Tool item in the palette.
 */
export interface ToolItem {
  /** Unique ID of the tool */
  id: string;
  /** Display label */
  label: string;
  /** Icon identifier */
  icon?: string;
  /** Sort priority (lower = higher priority) */
  sortString?: string;
  /** Action to perform when tool is used */
  action: ToolAction;
}

/**
 * Group of tools in the palette.
 */
export interface ToolGroup {
  /** Group ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon identifier */
  icon?: string;
  /** Child items (tools or nested groups) */
  children: (ToolItem | ToolGroup)[];
  /** Whether group is initially collapsed */
  collapsed?: boolean;
}

/**
 * Action performed by a tool.
 */
export interface ToolAction {
  /** Action kind */
  kind: 'create-node' | 'create-edge' | 'delete' | 'custom';
  /** Element type to create */
  elementTypeId?: string;
  /** Custom action data */
  args?: Record<string, any>;
}

/**
 * Tool palette configuration.
 */
export interface ToolPalette {
  /** Tool groups */
  groups: ToolGroup[];
  /** Default selected tool ID */
  defaultTool?: string;
}

/**
 * Default tool palette provider implementation.
 */
export const defaultToolPaletteProvider = {
  /**
   * T075b: Generate tool palette configuration with performance logging.
   */
  getToolPalette(context: GlspContext): ToolPalette {
    const startTime = performance.now();

    const manifest = (context as any).manifest;
    let palette: ToolPalette;

    // If manifest has explicit palette configuration, use it
    if (manifest?.diagram?.toolPalette) {
      palette = this.buildFromManifest(context, manifest.diagram.toolPalette);
    } else {
      // Otherwise generate from node/edge types
      palette = this.generateFromTypes(context);
    }

    // T075b: Log performance
    const duration = performance.now() - startTime;
    if (duration > 50) {
      logger.warn({ durationMs: duration }, 'Tool palette generation exceeded 50ms target');
    } else {
      logger.info({ durationMs: duration }, 'Tool palette generated');
    }

    return palette;
  },

  /**
   * Build palette from manifest configuration.
   */
  buildFromManifest(context: GlspContext, config: any): ToolPalette {
    const groups: ToolGroup[] = [];

    for (const groupConfig of config.groups || []) {
      const group: ToolGroup = {
        id: groupConfig.id,
        label: groupConfig.label,
        icon: groupConfig.icon,
        children: [],
        collapsed: groupConfig.collapsed,
      };

      for (const itemConfig of groupConfig.items || []) {
        if (itemConfig.items) {
          // Nested group
          const nestedGroup: ToolGroup = {
            id: itemConfig.id,
            label: itemConfig.label,
            icon: itemConfig.icon,
            children: itemConfig.items.map((i: any) => this.createToolItem(i)),
            collapsed: itemConfig.collapsed,
          };
          group.children.push(nestedGroup);
        } else {
          // Tool item
          group.children.push(this.createToolItem(itemConfig));
        }
      }

      groups.push(group);
    }

    return {
      groups,
      defaultTool: config.defaultTool,
    };
  },

  /**
   * Generate palette from node and edge types (T055-T060).
   *
   * Reads from:
   * - rootTypes[].diagramNode for node tools (T055)
   * - diagramTypes[].nodeTypes for creatable filtering (T056)
   * - diagramTypes[].edgeTypes for edge tools (T057)
   *
   * @param context - GLSP context with manifest
   * @returns Tool palette configuration
   */
  generateFromTypes(context: GlspContext): ToolPalette {
    const manifest = (context as any).manifest as GrammarManifest | undefined;
    const groups: ToolGroup[] = [];

    // T055, T056: Build node tools from rootTypes[].diagramNode
    const nodeTools = this.buildNodeTools(manifest);

    // T057: Build edge tools from diagramTypes[].edgeTypes
    const edgeTools = this.buildEdgeTools(manifest);

    // T058: Group nodes by type hierarchy
    const nodeGroups = this.buildNodeGroups(nodeTools, manifest);
    groups.push(...nodeGroups);

    // Add edges group if we have edge tools
    if (edgeTools.length > 0) {
      const edgesGroup: ToolGroup = {
        id: 'edges',
        label: 'Connections',
        icon: 'arrow-right',
        children: edgeTools,
      };
      groups.push(edgesGroup);
    }

    // Add actions group
    const actionsGroup: ToolGroup = {
      id: 'actions',
      label: 'Actions',
      icon: 'tools',
      children: [
        {
          id: 'delete',
          label: 'Delete',
          icon: 'trash',
          action: {
            kind: 'delete',
          },
        },
      ],
    };
    groups.push(actionsGroup);

    // T060: Add fallback message when no node types defined
    if (nodeTools.length === 0 && edgeTools.length === 0) {
      return this.buildEmptyPalette();
    }

    // Determine default tool
    const defaultTool = nodeTools.length > 0 ? nodeTools[0]?.id : undefined;

    return {
      groups,
      defaultTool,
    };
  },

  /**
   * T055, T056: Build node tools from manifest.
   *
   * Reads from rootTypes[].diagramNode and filters by
   * diagramTypes[].nodeTypes.creatable.
   */
  buildNodeTools(manifest: GrammarManifest | undefined): ToolItem[] {
    if (!manifest) {
      return [];
    }

    const tools: ToolItem[] = [];

    // Build a set of creatable node types from diagramTypes (T056)
    const creatableNodeTypes = this.getCreatableNodeTypes(manifest);

    // T055: Read from rootTypes[].diagramNode
    for (const rootType of manifest.rootTypes) {
      const diagramNode = rootType.diagramNode;
      if (!diagramNode) {
        continue;
      }

      // T056: Filter by creatable flag from diagramTypes
      const glspType = diagramNode.glspType;
      if (creatableNodeTypes.size > 0 && !creatableNodeTypes.has(glspType)) {
        continue;
      }

      tools.push({
        id: `create-${rootType.astType.toLowerCase()}`,
        label: rootType.displayName || this.formatLabel(rootType.astType),
        icon: rootType.icon || this.getIconForType(rootType.astType),
        sortString: rootType.astType.toLowerCase(),
        action: {
          kind: 'create-node',
          elementTypeId: glspType,
          args: {
            astType: rootType.astType,
            template: rootType.template,
            folder: rootType.folder,
          },
        },
      });
    }

    return tools;
  },

  /**
   * T056: Get set of creatable node types from diagramTypes.
   */
  getCreatableNodeTypes(manifest: GrammarManifest): Set<string> {
    const creatableTypes = new Set<string>();

    if (!manifest.diagramTypes) {
      return creatableTypes;
    }

    for (const diagramType of manifest.diagramTypes) {
      for (const nodeType of diagramType.nodeTypes) {
        if (nodeType.creatable) {
          creatableTypes.add(nodeType.glspType);
        }
      }
    }

    return creatableTypes;
  },

  /**
   * T057: Build edge tools from diagramTypes[].edgeTypes.
   */
  buildEdgeTools(manifest: GrammarManifest | undefined): ToolItem[] {
    if (!manifest?.diagramTypes) {
      return [];
    }

    const tools: ToolItem[] = [];
    const seenEdgeTypes = new Set<string>();

    for (const diagramType of manifest.diagramTypes) {
      for (const edgeType of diagramType.edgeTypes) {
        // Only include creatable edges
        if (!edgeType.creatable) {
          continue;
        }

        // Avoid duplicates across diagram types
        if (seenEdgeTypes.has(edgeType.glspType)) {
          continue;
        }
        seenEdgeTypes.add(edgeType.glspType);

        // Extract edge name from glspType (e.g., 'edge:reference' -> 'reference')
        const edgeName = edgeType.glspType.replace(/^edge:/, '');

        tools.push({
          id: `create-${edgeName.toLowerCase()}`,
          label: this.formatLabel(edgeName),
          icon: this.getIconForEdge(edgeName),
          sortString: edgeName.toLowerCase(),
          action: {
            kind: 'create-edge',
            elementTypeId: edgeType.glspType,
          },
        });
      }
    }

    return tools;
  },

  /**
   * T058: Group node tools by type hierarchy from manifest.
   *
   * Creates separate groups based on folder structure or
   * falls back to a single "Nodes" group.
   */
  buildNodeGroups(nodeTools: ToolItem[], manifest: GrammarManifest | undefined): ToolGroup[] {
    if (nodeTools.length === 0) {
      return [];
    }

    // Group tools by folder if available in manifest
    const folderGroups = new Map<string, ToolItem[]>();

    if (manifest) {
      for (const tool of nodeTools) {
        const folder = (tool.action.args as any)?.folder || 'default';
        if (!folderGroups.has(folder)) {
          folderGroups.set(folder, []);
        }
        folderGroups.get(folder)!.push(tool);
      }
    }

    // If we have multiple folders, create separate groups
    if (folderGroups.size > 1) {
      const groups: ToolGroup[] = [];

      for (const [folder, tools] of folderGroups) {
        groups.push({
          id: `nodes-${folder}`,
          label: this.formatLabel(folder),
          icon: 'symbol-structure',
          children: tools.sort((a, b) => (a.sortString || '').localeCompare(b.sortString || '')),
        });
      }

      return groups;
    }

    // Single "Nodes" group for all tools
    return [{
      id: 'nodes',
      label: 'Nodes',
      icon: 'symbol-structure',
      children: nodeTools.sort((a, b) => (a.sortString || '').localeCompare(b.sortString || '')),
    }];
  },

  /**
   * T060: Build empty palette with fallback message.
   */
  buildEmptyPalette(): ToolPalette {
    return {
      groups: [{
        id: 'info',
        label: 'No Tools Available',
        icon: 'info',
        children: [{
          id: 'no-types-message',
          label: 'No diagram types defined in manifest',
          icon: 'warning',
          action: {
            kind: 'custom',
            args: { message: 'Configure rootTypes with diagramNode in your grammar manifest to enable diagram tools.' },
          },
        }],
      }],
    };
  },

  /**
   * Create a tool item from config.
   */
  createToolItem(config: any): ToolItem {
    return {
      id: config.id,
      label: config.label,
      icon: config.icon,
      sortString: config.sortString,
      action: {
        kind: config.actionKind || 'create-node',
        elementTypeId: config.elementTypeId,
        args: config.args,
      },
    };
  },

  /**
   * Format a label from camelCase or PascalCase.
   */
  formatLabel(text: string): string {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  },

  /**
   * Get icon for a node type.
   */
  getIconForType(astType: string): string {
    const lower = astType.toLowerCase();
    if (lower.includes('entity') || lower.includes('class')) return 'symbol-class';
    if (lower.includes('interface')) return 'symbol-interface';
    if (lower.includes('property') || lower.includes('attribute')) return 'symbol-field';
    if (lower.includes('method') || lower.includes('function')) return 'symbol-method';
    if (lower.includes('package') || lower.includes('module')) return 'symbol-namespace';
    if (lower.includes('enum')) return 'symbol-enum';
    return 'symbol-misc';
  },

  /**
   * Get icon for an edge type.
   */
  getIconForEdge(property: string): string {
    const lower = property.toLowerCase();
    if (lower.includes('extends') || lower.includes('inherit')) return 'arrow-up';
    if (lower.includes('implements')) return 'implementations';
    if (lower.includes('contains') || lower.includes('composition')) return 'circle-filled';
    if (lower.includes('has') || lower.includes('aggregation')) return 'circle-outline';
    return 'arrow-right';
  },

  /**
   * Check if a tool is enabled for the current selection.
   */
  isToolEnabled(context: GlspContext, toolId: string): boolean {
    const selectedElements = (context as any).selectedElements || [];

    // Delete tool requires selection
    if (toolId === 'delete') {
      return selectedElements.length > 0;
    }

    // Edge creation requires a source node selected
    if (toolId.startsWith('create-') && toolId.includes('edge')) {
      return selectedElements.length === 1;
    }

    // Node creation is always enabled
    return true;
  },
};

/**
 * Create a custom tool palette provider.
 *
 * @param customBuilder - Custom provider methods
 * @returns A customized provider
 */
export function createToolPaletteProvider(
  customBuilder?: Partial<ToolPaletteProvider>
): ToolPaletteProvider {
  return {
    ...defaultToolPaletteProvider,
    ...customBuilder,
  };
}
