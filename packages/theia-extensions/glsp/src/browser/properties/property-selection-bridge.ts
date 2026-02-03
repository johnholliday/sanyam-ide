/**
 * Property Selection Bridge
 *
 * FrontendApplicationContribution that bridges diagram/outline selection events
 * to Theia's SelectionService, enabling the built-in property view
 * to react to diagram, outline, and text editor selections.
 *
 * Subscribes directly to diagram widget selection events (via CompositeEditorWidget)
 * rather than relying solely on OutlineSyncService, which may not be wired yet
 * when the diagram widget is created asynchronously.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject } from 'inversify';
import { FrontendApplicationContribution, Widget } from '@theia/core/lib/browser';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { Disposable, DisposableCollection } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OutlineSyncServiceImpl, OutlineSyncServiceSymbol } from '../outline';
import { CompositeEditorWidget, type DiagramWidgetCapabilities } from '../composite-editor-widget';
import type { ElementPropertySelection } from './element-selection';

/**
 * Bridges diagram/outline selection events to Theia's SelectionService.
 *
 * Uses two subscription paths:
 * 1. Direct: watches for CompositeEditorWidget activation, subscribes to
 *    the embedded diagram widget's onSelectionChanged event.
 * 2. Indirect: listens to OutlineSyncService events for outline-initiated
 *    and text-editor-initiated selections.
 */
@injectable()
export class PropertySelectionBridge implements FrontendApplicationContribution {
  protected readonly logger = createLogger({ name: 'PropertySelectionBridge' });
  protected readonly toDispose = new DisposableCollection();

  /** Disposables scoped to the currently tracked composite editor */
  protected readonly toDisposeOnWidget = new DisposableCollection();

  /** Currently tracked composite editor */
  protected currentComposite: CompositeEditorWidget | undefined;

  @inject(SelectionService)
  protected readonly selectionService: SelectionService;

  @inject(OutlineSyncServiceSymbol)
  protected readonly outlineSyncService: OutlineSyncServiceImpl;

  @inject(ApplicationShell)
  protected readonly shell: ApplicationShell;

  /**
   * Called when the application starts.
   */
  onStart(): void {
    this.logger.debug('PropertySelectionBridge.onStart() called');

    // === Path 1: Direct diagram selection subscription ===
    // Watch for active widget changes and subscribe to diagram selection directly
    this.toDispose.push(
      this.shell.onDidChangeCurrentWidget(({ newValue }) => {
        this.logger.debug({ widgetId: newValue?.id, widgetClass: newValue?.constructor.name }, 'onDidChangeCurrentWidget');
        this.handleActiveWidgetChanged(newValue ?? undefined);
      })
    );
    // Handle already-active widget at startup
    this.handleActiveWidgetChanged(this.shell.currentWidget ?? undefined);

    // === Path 2: OutlineSyncService events (outline/text editor selections) ===
    this.toDispose.push(
      this.outlineSyncService.onDiagramSelectionRequest(event => {
        if (event.elementIds.length > 0) {
          this.publishSelection(event.uri, event.elementIds, 'outline');
        }
      })
    );

    // Listen for outline-initiated and text-editor-initiated selections.
    // These don't carry a URI, so we resolve it from the active composite.
    this.toDispose.push(
      this.outlineSyncService.onOutlineSelection(event => {
        // Only handle non-diagram sources here — diagram is handled directly above.
        if (event.source === 'diagram') {
          return;
        }
        const elementIds = event.elementIds;
        if (!elementIds || elementIds.length === 0) {
          return;
        }
        const uri = this.currentComposite?.uri.toString();
        if (uri) {
          this.publishSelection(uri, [...elementIds], event.source);
        }
      })
    );
  }

  /**
   * Track the active composite editor and subscribe to its diagram widget.
   */
  protected handleActiveWidgetChanged(widget: Widget | undefined): void {
    const isComposite = widget instanceof CompositeEditorWidget;
    this.logger.debug({ widgetId: widget?.id, isComposite, isSame: widget === this.currentComposite }, 'handleActiveWidgetChanged');
    if (isComposite) {
      if (widget === this.currentComposite) {
        return;
      }
      this.trackCompositeEditor(widget);
    } else if (this.currentComposite) {
      // Only release when the new widget is in the main area (another editor)
      if (widget && this.shell.getAreaFor(widget) === 'main') {
        this.releaseCompositeEditor();
      }
    }
  }

  /**
   * Subscribe to the diagram widget's selection events within a composite editor.
   */
  protected trackCompositeEditor(composite: CompositeEditorWidget): void {
    this.releaseCompositeEditor();
    this.currentComposite = composite;

    const diagramWidget = composite.getDiagramWidget();
    this.logger.debug({ hasDiagramWidget: !!diagramWidget, compositeId: composite.id }, 'trackCompositeEditor');
    if (diagramWidget) {
      this.wireDiagramSelection(composite, diagramWidget);
    } else {
      // Diagram widget not created yet — poll until it appears
      this.pollForDiagramWidget(composite);
    }

    // Release if composite is disposed
    composite.disposed.connect(() => {
      if (this.currentComposite === composite) {
        this.releaseCompositeEditor();
      }
    });
  }

  /**
   * Poll for the diagram widget to become available.
   */
  protected pollForDiagramWidget(composite: CompositeEditorWidget): void {
    const tryWire = (): void => {
      const dw = composite.getDiagramWidget();
      if (dw) {
        this.wireDiagramSelection(composite, dw);
        if (pollTimer !== undefined) {
          clearInterval(pollTimer);
        }
      }
    };

    // Also try on view changes (user switches tabs within composite)
    this.toDisposeOnWidget.push(
      composite.onActiveViewChanged(() => tryWire())
    );

    const pollTimer = setInterval(() => tryWire(), 500);
    this.toDisposeOnWidget.push(Disposable.create(() => clearInterval(pollTimer)));
  }

  /**
   * Wire direct subscription to diagram widget selection changes.
   */
  protected wireDiagramSelection(
    composite: CompositeEditorWidget,
    diagramWidget: DiagramWidgetCapabilities
  ): void {
    const hasEvent = !!diagramWidget.onSelectionChanged;
    this.logger.debug({ hasOnSelectionChanged: hasEvent, diagramWidgetId: diagramWidget.id }, 'wireDiagramSelection');
    if (!diagramWidget.onSelectionChanged) {
      return;
    }

    const uri = composite.uri.toString();

    const disposable = diagramWidget.onSelectionChanged(selection => {
      // Copy selectedIds immediately — state.selection is a shared mutable reference
      const ids = [...selection.selectedIds];
      this.logger.debug({ selectedIds: ids, uri }, 'diagram onSelectionChanged fired');
      this.publishSelection(uri, ids, 'diagram');
    });

    this.toDisposeOnWidget.push(disposable);
    this.logger.debug({ uri }, 'Wired diagram selection for properties');
  }

  /**
   * Publish an ElementPropertySelection to Theia's SelectionService.
   */
  protected publishSelection(
    uri: string,
    elementIds: readonly string[],
    source: 'diagram' | 'outline' | 'textEditor'
  ): void {
    const selection: ElementPropertySelection = {
      kind: 'element-property-selection',
      uri,
      elementIds: [...elementIds],
      source,
    };
    this.logger.debug({ uri, elementIds: [...elementIds], source }, 'publishSelection → SelectionService');
    this.selectionService.selection = selection;
  }

  /**
   * Release the current composite editor tracking.
   */
  protected releaseCompositeEditor(): void {
    this.logger.debug('releaseCompositeEditor called');
    this.toDisposeOnWidget.dispose();
    this.currentComposite = undefined;
  }

  /**
   * Called when the application stops.
   */
  onStop(): void {
    this.releaseCompositeEditor();
    this.toDispose.dispose();
  }
}
