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
    BoxLayout,
    BoxPanel,
    StatefulWidget,
    Saveable,
    SaveableSource,
    NavigatableWidget,
    ApplicationShell,
    WidgetManager,
} from '@theia/core/lib/browser';
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
}

export namespace CompositeEditorWidget {
    export interface Options {
        uri: URI;
        manifest: GrammarManifest;
    }

    export interface State {
        activeView: 'text' | 'diagram';
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

    protected toggleBar: HTMLDivElement | undefined;
    protected contentPanel: BoxPanel | undefined;

    protected _activeView: 'text' | 'diagram' = 'text';

    protected readonly toDispose = new DisposableCollection();

    protected readonly onActiveViewChangedEmitter = new Emitter<'text' | 'diagram'>();
    readonly onActiveViewChanged: Event<'text' | 'diagram'> = this.onActiveViewChangedEmitter.event;

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
        };
    }

    restoreState(state: CompositeEditorWidget.State): void {
        if (state.activeView && state.activeView !== this._activeView) {
            this.switchView(state.activeView);
        }
    }

    protected createLayout(): void {
        // Use vertical BoxLayout: [content panel] [tab bar at bottom]
        const layout = new BoxLayout({ direction: 'top-to-bottom' });
        this.layout = layout;

        // Content panel holds the editor/diagram widgets - takes all available space
        this.contentPanel = new BoxPanel({ direction: 'top-to-bottom' });
        this.contentPanel.addClass('sanyam-composite-editor-content');
        BoxLayout.setStretch(this.contentPanel, 1);

        // Tab bar widget at the bottom
        const tabBarWidget = new Widget();
        tabBarWidget.addClass('sanyam-composite-editor-tab-bar');
        this.toggleBar = tabBarWidget.node as HTMLDivElement;
        this.createToggleButtons();
        BoxLayout.setSizeBasis(tabBarWidget, 32);
        BoxLayout.setStretch(tabBarWidget, 0);

        layout.addWidget(this.contentPanel);
        layout.addWidget(tabBarWidget);
    }

    protected createToggleButtons(): void {
        if (!this.toggleBar) {
            return;
        }

        const textTab = this.createTab('text', 'codicon-file-code', 'Text');
        const diagramTab = this.createTab('diagram', 'codicon-type-hierarchy', 'Diagram');

        textTab.classList.add('active');

        if (!this.manifest.diagrammingEnabled) {
            diagramTab.classList.add('disabled');
            diagramTab.title = 'Diagramming not enabled for this grammar';
        }

        this.toggleBar.appendChild(textTab);
        this.toggleBar.appendChild(diagramTab);
    }

    protected createTab(
        view: 'text' | 'diagram',
        iconClass: string,
        label: string
    ): HTMLDivElement {
        const tab = document.createElement('div');
        tab.className = 'sanyam-editor-tab';
        tab.dataset['view'] = view;
        tab.title = `${label} View`;

        // Icon
        const icon = document.createElement('span');
        icon.className = `sanyam-editor-tab-icon codicon ${iconClass}`;
        tab.appendChild(icon);

        // Label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'sanyam-editor-tab-label';
        labelSpan.textContent = label;
        tab.appendChild(labelSpan);

        tab.addEventListener('click', () => {
            if (view === 'diagram' && !this.manifest.diagrammingEnabled) {
                return;
            }
            this.switchView(view);
        });

        return tab;
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
        this.updateToggleButtons();

        if (view === 'text') {
            await this.showTextView();
        } else {
            await this.showDiagramView();
        }

        this.onActiveViewChangedEmitter.fire(view);
        this.update();
    }

    protected updateToggleButtons(): void {
        if (!this.toggleBar) {
            return;
        }

        const tabs = this.toggleBar.querySelectorAll('.sanyam-editor-tab');
        tabs.forEach(tab => {
            const tabView = (tab as HTMLElement).dataset['view'];
            if (tabView === this._activeView) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    protected async showTextView(): Promise<void> {
        if (this.diagramWidget) {
            this.diagramWidget.hide();
        }

        if (!this.textEditor) {
            await this.createTextEditor();
        }

        if (this.textEditor && this.contentPanel) {
            // Ensure editor is in the content panel
            if (!this.textEditor.isAttached || this.textEditor.parent !== this.contentPanel) {
                this.contentPanel.addWidget(this.textEditor);
                BoxLayout.setStretch(this.textEditor, 1);
            }
            this.textEditor.show();
            // Trigger Monaco editor re-layout
            this.triggerEditorResize();
        }
    }

    /**
     * Trigger resize on the embedded editor to ensure Monaco re-layouts properly.
     */
    protected triggerEditorResize(): void {
        if (this.textEditor && this.contentPanel) {
            // Use requestAnimationFrame to ensure DOM has settled
            requestAnimationFrame(() => {
                if (this.textEditor && this.isVisible && this.contentPanel) {
                    const rect = this.contentPanel.node.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const msg = new Widget.ResizeMessage(rect.width, rect.height);
                        MessageLoop.sendMessage(this.textEditor, msg);
                    }
                }
            });
        }
    }

    protected async showDiagramView(): Promise<void> {
        if (this.textEditor) {
            this.textEditor.hide();
        }

        if (!this.diagramWidget) {
            await this.createDiagramWidget();
        }

        if (this.diagramWidget && this.contentPanel) {
            // Ensure diagram widget is in the content panel
            if (!this.diagramWidget.isAttached || this.diagramWidget.parent !== this.contentPanel) {
                this.contentPanel.addWidget(this.diagramWidget);
                BoxLayout.setStretch(this.diagramWidget, 1);
            }
            this.diagramWidget.show();

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

    protected async createTextEditor(): Promise<void> {
        try {
            const editor = await this.editorManager.getOrCreateByUri(this.uri);

            if (editor) {
                this.textEditor = editor;
                this.textEditor.addClass('sanyam-composite-text-editor');

                this.toDispose.push(this.textEditor.saveable.onDirtyChanged(() => {
                    this.setDirty(this.textEditor?.saveable.dirty ?? false);
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
            this.textEditor.activate();
        } else if (this._activeView === 'diagram' && this.diagramWidget) {
            this.diagramWidget.activate();
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.showTextView();
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);

        if (this._activeView === 'text' && this.textEditor) {
            this.textEditor.show();
            this.triggerEditorResize();
        } else if (this._activeView === 'diagram' && this.diagramWidget) {
            this.diagramWidget.show();
        }
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);

        if (this.textEditor && this._activeView === 'text') {
            MessageLoop.sendMessage(this.textEditor, msg);
        }
        if (this.diagramWidget && this._activeView === 'diagram') {
            MessageLoop.sendMessage(this.diagramWidget, msg);
        }
    }

    dispose(): void {
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
