/**
 * Tool Palette Provider (T071)
 *
 * Generates tool palette configuration from manifest.
 *
 * @packageDocumentation
 */

import type { GlspContext, ToolPaletteProvider } from '@sanyam/types';

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
export const defaultToolPaletteProvider: ToolPaletteProvider = {
  /**
   * Generate tool palette configuration.
   */
  getToolPalette(context: GlspContext): ToolPalette {
    const manifest = (context as any).manifest;

    // If manifest has explicit palette configuration, use it
    if (manifest?.diagram?.toolPalette) {
      return this.buildFromManifest(context, manifest.diagram.toolPalette);
    }

    // Otherwise generate from node/edge types
    return this.generateFromTypes(context);
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
   * Generate palette from node and edge types.
   */
  generateFromTypes(context: GlspContext): ToolPalette {
    const manifest = (context as any).manifest;
    const groups: ToolGroup[] = [];

    // Create nodes group
    const nodesGroup: ToolGroup = {
      id: 'nodes',
      label: 'Nodes',
      icon: 'symbol-structure',
      children: [],
    };

    // Add node tools from manifest
    if (manifest?.diagram?.nodeTypes) {
      for (const [astType, config] of Object.entries(manifest.diagram.nodeTypes)) {
        nodesGroup.children.push({
          id: `create-${astType.toLowerCase()}`,
          label: this.formatLabel(astType),
          icon: this.getIconForType(astType),
          action: {
            kind: 'create-node',
            elementTypeId: (config as any).type,
            args: { astType },
          },
        });
      }
    }

    // Add default node tools if no manifest
    if (nodesGroup.children.length === 0) {
      nodesGroup.children.push(
        {
          id: 'create-entity',
          label: 'Entity',
          icon: 'symbol-class',
          action: {
            kind: 'create-node',
            elementTypeId: 'node:entity',
          },
        },
        {
          id: 'create-property',
          label: 'Property',
          icon: 'symbol-field',
          action: {
            kind: 'create-node',
            elementTypeId: 'node:property',
          },
        }
      );
    }

    groups.push(nodesGroup);

    // Create edges group
    const edgesGroup: ToolGroup = {
      id: 'edges',
      label: 'Connections',
      icon: 'arrow-right',
      children: [],
    };

    // Add edge tools from manifest
    if (manifest?.diagram?.edgeTypes) {
      for (const [property, config] of Object.entries(manifest.diagram.edgeTypes)) {
        edgesGroup.children.push({
          id: `create-${property.toLowerCase()}`,
          label: this.formatLabel(property),
          icon: this.getIconForEdge(property),
          action: {
            kind: 'create-edge',
            elementTypeId: (config as any).type,
            args: { property },
          },
        });
      }
    }

    // Add default edge tools if no manifest
    if (edgesGroup.children.length === 0) {
      edgesGroup.children.push(
        {
          id: 'create-reference',
          label: 'Reference',
          icon: 'arrow-right',
          action: {
            kind: 'create-edge',
            elementTypeId: 'edge:reference',
          },
        },
        {
          id: 'create-inheritance',
          label: 'Inheritance',
          icon: 'arrow-up',
          action: {
            kind: 'create-edge',
            elementTypeId: 'edge:inheritance',
          },
        }
      );
    }

    groups.push(edgesGroup);

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

    return {
      groups,
      defaultTool: 'create-entity',
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
