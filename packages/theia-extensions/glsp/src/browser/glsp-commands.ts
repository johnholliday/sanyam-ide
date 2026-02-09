/**
 * GLSP Diagram Commands (T086)
 *
 * Command contributions for diagram operations.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct } from 'inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser';
import { ContextKeyService, ContextKey } from '@theia/core/lib/browser/context-key-service';
import URI from '@theia/core/lib/common/uri';
import { SelectAllAction } from 'sprotty-protocol';
import { createLogger } from '@sanyam/logger';

import { GlspContribution } from '../common/glsp-contribution';
import { DiagramWidget } from './diagram-widget';
import { CompositeEditorWidget } from './composite-editor-widget';
import { diagramTypeRegistry } from './glsp-frontend-module';
import { RequestLayoutAction, EdgeRoutingService, type EdgeRoutingMode } from './layout';
import {
  ZoomInAction,
  ZoomOutAction,
  FitDiagramAction,
  CenterDiagramAction,
} from './ui-extensions/viewport';
import { SnapGridServiceSymbol, type SnapGridService } from './ui-extensions/snap-to-grid';

/**
 * Command IDs for diagram operations.
 */
export namespace DiagramCommands {
  export const OPEN_DIAGRAM: Command = {
    id: 'sanyam.diagram.open',
    label: 'Open Diagram View',
    category: 'Diagram',
  };

  export const CLOSE_DIAGRAM: Command = {
    id: 'sanyam.diagram.close',
    label: 'Close Diagram View',
    category: 'Diagram',
  };

  export const REFRESH_DIAGRAM: Command = {
    id: 'sanyam.diagram.refresh',
    label: 'Refresh Diagram',
    category: 'Diagram',
  };

  export const ZOOM_TO_FIT: Command = {
    id: 'sanyam.diagram.zoomToFit',
    label: 'Zoom to Fit',
    category: 'Diagram',
  };

  export const ZOOM_IN: Command = {
    id: 'sanyam.diagram.zoomIn',
    label: 'Zoom In',
    category: 'Diagram',
  };

  export const ZOOM_OUT: Command = {
    id: 'sanyam.diagram.zoomOut',
    label: 'Zoom Out',
    category: 'Diagram',
  };

  export const DELETE_SELECTED: Command = {
    id: 'sanyam.diagram.delete',
    label: 'Delete Selected Elements',
    category: 'Diagram',
  };

  export const SELECT_ALL: Command = {
    id: 'sanyam.diagram.selectAll',
    label: 'Select All',
    category: 'Diagram',
  };

  export const LAYOUT_DIAGRAM: Command = {
    id: 'sanyam.diagram.layout',
    label: 'Auto-Layout Diagram',
    category: 'Diagram',
  };

  export const EXPORT_SVG: Command = {
    id: 'sanyam.diagram.exportSvg',
    label: 'Export as SVG',
    category: 'Diagram',
  };

  export const EXPORT_PNG: Command = {
    id: 'sanyam.diagram.exportPng',
    label: 'Export as PNG',
    category: 'Diagram',
  };

  export const CENTER_VIEW: Command = {
    id: 'sanyam.diagram.centerView',
    label: 'Center View',
    category: 'Diagram',
  };

  export const TOGGLE_GRID: Command = {
    id: 'sanyam.diagram.toggleGrid',
    label: 'Toggle Grid',
    category: 'Diagram',
  };

  export const TOGGLE_SNAP_TO_GRID: Command = {
    id: 'sanyam.diagram.toggleSnapToGrid',
    label: 'Toggle Snap to Grid',
    category: 'Diagram',
  };

  export const ALIGN_LEFT: Command = {
    id: 'sanyam.diagram.alignLeft',
    label: 'Align Left',
    category: 'Diagram',
  };

  export const ALIGN_CENTER: Command = {
    id: 'sanyam.diagram.alignCenter',
    label: 'Align Center',
    category: 'Diagram',
  };

  export const ALIGN_RIGHT: Command = {
    id: 'sanyam.diagram.alignRight',
    label: 'Align Right',
    category: 'Diagram',
  };

  export const ALIGN_TOP: Command = {
    id: 'sanyam.diagram.alignTop',
    label: 'Align Top',
    category: 'Diagram',
  };

  export const ALIGN_MIDDLE: Command = {
    id: 'sanyam.diagram.alignMiddle',
    label: 'Align Middle',
    category: 'Diagram',
  };

  export const ALIGN_BOTTOM: Command = {
    id: 'sanyam.diagram.alignBottom',
    label: 'Align Bottom',
    category: 'Diagram',
  };

  export const TOGGLE_MINIMAP: Command = {
    id: 'sanyam.diagram.toggleMinimap',
    label: 'Toggle Minimap',
    category: 'Diagram',
  };

  export const MARQUEE_SELECT: Command = {
    id: 'sanyam.diagram.marqueeSelect',
    label: 'Enable Marquee Selection',
    category: 'Diagram',
  };

  export const EDGE_ROUTING_ORTHOGONAL: Command = {
    id: 'sanyam.diagram.edgeRouting.orthogonal',
    label: 'Orthogonal Edge Routing',
    category: 'Diagram',
  };

  export const EDGE_ROUTING_STRAIGHT: Command = {
    id: 'sanyam.diagram.edgeRouting.straight',
    label: 'Straight Edge Routing',
    category: 'Diagram',
  };

  export const EDGE_ROUTING_BEZIER: Command = {
    id: 'sanyam.diagram.edgeRouting.bezier',
    label: 'Bezier Edge Routing',
    category: 'Diagram',
  };

  export const EXPORT_JSON: Command = {
    id: 'sanyam.diagram.exportJson',
    label: 'Export as JSON',
    category: 'Diagram',
  };

  export const EXPORT_MARKDOWN: Command = {
    id: 'sanyam.diagram.exportMarkdown',
    label: 'Export as Markdown',
    category: 'Diagram',
  };

}

/**
 * Command contributions for diagram operations.
 */
@injectable()
export class GlspDiagramCommands implements CommandContribution {
  protected readonly logger = createLogger({ name: 'GlspCommands' });

  @inject(ApplicationShell)
  protected readonly shell: ApplicationShell;

  @inject(GlspContribution)
  protected readonly glspContribution: GlspContribution;

  @inject(EdgeRoutingService)
  protected readonly edgeRoutingService: EdgeRoutingService;

  @inject(SnapGridServiceSymbol)
  protected readonly snapGridService: SnapGridService;

  @inject(ContextKeyService)
  protected readonly contextKeyService: ContextKeyService;

  /** Context key for snap-to-grid state - triggers toolbar refresh when changed */
  protected snapToGridContextKey: ContextKey<boolean> | undefined;

  /**
   * Cache of the last known diagram widget.
   * Used as fallback when shell.activeWidget is undefined (e.g., during toolbar clicks).
   */
  protected lastKnownDiagramWidget: DiagramWidget | undefined;

  /**
   * Cache of the last known composite editor showing diagram.
   * Used as fallback when shell.activeWidget is undefined.
   */
  protected lastKnownCompositeWidget: CompositeEditorWidget | undefined;

  @postConstruct()
  protected init(): void {
    // Create context key for snap-to-grid state
    this.snapToGridContextKey = this.contextKeyService.createKey<boolean>('sanyam.diagram.snapToGridEnabled', false);
  }

  /**
   * Register commands.
   */
  registerCommands(registry: CommandRegistry): void {
    // Open diagram view
    // Accepts either a URI object, a string URI, or nothing (uses active editor)
    registry.registerCommand(DiagramCommands.OPEN_DIAGRAM, {
      execute: (...args: unknown[]) => this.openDiagram(args),
      isEnabled: (...args: unknown[]) => this.canOpenDiagram(args),
      isVisible: (...args: unknown[]) => this.canOpenDiagram(args),
    });

    // Close diagram view
    registry.registerCommand(DiagramCommands.CLOSE_DIAGRAM, {
      execute: () => this.closeDiagram(),
      isEnabled: () => this.hasDiagramFocus(),
      isVisible: () => this.hasDiagramFocus(),
    });

    // Refresh diagram - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.REFRESH_DIAGRAM, {
      execute: (...args: unknown[]) => this.refreshDiagram(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
      isVisible: () => this.hasDiagramFocus(),
    });

    // Zoom commands - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.ZOOM_TO_FIT, {
      execute: (...args: unknown[]) => this.zoomToFit(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.ZOOM_IN, {
      execute: (...args: unknown[]) => this.zoomIn(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.ZOOM_OUT, {
      execute: (...args: unknown[]) => this.zoomOut(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Delete selected
    registry.registerCommand(DiagramCommands.DELETE_SELECTED, {
      execute: () => this.deleteSelected(),
      isEnabled: () => this.hasSelection(),
    });

    // Select all
    registry.registerCommand(DiagramCommands.SELECT_ALL, {
      execute: () => this.selectAll(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Auto-layout - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.LAYOUT_DIAGRAM, {
      execute: (...args: unknown[]) => this.layoutDiagram(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Export commands - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.EXPORT_SVG, {
      execute: (...args: unknown[]) => this.exportSvg(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.EXPORT_PNG, {
      execute: (...args: unknown[]) => this.exportPng(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.EXPORT_JSON, {
      execute: (...args: unknown[]) => this.exportJson(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.EXPORT_MARKDOWN, {
      execute: (...args: unknown[]) => this.exportMarkdown(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // View commands - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.CENTER_VIEW, {
      execute: (...args: unknown[]) => this.centerView(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.TOGGLE_GRID, {
      execute: () => this.toggleGrid(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Alignment commands
    this.registerAlignmentCommands(registry);

    // Toggle minimap - accept widget argument from toolbar
    registry.registerCommand(DiagramCommands.TOGGLE_MINIMAP, {
      execute: (...args: unknown[]) => this.toggleMinimap(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Marquee selection
    registry.registerCommand(DiagramCommands.MARQUEE_SELECT, {
      execute: () => this.enableMarqueeSelect(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Toggle snap-to-grid
    registry.registerCommand(DiagramCommands.TOGGLE_SNAP_TO_GRID, {
      execute: (...args: unknown[]) => this.toggleSnapToGrid(this.extractWidgetFromArgs(args)),
      isEnabled: () => this.hasDiagramFocus(),
      isToggled: () => this.isSnapToGridEnabled(),
    });

    // Edge routing mode commands
    this.registerEdgeRoutingCommand(registry, DiagramCommands.EDGE_ROUTING_ORTHOGONAL, 'orthogonal');
    this.registerEdgeRoutingCommand(registry, DiagramCommands.EDGE_ROUTING_STRAIGHT, 'straight');
    this.registerEdgeRoutingCommand(registry, DiagramCommands.EDGE_ROUTING_BEZIER, 'bezier');

  }

  /**
   * Register an edge routing mode command.
   */
  protected registerEdgeRoutingCommand(registry: CommandRegistry, command: Command, mode: EdgeRoutingMode): void {
    registry.registerCommand(command, {
      execute: (...args: unknown[]) => {
        this.edgeRoutingService.setMode(mode);
        const diagram = this.getActiveDiagram(this.extractWidgetFromArgs(args));
        if (diagram) {
          const action = RequestLayoutAction.create();
          diagram.dispatchAction(action).catch(err => {
            this.logger.error({ err }, `Edge routing ${mode} layout failed`);
          });
        }
      },
      isEnabled: () => this.hasDiagramFocus(),
      isToggled: () => this.edgeRoutingService.currentMode === mode,
    });
  }

  /**
   * Check if snap-to-grid is enabled.
   * Reads directly from global window state to ensure consistency across all webpack chunks.
   */
  protected isSnapToGridEnabled(): boolean {
    // Read directly from global state to bypass any instance issues
    const globalConfig = (window as any)['__sanyam_snap_grid_config__'];
    return globalConfig?.enabled ?? false;
  }

  /**
   * Register alignment commands.
   */
  protected registerAlignmentCommands(registry: CommandRegistry): void {
    const alignmentCommands = [
      { command: DiagramCommands.ALIGN_LEFT, alignment: 'left' },
      { command: DiagramCommands.ALIGN_CENTER, alignment: 'center' },
      { command: DiagramCommands.ALIGN_RIGHT, alignment: 'right' },
      { command: DiagramCommands.ALIGN_TOP, alignment: 'top' },
      { command: DiagramCommands.ALIGN_MIDDLE, alignment: 'middle' },
      { command: DiagramCommands.ALIGN_BOTTOM, alignment: 'bottom' },
    ];

    for (const { command, alignment } of alignmentCommands) {
      registry.registerCommand(command, {
        execute: () => this.alignSelection(alignment),
        isEnabled: () => this.hasMultipleSelection(),
      });
    }
  }

  /**
   * Get active diagram widget.
   * Handles both standalone DiagramWidget and DiagramWidget embedded in CompositeEditorWidget.
   * Uses cached widget as fallback when shell.activeWidget is undefined (toolbar click timing issue).
   * @param widgetHint - Optional widget passed from toolbar context
   */
  protected getActiveDiagram(widgetHint?: unknown): DiagramWidget | undefined {
    // If a widget was passed (from toolbar), try to use it first
    let widget: unknown = widgetHint;
    if (!widget) {
      widget = this.shell.activeWidget;
    }

    // If widget is still undefined, use cached fallback
    if (!widget) {
      this.logger.debug('[GlspDiagramCommands] getActiveDiagram - activeWidget undefined, using cached fallback');
      // Try cached diagram widget first
      if (this.lastKnownDiagramWidget && !this.lastKnownDiagramWidget.isDisposed) {
        this.logger.debug('[GlspDiagramCommands] Using cached DiagramWidget');
        return this.lastKnownDiagramWidget;
      }
      // Try cached composite widget
      if (this.lastKnownCompositeWidget && !this.lastKnownCompositeWidget.isDisposed) {
        if (this.lastKnownCompositeWidget.activeView === 'diagram') {
          const diagramWidget = this.lastKnownCompositeWidget.getDiagramWidget() as DiagramWidget | undefined;
          this.logger.debug({ embeddedDiagram: diagramWidget?.constructor.name }, 'Using cached CompositeEditorWidget');
          return diagramWidget;
        }
      }
      this.logger.debug('[GlspDiagramCommands] No cached widget available');
      return undefined;
    }

    this.logger.debug({ widget: (widget as any)?.constructor?.name, fromHint: !!widgetHint }, 'getActiveDiagram');

    if (widget instanceof DiagramWidget) {
      this.logger.debug('[GlspDiagramCommands] Found standalone DiagramWidget');
      // Cache for future use
      this.lastKnownDiagramWidget = widget;
      return widget;
    }
    if (widget instanceof CompositeEditorWidget) {
      this.logger.debug({ activeView: widget.activeView }, 'Found CompositeEditorWidget');
      // Cache for future use
      this.lastKnownCompositeWidget = widget;
      if (widget.activeView === 'diagram') {
        // Get the embedded diagram widget via public getter
        const diagramWidget = widget.getDiagramWidget() as DiagramWidget | undefined;
        this.logger.debug({ diagramWidget: diagramWidget?.constructor.name, sprottyInitialized: diagramWidget?.isSprottyInitialized?.() }, 'Embedded diagramWidget');
        return diagramWidget;
      }
    }
    this.logger.debug('[GlspDiagramCommands] No diagram widget found');
    return undefined;
  }

  /**
   * Check if a diagram has focus.
   * Returns true for both standalone diagram widgets and composite editors showing diagram view.
   * Uses cached widget as fallback when shell.activeWidget is undefined.
   */
  protected hasDiagramFocus(): boolean {
    let widget = this.shell.activeWidget;

    // If activeWidget is undefined, use cached fallback
    if (!widget) {
      // Check cached diagram widget
      if (this.lastKnownDiagramWidget && !this.lastKnownDiagramWidget.isDisposed) {
        this.logger.debug('[GlspDiagramCommands] hasDiagramFocus: true (using cached DiagramWidget)');
        return true;
      }
      // Check cached composite widget
      if (this.lastKnownCompositeWidget && !this.lastKnownCompositeWidget.isDisposed) {
        if (this.lastKnownCompositeWidget.activeView === 'diagram') {
          this.logger.debug('[GlspDiagramCommands] hasDiagramFocus: true (using cached CompositeEditorWidget)');
          return true;
        }
      }
      this.logger.debug('[GlspDiagramCommands] hasDiagramFocus: false - activeWidget undefined and no valid cache');
      return false;
    }

    const isDiagramWidget = widget instanceof DiagramWidget;
    const isComposite = widget instanceof CompositeEditorWidget;
    const compositeShowingDiagram = isComposite && (widget as CompositeEditorWidget).activeView === 'diagram';
    const result = isDiagramWidget || compositeShowingDiagram;

    // Cache valid widgets for future use
    if (isDiagramWidget) {
      this.lastKnownDiagramWidget = widget as DiagramWidget;
    }
    if (isComposite) {
      this.lastKnownCompositeWidget = widget as CompositeEditorWidget;
    }

    // If active widget is not a diagram (e.g., sidebar palette), fall back to cached widgets
    if (!result) {
      if (this.lastKnownDiagramWidget && !this.lastKnownDiagramWidget.isDisposed) {
        this.logger.debug('[GlspDiagramCommands] hasDiagramFocus: true (fallback to cached DiagramWidget)');
        return true;
      }
      if (this.lastKnownCompositeWidget && !this.lastKnownCompositeWidget.isDisposed) {
        if (this.lastKnownCompositeWidget.activeView === 'diagram') {
          this.logger.debug('[GlspDiagramCommands] hasDiagramFocus: true (fallback to cached CompositeEditorWidget)');
          return true;
        }
      }
    }

    this.logger.debug({ result, activeWidget: widget?.constructor.name }, 'hasDiagramFocus');
    return result;
  }

  /**
   * Extract a widget from command arguments (used when toolbar passes the widget context).
   */
  protected extractWidgetFromArgs(args: unknown[]): unknown | undefined {
    if (args.length === 0) {
      return undefined;
    }
    const firstArg = args[0];
    // Theia toolbar passes the widget as the first argument
    if (firstArg instanceof DiagramWidget || firstArg instanceof CompositeEditorWidget) {
      this.logger.debug({ widget: firstArg.constructor.name }, 'extractWidgetFromArgs - found widget');
      return firstArg;
    }
    return undefined;
  }

  /**
   * Extract URI from command arguments.
   */
  protected extractUri(args: unknown[]): URI | undefined {
    if (args.length === 0) {
      return undefined;
    }

    const firstArg = args[0];

    // Handle URI object directly
    if (firstArg instanceof URI) {
      return firstArg;
    }

    // Handle Theia's UriSelection (from navigator context menu)
    if (firstArg && typeof firstArg === 'object' && 'uri' in firstArg) {
      const uriSelection = firstArg as { uri: URI };
      if (uriSelection.uri instanceof URI) {
        return uriSelection.uri;
      }
    }

    // Handle string URI
    if (typeof firstArg === 'string') {
      return new URI(firstArg);
    }

    // Handle array of selections (navigator can pass array)
    if (Array.isArray(firstArg) && firstArg.length > 0) {
      const first = firstArg[0];
      if (first && typeof first === 'object' && 'uri' in first) {
        const selection = first as { uri: URI };
        if (selection.uri instanceof URI) {
          return selection.uri;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if current editor or selected file can be opened as diagram.
   */
  protected canOpenDiagram(args: unknown[]): boolean {
    // Check if a URI was passed as argument (from navigator context menu)
    const uri = this.extractUri(args);
    if (uri) {
      const extension = uri.path.ext;
      const config = diagramTypeRegistry.getByFileExtension(extension);
      return config !== undefined;
    }

    // Fall back to active widget
    const activeWidget = this.shell.activeWidget;
    if (activeWidget && 'uri' in activeWidget) {
      return this.glspContribution.canOpenDiagram((activeWidget as any).uri);
    }
    return false;
  }

  /**
   * Check if there's a selection.
   */
  protected hasSelection(): boolean {
    const diagram = this.getActiveDiagram();
    return diagram ? diagram.getSelection().length > 0 : false;
  }

  /**
   * Check if there's multiple selection.
   */
  protected hasMultipleSelection(): boolean {
    const diagram = this.getActiveDiagram();
    return diagram ? diagram.getSelection().length > 1 : false;
  }

  // Command implementations

  protected async openDiagram(args: unknown[]): Promise<void> {
    // Check if a URI was passed as argument (from navigator context menu)
    const uri = this.extractUri(args);
    if (uri) {
      const extension = uri.path.ext;
      const config = diagramTypeRegistry.getByFileExtension(extension);
      if (config) {
        await this.glspContribution.openDiagramView(uri, {
          activate: true,
          diagramType: config.diagramType,
        });
        return;
      }
    }

    // Fall back to active widget
    await this.glspContribution.openView({ activate: true });
  }

  protected closeDiagram(): void {
    const diagram = this.getActiveDiagram();
    diagram?.close();
  }

  protected refreshDiagram(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] refreshDiagram called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      diagram.refresh();
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for refreshDiagram');
    }
  }

  protected zoomToFit(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] zoomToFit called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching FitDiagramAction');
      diagram.dispatchAction(FitDiagramAction.create()).catch(err => {
        this.logger.error({ err }, 'zoomToFit failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for zoomToFit');
    }
  }

  protected zoomIn(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] zoomIn called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching ZoomInAction');
      diagram.dispatchAction(ZoomInAction.create(1.2)).catch(err => {
        this.logger.error({ err }, 'zoomIn failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for zoomIn');
    }
  }

  protected zoomOut(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] zoomOut called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching ZoomOutAction');
      diagram.dispatchAction(ZoomOutAction.create(1.2)).catch(err => {
        this.logger.error({ err }, 'zoomOut failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for zoomOut');
    }
  }

  protected deleteSelected(): void {
    const diagram = this.getActiveDiagram();
    if (diagram) {
      const selectedIds = diagram.getSelection();
      diagram.executeOperation({
        kind: 'delete',
        elementIds: selectedIds,
      });
    }
  }

  protected selectAll(): void {
    this.logger.debug('[GlspDiagramCommands] selectAll called');
    const diagram = this.getActiveDiagram();
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching SelectAllAction');
      const action: SelectAllAction = SelectAllAction.create({ select: true });
      diagram.dispatchAction(action).catch(err => {
        this.logger.error({ err }, 'selectAll failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for selectAll');
    }
  }

  protected layoutDiagram(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] layoutDiagram called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching RequestLayoutAction');
      const action = RequestLayoutAction.create();
      diagram.dispatchAction(action).catch(err => {
        this.logger.error({ err }, 'layoutDiagram failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for layoutDiagram');
    }
  }

  protected exportSvg(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] exportSvg called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching requestExportSvg action');
      diagram.dispatchAction({ kind: 'requestExportSvg' }).catch(err => {
        this.logger.error({ err }, 'exportSvg failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for exportSvg');
    }
  }

  protected exportPng(_widgetHint?: unknown): void {
    // PNG export requires canvas rendering - not implemented yet
    this.logger.debug('[GlspDiagramCommands] Export PNG - not yet implemented');
  }

  protected exportJson(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] exportJson called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (!diagram) {
      this.logger.debug('[GlspDiagramCommands] No diagram for exportJson');
      return;
    }
    const gModel = diagram.getModel();
    if (!gModel) {
      this.logger.warn('[GlspDiagramCommands] No model available for JSON export');
      return;
    }
    const jsonStr = JSON.stringify(gModel, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.logger.debug('[GlspDiagramCommands] JSON exported');
  }

  protected exportMarkdown(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] exportMarkdown called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (!diagram) {
      this.logger.debug('[GlspDiagramCommands] No diagram for exportMarkdown');
      return;
    }
    const gModel = diagram.getModel();
    if (!gModel) {
      this.logger.warn('[GlspDiagramCommands] No model available for Markdown export');
      return;
    }
    const md = this.generateMarkdownSummary(gModel);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.logger.debug('[GlspDiagramCommands] Markdown exported');
  }

  /**
   * Generate a Markdown summary of the diagram model.
   */
  protected generateMarkdownSummary(gModel: unknown): string {
    const root = gModel as { id?: string; type?: string; children?: unknown[] };
    const nodes: { id: string; type: string; label?: string }[] = [];
    const edges: { id: string; type: string; source?: string; target?: string; label?: string }[] = [];

    const collectElements = (element: unknown): void => {
      const el = element as { id?: string; type?: string; children?: unknown[]; sourceId?: string; targetId?: string; text?: string };
      if (!el || !el.type) return;

      if (el.type.includes('edge') || el.type.includes('Edge')) {
        edges.push({
          id: el.id ?? '',
          type: el.type,
          source: el.sourceId,
          target: el.targetId,
          label: el.text,
        });
      } else if (el.type.includes('node') || el.type.includes('Node')) {
        const label = el.text ?? this.findLabelInChildren(el.children);
        nodes.push({ id: el.id ?? '', type: el.type, label });
      }

      if (el.children) {
        for (const child of el.children) {
          collectElements(child);
        }
      }
    };

    if (root.children) {
      for (const child of root.children) {
        collectElements(child);
      }
    }

    const lines: string[] = [
      '# Diagram Summary',
      '',
      `**Root**: ${root.type ?? 'unknown'} (${root.id ?? 'no-id'})`,
      '',
    ];

    if (nodes.length > 0) {
      lines.push('## Nodes', '', '| ID | Type | Label |', '|---|------|-------|');
      for (const n of nodes) {
        lines.push(`| ${n.id} | ${n.type} | ${n.label ?? ''} |`);
      }
      lines.push('');
    }

    if (edges.length > 0) {
      lines.push('## Edges', '', '| ID | Type | Source | Target | Label |', '|---|------|--------|--------|-------|');
      for (const e of edges) {
        lines.push(`| ${e.id} | ${e.type} | ${e.source ?? ''} | ${e.target ?? ''} | ${e.label ?? ''} |`);
      }
      lines.push('');
    }

    lines.push(`*Exported at ${new Date().toISOString()}*`);
    return lines.join('\n');
  }

  /**
   * Find a label text in child elements.
   */
  protected findLabelInChildren(children?: unknown[]): string | undefined {
    if (!children) return undefined;
    for (const child of children) {
      const el = child as { type?: string; text?: string; children?: unknown[] };
      if (el.type?.includes('label') || el.type?.includes('Label')) {
        return el.text;
      }
      if (el.children) {
        const found = this.findLabelInChildren(el.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  protected centerView(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] centerView called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching CenterDiagramAction');
      diagram.dispatchAction(CenterDiagramAction.create()).catch(err => {
        this.logger.error({ err }, 'centerView failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for centerView');
    }
  }

  protected toggleGrid(): void {
    // Grid is controlled via preferences, not an action
    this.logger.debug('Toggle grid - use preferences');
  }

  protected alignSelection(alignment: string): void {
    const diagram = this.getActiveDiagram();
    if (diagram) {
      diagram.executeOperation({
        kind: 'align',
        alignment,
        elementIds: diagram.getSelection(),
      });
    }
  }

  protected toggleMinimap(widgetHint?: unknown): void {
    this.logger.debug('[GlspDiagramCommands] toggleMinimap called');
    const diagram = this.getActiveDiagram(widgetHint);
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching toggleMinimap action');
      diagram.dispatchAction({ kind: 'toggleMinimap' }).catch(err => {
        this.logger.error({ err }, 'toggleMinimap failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for toggleMinimap');
    }
  }

  protected enableMarqueeSelect(): void {
    this.logger.debug('[GlspDiagramCommands] enableMarqueeSelect called');
    const diagram = this.getActiveDiagram();
    if (diagram) {
      this.logger.debug('[GlspDiagramCommands] Dispatching enableMarqueeSelect action');
      diagram.dispatchAction({ kind: 'enableMarqueeSelect' }).catch(err => {
        this.logger.error({ err }, 'enableMarqueeSelect failed');
      });
    } else {
      this.logger.debug('[GlspDiagramCommands] No diagram for enableMarqueeSelect');
    }
  }

  protected toggleSnapToGrid(_widgetHint?: unknown): void {
    // Toggle the snap-to-grid state directly via the service
    const newState = this.snapGridService.toggle();

    // Update context key to trigger toolbar refresh
    this.snapToGridContextKey?.set(newState);
  }
}
