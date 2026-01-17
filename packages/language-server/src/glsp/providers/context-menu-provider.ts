/**
 * Context Menu Provider (T074)
 *
 * Provides context menu items for diagram elements.
 *
 * @packageDocumentation
 */

import type { GlspContext, ContextMenuProvider } from '@sanyam/types';
import type { GModelElement, GModelNode, GModelEdge } from '../conversion-types.js';
import { isNode, isEdge } from '../conversion-types.js';

/**
 * Context menu item.
 */
export interface ContextMenuItem {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon identifier */
  icon?: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Whether item is enabled */
  enabled?: boolean;
  /** Whether item is visible */
  visible?: boolean;
  /** Action to perform */
  action: MenuAction;
  /** Submenu items */
  children?: ContextMenuItem[];
  /** Separator before this item */
  separator?: boolean;
  /** Group for ordering */
  group?: string;
}

/**
 * Menu action configuration.
 */
export interface MenuAction {
  /** Action kind */
  kind: 'edit' | 'delete' | 'copy' | 'paste' | 'layout' | 'navigate' | 'custom';
  /** Custom action command */
  command?: string;
  /** Action arguments */
  args?: Record<string, any>;
}

/**
 * Context menu configuration.
 */
export interface ContextMenu {
  /** Menu items */
  items: ContextMenuItem[];
  /** Position to show menu */
  position?: { x: number; y: number };
}

/**
 * Default context menu provider implementation.
 */
export const defaultContextMenuProvider: ContextMenuProvider = {
  /**
   * Get context menu for selected elements.
   */
  getContextMenu(
    context: GlspContext,
    selectedIds: string[],
    position?: { x: number; y: number }
  ): ContextMenu {
    const items: ContextMenuItem[] = [];

    if (selectedIds.length === 0) {
      // Canvas context menu
      items.push(...this.getCanvasMenuItems(context, position));
    } else if (selectedIds.length === 1) {
      // Single element context menu
      const element = this.findElement(context, selectedIds[0]);
      if (element) {
        if (isNode(element)) {
          items.push(...this.getNodeMenuItems(context, element));
        } else if (isEdge(element)) {
          items.push(...this.getEdgeMenuItems(context, element));
        }
      }
    } else {
      // Multi-selection context menu
      items.push(...this.getMultiSelectionMenuItems(context, selectedIds));
    }

    return {
      items,
      position,
    };
  },

  /**
   * Get menu items for canvas (no selection).
   */
  getCanvasMenuItems(
    context: GlspContext,
    position?: { x: number; y: number }
  ): ContextMenuItem[] {
    return [
      {
        id: 'create',
        label: 'Create',
        icon: 'add',
        group: 'create',
        action: { kind: 'custom' },
        children: this.getCreateMenuItems(context, position),
      },
      {
        id: 'paste',
        label: 'Paste',
        icon: 'clippy',
        shortcut: 'Ctrl+V',
        group: 'clipboard',
        enabled: this.hasClipboard(context),
        action: {
          kind: 'paste',
          args: { position },
        },
        separator: true,
      },
      {
        id: 'select-all',
        label: 'Select All',
        icon: 'selection',
        shortcut: 'Ctrl+A',
        group: 'selection',
        action: {
          kind: 'custom',
          command: 'selectAll',
        },
      },
      {
        id: 'layout',
        label: 'Layout',
        icon: 'layout',
        group: 'layout',
        separator: true,
        action: { kind: 'layout' },
        children: this.getLayoutMenuItems(context),
      },
    ];
  },

  /**
   * Get menu items for a node.
   */
  getNodeMenuItems(context: GlspContext, node: GModelNode): ContextMenuItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        icon: 'edit',
        shortcut: 'F2',
        group: 'edit',
        action: {
          kind: 'edit',
          args: { elementId: node.id },
        },
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: 'symbol-key',
        group: 'edit',
        action: {
          kind: 'custom',
          command: 'rename',
          args: { elementId: node.id },
        },
      },
      {
        id: 'cut',
        label: 'Cut',
        icon: 'files',
        shortcut: 'Ctrl+X',
        group: 'clipboard',
        separator: true,
        action: {
          kind: 'custom',
          command: 'cut',
          args: { elementIds: [node.id] },
        },
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: 'copy',
        shortcut: 'Ctrl+C',
        group: 'clipboard',
        action: {
          kind: 'copy',
          args: { elementIds: [node.id] },
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        shortcut: 'Del',
        group: 'delete',
        separator: true,
        action: {
          kind: 'delete',
          args: { elementIds: [node.id] },
        },
      },
      {
        id: 'navigate',
        label: 'Go to Source',
        icon: 'go-to-file',
        shortcut: 'F12',
        group: 'navigate',
        separator: true,
        action: {
          kind: 'navigate',
          command: 'goToSource',
          args: { elementId: node.id },
        },
      },
      {
        id: 'references',
        label: 'Find References',
        icon: 'references',
        shortcut: 'Shift+F12',
        group: 'navigate',
        action: {
          kind: 'navigate',
          command: 'findReferences',
          args: { elementId: node.id },
        },
      },
    ];
  },

  /**
   * Get menu items for an edge.
   */
  getEdgeMenuItems(context: GlspContext, edge: GModelEdge): ContextMenuItem[] {
    return [
      {
        id: 'edit-label',
        label: 'Edit Label',
        icon: 'edit',
        group: 'edit',
        action: {
          kind: 'edit',
          args: { elementId: edge.id, editLabel: true },
        },
      },
      {
        id: 'reconnect',
        label: 'Reconnect',
        icon: 'link',
        group: 'edit',
        action: {
          kind: 'custom',
          command: 'reconnect',
          args: { edgeId: edge.id },
        },
      },
      {
        id: 'reverse',
        label: 'Reverse Direction',
        icon: 'arrow-swap',
        group: 'edit',
        action: {
          kind: 'custom',
          command: 'reverseEdge',
          args: { edgeId: edge.id },
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        shortcut: 'Del',
        group: 'delete',
        separator: true,
        action: {
          kind: 'delete',
          args: { elementIds: [edge.id] },
        },
      },
      {
        id: 'goto-source',
        label: 'Go to Source Node',
        icon: 'arrow-left',
        group: 'navigate',
        separator: true,
        action: {
          kind: 'navigate',
          command: 'selectElement',
          args: { elementId: edge.sourceId },
        },
      },
      {
        id: 'goto-target',
        label: 'Go to Target Node',
        icon: 'arrow-right',
        group: 'navigate',
        action: {
          kind: 'navigate',
          command: 'selectElement',
          args: { elementId: edge.targetId },
        },
      },
    ];
  },

  /**
   * Get menu items for multi-selection.
   */
  getMultiSelectionMenuItems(
    context: GlspContext,
    selectedIds: string[]
  ): ContextMenuItem[] {
    return [
      {
        id: 'cut',
        label: `Cut ${selectedIds.length} Elements`,
        icon: 'files',
        shortcut: 'Ctrl+X',
        group: 'clipboard',
        action: {
          kind: 'custom',
          command: 'cut',
          args: { elementIds: selectedIds },
        },
      },
      {
        id: 'copy',
        label: `Copy ${selectedIds.length} Elements`,
        icon: 'copy',
        shortcut: 'Ctrl+C',
        group: 'clipboard',
        action: {
          kind: 'copy',
          args: { elementIds: selectedIds },
        },
      },
      {
        id: 'delete',
        label: `Delete ${selectedIds.length} Elements`,
        icon: 'trash',
        shortcut: 'Del',
        group: 'delete',
        separator: true,
        action: {
          kind: 'delete',
          args: { elementIds: selectedIds },
        },
      },
      {
        id: 'align',
        label: 'Align',
        icon: 'layout',
        group: 'layout',
        separator: true,
        action: { kind: 'layout' },
        children: [
          {
            id: 'align-left',
            label: 'Align Left',
            icon: 'align-left',
            action: {
              kind: 'layout',
              command: 'alignLeft',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'align-center',
            label: 'Align Center',
            icon: 'align-center',
            action: {
              kind: 'layout',
              command: 'alignCenter',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'align-right',
            label: 'Align Right',
            icon: 'align-right',
            action: {
              kind: 'layout',
              command: 'alignRight',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'align-top',
            label: 'Align Top',
            separator: true,
            action: {
              kind: 'layout',
              command: 'alignTop',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'align-middle',
            label: 'Align Middle',
            action: {
              kind: 'layout',
              command: 'alignMiddle',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'align-bottom',
            label: 'Align Bottom',
            action: {
              kind: 'layout',
              command: 'alignBottom',
              args: { elementIds: selectedIds },
            },
          },
        ],
      },
      {
        id: 'distribute',
        label: 'Distribute',
        icon: 'layout',
        group: 'layout',
        action: { kind: 'layout' },
        children: [
          {
            id: 'distribute-horizontal',
            label: 'Distribute Horizontally',
            action: {
              kind: 'layout',
              command: 'distributeHorizontal',
              args: { elementIds: selectedIds },
            },
          },
          {
            id: 'distribute-vertical',
            label: 'Distribute Vertically',
            action: {
              kind: 'layout',
              command: 'distributeVertical',
              args: { elementIds: selectedIds },
            },
          },
        ],
      },
    ];
  },

  /**
   * Get create submenu items.
   */
  getCreateMenuItems(
    context: GlspContext,
    position?: { x: number; y: number }
  ): ContextMenuItem[] {
    const manifest = (context as any).manifest;
    const items: ContextMenuItem[] = [];

    // Add items from manifest
    if (manifest?.diagram?.nodeTypes) {
      for (const [astType, config] of Object.entries(manifest.diagram.nodeTypes)) {
        items.push({
          id: `create-${astType.toLowerCase()}`,
          label: this.formatLabel(astType),
          icon: 'symbol-class',
          action: {
            kind: 'custom',
            command: 'createElement',
            args: {
              elementTypeId: (config as any).type,
              astType,
              position,
            },
          },
        });
      }
    }

    // Default items if no manifest
    if (items.length === 0) {
      items.push(
        {
          id: 'create-entity',
          label: 'Entity',
          icon: 'symbol-class',
          action: {
            kind: 'custom',
            command: 'createElement',
            args: {
              elementTypeId: 'node:entity',
              position,
            },
          },
        },
        {
          id: 'create-property',
          label: 'Property',
          icon: 'symbol-field',
          action: {
            kind: 'custom',
            command: 'createElement',
            args: {
              elementTypeId: 'node:property',
              position,
            },
          },
        }
      );
    }

    return items;
  },

  /**
   * Get layout submenu items.
   */
  getLayoutMenuItems(context: GlspContext): ContextMenuItem[] {
    return [
      {
        id: 'layout-grid',
        label: 'Grid Layout',
        icon: 'layout-grid',
        action: {
          kind: 'layout',
          args: { algorithm: 'grid' },
        },
      },
      {
        id: 'layout-tree',
        label: 'Tree Layout',
        icon: 'type-hierarchy',
        action: {
          kind: 'layout',
          args: { algorithm: 'tree' },
        },
      },
      {
        id: 'layout-force',
        label: 'Force Layout',
        icon: 'layout-activitybar-right',
        action: {
          kind: 'layout',
          args: { algorithm: 'force' },
        },
      },
    ];
  },

  /**
   * Check if clipboard has content.
   */
  hasClipboard(context: GlspContext): boolean {
    // Check clipboard service
    const clipboard = (context as any).clipboard;
    return clipboard?.hasContent?.() ?? false;
  },

  /**
   * Find an element by ID.
   */
  findElement(context: GlspContext, elementId: string): GModelElement | undefined {
    const gModel = context.gModel;
    if (!gModel?.children) return undefined;

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

    return search(gModel.children);
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
};

/**
 * Create a custom context menu provider.
 *
 * @param customBuilder - Custom provider methods
 * @returns A customized provider
 */
export function createContextMenuProvider(
  customBuilder?: Partial<ContextMenuProvider>
): ContextMenuProvider {
  return {
    ...defaultContextMenuProvider,
    ...customBuilder,
  };
}
