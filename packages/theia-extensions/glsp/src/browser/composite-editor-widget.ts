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
import { DiagramLanguageClient } from './diagram-language-client';

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

    readonly uri: URI;
    readonly manifest: GrammarManifest;

    protected diagramModelLoaded = false;

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

            // Load diagram model on first activation via tab click
            if (newActiveView === 'diagram' && this.diagramWidget && !this.diagramModelLoaded) {
                this.loadDiagramModel().catch(error => {
                    this.logger.error({ err: error }, 'Failed to load diagram model on tab switch');
                });
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

        // Show loading state
        this.diagramWidget.showLoading?.();

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
            } else {
                this.diagramWidget.showError?.(response.error || 'Failed to load diagram model');
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
                    if (!isDirty && this.diagramModelLoaded) {
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
        this.initializeViews();
    }

    protected onBeforeDetach(msg: Message): void {
        document.removeEventListener('lm-dragenter', this.constrainDragListener, true);
        document.removeEventListener('lm-dragover', this.constrainDragListener, true);
        document.removeEventListener('lm-drop', this.constrainDragListener, true);
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
        this.dockPanel.layoutModified.disconnect(this.onDockLayoutModified, this);
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

    createWidget(options: CompositeEditorWidget.Options): CompositeEditorWidget {
        const widget = new CompositeEditorWidget(options);
        (widget as any).editorManager = this.editorManager;
        (widget as any).widgetManager = this.widgetManager;
        (widget as any).shell = this.shell;
        (widget as any).diagramLanguageClient = this.diagramLanguageClient;
        widget['init']();
        return widget;
    }
}
