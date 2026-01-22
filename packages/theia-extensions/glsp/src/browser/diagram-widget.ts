/**
 * Diagram Widget (T084)
 *
 * Widget for rendering GLSP diagrams in Theia using Sprotty.
 * Handles diagram rendering, user interactions, and synchronization.
 *
 * @packageDocumentation
 */

import { injectable, postConstruct, inject } from 'inversify';
import { Widget, BaseWidget, Message } from '@theia/core/lib/browser';
import { Emitter, Event, DisposableCollection } from '@theia/core/lib/common';
import { PreferenceService, PreferenceChange } from '@theia/core/lib/common/preferences/preference-service';
import URI from '@theia/core/lib/common/uri';
import { DIAGRAM_WIDGET_FACTORY_ID_STRING } from '@sanyam/types';
import type { GModelRoot as GModelRootType, GModelElement as GModelElementType } from '@sanyam/types';

// Sprotty imports
import {
    SprottyDiagramManager,
    DiagramEventCallbacks,
    GModelRoot,
    Action,
} from './di/sprotty-di-config';

// Preferences
import { DiagramPreferences, DiagramBackgroundStyle } from './diagram-preferences';

/**
 * Factory ID for diagram widgets.
 * Re-exported from @sanyam/types for backwards compatibility.
 */
export const DIAGRAM_WIDGET_FACTORY_ID = DIAGRAM_WIDGET_FACTORY_ID_STRING;

/**
 * Options for creating a diagram widget.
 */
export namespace DiagramWidget {
    export interface Options {
        /** URI of the source document */
        uri: string;
        /** Diagram type identifier */
        diagramType: string;
        /** Optional label override */
        label?: string;
    }
}

/**
 * GModel element base interface.
 * @deprecated Use GModelElement from @sanyam/types instead.
 */
export interface GModelElement {
    id: string;
    type: string;
    children?: GModelElement[];
}

/**
 * Point type.
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * Dimension type.
 */
export interface Dimension {
    width: number;
    height: number;
}

/**
 * Selection state.
 */
export interface SelectionState {
    selectedIds: string[];
    hoveredId?: string;
}

/**
 * Diagram state.
 */
export interface DiagramState {
    gModel?: GModelRootType;
    positions: Map<string, Point>;
    sizes: Map<string, Dimension>;
    selection: SelectionState;
    viewport: {
        scroll: Point;
        zoom: number;
    };
}

/**
 * Events emitted by the diagram widget.
 */
export interface DiagramWidgetEvents {
    onModelChanged: Event<GModelRootType>;
    onSelectionChanged: Event<SelectionState>;
    onOperationRequested: Event<{ operation: any }>;
}

/**
 * Diagram widget for rendering GLSP diagrams using Sprotty.
 *
 * This widget:
 * - Renders GModel using Sprotty for interactive diagrams
 * - Provides drag, selection, zoom, and pan via Sprotty
 * - Communicates with the GLSP server for operations
 * - Synchronizes with text document changes
 */
@injectable()
export class DiagramWidget extends BaseWidget implements DiagramWidgetEvents {
    static readonly ID = DIAGRAM_WIDGET_FACTORY_ID;

    /** Source document URI */
    readonly uri: string;

    /** Diagram type */
    readonly diagramType: string;

    /** Current diagram state */
    protected state: DiagramState = {
        positions: new Map(),
        sizes: new Map(),
        selection: { selectedIds: [] },
        viewport: { scroll: { x: 0, y: 0 }, zoom: 1 },
    };

    /** Disposables */
    protected readonly toDispose = new DisposableCollection();

    /** Event emitters */
    protected readonly onModelChangedEmitter = new Emitter<GModelRootType>();
    protected readonly onSelectionChangedEmitter = new Emitter<SelectionState>();
    protected readonly onOperationRequestedEmitter = new Emitter<{ operation: any }>();

    /** Event accessors */
    readonly onModelChanged = this.onModelChangedEmitter.event;
    readonly onSelectionChanged = this.onSelectionChangedEmitter.event;
    readonly onOperationRequested = this.onOperationRequestedEmitter.event;

    /** Sprotty diagram manager */
    protected sprottyManager: SprottyDiagramManager | undefined;

    /** SVG container element (used by Sprotty) */
    protected svgContainer: HTMLDivElement | undefined;

    /** Tool palette element */
    protected toolPalette: HTMLDivElement | undefined;

    /** Flag indicating if Sprotty has been initialized */
    protected sprottyInitialized = false;

    /** Preference service for reading diagram preferences */
    protected preferenceService: PreferenceService | undefined;

    /** Current background style */
    protected currentBackgroundStyle: DiagramBackgroundStyle = 'dots';

    constructor(
        protected readonly options: DiagramWidget.Options
    ) {
        super();
        this.uri = options.uri;
        this.diagramType = options.diagramType;

        this.id = `${DIAGRAM_WIDGET_FACTORY_ID}:${options.uri}`;
        this.title.label = options.label ?? this.getDefaultLabel();
        this.title.caption = options.uri;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-project-diagram';

        this.addClass('sanyam-diagram-widget');

        this.toDispose.push(this.onModelChangedEmitter);
        this.toDispose.push(this.onSelectionChangedEmitter);
        this.toDispose.push(this.onOperationRequestedEmitter);
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    /**
     * Set the preference service and subscribe to preference changes.
     */
    setPreferenceService(preferenceService: PreferenceService): void {
        this.preferenceService = preferenceService;

        // Apply initial background style
        this.applyBackgroundPreferences();

        // Subscribe to preference changes
        this.toDispose.push(
            preferenceService.onPreferenceChanged((event: PreferenceChange) => {
                if (event.preferenceName.startsWith('diagram.')) {
                    this.applyBackgroundPreferences();
                }
            })
        );
    }

    /**
     * Apply background preferences to the diagram container.
     */
    protected applyBackgroundPreferences(): void {
        if (!this.svgContainer || !this.preferenceService) {
            return;
        }

        // Get preference values
        const style = this.preferenceService.get<DiagramBackgroundStyle>(
            DiagramPreferences.BACKGROUND_STYLE,
            'dots'
        );
        const imagePath = this.preferenceService.get<string>(
            DiagramPreferences.BACKGROUND_IMAGE_PATH,
            ''
        );
        const patternOpacity = this.preferenceService.get<number>(
            DiagramPreferences.PATTERN_OPACITY,
            0.3
        );
        const gridSize = this.preferenceService.get<number>(
            DiagramPreferences.GRID_SIZE,
            20
        );
        const dotsSize = this.preferenceService.get<number>(
            DiagramPreferences.DOTS_SIZE,
            1
        );
        const dotsSpacing = this.preferenceService.get<number>(
            DiagramPreferences.DOTS_SPACING,
            20
        );

        // Remove existing background classes
        this.svgContainer.classList.remove('bg-none', 'bg-dots', 'bg-grid', 'bg-image');

        // Add the appropriate class
        this.svgContainer.classList.add(`bg-${style}`);

        // Apply pattern opacity
        this.svgContainer.style.setProperty('--diagram-pattern-opacity', String(patternOpacity));

        // Determine if we're in a light or dark theme
        const isLightTheme = document.body.classList.contains('theia-light');

        // Apply theme-aware pattern colors with opacity
        // Dark theme: light gray patterns, Light theme: dark patterns
        const patternColorBase = isLightTheme ? '0, 0, 0' : '128, 128, 128';
        const patternColorWithOpacity = `rgba(${patternColorBase}, ${patternOpacity})`;

        this.svgContainer.style.setProperty('--diagram-dots-color', patternColorWithOpacity);
        this.svgContainer.style.setProperty('--diagram-grid-color', patternColorWithOpacity);

        // Apply dots settings
        this.svgContainer.style.setProperty('--diagram-dots-size', `${dotsSize}px`);
        this.svgContainer.style.setProperty('--diagram-dots-spacing', `${dotsSpacing}px`);

        // Apply grid settings
        this.svgContainer.style.setProperty('--diagram-grid-size', `${gridSize}px`);

        // Handle custom image background
        if (style === 'image' && imagePath) {
            // Convert file path to URL format
            const imageUrl = this.convertPathToUrl(imagePath);
            this.svgContainer.style.setProperty('--diagram-image-url', `url('${imageUrl}')`);
        } else {
            this.svgContainer.style.removeProperty('--diagram-image-url');
        }

        this.currentBackgroundStyle = style;
        console.log(`[DiagramWidget] Applied background style: ${style}, opacity: ${patternOpacity}`);
    }

    /**
     * Convert a file path to a URL suitable for CSS.
     */
    protected convertPathToUrl(path: string): string {
        // If already a URL (file:// or http://), return as-is
        if (path.startsWith('file://') || path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        // Convert local path to file:// URL
        // Handle Windows paths (C:\...) and Unix paths (/...)
        if (path.startsWith('/')) {
            return `file://${path}`;
        } else if (/^[A-Za-z]:/.test(path)) {
            // Windows path - convert backslashes and add file:///
            return `file:///${path.replace(/\\/g, '/')}`;
        }

        // Return as-is for relative paths or other formats
        return path;
    }

    /**
     * Get default label from URI.
     */
    protected getDefaultLabel(): string {
        const uri = new URI(this.uri);
        return `${uri.path.base} (Diagram)`;
    }

    /**
     * Called when widget is attached to DOM.
     */
    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.createDiagramContainer();
        this.initializeSprotty();
    }

    /**
     * Called when widget is shown.
     */
    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.refresh();
    }

    /**
     * Called when widget is resized.
     */
    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        // Sprotty handles resize automatically via CSS
    }

    /**
     * Create the diagram container elements.
     */
    protected createDiagramContainer(): void {
        // Create main container
        const container = document.createElement('div');
        container.className = 'sanyam-diagram-container';

        // Create tool palette
        this.toolPalette = document.createElement('div');
        this.toolPalette.className = 'sanyam-diagram-tool-palette';
        container.appendChild(this.toolPalette);

        // Create SVG container for Sprotty
        this.svgContainer = document.createElement('div');
        this.svgContainer.className = 'sanyam-diagram-svg-container bg-dots'; // Default to dots pattern
        this.svgContainer.id = `sprotty-${this.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
        container.appendChild(this.svgContainer);

        // Apply background preferences if preference service is available
        if (this.preferenceService) {
            this.applyBackgroundPreferences();
        }

        // Create hidden container for Sprotty measurements
        const hiddenContainer = document.createElement('div');
        hiddenContainer.id = `${this.svgContainer.id}-hidden`;
        hiddenContainer.className = 'sprotty-hidden';
        container.appendChild(hiddenContainer);

        this.node.appendChild(container);

        // Show placeholder initially
        this.showPlaceholder();
    }

    /**
     * Initialize Sprotty diagram rendering.
     */
    protected async initializeSprotty(): Promise<void> {
        if (this.sprottyInitialized || !this.svgContainer) {
            return;
        }

        try {
            // Create Sprotty diagram manager with UI extensions enabled
            this.sprottyManager = new SprottyDiagramManager({
                diagramId: this.svgContainer.id,
                needsMoveAction: true,
                uiExtensions: {
                    enableToolPalette: true,
                    enableValidation: true,
                    enableEditLabel: true,
                    enableCommandPalette: true,
                    enableEdgeCreation: true,
                    enableHelperLines: true,
                    enableMarqueeSelection: true,
                    enableResizeHandles: true,
                    enablePopup: true,
                    enableMinimap: true,
                },
            });

            // Set up event callbacks
            const callbacks: DiagramEventCallbacks = {
                onSelectionChanged: (selectedIds) => {
                    this.state.selection.selectedIds = selectedIds;
                    this.onSelectionChangedEmitter.fire(this.state.selection);
                },
                onMoveCompleted: (elementId, newPosition) => {
                    // Fire operation request to update position in the model
                    this.onOperationRequestedEmitter.fire({
                        operation: {
                            kind: 'moveElement',
                            elementId,
                            newPosition,
                        },
                    });
                },
                onDoubleClick: (elementId) => {
                    // Request to navigate to element in text view
                    this.onOperationRequestedEmitter.fire({
                        operation: {
                            kind: 'navigateToElement',
                            elementId,
                        },
                    });
                },
            };
            this.sprottyManager.setCallbacks(callbacks);

            // Initialize UI extensions and set parent container
            this.sprottyManager.initializeUIExtensions();

            // Set parent container for UI extensions (the diagram container)
            const diagramContainer = this.svgContainer.parentElement;
            if (diagramContainer) {
                this.sprottyManager.setUIExtensionsParentContainer(diagramContainer);
            }

            this.sprottyInitialized = true;
            console.log(`[DiagramWidget] Sprotty initialized for: ${this.uri}`);

            // Request tool palette from server
            await this.sprottyManager.requestToolPalette();

            // Load initial model
            await this.loadModel();
        } catch (error) {
            console.error('[DiagramWidget] Failed to initialize Sprotty:', error);
            this.showError('Failed to initialize diagram viewer');
        }
    }

    /**
     * Show placeholder when no model is loaded.
     */
    protected showPlaceholder(): void {
        if (!this.svgContainer) {
            return;
        }

        this.svgContainer.innerHTML = `
            <div class="sanyam-diagram-placeholder">
                <div class="sanyam-diagram-placeholder-icon">
                    <i class="codicon codicon-type-hierarchy"></i>
                </div>
                <div class="sanyam-diagram-placeholder-text">
                    <p>Diagram view is ready</p>
                    <p class="secondary">Waiting for language server to provide diagram data...</p>
                </div>
            </div>
        `;
    }

    /**
     * Show loading state.
     */
    showLoading(): void {
        if (!this.svgContainer) {
            return;
        }

        this.svgContainer.innerHTML = `
            <div class="sanyam-diagram-placeholder">
                <div class="sanyam-diagram-loading-spinner"></div>
                <div class="sanyam-diagram-placeholder-text">
                    <p>Loading diagram...</p>
                </div>
            </div>
        `;
    }

    /**
     * Show error state.
     */
    showError(message: string): void {
        if (!this.svgContainer) {
            return;
        }

        this.svgContainer.innerHTML = `
            <div class="sanyam-diagram-placeholder sanyam-diagram-error">
                <div class="sanyam-diagram-placeholder-icon">
                    <i class="codicon codicon-error"></i>
                </div>
                <div class="sanyam-diagram-placeholder-text">
                    <p>Failed to load diagram</p>
                    <p class="secondary">${this.escapeHtml(message)}</p>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS.
     */
    protected escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Load the diagram model from the server.
     */
    async loadModel(): Promise<void> {
        // This will be called via the language client
        // For now, set up placeholder
        console.log(`[DiagramWidget] Loading diagram model for: ${this.uri}`);
    }

    /**
     * Set the diagram model.
     */
    async setModel(gModel: GModelRootType): Promise<void> {
        this.state.gModel = gModel;

        // Clear placeholder content if present
        if (this.svgContainer && this.svgContainer.querySelector('.sanyam-diagram-placeholder')) {
            this.svgContainer.innerHTML = '';
        }

        // Set model in Sprotty
        if (this.sprottyManager && this.sprottyInitialized) {
            try {
                // Convert to Sprotty format with positions
                const sprottyModel = this.convertToSprottyModel(gModel);
                await this.sprottyManager.setModel(sprottyModel);
                console.log('[DiagramWidget] Model set in Sprotty');

                // Fit to screen after initial load
                await this.sprottyManager.fitToScreen();
            } catch (error) {
                console.error('[DiagramWidget] Failed to set model in Sprotty:', error);
            }
        }

        this.onModelChangedEmitter.fire(gModel);
    }

    /**
     * Update the diagram model.
     */
    async updateModel(gModel: GModelRootType): Promise<void> {
        this.state.gModel = gModel;

        if (this.sprottyManager && this.sprottyInitialized) {
            try {
                const sprottyModel = this.convertToSprottyModel(gModel);
                await this.sprottyManager.updateModel(sprottyModel);
                console.log('[DiagramWidget] Model updated in Sprotty');
            } catch (error) {
                console.error('[DiagramWidget] Failed to update model in Sprotty:', error);
            }
        }

        this.onModelChangedEmitter.fire(gModel);
    }

    /**
     * Convert GModel to Sprotty-compatible format.
     */
    protected convertToSprottyModel(gModel: GModelRootType): GModelRoot {
        // The GModel format should be compatible with Sprotty
        // Add positions from state if available
        const converted = this.addPositionsToModel(gModel);
        return converted as unknown as GModelRoot;
    }

    /**
     * Add positions from state to model elements.
     */
    protected addPositionsToModel(element: GModelElementType): any {
        const result: any = { ...element };

        // Add position if available
        const position = this.state.positions.get(element.id);
        if (position) {
            result.position = position;
        }

        // Add size if available
        const size = this.state.sizes.get(element.id);
        if (size) {
            result.size = size;
        }

        // Process children recursively
        if (element.children) {
            result.children = element.children.map(child => this.addPositionsToModel(child));
        }

        return result;
    }

    /**
     * Get the current diagram model.
     */
    getModel(): GModelRootType | undefined {
        return this.state.gModel;
    }

    /**
     * Select an element.
     */
    async selectElement(elementId: string, addToSelection: boolean = false): Promise<void> {
        if (addToSelection) {
            if (this.state.selection.selectedIds.includes(elementId)) {
                // Remove from selection
                this.state.selection.selectedIds = this.state.selection.selectedIds.filter(id => id !== elementId);
            } else {
                // Add to selection
                this.state.selection.selectedIds.push(elementId);
            }
        } else {
            // Replace selection
            this.state.selection.selectedIds = [elementId];
        }

        // Update Sprotty selection
        if (this.sprottyManager) {
            await this.sprottyManager.select(this.state.selection.selectedIds);
        }

        this.onSelectionChangedEmitter.fire(this.state.selection);
    }

    /**
     * Clear selection.
     */
    async clearSelection(): Promise<void> {
        this.state.selection.selectedIds = [];

        if (this.sprottyManager) {
            await this.sprottyManager.selectAll(false);
        }

        this.onSelectionChangedEmitter.fire(this.state.selection);
    }

    /**
     * Get current selection.
     */
    getSelection(): string[] {
        return [...this.state.selection.selectedIds];
    }

    /**
     * Execute an operation.
     */
    executeOperation(operation: any): void {
        this.onOperationRequestedEmitter.fire({ operation });
    }

    /**
     * Update positions from metadata.
     */
    updatePositions(positions: Map<string, Point>): void {
        this.state.positions = new Map(positions);

        // Re-render with new positions
        if (this.state.gModel) {
            this.updateModel(this.state.gModel);
        }
    }

    /**
     * Update sizes from metadata.
     */
    updateSizes(sizes: Map<string, Dimension>): void {
        this.state.sizes = new Map(sizes);

        // Re-render with new sizes
        if (this.state.gModel) {
            this.updateModel(this.state.gModel);
        }
    }

    /**
     * Refresh the diagram.
     */
    refresh(): void {
        this.loadModel();
    }

    /**
     * Zoom to fit all elements.
     */
    async zoomToFit(): Promise<void> {
        if (this.sprottyManager) {
            await this.sprottyManager.fitToScreen();
        }
    }

    /**
     * Center on specific elements or all.
     */
    async center(elementIds?: string[]): Promise<void> {
        if (this.sprottyManager) {
            await this.sprottyManager.center(elementIds);
        }
    }

    /**
     * Dispatch a Sprotty action.
     */
    async dispatchAction(action: Action): Promise<void> {
        if (this.sprottyManager) {
            const modelSource = this.sprottyManager.getModelSource();
            await modelSource.actionDispatcher.dispatch(action);
        }
    }

    /**
     * Get the Sprotty diagram manager.
     */
    getSprottyManager(): SprottyDiagramManager | undefined {
        return this.sprottyManager;
    }

    /**
     * Check if Sprotty is initialized.
     */
    isSprottyInitialized(): boolean {
        return this.sprottyInitialized;
    }

    /**
     * Dispose the widget.
     */
    dispose(): void {
        if (this.sprottyManager) {
            this.sprottyManager.dispose();
            this.sprottyManager = undefined;
        }
        this.sprottyInitialized = false;
        this.toDispose.dispose();
        super.dispose();
    }
}

/**
 * Factory for creating diagram widgets.
 */
@injectable()
export class DiagramWidgetFactory {
    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    /**
     * Create a diagram widget.
     */
    createWidget(options: DiagramWidget.Options): DiagramWidget {
        const widget = new DiagramWidget(options);
        widget.setPreferenceService(this.preferenceService);
        return widget;
    }
}

/**
 * Export GModelRoot type for backwards compatibility.
 */
export type { GModelRootType as GModelRoot };
