/**
 * Grammar Operation Toolbar
 *
 * Toolbar contributions for grammar operations.
 * Adds operation buttons to the composite editor toolbar.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import {
  TabBarToolbarContribution,
  TabBarToolbarRegistry,
} from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { Widget } from '@theia/core/lib/browser';
import type { GrammarOperation } from '@sanyam/types';
import { GrammarOperationCommands } from './grammar-operation-commands';

/**
 * Symbol for injection.
 */
export const GrammarOperationToolbarContribution = Symbol('GrammarOperationToolbarContribution');

/**
 * Interface for grammar operation toolbar contribution.
 */
export interface GrammarOperationToolbarContributionInterface extends TabBarToolbarContribution {
  /**
   * Register toolbar items for a specific language's operations.
   * Operations are passed directly from the GrammarManifest for immediate availability.
   *
   * @param languageId - The language ID
   * @param operations - Operations from the grammar manifest
   */
  registerLanguageOperationToolbar(languageId: string, operations: readonly GrammarOperation[]): void;
}

/**
 * Toolbar contribution for grammar operations.
 *
 * Adds operation buttons to composite editor and diagram toolbars
 * based on operation.contexts configuration.
 */
@injectable()
export class GrammarOperationToolbarContributionImpl
  implements TabBarToolbarContribution, GrammarOperationToolbarContributionInterface
{
  /** Toolbar registry reference */
  private toolbarRegistry?: TabBarToolbarRegistry;

  /** Map of registered toolbar items */
  private registeredItems = new Map<string, Set<string>>();

  /**
   * Register toolbar items with the registry.
   */
  registerToolbarItems(registry: TabBarToolbarRegistry): void {
    this.toolbarRegistry = registry;
    // Items are registered dynamically when languages are loaded
  }

  /**
   * Register toolbar items for a specific language's operations.
   * Operations are passed directly from the GrammarManifest for immediate availability.
   */
  registerLanguageOperationToolbar(languageId: string, operations: readonly GrammarOperation[]): void {
    if (!this.toolbarRegistry) {
      console.warn('Toolbar registry not available');
      return;
    }

    for (const operation of operations) {
      if (operation.contexts.compositeToolbar || operation.contexts.diagramElement) {
        this.registerOperationToolbarItem(languageId, operation);
      }
    }
  }

  /**
   * Register a toolbar item for an operation.
   */
  private registerOperationToolbarItem(
    languageId: string,
    operation: GrammarOperation
  ): void {
    if (!this.toolbarRegistry) {
      return;
    }

    const commandId = GrammarOperationCommands.buildCommandId(languageId, operation.id);
    const itemKey = `${languageId}:${operation.id}`;

    // Track registered items
    if (!this.registeredItems.has(itemKey)) {
      this.registeredItems.set(itemKey, new Set());
    }
    const registered = this.registeredItems.get(itemKey)!;

    // Register for composite editor toolbar
    if (operation.contexts.compositeToolbar && !registered.has('composite')) {
      this.toolbarRegistry.registerItem({
        id: `${commandId}:toolbar`,
        command: commandId,
        tooltip: operation.description,
        priority: this.getPriorityForOperation(operation),
        // Only show in composite editor widgets
        isVisible: (widget: Widget) => this.isCompositeEditorWidget(widget) && this.isWidgetForLanguage(widget, languageId),
        group: operation.category ?? 'operations',
      });
      registered.add('composite');
    }

    // Register for diagram toolbar
    if (operation.contexts.diagramElement && !registered.has('diagram')) {
      this.toolbarRegistry.registerItem({
        id: `${commandId}:diagram-toolbar`,
        command: commandId,
        tooltip: operation.description,
        priority: this.getPriorityForOperation(operation),
        // Only show in diagram widgets
        isVisible: (widget: Widget) => this.isDiagramWidget(widget) && this.isWidgetForLanguage(widget, languageId),
        group: operation.category ?? 'operations',
      });
      registered.add('diagram');
    }
  }

  /**
   * Get toolbar priority for an operation.
   */
  private getPriorityForOperation(operation: GrammarOperation): number {
    // Prioritize by category and execution speed
    const categoryPriority: Record<string, number> = {
      'Generate': 100,
      'Export': 200,
      'Transform': 300,
      'Analyze': 400,
      'Other': 500,
    };

    const basePriority = categoryPriority[operation.category ?? 'Other'] ?? 500;

    // Fast operations get higher priority (shown first)
    const speedBonus = operation.execution?.durationHint === 'fast' ? -10 : 0;

    return basePriority + speedBonus;
  }

  /**
   * Check if a widget is a composite editor widget.
   */
  private isCompositeEditorWidget(widget: Widget): boolean {
    return widget.id.startsWith('sanyam-composite-editor:') || widget.constructor.name === 'CompositeEditorWidget';
  }

  /**
   * Check if a widget is a diagram widget.
   */
  private isDiagramWidget(widget: Widget): boolean {
    return widget.id.startsWith('sanyam-diagram-widget:') || widget.constructor.name === 'DiagramWidget';
  }

  /**
   * Check if a widget is for a specific language.
   */
  private isWidgetForLanguage(widget: Widget, languageId: string): boolean {
    // Extract language from widget ID or properties
    const id = widget.id;

    // Check if widget ID contains language extension
    // This is a simple heuristic; more sophisticated matching could be added
    if (id.includes(`.${languageId}`)) {
      return true;
    }

    // Check widget properties if available
    const widgetAny = widget as any;
    if (widgetAny.languageId) {
      return widgetAny.languageId === languageId;
    }

    // Default to showing operations for all languages
    return true;
  }
}
