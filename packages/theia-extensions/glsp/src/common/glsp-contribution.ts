/**
 * GLSP Contribution (T085)
 *
 * Frontend contribution for registering diagram types and
 * handling diagram-related functionality in Theia.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from 'inversify';
import {
  FrontendApplicationContribution,
  FrontendApplication,
  WidgetManager,
  ApplicationShell,
  KeybindingContribution,
  KeybindingRegistry,
} from '@theia/core/lib/browser';
import { DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import type { DiagramLanguageInfo } from '@sanyam/types';

import { DiagramWidget, DIAGRAM_WIDGET_FACTORY_ID } from '../browser/diagram-widget';
import { diagramTypeRegistry, DiagramTypeConfiguration } from '../browser/glsp-frontend-module';
import { SanyamLanguageClientProvider } from '../browser/sanyam-language-client-provider';

/**
 * Default diagram types - empty by default.
 * Diagram types are registered dynamically based on language contributions
 * that have diagrammingEnabled=true in their manifest.
 *
 * The DiagramLanguageClient will fetch supported languages from the backend
 * and register them with the diagramTypeRegistry.
 */
export const DEFAULT_DIAGRAM_TYPES: DiagramTypeConfiguration[] = [];

/**
 * GLSP contribution for Theia.
 *
 * This contribution:
 * - Registers diagram types
 * - Opens diagram views for supported files
 * - Handles diagram keybindings
 * - Manages diagram widget lifecycle
 */
@injectable()
export class GlspContribution
  implements FrontendApplicationContribution, KeybindingContribution
{
  readonly viewId = DIAGRAM_WIDGET_FACTORY_ID;
  readonly viewLabel = 'Diagram View';

  @inject(WidgetManager)
  protected readonly widgetManager: WidgetManager;

  @inject(ApplicationShell)
  protected readonly shell: ApplicationShell;

  @inject(SanyamLanguageClientProvider) @optional()
  protected readonly languageClientProvider: SanyamLanguageClientProvider | undefined;

  protected readonly toDispose = new DisposableCollection();
  protected app: FrontendApplication | undefined;
  protected diagramLanguagesLoaded = false;

  @postConstruct()
  protected init(): void {
    // Register default diagram types (empty by default)
    this.registerDefaultDiagramTypes();
  }

  /**
   * Called when the frontend application starts.
   */
  async onStart(app: FrontendApplication): Promise<void> {
    this.app = app;
    console.log('GLSP Contribution started');

    // Fetch and register diagram-enabled languages from backend
    await this.fetchDiagramLanguages();

    // Register widget open handler for diagram files
    this.registerOpenHandlers();
  }

  /**
   * Fetch diagram-enabled languages from the backend and register them.
   */
  protected async fetchDiagramLanguages(): Promise<void> {
    if (!this.languageClientProvider) {
      console.log('[GlspContribution] No language client provider available');
      return;
    }

    try {
      console.log('[GlspContribution] Fetching diagram-enabled languages...');
      const languages = await this.languageClientProvider.sendRequest<DiagramLanguageInfo[]>(
        'glsp/getDiagramLanguages',
        {}
      );

      for (const lang of languages) {
        const config: DiagramTypeConfiguration = {
          diagramType: `sanyam:${lang.languageId}`,
          languageId: lang.languageId,
          label: `${lang.displayName} Diagram`,
          iconClass: lang.iconClass ?? 'fa fa-project-diagram',
          fileExtensions: lang.fileExtensions,
        };
        diagramTypeRegistry.register(config);
        console.log(`[GlspContribution] Registered diagram type: ${config.diagramType} for ${lang.fileExtensions.join(', ')}`);
      }

      this.diagramLanguagesLoaded = true;
      console.log(`[GlspContribution] Registered ${languages.length} diagram type(s) from backend`);
    } catch (error) {
      console.error('[GlspContribution] Failed to fetch diagram languages:', error);
    }
  }

  /**
   * Register default diagram types.
   */
  protected registerDefaultDiagramTypes(): void {
    for (const config of DEFAULT_DIAGRAM_TYPES) {
      diagramTypeRegistry.register(config);
    }
    if (DEFAULT_DIAGRAM_TYPES.length > 0) {
      console.log(`Registered ${DEFAULT_DIAGRAM_TYPES.length} default diagram types`);
    }
  }

  /**
   * Register a diagram type.
   */
  registerDiagramType(config: DiagramTypeConfiguration): void {
    diagramTypeRegistry.register(config);
  }

  /**
   * Register open handlers for diagram files.
   */
  protected registerOpenHandlers(): void {
    // This would integrate with Theia's open handler system
    // to intercept file opens for diagram-supported extensions
    console.log('Diagram open handlers registered');
  }

  /**
   * Open a diagram view for a URI.
   */
  async openDiagramView(uri: string | URI, options?: {
    activate?: boolean;
    reveal?: boolean;
    diagramType?: string;
  }): Promise<DiagramWidget | undefined> {
    const uriString = uri instanceof URI ? uri.toString() : uri;
    const diagramType = options?.diagramType ?? this.getDiagramTypeForUri(uriString);

    if (!diagramType) {
      console.warn(`No diagram type found for URI: ${uriString}`);
      return undefined;
    }

    try {
      const widget = await this.widgetManager.getOrCreateWidget<DiagramWidget>(
        DIAGRAM_WIDGET_FACTORY_ID,
        {
          uri: uriString,
          diagramType,
        }
      );

      if (options?.activate !== false) {
        await this.shell.activateWidget(widget.id);
      } else if (options?.reveal !== false) {
        await this.shell.revealWidget(widget.id);
      }

      return widget;
    } catch (error) {
      console.error('Failed to open diagram view:', error);
      return undefined;
    }
  }

  /**
   * Get diagram type for a URI.
   */
  protected getDiagramTypeForUri(uri: string): string | undefined {
    const uriObj = new URI(uri);
    const extension = uriObj.path.ext;
    const config = diagramTypeRegistry.getByFileExtension(extension);
    return config?.diagramType;
  }

  /**
   * Check if a URI can be opened as a diagram.
   */
  canOpenDiagram(uri: string | URI): boolean {
    const uriString = uri instanceof URI ? uri.toString() : uri;
    return this.getDiagramTypeForUri(uriString) !== undefined;
  }

  /**
   * Get all open diagram widgets.
   */
  getDiagramWidgets(): DiagramWidget[] {
    return this.shell.widgets.filter(
      (widget): widget is DiagramWidget => widget instanceof DiagramWidget
    );
  }

  /**
   * Get diagram widget for a URI.
   */
  getDiagramWidgetForUri(uri: string | URI): DiagramWidget | undefined {
    const uriString = uri instanceof URI ? uri.toString() : uri;
    return this.getDiagramWidgets().find(widget => widget.uri === uriString);
  }

  /**
   * Close diagram view for a URI.
   */
  async closeDiagramView(uri: string | URI): Promise<void> {
    const widget = this.getDiagramWidgetForUri(uri);
    if (widget) {
      widget.close();
    }
  }

  /**
   * Refresh all diagram views.
   */
  refreshAllDiagrams(): void {
    for (const widget of this.getDiagramWidgets()) {
      widget.refresh();
    }
  }

  /**
   * Register keybindings for diagram operations.
   */
  registerKeybindings(registry: KeybindingRegistry): void {
    // Open diagram view (Alt+Shift+D for "Diagram" view)
    // Note: Ctrl+Shift+D conflicts with Debug, Ctrl+Shift+G conflicts with Source Control
    registry.registerKeybinding({
      command: 'sanyam.diagram.open',
      keybinding: 'alt+shift+d',
      when: 'editorFocus',
    });

    // Zoom to fit
    registry.registerKeybinding({
      command: 'sanyam.diagram.zoomToFit',
      keybinding: 'ctrlcmd+shift+0',
      when: 'sanyam.diagram.active',
    });

    // Delete selected elements
    registry.registerKeybinding({
      command: 'sanyam.diagram.delete',
      keybinding: 'delete',
      when: 'sanyam.diagram.active && sanyam.diagram.hasSelection',
    });

    // Select all
    registry.registerKeybinding({
      command: 'sanyam.diagram.selectAll',
      keybinding: 'ctrlcmd+a',
      when: 'sanyam.diagram.active',
    });

    // Toggle minimap
    registry.registerKeybinding({
      command: 'sanyam.diagram.toggleMinimap',
      keybinding: 'ctrlcmd+shift+m',
      when: 'sanyam.diagram.active',
    });

    // Marquee selection mode
    registry.registerKeybinding({
      command: 'sanyam.diagram.marqueeSelect',
      keybinding: 'shift+m',
      when: 'sanyam.diagram.active',
    });
  }

  /**
   * Open the view.
   */
  async openView(args?: { activate?: boolean }): Promise<DiagramWidget | undefined> {
    // Get active editor URI
    const activeEditor = this.shell.activeWidget;
    if (activeEditor && 'uri' in activeEditor) {
      const uri = (activeEditor as any).uri;
      if (uri && this.canOpenDiagram(uri)) {
        return this.openDiagramView(uri, { activate: args?.activate ?? true });
      }
    }
    return undefined;
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.toDispose.dispose();
  }
}

/**
 * Check if diagram contribution is available.
 */
export function isDiagramContributionAvailable(): boolean {
  return diagramTypeRegistry.getAll().length > 0;
}
