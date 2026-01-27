/**
 * Properties Panel Contribution (T034, T039, FR-009 to FR-013)
 *
 * Theia contribution for registering the properties panel widget.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import {
  AbstractViewContribution,
  FrontendApplication,
  FrontendApplicationContribution,
  WidgetFactory,
} from '@theia/core/lib/browser';
import {
  CommandContribution,
  CommandRegistry,
  MenuContribution,
  MenuModelRegistry,
} from '@theia/core/lib/common';
import { PROPERTIES_PANEL_ID, PropertiesPanelCommands } from '@sanyam/types';

import { PropertiesPanelWidget } from './properties-panel-widget';

/**
 * Properties panel command definitions.
 */
export const PropertiesCommands = {
  TOGGLE: {
    id: PropertiesPanelCommands.TOGGLE,
    label: 'Toggle Properties Panel',
    category: 'View',
  },
  FOCUS: {
    id: PropertiesPanelCommands.FOCUS,
    label: 'Focus Properties Panel',
    category: 'View',
  },
  REFRESH: {
    id: PropertiesPanelCommands.REFRESH,
    label: 'Refresh Properties',
    category: 'View',
  },
} as const;

/**
 * Properties Panel View Contribution.
 *
 * Registers the properties panel in the View menu and provides commands.
 */
@injectable()
export class PropertiesPanelContribution
  extends AbstractViewContribution<PropertiesPanelWidget>
  implements CommandContribution, MenuContribution, FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: PROPERTIES_PANEL_ID,
      widgetName: 'Properties',
      defaultWidgetOptions: {
        area: 'right',
        rank: 200,
      },
      toggleCommandId: PropertiesCommands.TOGGLE.id,
    });
  }

  /**
   * Initialize on application startup.
   */
  async initializeLayout(app: FrontendApplication): Promise<void> {
    // Properties panel is opened on demand, not by default
  }

  /**
   * Register commands.
   */
  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);

    commands.registerCommand(PropertiesCommands.FOCUS, {
      execute: () => this.openView({ activate: true, reveal: true }),
    });

    commands.registerCommand(PropertiesCommands.REFRESH, {
      execute: async () => {
        const widget = await this.widget;
        if (widget) {
          await widget.refresh();
        }
      },
      isEnabled: () => this.isWidgetVisible(),
    });
  }

  /**
   * T039: Register menu items.
   */
  registerMenus(menus: MenuModelRegistry): void {
    super.registerMenus(menus);

    // The parent class already registers in View menu via toggleCommandId
  }

  /**
   * Check if widget is visible.
   */
  protected isWidgetVisible(): boolean {
    const widget = this.tryGetWidget();
    return widget !== undefined && widget.isVisible;
  }

  /**
   * Get the properties panel widget.
   */
  async getPropertiesPanel(): Promise<PropertiesPanelWidget | undefined> {
    return this.widget;
  }
}

/**
 * Properties Panel Factory.
 *
 * Creates instances of the properties panel widget.
 */
@injectable()
export class PropertiesPanelFactory implements WidgetFactory {
  readonly id = PROPERTIES_PANEL_ID;

  @inject(PropertiesPanelWidget)
  protected readonly widget: PropertiesPanelWidget;

  createWidget(): PropertiesPanelWidget {
    return this.widget;
  }
}
