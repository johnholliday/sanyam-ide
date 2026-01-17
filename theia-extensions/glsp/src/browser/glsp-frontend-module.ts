/**
 * GLSP Frontend Module (T083)
 *
 * Inversify container module for GLSP frontend integration in Theia.
 * Binds diagram widgets, contributions, and GLSP client services.
 *
 * @packageDocumentation
 */

import { ContainerModule, interfaces } from 'inversify';
import { WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';

// Import GLSP contribution and widget
import { GlspContribution } from '../common/glsp-contribution';
import { DiagramWidget, DiagramWidgetFactory, DIAGRAM_WIDGET_FACTORY_ID } from './diagram-widget';
import { GlspDiagramCommands } from './glsp-commands';
import { GlspDiagramMenus } from './glsp-menus';

/**
 * Service identifiers for GLSP frontend services.
 */
export const GLSP_FRONTEND_TYPES = {
  DiagramWidgetFactory: Symbol.for('DiagramWidgetFactory'),
  GlspContribution: Symbol.for('GlspContribution'),
  DiagramManager: Symbol.for('DiagramManager'),
};

/**
 * GLSP frontend module for Theia.
 *
 * This module sets up:
 * - Diagram widget factory for creating diagram views
 * - GLSP contribution for diagram type registration
 * - Command and menu contributions for diagram operations
 * - Frontend application contribution for initialization
 */
export default new ContainerModule((bind: interfaces.Bind) => {
  // Bind the diagram widget factory
  bind(DiagramWidgetFactory).toSelf().inSingletonScope();
  bind(GLSP_FRONTEND_TYPES.DiagramWidgetFactory).toService(DiagramWidgetFactory);

  // Register widget factory with Theia
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: DIAGRAM_WIDGET_FACTORY_ID,
    createWidget: (options: DiagramWidget.Options) => {
      const factory = ctx.container.get(DiagramWidgetFactory);
      return factory.createWidget(options);
    },
  })).inSingletonScope();

  // Bind GLSP contribution
  bind(GlspContribution).toSelf().inSingletonScope();
  bind(GLSP_FRONTEND_TYPES.GlspContribution).toService(GlspContribution);
  bindViewContribution(bind, GlspContribution);
  bind(FrontendApplicationContribution).toService(GlspContribution);

  // Bind command contributions
  bind(GlspDiagramCommands).toSelf().inSingletonScope();
  bind(CommandContribution).toService(GlspDiagramCommands);

  // Bind menu contributions
  bind(GlspDiagramMenus).toSelf().inSingletonScope();
  bind(MenuContribution).toService(GlspDiagramMenus);
});

/**
 * Create a child container for a specific diagram type.
 *
 * This allows each diagram type to have its own configuration
 * while sharing common services.
 *
 * @param parent - Parent container
 * @param diagramType - The diagram type identifier
 * @returns Child container configured for the diagram type
 */
export function createDiagramContainer(
  parent: interfaces.Container,
  diagramType: string
): interfaces.Container {
  const child = parent.createChild();

  // Bind diagram type constant
  child.bind('DiagramType').toConstantValue(diagramType);

  return child;
}

/**
 * Configuration for GLSP diagram types.
 */
export interface DiagramTypeConfiguration {
  /** Unique identifier for the diagram type */
  diagramType: string;
  /** Language ID this diagram type is associated with */
  languageId: string;
  /** Human-readable label */
  label: string;
  /** Icon class for the diagram type */
  iconClass?: string;
  /** File extensions that can be opened as diagrams */
  fileExtensions: string[];
}

/**
 * Registry of diagram type configurations.
 */
export class DiagramTypeRegistry {
  private configurations: Map<string, DiagramTypeConfiguration> = new Map();

  /**
   * Register a diagram type configuration.
   */
  register(config: DiagramTypeConfiguration): void {
    this.configurations.set(config.diagramType, config);
  }

  /**
   * Get configuration for a diagram type.
   */
  get(diagramType: string): DiagramTypeConfiguration | undefined {
    return this.configurations.get(diagramType);
  }

  /**
   * Get configuration by language ID.
   */
  getByLanguageId(languageId: string): DiagramTypeConfiguration | undefined {
    for (const config of this.configurations.values()) {
      if (config.languageId === languageId) {
        return config;
      }
    }
    return undefined;
  }

  /**
   * Get configuration by file extension.
   */
  getByFileExtension(extension: string): DiagramTypeConfiguration | undefined {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    for (const config of this.configurations.values()) {
      if (config.fileExtensions.includes(ext)) {
        return config;
      }
    }
    return undefined;
  }

  /**
   * Get all registered diagram types.
   */
  getAll(): DiagramTypeConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * Check if a diagram type is registered.
   */
  has(diagramType: string): boolean {
    return this.configurations.has(diagramType);
  }
}

// Export singleton instance
export const diagramTypeRegistry = new DiagramTypeRegistry();
