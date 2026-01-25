/**
 * GLSP Diagram Menus (T086)
 *
 * Menu contributions for diagram operations.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { MenuContribution, MenuModelRegistry, MenuPath, MAIN_MENU_BAR } from '@theia/core/lib/common';
import { NavigatorContextMenu } from '@theia/navigator/lib/browser/navigator-contribution';

import { DiagramCommands } from './glsp-commands';

/**
 * Menu paths for diagram menus.
 */
export namespace DiagramMenus {
  export const DIAGRAM: MenuPath = [...MAIN_MENU_BAR, '7_diagram'];
  export const DIAGRAM_VIEW: MenuPath = [...DIAGRAM, '1_view'];
  export const DIAGRAM_ZOOM: MenuPath = [...DIAGRAM, '2_zoom'];
  export const DIAGRAM_LAYOUT: MenuPath = [...DIAGRAM, '3_layout'];
  export const DIAGRAM_ALIGN: MenuPath = [...DIAGRAM, '4_align'];
  export const DIAGRAM_EXPORT: MenuPath = [...DIAGRAM, '5_export'];
}

/**
 * Context menu paths for diagram elements.
 */
export namespace DiagramContextMenus {
  export const DIAGRAM_ELEMENT: MenuPath = ['diagram-element-context-menu'];
  export const DIAGRAM_ELEMENT_EDIT: MenuPath = [...DIAGRAM_ELEMENT, '1_edit'];
  export const DIAGRAM_ELEMENT_LAYOUT: MenuPath = [...DIAGRAM_ELEMENT, '2_layout'];
  export const DIAGRAM_ELEMENT_NAVIGATION: MenuPath = [...DIAGRAM_ELEMENT, '3_navigation'];
}

/**
 * Menu contributions for diagram operations.
 */
@injectable()
export class GlspDiagramMenus implements MenuContribution {
  /**
   * Register menus.
   */
  registerMenus(registry: MenuModelRegistry): void {
    // Main menu bar
    this.registerMainMenu(registry);

    // Context menu
    this.registerContextMenu(registry);
  }

  /**
   * Register main menu.
   */
  protected registerMainMenu(registry: MenuModelRegistry): void {
    // Diagram menu
    registry.registerSubmenu(DiagramMenus.DIAGRAM, 'Diagram');

    // View submenu
    registry.registerSubmenu(DiagramMenus.DIAGRAM_VIEW, 'View');

    registry.registerMenuAction(DiagramMenus.DIAGRAM_VIEW, {
      commandId: DiagramCommands.OPEN_DIAGRAM.id,
      label: 'Open Diagram View',
      order: '1',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_VIEW, {
      commandId: DiagramCommands.CLOSE_DIAGRAM.id,
      label: 'Close Diagram View',
      order: '2',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_VIEW, {
      commandId: DiagramCommands.REFRESH_DIAGRAM.id,
      label: 'Refresh',
      order: '3',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_VIEW, {
      commandId: DiagramCommands.CENTER_VIEW.id,
      label: 'Center View',
      order: '4',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_VIEW, {
      commandId: DiagramCommands.TOGGLE_GRID.id,
      label: 'Toggle Grid',
      order: '5',
    });

    // Zoom submenu
    registry.registerSubmenu(DiagramMenus.DIAGRAM_ZOOM, 'Zoom');

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ZOOM, {
      commandId: DiagramCommands.ZOOM_IN.id,
      label: 'Zoom In',
      order: '1',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ZOOM, {
      commandId: DiagramCommands.ZOOM_OUT.id,
      label: 'Zoom Out',
      order: '2',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ZOOM, {
      commandId: DiagramCommands.ZOOM_TO_FIT.id,
      label: 'Zoom to Fit',
      order: '3',
    });

    // Layout submenu
    registry.registerSubmenu(DiagramMenus.DIAGRAM_LAYOUT, 'Layout');

    registry.registerMenuAction(DiagramMenus.DIAGRAM_LAYOUT, {
      commandId: DiagramCommands.LAYOUT_DIAGRAM.id,
      label: 'Auto-Layout',
      order: '1',
    });

    // Align submenu
    registry.registerSubmenu(DiagramMenus.DIAGRAM_ALIGN, 'Align');

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_LEFT.id,
      label: 'Align Left',
      order: '1',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_CENTER.id,
      label: 'Align Center',
      order: '2',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_RIGHT.id,
      label: 'Align Right',
      order: '3',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_TOP.id,
      label: 'Align Top',
      order: '4',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_MIDDLE.id,
      label: 'Align Middle',
      order: '5',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_ALIGN, {
      commandId: DiagramCommands.ALIGN_BOTTOM.id,
      label: 'Align Bottom',
      order: '6',
    });

    // Export submenu
    registry.registerSubmenu(DiagramMenus.DIAGRAM_EXPORT, 'Export');

    registry.registerMenuAction(DiagramMenus.DIAGRAM_EXPORT, {
      commandId: DiagramCommands.EXPORT_SVG.id,
      label: 'Export as SVG',
      order: '1',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM_EXPORT, {
      commandId: DiagramCommands.EXPORT_PNG.id,
      label: 'Export as PNG',
      order: '2',
    });

    // Direct menu items
    registry.registerMenuAction(DiagramMenus.DIAGRAM, {
      commandId: DiagramCommands.DELETE_SELECTED.id,
      label: 'Delete Selected',
      order: '6',
    });

    registry.registerMenuAction(DiagramMenus.DIAGRAM, {
      commandId: DiagramCommands.SELECT_ALL.id,
      label: 'Select All',
      order: '7',
    });
  }

  /**
   * Register context menu.
   */
  protected registerContextMenu(registry: MenuModelRegistry): void {
    // File explorer context menu - "Open Diagram View" for supported files
    registry.registerMenuAction(NavigatorContextMenu.OPEN_WITH, {
      commandId: DiagramCommands.OPEN_DIAGRAM.id,
      label: 'Open Diagram View',
      order: '0',
    });

    // Edit group (for diagram element context menu)
    registry.registerMenuAction(DiagramContextMenus.DIAGRAM_ELEMENT_EDIT, {
      commandId: DiagramCommands.DELETE_SELECTED.id,
      label: 'Delete',
      order: '1',
    });

    // Layout group
    registry.registerMenuAction(DiagramContextMenus.DIAGRAM_ELEMENT_LAYOUT, {
      commandId: DiagramCommands.LAYOUT_DIAGRAM.id,
      label: 'Auto-Layout',
      order: '1',
    });

    // Navigation group
    registry.registerMenuAction(DiagramContextMenus.DIAGRAM_ELEMENT_NAVIGATION, {
      commandId: DiagramCommands.CENTER_VIEW.id,
      label: 'Center View',
      order: '1',
    });
  }
}
