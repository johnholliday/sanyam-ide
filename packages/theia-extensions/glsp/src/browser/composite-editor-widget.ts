/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { createLogger } from '@sanyam/logger';
import {
    BaseWidget,
    Widget,
    Message,
    StatefulWidget,
    Saveable,
    SaveableSource,
    NavigatableWidget,
    ApplicationShell,
    WidgetManager,
} from '@theia/core/lib/browser';
import { DockPanel } from '@lumino/widgets';
import { PanelLayout } from '@lumino/widgets';
import { MessageLoop } from '@lumino/messaging';
import { DisposableCollection, Emitter, Event } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import type { GrammarManifest, GModelRoot } from '@sanyam/types';
import { COMPOSITE_EDITOR_WIDGET_FACTORY_ID_STRING } from '@sanyam/types';

// Direct import from same package - no more symbol-based lookup needed
import { DIAGRAM_WIDGET_FACTORY_ID } from './diagram-widget';
import { DiagramLanguageClient, TextEdit } from './diagram-language-client';
import { CanvasDropHandler, CanvasDropHandlerSymbol, TextEditorDropHandler, TextEditorDropHandlerSymbol, ELEMENT_PALETTE_DRAG_MIME_TYPE, decodeDragData } from './element-palette';

import './style/index.css';

/**
 * Factory ID for composite editor widgets.
 * Re-exported from @sanyam/types for backwards compatibility.
 */
export const COMPOSITE_EDITOR_WIDGET_FACTORY_ID = COMPOSITE_EDITOR_WIDGET_FACTORY_ID_STRING;

/**
 * Interface for diagram widget capabilities needed by the composite editor.
 * This allows decoupled interaction without importing the actual DiagramWidget class.
 */
export interface DiagramWidgetCapabilities extends Widget {
    /** Set the diagram model */
    setModel(gModel: GModelRoot): void;
    /** Update element positions */
    updatePositions?(positions: Map<string, { x: number; y: number }>): void;
    /** Update element sizes */
    updateSizes?(sizes: Map<string, { width: number; height: number }>): void;
    /** Show loading state */
    showLoading?(): void;
    /** Show error state */
    showError?(message: string): void;
    /** Dispatch a Sprotty action */
    dispatchAction?(action: unknown): Promise<void>;
    /** Check if Sprotty is initialized */
    isSprottyInitialized?(): boolean;
    /** Zoom to fit all elements */
    zoomToFit?(): Promise<void>;
    /** Zoom in by a factor */
    zoomIn?(factor?: number): Promise<void>;
    /** Zoom out by a factor */
    zoomOut?(factor?: number): Promise<void>;
    /** Center the view */
    center?(elementIds?: string[]): Promise<void>;
    /** Refresh the diagram */
    refresh?(): void;
    /** Get the current selection */
    getSelection?(): string[];
    /** Execute an operation */
    executeOperation?(operation: unknown): void;
    /** Event fired when selection changes */
    onSelectionChanged?: Event<{ selectedIds: string[] }>;
    /** Event fired when model changes */
    onModelChanged?: Event<unknown>;
    /** Programmatically select an element */
    selectElement?(elementId: string, addToSelection?: boolean): Promise<void>;
    /** Get the current diagram model */
    getModel?(): unknown;
    /** Get source ranges for outline↔diagram mapping */
    getSourceRanges?(): ReadonlyMap<string, { start: { line: number; character: number }; end: { line: number; character: number } }> | undefined;
    /** Get the SVG container element for drop handling */
    getSvgContainer?(): HTMLElement | undefined;
    /** Set whether the widget should auto-load the model during initialization */
    setAutoLoadModel?(enabled: boolean): void;
}

export namespace CompositeEditorWidget {
    export interface Options {
        uri: URI;
        manifest: GrammarManifest;
    }

    export interface State {
        activeView: 'text' | 'diagram';
        dockLayout?: DockPanel.ILayoutConfig;
    }
}

@injectable()
export class CompositeEditorWidget extends BaseWidget
    implements NavigatableWidget, SaveableSource, StatefulWidget {

    static readonly ID = COMPOSITE_EDITOR_WIDGET_FACTORY_ID;

    protected readonly logger = createLogger({ name: 'CompositeEditor' });

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    @inject(CanvasDropHandlerSymbol)
    protected readonly canvasDropHandler: CanvasDropHandler;

    @inject(TextEditorDropHandlerSymbol)
    protected readonly textEditorDropHandler: TextEditorDropHandler;

    readonly uri: URI;
    readonly manifest: GrammarManifest;

    protected diagramModelLoaded = false;

    /** Suppresses the onDirtyChanged diagram reload when an explicit reload is already in progress. */
    protected suppressAutoReload = false;

    protected textEditor: EditorWidget | undefined;
    protected diagramWidget: DiagramWidgetCapabilities | undefined;

    protected dockPanel: DockPanel;

    protected _activeView: 'text' | 'diagram' = 'text';

    protected readonly toDispose = new DisposableCollection();

    protected readonly onActiveViewChangedEmitter = new Emitter<'text' | 'diagram'>();
    readonly onActiveViewChanged: Event<'text' | 'diagram'> = this.onActiveViewChangedEmitter.event;

    /**
     * Bound listener that constrains drag operations to this composite editor.
     * Prevents tabs from being dragged out to the Theia shell's DockPanel.
     */
    protected readonly constrainDragListener = (event: globalThis.Event): void => {
        // Cast to access Lumino Drag.Event properties
        const dragEvent = event as globalThis.Event & { source?: unknown };
        if (dragEvent.source === this.dockPanel && !this.node.contains(event.target as Node)) {
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    };

    /**
     * Capture-phase listener for native HTML5 drag events from the sidebar palette.
     *
     * Theia's FrontendApplication (document-level) sets dropEffect='none' and
     * ApplicationShell (main DockPanel) sets dropEffect='link' + stopPropagation
     * on all native dragover/dragenter events. Since the palette drag source uses
     * effectAllowed='copy', the 'link' override makes the browser show the no-drop
     * cursor (incompatible effects).
     *
     * This capture-phase handler fires BEFORE any bubble-phase handler and
     * short-circuits the event when it carries our palette MIME type, ensuring
     * dropEffect stays 'copy'.
     */
    protected readonly paletteDragListener = (event: DragEvent): void => {
        const types = event.dataTransfer?.types;
        if (types && Array.from(types).includes(ELEMENT_PALETTE_DRAG_MIME_TYPE)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
            }
        }
    };

    /**
     * Capture-phase drop handler for palette drags.
     *
     * Handles the drop directly at the composite editor level instead of relying
     * on individual handlers that may not be initialized (due to timing — the SVG
     * container and Monaco DOM node may not be available when initialize() is
     * first called).
     */
    protected readonly paletteDropListener = (event: DragEvent): void => {
        const types = event.dataTransfer?.types;
        if (!types || !Array.from(types).includes(ELEMENT_PALETTE_DRAG_MIME_TYPE)) {
            return;
        }

        const dataStr = event.dataTransfer?.getData(ELEMENT_PALETTE_DRAG_MIME_TYPE);
        if (!dataStr) {
            return;
        }

        const dragData = decodeDragData(dataStr);
        if (!dragData) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const target = event.target as HTMLElement;
        const svgContainer = this.diagramWidget?.getSvgContainer?.();

        if (svgContainer && svgContainer.contains(target)) {
            this.handleCanvasDrop(event, dragData.elementTypeId);
        } else if (this.textEditor && this.textEditor.node.contains(target)) {
            this.handleTextEditorDrop(event, dragData);
        } else {
            this.logger.debug('Drop target not in diagram or text editor');
        }
    };

    constructor(
        protected readonly options: CompositeEditorWidget.Options
    ) {
        super();
        this.uri = options.uri;
        this.manifest = options.manifest;

        this.id = `${COMPOSITE_EDITOR_WIDGET_FACTORY_ID}:${options.uri.toString()}`;
        this.title.label = this.uri.path.base;
        this.title.caption = this.uri.path.toString();
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-file-code';

        this.addClass('sanyam-composite-editor');

        this.toDispose.push(this.onActiveViewChangedEmitter);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.createLayout();
        this.setupModelChangeSubscription();
    }

    /**
     * Subscribe to diagram model changes from the language server.
     */
    protected setupModelChangeSubscription(): void {
        // Subscribe to model updates
        const subscription = this.diagramLanguageClient.onModelUpdated((update) => {
            if (update.uri === this.uri.toString() && this.diagramWidget) {
                // Update positions and sizes if available
                if (update.metadata?.positions) {
                    this.diagramWidget.updatePositions?.(update.metadata.positions);
                }
                if (update.metadata?.sizes) {
                    this.diagramWidget.updateSizes?.(update.metadata.sizes);
                }
                // Update the model
                this.diagramWidget.setModel(update.gModel);
                this.diagramModelLoaded = true;

                // Initialize drop handler — model arrived via push, so loadDiagramModel() was skipped
                this.initializeCanvasDropHandler();
                this.initializeTextEditorDropHandler();
            }
        });
        this.toDispose.push(subscription);
    }

    get activeView(): 'text' | 'diagram' {
        return this._activeView;
    }

    /**
     * Get the embedded diagram widget (if created).
     * Used by commands to dispatch actions to the diagram.
     */
    getDiagramWidget(): DiagramWidgetCapabilities | undefined {
        return this.diagramWidget;
    }

    get saveable(): Saveable {
        if (this.textEditor) {
            return this.textEditor.saveable;
        }
        return {
            dirty: false,
            onDirtyChanged: Event.None,
            onContentChanged: Event.None,
            save: async () => {},
        };
    }

    getResourceUri(): URI | undefined {
        return this.uri;
    }

    createMoveToUri(resourceUri: URI): URI | undefined {
        return resourceUri;
    }

    storeState(): CompositeEditorWidget.State {
        return {
            activeView: this._activeView,
            dockLayout: this.dockPanel.saveLayout(),
        };
    }

    restoreState(state: CompositeEditorWidget.State): void {
        if (state.activeView && state.activeView !== this._activeView) {
            this.switchView(state.activeView);
        }
        if (state.dockLayout) {
            // Layout restore requires widgets to exist; kick off async restore
            this.restoreDockLayout(state.dockLayout).catch(error => {
                this.logger.error({ err: error }, 'Failed to restore dock layout');
            });
        }
    }

    /**
     * Asynchronously create widgets and restore a saved dock layout.
     */
    protected async restoreDockLayout(config: DockPanel.ILayoutConfig): Promise<void> {
        // Eagerly create both widgets so restoreLayout can find them
        if (!this.textEditor) {
            await this.createTextEditor();
        }
        if (this.manifest.diagrammingEnabled && !this.diagramWidget) {
            await this.createDiagramWidget();
        }
        this.dockPanel.restoreLayout(config);
    }

    protected createLayout(): void {
        const layout = new PanelLayout();
        this.layout = layout;

        this.dockPanel = new DockPanel({
            mode: 'multiple-document',
            spacing: 2,
        });
        this.dockPanel.tabsMovable = true;
        this.dockPanel.tabsConstrained = true;
        this.dockPanel.addClass('sanyam-composite-editor-dock');

        // Track active view when dock layout changes (tab selection, splits)
        this.dockPanel.layoutModified.connect(this.onDockLayoutModified, this);

        layout.addWidget(this.dockPanel);
    }

    /**
     * Handle dock layout modifications to track which view is active.
     */
    protected onDockLayoutModified(): void {
        // Determine active view from selected widgets in the dock panel
        const selectedWidgets = Array.from(this.dockPanel.selectedWidgets());
        let newActiveView: 'text' | 'diagram' = this._activeView;

        // If only one widget is selected, that's the active view
        // If both are selected (split mode), prefer the most recently focused
        if (selectedWidgets.length > 0) {
            const lastSelected = selectedWidgets[selectedWidgets.length - 1];
            if (lastSelected === this.textEditor) {
                newActiveView = 'text';
            } else if (lastSelected === this.diagramWidget) {
                newActiveView = 'diagram';
            }
        }

        if (newActiveView !== this._activeView) {
            this._activeView = newActiveView;
            this.onActiveViewChangedEmitter.fire(newActiveView);

            // Load diagram model on first activation via tab click.
            // Deferred with requestAnimationFrame to avoid spurious loads during
            // initializeViews() when addWidget fires layoutModified before activateWidget.
            if (newActiveView === 'diagram' && this.diagramWidget && !this.diagramModelLoaded) {
                requestAnimationFrame(() => {
                    if (this._activeView === 'diagram' && !this.diagramModelLoaded) {
                        this.loadDiagramModel().catch(error => {
                            this.logger.error({ err: error }, 'Failed to load diagram model on tab switch');
                        });
                    }
                });
            }
            // Re-initialize canvas drop handler when switching to diagram with model loaded
            // (SVG container may have been recreated after detach/reattach)
            if (newActiveView === 'diagram' && this.diagramModelLoaded) {
                this.initializeCanvasDropHandler();
            }

            // Trigger Monaco resize when switching back to text
            if (newActiveView === 'text') {
                this.triggerEditorResize();
            }
        }
    }

    async switchView(view: 'text' | 'diagram'): Promise<void> {
        if (view === this._activeView) {
            return;
        }

        if (view === 'diagram' && !this.manifest.diagrammingEnabled) {
            this.logger.warn('Diagramming not enabled for this grammar');
            return;
        }

        this._activeView = view;

        if (view === 'text') {
            await this.showTextView();
        } else {
            await this.showDiagramView();
        }

        this.onActiveViewChangedEmitter.fire(view);
        this.update();
    }

    protected async showTextView(): Promise<void> {
        if (!this.textEditor) {
            await this.createTextEditor();
        }

        if (this.textEditor) {
            if (!this.textEditor.isAttached) {
                this.dockPanel.addWidget(this.textEditor);
            }
            this.dockPanel.activateWidget(this.textEditor);
            this.triggerEditorResize();
        }
    }

    /**
     * Trigger resize on the embedded editor to ensure Monaco re-layouts properly.
     */
    protected triggerEditorResize(): void {
        if (this.textEditor && this.dockPanel) {
            // Use requestAnimationFrame to ensure DOM has settled
            requestAnimationFrame(() => {
                if (this.textEditor && this.isVisible && this.dockPanel) {
                    const rect = this.dockPanel.node.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const msg = new Widget.ResizeMessage(rect.width, rect.height);
                        MessageLoop.sendMessage(this.textEditor, msg);
                    }
                }
            });
        }
    }

    protected async showDiagramView(): Promise<void> {
        if (!this.diagramWidget) {
            await this.createDiagramWidget();
        }

        if (this.diagramWidget) {
            if (!this.diagramWidget.isAttached) {
                this.dockPanel.addWidget(this.diagramWidget);
            }
            this.dockPanel.activateWidget(this.diagramWidget);

            // Load diagram model if not already loaded
            if (!this.diagramModelLoaded) {
                await this.loadDiagramModel();
            }
        }
    }

    /**
     * Load the diagram model from the language server.
     */
    protected async loadDiagramModel(): Promise<void> {
        this.logger.debug({ uri: this.uri.toString() }, 'loadDiagramModel called');
        if (!this.diagramWidget) {
            this.logger.warn('No diagram widget available');
            return;
        }

        // Show loading state only for the initial load.
        // After Sprotty has rendered, showLoading() would destroy the SVG DOM
        // tree and invalidate Snabbdom's internal VNode references — causing
        // subsequent setModel() calls to patch disconnected elements.
        if (!this.diagramModelLoaded) {
            this.diagramWidget.showLoading?.();
        }

        try {
            this.logger.debug('Calling diagramLanguageClient.loadModel...');
            const response = await this.diagramLanguageClient.loadModel(this.uri.toString());
            this.logger.debug({
                success: response.success,
                hasGModel: !!response.gModel,
                childCount: response.gModel?.children?.length ?? 0,
                error: response.error,
            }, 'loadModel response');

            if (response.success && response.gModel) {
                this.diagramModelLoaded = true;

                // Update positions and sizes if available
                if (response.metadata?.positions) {
                    const positionsMap = new Map(Object.entries(response.metadata.positions));
                    this.diagramWidget.updatePositions?.(positionsMap);
                }
                if (response.metadata?.sizes) {
                    const sizesMap = new Map(Object.entries(response.metadata.sizes));
                    this.diagramWidget.updateSizes?.(sizesMap);
                }

                // Set the model
                this.diagramWidget.setModel(response.gModel);

                // Initialize drop handler for sidebar element palette
                this.initializeCanvasDropHandler();
            } else {
                // Handle error - response.error might be an object (JSON-RPC error format)
                let errorMsg: string;
                if (response.error === undefined || response.error === null) {
                    errorMsg = 'Failed to load diagram model';
                } else if (typeof response.error === 'string') {
                    errorMsg = response.error;
                } else if (typeof response.error === 'object') {
                    const errObj = response.error as { message?: string; code?: number };
                    errorMsg = errObj.message || JSON.stringify(response.error);
                } else {
                    errorMsg = String(response.error);
                }
                this.logger.error({ rawError: response.error, errorType: typeof response.error }, 'Model load failed');
                this.diagramWidget.showError?.(errorMsg);
            }
        } catch (error) {
            this.logger.error({ err: error }, 'Error loading diagram model');
            this.diagramWidget.showError?.(error instanceof Error ? error.message : 'Failed to load diagram model');
        }
    }

    /**
     * Reload the diagram model (e.g., after text changes).
     */
    async reloadDiagramModel(): Promise<void> {
        this.diagramModelLoaded = false;
        if (this._activeView === 'diagram') {
            await this.loadDiagramModel();
        }
    }

    /**
     * Initialize the canvas drop handler for sidebar element palette drag-and-drop.
     */
    protected initializeCanvasDropHandler(): void {
        if (!this.diagramWidget) {
            return;
        }

        // Get the SVG container from the diagram widget
        const svgContainer = this.diagramWidget.getSvgContainer?.();
        if (svgContainer) {
            this.canvasDropHandler.initialize(svgContainer, this.uri.toString());
            this.logger.debug('Canvas drop handler initialized');
        } else {
            this.logger.warn('SVG container not available for drop handler');
        }
    }

    /**
     * Initialize the text editor drop handler for sidebar element palette drag-and-drop.
     */
    protected initializeTextEditorDropHandler(): void {
        if (!this.textEditor) {
            return;
        }

        // Get the Monaco editor instance from the Theia EditorWidget
        const monacoEditor = (this.textEditor as any).editor?.getControl?.();
        if (!monacoEditor) {
            this.logger.warn('Monaco editor not available for text drop handler');
            return;
        }

        // Get the editor DOM node
        const domNode = monacoEditor.getDomNode?.() as HTMLElement | null;
        if (domNode) {
            this.textEditorDropHandler.initialize(domNode, monacoEditor, this.uri.toString());

            // Wire up post-operation callback: apply returned text edits,
            // save the file to disk, and invalidate the diagram model so
            // it reloads from the updated content on the next tab switch.
            this.textEditorDropHandler.onOperationComplete = async (response) => {
                if (response.success && response.edits?.length) {
                    this.applyTextEdits(response.edits);
                    try {
                        await this.textEditor?.saveable?.save();
                    } catch (saveError) {
                        this.logger.error(`Failed to save after text editor drop: ${saveError}`);
                    }
                    this.diagramModelLoaded = false;
                }
            };

            this.logger.debug('Text editor drop handler initialized');
        } else {
            this.logger.warn('Monaco editor DOM node not available for text drop handler');
        }
    }

    /**
     * Handle a palette drop on the diagram canvas.
     * Converts screen coordinates to model coordinates and creates a node.
     */
    protected handleCanvasDrop(event: DragEvent, elementTypeId: string): void {
        const svgContainer = this.diagramWidget?.getSvgContainer?.();
        if (!svgContainer) {
            this.logger.warn('SVG container not available for canvas drop');
            return;
        }

        // Convert screen coordinates to model coordinates via SVG CTM
        const svgElement = svgContainer.querySelector('svg') as SVGSVGElement | null;
        if (!svgElement) {
            this.logger.warn('SVG element not found for coordinate conversion');
            return;
        }

        const point = svgElement.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const ctm = svgElement.getScreenCTM();
        if (!ctm) {
            this.logger.warn('Could not get screen CTM for coordinate conversion');
            return;
        }
        const svgPoint = point.matrixTransform(ctm.inverse());

        this.logger.info({ elementTypeId, x: svgPoint.x, y: svgPoint.y }, 'Canvas drop: creating element');
        this.diagramLanguageClient.executeOperation(this.uri.toString(), {
            kind: 'createNode',
            elementTypeId,
            location: { x: svgPoint.x, y: svgPoint.y },
        }).then(async response => {
            if (response.success && response.edits?.length) {
                this.applyTextEdits(response.edits);
                // Save the file so the backend can re-read from disk, then
                // reload the diagram model to show the newly created element.
                // Suppress the onDirtyChanged auto-reload to avoid a double load.
                this.suppressAutoReload = true;
                try {
                    await this.textEditor?.saveable?.save();
                    // Brief delay to let the backend re-parse the saved file
                    // before requesting the updated model
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await this.loadDiagramModel();
                } catch (reloadError) {
                    this.logger.error(`Failed to reload diagram after canvas drop: ${reloadError}`);
                } finally {
                    this.suppressAutoReload = false;
                }
            } else if (!response.success) {
                this.logger.error(`Canvas drop operation failed: ${response.error ?? 'unknown error'}`);
            }
        }).catch(error => {
            this.logger.error(`Failed to create element from canvas drop: ${error}`);
        });
    }

    /**
     * Handle a palette drop on the text editor.
     * Resolves the text position at the drop point and creates a node.
     */
    protected handleTextEditorDrop(
        event: DragEvent,
        dragData: { elementTypeId: string; kind?: string }
    ): void {
        // Reject edges — they need two endpoints
        if (dragData.kind === 'createEdge') {
            this.logger.debug('Rejected edge drop on text editor');
            return;
        }

        // Get Monaco editor to resolve text position
        const monacoEditor = (this.textEditor as any)?.editor?.getControl?.() as {
            getTargetAtClientPoint?(clientX: number, clientY: number): {
                position?: { lineNumber: number; column: number };
            } | null;
        } | null;

        let insertPosition: { line: number; character: number } | undefined;

        if (monacoEditor?.getTargetAtClientPoint) {
            const target = monacoEditor.getTargetAtClientPoint(event.clientX, event.clientY);
            if (target?.position) {
                // Monaco is 1-based, LSP is 0-based
                insertPosition = {
                    line: target.position.lineNumber - 1,
                    character: target.position.column - 1,
                };
            }
        }

        this.logger.info({
            elementTypeId: dragData.elementTypeId,
            insertPosition,
        }, 'Text editor drop: creating element');

        this.diagramLanguageClient.executeOperation(this.uri.toString(), {
            kind: 'createNode',
            elementTypeId: dragData.elementTypeId,
            args: insertPosition ? { insertAtPosition: insertPosition } : undefined,
        }).then(async response => {
            if (response.success && response.edits?.length) {
                this.applyTextEdits(response.edits);
                // Save the file so the on-disk content is up to date.
                // Invalidate the diagram model so it reloads from disk the
                // next time the user switches to the Diagram tab (the lazy
                // load handler at tab-switch time will call loadDiagramModel).
                try {
                    await this.textEditor?.saveable?.save();
                } catch (saveError) {
                    this.logger.error(`Failed to save after text editor drop: ${saveError}`);
                }
                this.diagramModelLoaded = false;
            } else if (!response.success) {
                this.logger.error(`Text editor drop operation failed: ${response.error ?? 'unknown error'}`);
            }
        }).catch(error => {
            this.logger.error(`Failed to create element from text editor drop: ${error}`);
        });
    }

    /**
     * Apply text edits returned from a server operation to the Monaco editor.
     * LSP positions are 0-based; Monaco positions are 1-based.
     *
     * When the diagram tab is active, the Monaco editor may be detached from
     * the DOM and `getModel()` returns null.  In that case we fall back to
     * `textEditorModel.pushEditOperations()` which operates on the in-memory
     * text model directly and correctly marks it as dirty.
     */
    protected applyTextEdits(edits: TextEdit[]): void {
        if (!this.textEditor) {
            this.logger.warn('Cannot apply text edits: text editor not available');
            return;
        }

        const monacoEdits = edits.map(edit => ({
            range: {
                startLineNumber: edit.range.start.line + 1,
                startColumn: edit.range.start.character + 1,
                endLineNumber: edit.range.end.line + 1,
                endColumn: edit.range.end.character + 1,
            },
            text: edit.newText,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monacoEditor = (this.textEditor as any)?.editor?.getControl?.();

        // Try the editor's executeEdits first (works when the editor has a model).
        if (monacoEditor?.executeEdits) {
            const success = monacoEditor.executeEdits('sanyam-palette-drop', monacoEdits);
            if (success) {
                return;
            }
        }

        // Fallback: the editor is hidden (diagram tab active) so getModel()
        // returns null.  Apply edits directly on the underlying text model.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textModel = (this.textEditor as any)?.editor?.document?.textEditorModel;
        if (textModel?.pushEditOperations) {
            textModel.pushEditOperations(
                [],
                monacoEdits.map((e: { range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }) => ({
                    range: e.range,
                    text: e.text,
                    forceMoveMarkers: true,
                })),
                () => null,
            );
        } else {
            this.logger.warn('Cannot apply text edits: no model available on editor or document');
        }
    }

    /**
     * Reload the diagram model after the text file has been saved.
     * The backend service will re-read the file from disk.
     */
    protected async reloadDiagramModelAfterSave(): Promise<void> {
        this.logger.debug('Text file saved, reloading diagram model');
        await this.loadDiagramModel();
    }

    protected async createTextEditor(): Promise<void> {
        try {
            const editor = await this.editorManager.getOrCreateByUri(this.uri);

            if (editor) {
                this.textEditor = editor;
                this.textEditor.addClass('sanyam-composite-text-editor');
                this.textEditor.title.label = 'Text';
                this.textEditor.title.iconClass = 'codicon codicon-file-code';
                this.textEditor.title.closable = false;

                this.toDispose.push(this.textEditor.saveable.onDirtyChanged(() => {
                    const isDirty = this.textEditor?.saveable.dirty ?? false;
                    this.setDirty(isDirty);

                    // When dirty transitions to false, the file was saved.
                    // Reload the diagram model so it reflects the new text content.
                    // Skip if suppressAutoReload is set (canvas drop path handles
                    // the reload explicitly to avoid a double load).
                    if (!isDirty && this.diagramModelLoaded && !this.suppressAutoReload) {
                        this.reloadDiagramModelAfterSave();
                    }
                }));

                this.toDispose.push({
                    dispose: () => {
                        if (this.textEditor) {
                            this.textEditor.close();
                        }
                    }
                });

                // Initialize text editor drop handler for sidebar palette drag-and-drop
                this.initializeTextEditorDropHandler();
            }
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to create text editor');
        }
    }

    protected async createDiagramWidget(): Promise<void> {
        try {
            // Use the local factory ID directly - now in the same package
            const widget = await this.widgetManager.getOrCreateWidget<DiagramWidgetCapabilities>(
                DIAGRAM_WIDGET_FACTORY_ID,
                {
                    uri: this.uri.toString(),
                    diagramType: `sanyam:${this.manifest.languageId}`,
                }
            );

            if (widget) {
                this.diagramWidget = widget;
                // Disable auto-load: CompositeEditorWidget manages when to load the model
                this.diagramWidget.setAutoLoadModel?.(false);
                this.diagramWidget.addClass('sanyam-composite-diagram');
                this.diagramWidget.title.label = 'Diagram';
                this.diagramWidget.title.iconClass = 'codicon codicon-type-hierarchy';
                this.diagramWidget.title.closable = false;

                this.toDispose.push({
                    dispose: () => {
                        if (this.diagramWidget) {
                            this.diagramWidget.close();
                        }
                    }
                });
            }
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to create diagram widget');
        }
    }

    updateDiagramModel(gModel: GModelRoot): void {
        if (this.diagramWidget) {
            this.diagramWidget.setModel(gModel);
        }
    }

    protected setDirty(dirty: boolean): void {
        if (dirty) {
            if (!this.title.label.endsWith(' *')) {
                this.title.label = this.title.label + ' *';
            }
        } else {
            if (this.title.label.endsWith(' *')) {
                this.title.label = this.title.label.slice(0, -2);
            }
        }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);

        if (this._activeView === 'text' && this.textEditor) {
            this.dockPanel.activateWidget(this.textEditor);
        } else if (this._activeView === 'diagram' && this.diagramWidget) {
            this.dockPanel.activateWidget(this.diagramWidget);
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        // Constrain drag operations: capture lm-dragenter on document to prevent
        // the Theia shell from accepting tabs dragged from our DockPanel.
        document.addEventListener('lm-dragenter', this.constrainDragListener, true);
        document.addEventListener('lm-dragover', this.constrainDragListener, true);
        document.addEventListener('lm-drop', this.constrainDragListener, true);

        // Intercept native palette drag events in capture phase so Theia's
        // ApplicationShell/FrontendApplication handlers cannot override dropEffect.
        this.node.addEventListener('dragover', this.paletteDragListener, true);
        this.node.addEventListener('dragenter', this.paletteDragListener, true);
        this.node.addEventListener('drop', this.paletteDropListener, true);

        this.initializeViews();
    }

    protected onBeforeDetach(msg: Message): void {
        document.removeEventListener('lm-dragenter', this.constrainDragListener, true);
        document.removeEventListener('lm-dragover', this.constrainDragListener, true);
        document.removeEventListener('lm-drop', this.constrainDragListener, true);
        this.node.removeEventListener('dragover', this.paletteDragListener, true);
        this.node.removeEventListener('dragenter', this.paletteDragListener, true);
        this.node.removeEventListener('drop', this.paletteDropListener, true);
        super.onBeforeDetach(msg);
    }

    /**
     * Eagerly create and add both widgets to the DockPanel so both tabs appear.
     */
    protected async initializeViews(): Promise<void> {
        await this.showTextView();
        if (this.manifest.diagrammingEnabled) {
            if (!this.diagramWidget) {
                await this.createDiagramWidget();
            }
            if (this.diagramWidget && !this.diagramWidget.isAttached) {
                this.dockPanel.addWidget(this.diagramWidget);
            }
            // Ensure the text editor is the active tab
            if (this.textEditor) {
                this.dockPanel.activateWidget(this.textEditor);
            }
        }
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);

        if (this._activeView === 'text' && this.textEditor) {
            this.triggerEditorResize();
        }
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        // DockPanel propagates resize to its children automatically
        MessageLoop.sendMessage(this.dockPanel, msg);
    }

    dispose(): void {
        document.removeEventListener('lm-dragenter', this.constrainDragListener, true);
        document.removeEventListener('lm-dragover', this.constrainDragListener, true);
        document.removeEventListener('lm-drop', this.constrainDragListener, true);
        this.node.removeEventListener('dragover', this.paletteDragListener, true);
        this.node.removeEventListener('dragenter', this.paletteDragListener, true);
        this.node.removeEventListener('drop', this.paletteDropListener, true);
        this.dockPanel.layoutModified.disconnect(this.onDockLayoutModified, this);
        this.canvasDropHandler.cleanup();
        this.textEditorDropHandler.cleanup();
        this.toDispose.dispose();
        super.dispose();
    }
}

@injectable()
export class CompositeEditorWidgetFactory {
    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    @inject(CanvasDropHandlerSymbol)
    protected readonly canvasDropHandler: CanvasDropHandler;

    @inject(TextEditorDropHandlerSymbol)
    protected readonly textEditorDropHandler: TextEditorDropHandler;

    createWidget(options: CompositeEditorWidget.Options): CompositeEditorWidget {
        const widget = new CompositeEditorWidget(options);
        (widget as any).editorManager = this.editorManager;
        (widget as any).widgetManager = this.widgetManager;
        (widget as any).shell = this.shell;
        (widget as any).diagramLanguageClient = this.diagramLanguageClient;
        (widget as any).canvasDropHandler = this.canvasDropHandler;
        (widget as any).textEditorDropHandler = this.textEditorDropHandler;
        widget['init']();
        return widget;
    }
}
