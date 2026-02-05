/**
 * Grammar Operation Menus
 *
 * Menu contributions for grammar operations.
 * Adds operations to context menus based on operation.contexts configuration.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@theia/core';
import { CommonMenus } from '@theia/core/lib/browser';
import type { GrammarOperation } from '@sanyam/types';
import { GrammarOperationCommands } from './grammar-operation-commands';
import { DiagramContextMenus, DiagramMenus } from '../glsp-menus';

/**
 * Menu paths for grammar operations.
 */
export namespace GrammarOperationMenus {
  /** File explorer context menu path */
  export const EXPLORER_CONTEXT: MenuPath = ['navigator-context-menu', 'grammar-operations'];

  /** Editor context menu path */
  export const EDITOR_CONTEXT: MenuPath = ['editor-context-menu', 'grammar-operations'];

  /** Main menu operations path (Edit menu) */
  export const MAIN_MENU: MenuPath = [...CommonMenus.EDIT, 'grammar-operations'];

  /** Diagram menu operations path */
  export const DIAGRAM_MENU: MenuPath = [...DiagramMenus.DIAGRAM_OPERATIONS];

  /** Diagram element context menu path */
  export const DIAGRAM_ELEMENT: MenuPath = [...DiagramContextMenus.DIAGRAM_ELEMENT, '4_grammar-operations'];
}

/**
 * Menu contribution for grammar operations.
 *
 * Dynamically adds menu items based on operations declared in grammar manifests.
 */
@injectable()
export class GrammarOperationMenuContribution implements MenuContribution {
  /** Menu registry reference for dynamic registration */
  private menuRegistry?: MenuModelRegistry;

  /** Map of registered menu items */
  private registeredMenuItems = new Map<string, Set<string>>();

  /**
   * Register grammar operation menus.
   */
  registerMenus(menus: MenuModelRegistry): void {
    // Store registry reference for dynamic registration
    this.menuRegistry = menus;

    // Register submenu group for grammar operations in explorer context
    menus.registerSubmenu(
      GrammarOperationMenus.EXPLORER_CONTEXT,
      'Grammar Operations',
      { sortString: '5' }
    );

    // Register submenu group for grammar operations in editor context
    menus.registerSubmenu(
      GrammarOperationMenus.EDITOR_CONTEXT,
      'Grammar Operations',
      { sortString: '5' }
    );

    // Register submenu group for grammar operations in diagram element context
    menus.registerSubmenu(
      GrammarOperationMenus.DIAGRAM_ELEMENT,
      'Grammar Operations',
      { sortString: '4' }
    );

    // Register submenu group for grammar operations in Diagram menu
    menus.registerSubmenu(
      GrammarOperationMenus.DIAGRAM_MENU,
      'Grammar Operations',
      { sortString: '8' }
    );
  }

  /**
   * Register menu items for a specific language's operations.
   *
   * Called when a grammar is loaded to register its operation menu items.
   * Operations are passed directly from the GrammarManifest for immediate availability.
   *
   * @param languageId - The language ID
   * @param operations - Operations from the grammar manifest
   * @param menus - Optional menu registry (uses stored registry if not provided)
   */
  registerLanguageOperationMenus(languageId: string, operations: readonly GrammarOperation[], menus?: MenuModelRegistry): void {
    const registry = menus ?? this.menuRegistry;
    if (!registry) {
      console.warn('GrammarOperationMenuContribution: Menu registry not available');
      return;
    }

    // Group operations by category
    const categories = new Map<string, GrammarOperation[]>();
    for (const operation of operations) {
      const category = operation.category ?? 'Other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(operation);
    }

    // Register menu items by category
    for (const [category, ops] of categories.entries()) {
      for (const operation of ops) {
        this.registerOperationMenuItems(languageId, operation, category, registry);
      }
    }
  }

  /**
   * Register menu items for a single operation.
   */
  private registerOperationMenuItems(
    languageId: string,
    operation: GrammarOperation,
    category: string,
    menus: MenuModelRegistry
  ): void {
    const commandId = GrammarOperationCommands.buildCommandId(languageId, operation.id);
    const menuKey = `${languageId}:${operation.id}`;

    // Track registered menu paths
    if (!this.registeredMenuItems.has(menuKey)) {
      this.registeredMenuItems.set(menuKey, new Set());
    }
    const registered = this.registeredMenuItems.get(menuKey)!;

    // File explorer context menu
    if (operation.contexts.fileExplorer) {
      const menuPath: MenuPath = [...GrammarOperationMenus.EXPLORER_CONTEXT, category];
      if (!registered.has('explorer')) {
        menus.registerMenuAction(menuPath, {
          commandId,
          label: operation.displayName,
          icon: operation.icon ? `codicon codicon-${operation.icon}` : undefined,
          order: this.getOrderForOperation(operation),
        });
        registered.add('explorer');
      }
    }

    // Main menu (Edit > Grammar Operations)
    if (operation.contexts.mainMenu) {
      const menuPath: MenuPath = [...GrammarOperationMenus.MAIN_MENU, category];
      if (!registered.has('main')) {
        menus.registerMenuAction(menuPath, {
          commandId,
          label: operation.displayName,
          icon: operation.icon ? `codicon codicon-${operation.icon}` : undefined,
          order: this.getOrderForOperation(operation),
        });
        registered.add('main');
      }

      // Also register in Diagram menu (Diagram > Grammar Operations)
      const diagramMenuPath: MenuPath = [...GrammarOperationMenus.DIAGRAM_MENU, category];
      if (!registered.has('diagramMenu')) {
        menus.registerMenuAction(diagramMenuPath, {
          commandId,
          label: operation.displayName,
          icon: operation.icon ? `codicon codicon-${operation.icon}` : undefined,
          order: this.getOrderForOperation(operation),
        });
        registered.add('diagramMenu');
      }
    }

    // Diagram element context menu
    if (operation.contexts.diagramElement) {
      const menuPath: MenuPath = [...GrammarOperationMenus.DIAGRAM_ELEMENT, category];
      if (!registered.has('diagram')) {
        menus.registerMenuAction(menuPath, {
          commandId,
          label: operation.displayName,
          icon: operation.icon ? `codicon codicon-${operation.icon}` : undefined,
          order: this.getOrderForOperation(operation),
        });
        registered.add('diagram');
      }
    }
  }

  /**
   * Get menu order for an operation based on category.
   */
  private getOrderForOperation(operation: GrammarOperation): string {
    // Order by category, then by display name
    const categoryOrder: Record<string, string> = {
      'Generate': '1',
      'Export': '2',
      'Analyze': '3',
      'Transform': '4',
      'Other': '9',
    };

    const catOrder = categoryOrder[operation.category ?? 'Other'] ?? '9';
    return `${catOrder}_${operation.displayName}`;
  }
}
