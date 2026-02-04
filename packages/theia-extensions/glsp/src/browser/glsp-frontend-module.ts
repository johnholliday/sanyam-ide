/**
 * GLSP Frontend Module (T083)
 *
 * Inversify container module for GLSP frontend integration in Theia.
 * Binds diagram widgets, composite editors, contributions, and GLSP client services.
 *
 * @packageDocumentation
 */

// CSS imports - must be in the frontend module for webpack to bundle them
import './style/index.css';
import './style/sprotty.css';
import './style/properties-panel.css';

import { ContainerModule, interfaces, injectable, inject } from 'inversify';
import { WidgetFactory, FrontendApplicationContribution, KeybindingContribution, OpenHandler } from '@theia/core/lib/browser';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { CommandContribution, MenuContribution, PreferenceContribution } from '@theia/core/lib/common';

// Diagram color contribution
import { DiagramColorContribution } from './diagram-color-contribution';

// Diagram widget imports
import { GlspContribution } from '../common/glsp-contribution';
import { DiagramWidget, DiagramWidgetFactory, DIAGRAM_WIDGET_FACTORY_ID } from './diagram-widget';
import { GlspDiagramCommands } from './glsp-commands';
import { GlspDiagramMenus } from './glsp-menus';

// Composite editor imports
import {
    CompositeEditorWidget,
    CompositeEditorWidgetFactory,
    COMPOSITE_EDITOR_WIDGET_FACTORY_ID,
} from './composite-editor-widget';
import { CompositeEditorOpenHandler } from './composite-editor-open-handler';
import { CompositeEditorContribution } from './composite-editor-contribution';
import { CompositeEditorContextKeyService } from './composite-editor-context-key-service';

// Language client for diagram operations
import { DiagramLanguageClient, LanguageClientProviderSymbol } from './diagram-language-client';
import { SanyamLanguageClientProvider, setGlspServiceProxy } from './sanyam-language-client-provider';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { SanyamGlspServicePath, type SanyamGlspServiceInterface } from '@sanyam/types';

// Diagram preferences
import { diagramPreferenceSchema } from './diagram-preferences';

// Layout storage
import { DiagramLayoutStorageService } from './layout-storage-service';

// Toolbar contribution
import { GlspDiagramToolbarContribution } from './glsp-toolbar-contribution';

// T037: Properties panel imports (using Theia's built-in property view)
import { SanyamGlspService as SanyamGlspServiceSymbol } from '@sanyam/types';
import { PropertyDataService } from '@theia/property-view/lib/browser/property-data-service';
import { PropertyViewWidgetProvider } from '@theia/property-view/lib/browser/property-view-widget-provider';
import {
  ElementPropertyDataService,
  ElementPropertyViewFormWidget,
  ElementPropertyViewWidgetProvider,
  PropertySelectionBridge,
} from './properties';

// T045: Outline sync imports
import { OutlineSyncServiceSymbol, OutlineSyncServiceImpl, ElementSymbolMapper, DiagramOutlineContribution } from './outline';
import { MonacoOutlineContribution } from '@theia/monaco/lib/browser/monaco-outline-contribution';

// T051: Snap-to-grid imports
import { GridSnapper, SnapGridTool, bindSnapGridPreferences, SnapGridServiceSymbol } from './ui-extensions/snap-to-grid';

// Edge routing service
import { EdgeRoutingService } from './layout';

// Grammar Operations imports
import {
  GrammarOperationService,
  GrammarOperationServiceImpl,
  GrammarOperationCommandContribution,
  GrammarOperationMenuContribution,
  GrammarOperationToolbarContribution,
  GrammarOperationToolbarContributionImpl,
  GrammarOperationOutput,
  GrammarOperationOutputServiceImpl,
  GrammarOperationInitializer,
  GrammarOperationInitializerImpl,
} from './grammar-operations';

// Note: Sprotty types are re-exported from di/sprotty-di-config via index.ts

/**
 * Service identifiers for GLSP frontend services.
 */
export const GLSP_FRONTEND_TYPES = {
    DiagramWidgetFactory: Symbol.for('DiagramWidgetFactory'),
    GlspContribution: Symbol.for('GlspContribution'),
    DiagramManager: Symbol.for('DiagramManager'),
    CompositeEditorWidgetFactory: Symbol.for('CompositeEditorWidgetFactory'),
    DiagramLanguageClient: Symbol.for('DiagramLanguageClient'),
    LanguageClientProvider: LanguageClientProviderSymbol,
    SprottyDiagramManager: Symbol.for('SprottyDiagramManager'),
    GlspServiceProxy: Symbol.for('SanyamGlspServiceProxy'),
    DiagramLayoutStorageService: Symbol.for('DiagramLayoutStorageService'),
};

/**
 * GLSP frontend module for Theia.
 *
 * This module sets up:
 * - Diagram widget factory for creating diagram views
 * - Composite editor widget for text/diagram synchronized editing
 * - GLSP contribution for diagram type registration
 * - Command and menu contributions for diagram operations
 * - Frontend application contribution for initialization
 */
/**
 * Override MonacoOutlineContribution to skip handling outline clicks
 * when a CompositeEditorWidget is active. Without this, Monaco's handler
 * calls editorManager.open() which opens a new tab instead of navigating
 * within the embedded editor.
 */
@injectable()
class CompositeAwareMonacoOutlineContribution extends MonacoOutlineContribution {
    @inject(DiagramOutlineContribution)
    protected readonly diagramOutline: DiagramOutlineContribution;

    protected override async selectInEditor(node: unknown, options?: unknown): Promise<void> {
        if (this.diagramOutline.isTrackingComposite) {
            // Let DiagramOutlineContribution handle navigation in composite editors
            return;
        }
        return super.selectInEditor(node as never, options as never);
    }
}

export default new ContainerModule((bind: interfaces.Bind, _unbind, _isBound, rebind) => {
  // Override MonacoOutlineContribution to avoid opening new tabs for composite editor symbols
  rebind(MonacoOutlineContribution).to(CompositeAwareMonacoOutlineContribution).inSingletonScope();
  // ═══════════════════════════════════════════════════════════════════════════════
  // Diagram Widget Bindings
  // ═══════════════════════════════════════════════════════════════════════════════

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
  bind(FrontendApplicationContribution).toService(GlspContribution);
  bind(KeybindingContribution).toService(GlspContribution);

  // Bind command contributions
  bind(GlspDiagramCommands).toSelf().inSingletonScope();
  bind(CommandContribution).toService(GlspDiagramCommands);

  // Bind menu contributions
  bind(GlspDiagramMenus).toSelf().inSingletonScope();
  bind(MenuContribution).toService(GlspDiagramMenus);

  // ═══════════════════════════════════════════════════════════════════════════════
  // SanyamGlspService Proxy (RPC to backend)
  // ═══════════════════════════════════════════════════════════════════════════════

  // Create the service proxy using ServiceConnectionProvider.createProxy() pattern
  // This is the same approach used by @eclipse-glsp/theia-integration
  bind(GLSP_FRONTEND_TYPES.GlspServiceProxy).toDynamicValue(({ container }) => {
    const proxy = ServiceConnectionProvider.createProxy<SanyamGlspServiceInterface>(container, SanyamGlspServicePath);
    // Also set the proxy in the static holder for legacy access
    setGlspServiceProxy(proxy);
    return proxy;
  }).inSingletonScope();

  // ═══════════════════════════════════════════════════════════════════════════════
  // Diagram Language Client (for server communication)
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind the language client provider for GLSP communication
  // Note: GLSP_FRONTEND_TYPES.LanguageClientProvider === LanguageClientProviderSymbol
  // so we only bind once to avoid Inversify ambiguous binding errors
  bind(SanyamLanguageClientProvider).toSelf().inSingletonScope();
  bind(LanguageClientProviderSymbol).toService(SanyamLanguageClientProvider);

  // Bind the diagram language client service
  bind(DiagramLanguageClient).toSelf().inSingletonScope();
  bind(GLSP_FRONTEND_TYPES.DiagramLanguageClient).toService(DiagramLanguageClient);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Composite Editor Bindings
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind the composite editor widget factory
  bind(CompositeEditorWidgetFactory).toSelf().inSingletonScope();
  bind(GLSP_FRONTEND_TYPES.CompositeEditorWidgetFactory).toService(CompositeEditorWidgetFactory);

  // Register widget factory with Theia
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: COMPOSITE_EDITOR_WIDGET_FACTORY_ID,
    createWidget: (options: CompositeEditorWidget.Options) => {
      const factory = ctx.container.get(CompositeEditorWidgetFactory);
      return factory.createWidget(options);
    },
  })).inSingletonScope();

  // Bind composite editor open handler
  bind(CompositeEditorOpenHandler).toSelf().inSingletonScope();
  bind(OpenHandler).toService(CompositeEditorOpenHandler);

  // Bind composite editor contribution (commands, keybindings, menus)
  bind(CompositeEditorContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CompositeEditorContribution);
  bind(KeybindingContribution).toService(CompositeEditorContribution);
  bind(MenuContribution).toService(CompositeEditorContribution);

  // Bind context key service for composite editor
  bind(CompositeEditorContextKeyService).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(CompositeEditorContextKeyService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Diagram Preferences
  // ═══════════════════════════════════════════════════════════════════════════════

  // Register diagram preferences schema
  bind(PreferenceContribution).toConstantValue({ schema: diagramPreferenceSchema });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Layout Storage Service
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind layout storage service for persisting diagram positions
  bind(DiagramLayoutStorageService).toSelf().inSingletonScope();
  bind(GLSP_FRONTEND_TYPES.DiagramLayoutStorageService).toService(DiagramLayoutStorageService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Toolbar Contribution
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind toolbar contribution for diagram editor buttons
  bind(GlspDiagramToolbarContribution).toSelf().inSingletonScope();
  bind(TabBarToolbarContribution).toService(GlspDiagramToolbarContribution);

  // ═══════════════════════════════════════════════════════════════════════════════
  // T037: Properties Panel
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind GLSP service for properties (uses the proxy)
  bind(SanyamGlspServiceSymbol).toDynamicValue(({ container }) =>
    container.get(GLSP_FRONTEND_TYPES.GlspServiceProxy)
  ).inSingletonScope();

  // Property data service (provides property data for element selections)
  // Use .to() pattern matching Theia's contribution convention (not .toService())
  // so ContributionProvider.getContributions() discovers it via getAll()
  bind(ElementPropertyDataService).toSelf().inSingletonScope();
  bind(PropertyDataService).toDynamicValue(({ container }) =>
    container.get(ElementPropertyDataService)
  ).inSingletonScope();

  // Property view form widget (renders property fields)
  bind(ElementPropertyViewFormWidget).toSelf().inSingletonScope();

  // Property view widget provider (connects selection to form widget)
  // Use .toDynamicValue() with singleton scope instead of .toService() which
  // explicitly prevents caching in Inversify 6 and may cause issues with getAll()
  bind(ElementPropertyViewWidgetProvider).toSelf().inSingletonScope();
  bind(PropertyViewWidgetProvider).toDynamicValue(({ container }) =>
    container.get(ElementPropertyViewWidgetProvider)
  ).inSingletonScope();

  // Property selection bridge (publishes outline/diagram events to SelectionService)
  bind(PropertySelectionBridge).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(PropertySelectionBridge);

  // ═══════════════════════════════════════════════════════════════════════════════
  // T045: Outline Sync Service
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind element symbol mapper
  bind(ElementSymbolMapper).toSelf().inSingletonScope();

  // Bind outline sync service
  bind(OutlineSyncServiceImpl).toSelf().inSingletonScope();
  bind(OutlineSyncServiceSymbol).toService(OutlineSyncServiceImpl);

  // Diagram outline contribution (publishes symbols for composite editors)
  bind(DiagramOutlineContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(DiagramOutlineContribution);

  // ═══════════════════════════════════════════════════════════════════════════════
  // T051: Snap-to-Grid
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind snap-grid preferences
  bindSnapGridPreferences(bind);

  // Bind SnapGridTool as the service and UI extension
  bind(SnapGridTool).toSelf().inSingletonScope();
  bind(SnapGridServiceSymbol).toService(SnapGridTool);

  // Bind GridSnapper for Sprotty's ISnapper interface
  bind(GridSnapper).toSelf().inSingletonScope();

  // ═══════════════════════════════════════════════════════════════════════════════
  // Edge Routing Service
  // ═══════════════════════════════════════════════════════════════════════════════

  bind(EdgeRoutingService).toSelf().inSingletonScope();

  // ═══════════════════════════════════════════════════════════════════════════════
  // Diagram Color Tokens
  // ═══════════════════════════════════════════════════════════════════════════════

  bind(DiagramColorContribution).toSelf().inSingletonScope();
  bind(ColorContribution).toService(DiagramColorContribution);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Grammar Operations
  // ═══════════════════════════════════════════════════════════════════════════════

  // Bind grammar operation service
  bind(GrammarOperationServiceImpl).toSelf().inSingletonScope();
  bind(GrammarOperationService).toService(GrammarOperationServiceImpl);

  // Bind grammar operation output service
  bind(GrammarOperationOutputServiceImpl).toSelf().inSingletonScope();
  bind(GrammarOperationOutput).toService(GrammarOperationOutputServiceImpl);

  // Bind grammar operation command contribution
  bind(GrammarOperationCommandContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(GrammarOperationCommandContribution);

  // Bind grammar operation menu contribution
  bind(GrammarOperationMenuContribution).toSelf().inSingletonScope();
  bind(MenuContribution).toService(GrammarOperationMenuContribution);

  // Bind grammar operation toolbar contribution
  bind(GrammarOperationToolbarContributionImpl).toSelf().inSingletonScope();
  bind(GrammarOperationToolbarContribution).toService(GrammarOperationToolbarContributionImpl);
  bind(TabBarToolbarContribution).toService(GrammarOperationToolbarContributionImpl);

  // Bind grammar operation initializer (discovers grammars and registers operations on app start)
  bind(GrammarOperationInitializerImpl).toSelf().inSingletonScope();
  bind(GrammarOperationInitializer).toService(GrammarOperationInitializerImpl);
  bind(FrontendApplicationContribution).toService(GrammarOperationInitializerImpl);
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
