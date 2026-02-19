/**
 * Diagram Widget (T084)
 *
 * Widget for rendering GLSP diagrams in Theia using Sprotty.
 * Handles diagram rendering, user interactions, and synchronization.
 *
 * @packageDocumentation
 */

import { injectable, postConstruct, inject } from 'inversify';
import { createLogger } from '@sanyam/logger';
import { Widget, BaseWidget, Message, ContextMenuRenderer } from '@theia/core/lib/browser';
import { Emitter, Event, DisposableCollection, Disposable } from '@theia/core/lib/common';
import { MenuPath } from '@theia/core/lib/common/menu';
import { PreferenceService, PreferenceChange } from '@theia/core/lib/common/preferences/preference-service';
import URI from '@theia/core/lib/common/uri';
import { DIAGRAM_WIDGET_FACTORY_ID_STRING } from '@sanyam/types';
import type { GModelRoot as GModelRootType, GModelElement as GModelElementType } from '@sanyam/types';

/**
 * Menu path for diagram element context menu.
 * Defined here to avoid circular dependency with glsp-menus.ts.
 */
const DIAGRAM_ELEMENT_CONTEXT_MENU: MenuPath = ['diagram-element-context-menu'];

// Import diagram language client for server communication
import { DiagramLanguageClient, DiagramModelUpdate } from './diagram-language-client';

// Sprotty imports
import {
    SprottyDiagramManager,
    DiagramEventCallbacks,
    GModelRoot,
    Action,
} from './di/sprotty-di-config';

// Preferences
import { DiagramPreferences, DiagramBackgroundStyle } from './diagram-preferences';

// Edge routing
import { EdgeRoutingService } from './layout';

// Layout storage
import { DiagramLayoutStorageService, type ElementLayout, type DiagramLayout, type DiagramLayoutV3, type DiagramViewState } from './layout-storage-service';

// Resize handles
import { ResizeHandlesExtension, RESIZE_HANDLES_ID } from './ui-extensions/resize';

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
 * Selection state (FR-006, FR-007, FR-008).
 */
export interface SelectionState {
    selectedIds: string[];
    hoveredId?: string;
}

/**
 * Event emitted when selection changes (FR-010, FR-013).
 */
export interface SelectionChangeEvent {
    /** Current selected element IDs */
    readonly selectedIds: readonly string[];
    /** Previously selected element IDs */
    readonly previousSelectedIds: readonly string[];
    /** Source of the selection change */
    readonly source: 'diagram' | 'outline' | 'textEditor' | 'explorer' | 'propertiesPanel';
    /** Hovered element ID (if any) */
    readonly hoveredId?: string;
}

/**
 * Diagram state.
 */
export interface DiagramState {
    gModel?: GModelRootType;
    positions: Map<string, Point>;
    sizes: Map<string, Dimension>;
    sourceRanges?: Map<string, { start: { line: number; character: number }; end: { line: number; character: number } }>;
    /** UUID registry exact-match index from server */
    idMap?: Record<string, string>;
    /** UUID registry fingerprints from server */
    fingerprints?: Record<string, unknown>;
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

    protected readonly logger = createLogger({ name: 'DiagramWidget' });

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

    /** Embedded diagram toolbar element */
    protected diagramToolbar: HTMLDivElement | undefined;

    /** Floating mini-toolbar element */
    protected floatingToolbar: HTMLDivElement | undefined;

    /** Loading progress bar element */
    protected progressBar: HTMLDivElement | undefined;

    /** Flag indicating if Sprotty has been initialized */
    protected sprottyInitialized = false;

    /** Flag indicating layout is in progress (used to hide diagram during initial layout) */
    protected layoutPending = false;

    /** Flag to prevent concurrent setModel calls */
    protected setModelInProgress = false;

    /** Queued model to process after current setModel completes (queue-latest pattern) */
    protected pendingModel: GModelRootType | undefined;

    /** Flag indicating an expand/collapse triggered the current layout */
    protected expandCollapseInProgress = false;

    /** Flag indicating whether the initial layout+fitToScreen has been completed */
    protected initialLayoutDone = false;

    /** Whether to auto-load the model during initializeSprotty(). Embedded widgets set this to false. */
    protected autoLoadModel = true;

    /** Preference service for reading diagram preferences */
    protected preferenceService: PreferenceService | undefined;

    /** Diagram language client for server communication */
    protected diagramLanguageClient: DiagramLanguageClient | undefined;

    /** Subscription to model updates */
    protected modelUpdateSubscription: Disposable | undefined;

    /** Current background style */
    protected currentBackgroundStyle: DiagramBackgroundStyle = 'dots';

    /** Layout storage service for persisting positions */
    protected layoutStorageService: DiagramLayoutStorageService | undefined;

    /** Saved layout loaded from storage (if any) */
    protected savedLayout: DiagramLayout | undefined;

    /** Edge routing service for dynamic edge routing mode */
    protected edgeRoutingService: EdgeRoutingService | undefined;

    /** Context menu renderer for showing Theia context menus */
    protected contextMenuRenderer: ContextMenuRenderer | undefined;

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

        // Apply initial edge jumps preference
        this.applyEdgeJumpsPreference();

        // Apply initial toolbar visibility preference
        this.applyToolbarVisibilityPreference();

        // Apply initial floating toolbar visibility preference
        this.applyFloatingToolbarVisibilityPreference();

        // Apply initial animated edges preference
        this.applyAnimatedEdgesPreference();

        // Subscribe to preference changes
        this.toDispose.push(
            preferenceService.onPreferenceChanged((event: PreferenceChange) => {
                if (event.preferenceName.startsWith('diagram.background.') ||
                    event.preferenceName.startsWith('diagram.pattern.') ||
                    event.preferenceName.startsWith('diagram.grid.') ||
                    event.preferenceName.startsWith('diagram.dots.')) {
                    this.applyBackgroundPreferences();
                }
                if (event.preferenceName === DiagramPreferences.EDGE_JUMPS_ENABLED) {
                    this.applyEdgeJumpsPreference();
                }
                if (event.preferenceName === DiagramPreferences.TOOLBAR_VISIBLE) {
                    this.applyToolbarVisibilityPreference();
                }
                if (event.preferenceName === DiagramPreferences.FLOATING_TOOLBAR_VISIBLE) {
                    this.applyFloatingToolbarVisibilityPreference();
                }
                if (event.preferenceName === DiagramPreferences.ANIMATED_EDGES_ENABLED) {
                    this.applyAnimatedEdgesPreference();
                }
            })
        );
    }

    /**
     * Set the diagram language client and subscribe to model updates.
     */
    setDiagramLanguageClient(client: DiagramLanguageClient): void {
        this.diagramLanguageClient = client;

        // Clean up any existing subscription
        if (this.modelUpdateSubscription) {
            this.modelUpdateSubscription.dispose();
        }

        // Subscribe to model updates for this URI
        this.modelUpdateSubscription = client.subscribeToChanges(this.uri, (update: DiagramModelUpdate) => {
            this.logger.debug(`[DiagramWidget] Model update received for: ${this.uri}`);
            this.handleModelUpdate(update);
        });

        this.toDispose.push(this.modelUpdateSubscription);
        this.logger.debug(`[DiagramWidget] DiagramLanguageClient set for: ${this.uri}`);
    }

    /**
     * Set layout storage service.
     */
    setLayoutStorageService(service: DiagramLayoutStorageService): void {
        this.layoutStorageService = service;
    }

    /**
     * Set edge routing service for dynamic edge routing mode.
     */
    setEdgeRoutingService(service: EdgeRoutingService): void {
        this.edgeRoutingService = service;
        // Apply edge jumps preference now that the service is available
        // (setPreferenceService runs before this, so its initial apply call no-ops)
        this.applyEdgeJumpsPreference();
    }

    /**
     * Set context menu renderer for showing Theia context menus on right-click.
     */
    setContextMenuRenderer(renderer: ContextMenuRenderer): void {
        this.contextMenuRenderer = renderer;
    }

    /**
     * Set whether the widget should auto-load the model during Sprotty initialization.
     * Embedded widgets (inside CompositeEditorWidget) set this to false to avoid
     * premature model loads before the language server is ready.
     */
    setAutoLoadModel(enabled: boolean): void {
        this.autoLoadModel = enabled;
    }

    /**
     * Handle model update from language client.
     */
    protected async handleModelUpdate(update: DiagramModelUpdate): Promise<void> {
        if (update.gModel) {
            // Update positions if available
            if (update.metadata?.positions) {
                this.state.positions = update.metadata.positions;
            }
            // Update sizes if available
            if (update.metadata?.sizes) {
                this.state.sizes = update.metadata.sizes;
            }
            // Update source ranges if available (for outline↔diagram mapping)
            if (update.metadata?.sourceRanges) {
                this.state.sourceRanges = update.metadata.sourceRanges;
            }
            // Store UUID registry data from server
            if (update.metadata?.idMap) {
                this.state.idMap = update.metadata.idMap;
            }
            if (update.metadata?.fingerprints) {
                this.state.fingerprints = update.metadata.fingerprints;
            }
            // Set the model
            await this.setModel(update.gModel);
        }
    }

    /**
     * Handle a collapse/expand action from the expand/collapse button.
     *
     * Sends the new collapsed state to the backend which regenerates the
     * model with the container's body compartment either present or absent.
     *
     * @param elementId - The container element ID
     * @param collapsed - Whether the container should be collapsed
     */
    protected async handleCollapseExpand(elementId: string, collapsed: boolean): Promise<void> {
        if (!this.diagramLanguageClient) {
            this.logger.warn('[DiagramWidget] No DiagramLanguageClient, cannot toggle collapse');
            return;
        }

        this.logger.debug({ elementId, collapsed }, '[DiagramWidget] Collapse/expand toggle');
        this.expandCollapseInProgress = true;

        // Hide diagram immediately to prevent visual glitches.
        // Sprotty's built-in CollapseExpandCommand runs synchronously and
        // toggles `expanded` on the local model, causing an intermediate
        // re-render before the server responds with the new model.  Hiding
        // here (before the first await) ensures the user never sees that
        // intermediate state or the viewport reset from setModel().
        if (this.svgContainer) {
            this.layoutPending = true;
            this.svgContainer.classList.add('layout-pending');
        }

        try {
            const response = await this.diagramLanguageClient.setCollapsed(
                this.uri,
                elementId,
                collapsed
            );

            if (response.success && response.gModel) {
                // Update metadata from response
                if (response.metadata?.idMap) {
                    this.state.idMap = response.metadata.idMap;
                }
                if (response.metadata?.fingerprints) {
                    this.state.fingerprints = response.metadata.fingerprints;
                }
                if (response.metadata?.sourceRanges) {
                    this.state.sourceRanges = new Map(Object.entries(response.metadata.sourceRanges));
                }

                // Clear saved layout so setModel() runs ELK layout for the new model.
                // The model structure changes during expand/collapse (children added/removed),
                // so saved positions are no longer valid and ELK must recompute.
                this.savedLayout = undefined;

                await this.setModel(response.gModel);
            } else {
                this.logger.warn({ elementId, error: response.error }, '[DiagramWidget] setCollapsed failed');
            }
        } catch (error) {
            this.logger.error({ err: error, elementId }, '[DiagramWidget] Error toggling collapse');
        }
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

        // Read the theme-driven grid color from the color token CSS variable.
        // If a blueprint (or other custom) theme defines sanyam.diagram.gridColor,
        // it will be available here; otherwise we fall back to a computed default.
        const computedGridColor = getComputedStyle(this.svgContainer)
            .getPropertyValue('--theia-sanyam-diagram-gridColor').trim();

        if (computedGridColor) {
            this.svgContainer.style.setProperty('--diagram-dots-color', computedGridColor);
            this.svgContainer.style.setProperty('--diagram-grid-color', computedGridColor);
        } else {
            // Fallback when no color token is resolved
            const isLightTheme = document.body.classList.contains('theia-light');
            const patternColorBase = isLightTheme ? '0, 0, 0' : '128, 128, 128';
            const patternColorWithOpacity = `rgba(${patternColorBase}, ${patternOpacity})`;
            this.svgContainer.style.setProperty('--diagram-dots-color', patternColorWithOpacity);
            this.svgContainer.style.setProperty('--diagram-grid-color', patternColorWithOpacity);
        }

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
        this.logger.debug(`[DiagramWidget] Applied background style: ${style}, opacity: ${patternOpacity}`);
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
     * Apply edge jumps preference to the edge routing service.
     */
    protected applyEdgeJumpsPreference(): void {
        if (!this.preferenceService || !this.edgeRoutingService) {
            return;
        }
        const enabled = this.preferenceService.get<boolean>(DiagramPreferences.EDGE_JUMPS_ENABLED, false);
        this.edgeRoutingService.setEdgeJumpsEnabled(enabled);
        // Re-render if Sprotty is initialized
        if (this.sprottyInitialized) {
            this.sprottyManager?.requestLayout();
        }
    }

    /**
     * Apply toolbar visibility preference.
     */
    protected applyToolbarVisibilityPreference(): void {
        if (!this.diagramToolbar || !this.preferenceService) {
            return;
        }
        const visible = this.preferenceService.get<boolean>(DiagramPreferences.TOOLBAR_VISIBLE, false);
        this.diagramToolbar.style.display = visible ? '' : 'none';
    }

    /**
     * Apply animated edges preference.
     * Toggles the `animated-edges` CSS class on the SVG container.
     */
    protected applyAnimatedEdgesPreference(): void {
        if (!this.svgContainer || !this.preferenceService) {
            return;
        }
        const enabled = this.preferenceService.get<boolean>(DiagramPreferences.ANIMATED_EDGES_ENABLED, true);
        this.svgContainer.classList.toggle('animated-edges', enabled);
    }

    /**
     * Apply floating toolbar visibility preference.
     */
    protected applyFloatingToolbarVisibilityPreference(): void {
        if (!this.floatingToolbar || !this.preferenceService) {
            return;
        }
        const visible = this.preferenceService.get<boolean>(DiagramPreferences.FLOATING_TOOLBAR_VISIBLE, true);
        this.floatingToolbar.style.display = visible ? '' : 'none';
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
        // Diagram retains its rendered state when hidden/re-shown.
        // Model loading is managed by CompositeEditorWidget.
        // The Refresh toolbar button still works for explicit refresh.
    }

    /**
     * Called when widget is resized.
     */
    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        // Sprotty handles resize automatically via CSS
    }

    /**
     * Create a toolbar button element.
     */
    protected createToolbarButton(icon: string, tooltip: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = 'sanyam-diagram-toolbar-button';
        btn.title = tooltip;
        btn.innerHTML = `<span class="${icon}"></span>`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    /**
     * Create a toolbar separator element.
     */
    protected createToolbarSeparator(): HTMLDivElement {
        const sep = document.createElement('div');
        sep.className = 'sanyam-diagram-toolbar-separator';
        return sep;
    }

    /**
     * Create the floating mini-toolbar anchored to the bottom-left corner.
     * Contains zoom, fit, layout, and minimap controls.
     */
    protected createFloatingToolbar(): HTMLDivElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'sanyam-diagram-floating-toolbar';

        // Undo/Redo
        toolbar.appendChild(this.createToolbarButton('codicon codicon-discard', 'Undo (Ctrl+Z)', () => {
            this.dispatchAction({ kind: 'undo' });
        }));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-redo', 'Redo (Ctrl+Y)', () => {
            this.dispatchAction({ kind: 'redo' });
        }));

        toolbar.appendChild(this.createToolbarSeparator());

        // Zoom & layout
        toolbar.appendChild(this.createToolbarButton('codicon codicon-zoom-in', 'Zoom In', () => this.zoomIn()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-zoom-out', 'Zoom Out', () => this.zoomOut()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-screen-full', 'Fit to Screen', () => this.zoomToFit()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-layout', 'Auto-Layout', () => {
            this.sprottyManager?.requestLayout();
        }));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-map', 'Toggle Minimap', () => {
            this.dispatchAction({ kind: 'toggleMinimap' });
        }));

        return toolbar;
    }

    /**
     * Create the embedded diagram toolbar (FR-006).
     * Toolbar is rendered at the top of the diagram view panel.
     */
    protected createEmbeddedToolbar(): HTMLDivElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'sanyam-diagram-embedded-toolbar';

        // Zoom group
        toolbar.appendChild(this.createToolbarButton('codicon codicon-zoom-in', 'Zoom In', () => this.zoomIn()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-zoom-out', 'Zoom Out', () => this.zoomOut()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-screen-full', 'Fit to Screen', () => this.zoomToFit()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-target', 'Center View', () => this.center()));

        toolbar.appendChild(this.createToolbarSeparator());

        // Layout
        toolbar.appendChild(this.createToolbarButton('codicon codicon-layout', 'Auto-Layout', () => {
            this.sprottyManager?.requestLayout();
        }));

        toolbar.appendChild(this.createToolbarSeparator());

        // Toggles
        toolbar.appendChild(this.createToolbarButton('codicon codicon-map', 'Toggle Minimap', () => {
            this.dispatchAction({ kind: 'toggleMinimap' });
        }));

        toolbar.appendChild(this.createToolbarSeparator());

        // Actions
        toolbar.appendChild(this.createToolbarButton('codicon codicon-refresh', 'Refresh Diagram', () => this.refresh()));
        toolbar.appendChild(this.createToolbarButton('codicon codicon-file-media', 'Export as SVG', () => {
            this.dispatchAction({ kind: 'requestExportSvg' });
        }));

        return toolbar;
    }

    /**
     * Create the diagram container elements.
     */
    protected createDiagramContainer(): void {
        // Guard against duplicate creation on re-attach
        if (this.svgContainer) {
            return;
        }
        // Create main container
        const container = document.createElement('div');
        container.className = 'sanyam-diagram-container';

        // Create embedded diagram toolbar (FR-006) - hidden by default per preference
        this.diagramToolbar = this.createEmbeddedToolbar();
        const toolbarVisible = this.preferenceService?.get<boolean>(DiagramPreferences.TOOLBAR_VISIBLE, false) ?? false;
        this.diagramToolbar.style.display = toolbarVisible ? '' : 'none';
        container.appendChild(this.diagramToolbar);

        // Create SVG container for Sprotty
        // T011: Add layout-pending class from the very start to prevent any flash
        this.svgContainer = document.createElement('div');
        this.svgContainer.className = 'sanyam-diagram-svg-container bg-dots layout-pending';
        this.svgContainer.id = `sprotty-${this.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
        this.layoutPending = true;

        // Create progress bar as first child of SVG container
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'sanyam-diagram-progress-bar';
        this.svgContainer.appendChild(this.progressBar);

        container.appendChild(this.svgContainer);

        // Create floating mini-toolbar - visible by default per preference
        this.floatingToolbar = this.createFloatingToolbar();
        const floatingVisible = this.preferenceService?.get<boolean>(DiagramPreferences.FLOATING_TOOLBAR_VISIBLE, true) ?? true;
        this.floatingToolbar.style.display = floatingVisible ? '' : 'none';
        container.appendChild(this.floatingToolbar);

        // Apply preferences now that svgContainer exists
        // (setPreferenceService runs before createDiagramContainer, so initial apply calls no-op)
        if (this.preferenceService) {
            this.applyBackgroundPreferences();
            this.applyAnimatedEdgesPreference();
        }

        // Create hidden container for Sprotty measurements
        const hiddenContainer = document.createElement('div');
        hiddenContainer.id = `${this.svgContainer.id}-hidden`;
        hiddenContainer.className = 'sprotty-hidden';
        container.appendChild(hiddenContainer);

        this.node.appendChild(container);

        // T022: Add mousedown listener for marquee selection on Ctrl+click empty space
        this.svgContainer.addEventListener('mousedown', this.handleCanvasMouseDown);

        // Add context menu listener for right-click on diagram
        this.svgContainer.addEventListener('contextmenu', this.handleContextMenu);

        // Show placeholder initially
        this.showPlaceholder();
    }

    /**
     * T022/T023: Handle mousedown on canvas for marquee selection.
     * Triggers marquee selection when Ctrl+click on empty space (not on a node).
     */
    protected handleCanvasMouseDown = (event: MouseEvent): void => {
        // Only trigger on Ctrl+click (or Cmd+click on Mac)
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }

        // T024: Check if click is on empty space (not on a node element)
        if (this.isNodeElement(event.target as Element)) {
            return;
        }

        // Get marquee selection tool and enable it
        const registry = this.sprottyManager?.getUIExtensionRegistry();
        if (registry) {
            const marqueeTool = registry.get('sanyam-marquee-selection');
            if (marqueeTool && 'enableMarqueeMode' in marqueeTool) {
                (marqueeTool as any).enableMarqueeMode();
                this.logger.debug('[DiagramWidget] Marquee selection mode enabled via Ctrl+click');
            }
        }
    };

    /**
     * Handle right-click context menu on the diagram canvas.
     * Shows Theia's context menu for diagram elements.
     */
    protected handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        if (!this.contextMenuRenderer || !this.svgContainer) {
            this.logger.warn('[DiagramWidget] Context menu renderer or container not available');
            return;
        }

        // Render the diagram element context menu at the click position
        this.contextMenuRenderer.render({
            menuPath: DIAGRAM_ELEMENT_CONTEXT_MENU,
            anchor: { x: event.clientX, y: event.clientY },
            args: [this.uri, this.state.selection.selectedIds],
            context: this.svgContainer,
        });

        this.logger.debug({ position: { x: event.clientX, y: event.clientY } }, '[DiagramWidget] Context menu shown');
    };

    /**
     * T024: Check if an element is a node element (or part of a node).
     *
     * @param element - DOM element to check
     * @returns True if the element is or belongs to a diagram node
     */
    protected isNodeElement(element: Element | null): boolean {
        if (!element) {
            return false;
        }

        // Check if the element itself is a node
        if (element.classList.contains('sprotty-node') ||
            element.classList.contains('sanyam-node') ||
            element.closest('.sprotty-node') ||
            element.closest('.sanyam-node')) {
            return true;
        }

        // Check if the element has a node-like ID pattern
        if (element.id && element.id.startsWith('node')) {
            return true;
        }

        // Check parent elements up to 5 levels for node classes
        let current: Element | null = element;
        let depth = 0;
        while (current && depth < 5) {
            if (current.classList.contains('sprotty-node') ||
                current.classList.contains('sanyam-node')) {
                return true;
            }
            current = current.parentElement;
            depth++;
        }

        return false;
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
                edgeRoutingService: this.edgeRoutingService,
                uiExtensions: {
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
                onLayoutComplete: (success, error) => this.onLayoutComplete(success, error),
            });

            // Set up event callbacks
            const callbacks: DiagramEventCallbacks = {
                onSelectionChanged: (selectedIds) => {
                    this.state.selection.selectedIds = selectedIds;
                    this.onSelectionChangedEmitter.fire(this.state.selection);
                    this.updateResizeHandles(selectedIds);
                },
                onMoveCompleted: (elementId, newPosition) => {
                    // Update local position state
                    this.state.positions.set(elementId, newPosition);

                    // Fire operation request to update position in the model
                    this.onOperationRequestedEmitter.fire({
                        operation: {
                            kind: 'moveElement',
                            elementId,
                            newPosition,
                        },
                    });

                    // Save layout to storage (debounced)
                    this.saveLayoutDebounced();
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
                onCollapseExpand: (elementId, collapsed) => {
                    // Send collapse/expand request to the backend, which will
                    // regenerate the model with the updated collapsed state.
                    this.handleCollapseExpand(elementId, collapsed);
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
            this.logger.debug(`[DiagramWidget] Sprotty initialized for: ${this.uri}`);

            // Load initial model (skip for embedded widgets where CompositeEditorWidget manages loading)
            if (this.autoLoadModel) {
                await this.loadModel();
            } else if (this.state.gModel && this.state.gModel.children && this.state.gModel.children.length > 0) {
                // A model was stored before Sprotty was ready (e.g., loadDiagramModel
                // raced with initializeSprotty during widget restoration). Render it now.
                this.logger.debug('[DiagramWidget] Rendering stored model after Sprotty init');
                await this.setModel(this.state.gModel);
            }
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to initialize Sprotty');
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

        // Show the progress bar
        if (this.progressBar) {
            this.progressBar.classList.remove('hidden');
        }

        // Once Sprotty has rendered into the container, we must not replace
        // innerHTML — Snabbdom's internal VNode tree references the live DOM
        // elements.  Destroying them causes subsequent setModel() calls to
        // patch disconnected elements, leaving the container empty.
        if (this.sprottyInitialized) {
            return;
        }

        // Show a centered placeholder only for the very first load
        // (before Sprotty is initialized)
        this.svgContainer.innerHTML = '';
        if (this.progressBar) {
            this.svgContainer.appendChild(this.progressBar);
        }
    }

    /**
     * Show error state.
     */
    showError(message: string): void {
        if (!this.svgContainer) {
            return;
        }

        // Hide progress bar on error
        if (this.progressBar) {
            this.progressBar.classList.add('hidden');
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
        this.logger.debug(`[DiagramWidget] Loading diagram model for: ${this.uri}`);

        if (!this.diagramLanguageClient) {
            this.logger.warn('[DiagramWidget] No DiagramLanguageClient set, cannot load model');
            this.showError('Diagram language client not available');
            return;
        }

        try {
            this.showLoading();
            // Reset initial layout flag so the new model gets a fit-to-screen
            this.initialLayoutDone = false;

            // Try to load saved layout first
            if (this.layoutStorageService) {
                this.savedLayout = await this.layoutStorageService.loadLayout(this.uri);
                if (this.savedLayout) {
                    this.logger.debug(`[DiagramWidget] Found saved layout with ${Object.keys(this.savedLayout.elements).length} elements`);
                }
            }

            // Pass saved UUID registry data to the server so it can seed the
            // element ID registry before reconciliation, producing stable UUIDs.
            const savedRegistry = this.savedLayout ? {
                idMap: (this.savedLayout as DiagramLayoutV3).idMap,
                fingerprints: (this.savedLayout as DiagramLayoutV3).fingerprints,
            } : undefined;

            this.logger.info({
                event: 'uuid:layout-load',
                uri: this.uri,
                hasSavedLayout: !!this.savedLayout,
                savedIdMapSize: Object.keys(savedRegistry?.idMap ?? {}).length,
                savedFingerprintCount: Object.keys(savedRegistry?.fingerprints ?? {}).length,
            }, 'UUID registry loaded from browser storage');

            const response = await this.diagramLanguageClient.loadModel(this.uri, savedRegistry);

            // Debug log the full response structure
            this.logger.debug({
                success: response.success,
                hasGModel: !!response.gModel,
                hasError: response.error !== undefined,
                errorType: typeof response.error,
                errorValue: response.error,
            }, '[DiagramWidget] loadModel response received');

            if (response.success && response.gModel) {
                this.logger.debug(`[DiagramWidget] Response has gModel with ${response.gModel.children?.length ?? 0} children`);
                // Update positions if available from server
                if (response.metadata?.positions) {
                    this.state.positions = new Map(Object.entries(response.metadata.positions));
                }
                // Update sizes if available from server
                if (response.metadata?.sizes) {
                    this.state.sizes = new Map(Object.entries(response.metadata.sizes));
                }
                // Update source ranges if available from server (for outline↔diagram mapping)
                if (response.metadata?.sourceRanges) {
                    this.state.sourceRanges = new Map(Object.entries(response.metadata.sourceRanges));
                }
                // Store UUID registry data from server
                if (response.metadata?.idMap) {
                    this.state.idMap = response.metadata.idMap;
                }
                if (response.metadata?.fingerprints) {
                    this.state.fingerprints = response.metadata.fingerprints;
                }

                this.logger.info({
                    event: 'uuid:rpc-receive',
                    uri: this.uri,
                    idMapSize: Object.keys(this.state.idMap ?? {}).length,
                    fingerprintCount: Object.keys(this.state.fingerprints ?? {}).length,
                    sourceRangeCount: this.state.sourceRanges?.size ?? 0,
                }, 'Stored UUID registry and sourceRanges from server response');

                // Apply saved layout positions directly.
                // Server-side UUID seeding (via savedRegistry above) ensures
                // element IDs are stable, so saved positions match current IDs.
                if (this.savedLayout) {
                    for (const [id, layout] of Object.entries(this.savedLayout.elements)) {
                        this.state.positions.set(id, layout.position);
                        if (layout.size) {
                            this.state.sizes.set(id, layout.size);
                        }
                    }
                    this.logger.debug(`[DiagramWidget] Applied ${Object.keys(this.savedLayout.elements).length} saved positions directly`);
                }

                // Set the model
                await this.setModel(response.gModel);
                this.logger.debug(`[DiagramWidget] Model loaded successfully for: ${this.uri}`);
            } else {
                // Convert error to string - handle object errors (e.g., JSON-RPC errors)
                let errorMsg: string;
                if (response.error === undefined || response.error === null) {
                    errorMsg = 'Unknown error loading diagram model';
                } else if (typeof response.error === 'string') {
                    errorMsg = response.error;
                } else if (typeof response.error === 'object') {
                    // Handle JSON-RPC error format { code, message, data }
                    const errObj = response.error as { message?: string; code?: number };
                    errorMsg = errObj.message || JSON.stringify(response.error);
                } else {
                    errorMsg = String(response.error);
                }

                this.logger.error({ errorMsg }, '[DiagramWidget] Failed to load model');
                this.showError(errorMsg);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[DiagramWidget] Error loading model: ${errorMsg}`);
            this.showError(errorMsg);
        }
    }

    /**
     * Set the diagram model.
     *
     * T011: Always adds layout-pending class immediately at entry to hide
     * the diagram during initial rendering (prevents visual repositioning).
     */
    async setModel(gModel: GModelRootType): Promise<void> {
        // Queue-latest pattern: if another setModel is in progress, store
        // the most recent model and process it when the current call finishes.
        if (this.setModelInProgress) {
            this.pendingModel = gModel;
            this.logger.debug('[DiagramWidget] setModel queued (in-progress)');
            return;
        }

        this.setModelInProgress = true;

        this.logger.info({
            sprottyInitialized: this.sprottyInitialized,
            hasSprottyManager: !!this.sprottyManager,
            childCount: gModel.children?.length ?? 0,
        }, '[DiagramWidget] setModel called');

        this.state.gModel = gModel;

        // Clear placeholder content if present, but ONLY before Sprotty has rendered.
        // Once Sprotty/Snabbdom manages the container's children, clearing innerHTML
        // disconnects Snabbdom's tracked DOM elements causing subsequent patches to fail.
        if (this.svgContainer && !this.sprottyInitialized && this.svgContainer.querySelector('.sanyam-diagram-placeholder')) {
            this.svgContainer.innerHTML = '';
        }

        // Check if we have saved positions (from layout storage)
        let hasSavedLayout = !!this.savedLayout && !!this.savedLayout.elements
            && Object.keys(this.savedLayout.elements).length > 0;

        // Verify saved layout isn't stale (element IDs actually match current model).
        // When the model structure changes (e.g., container node refactoring),
        // saved IDs may no longer match, leaving all nodes at (0,0).
        if (hasSavedLayout && gModel.children && gModel.children.length > 0) {
            const savedIds = new Set(Object.keys(this.savedLayout!.elements));
            // Collect IDs of top-level nodes (edges don't need position matching)
            const topLevelNodeIds = gModel.children
                .filter((c: GModelElementType) => c.type.startsWith('node') || (c.type.includes(':') && !c.type.startsWith('edge')))
                .map((c: GModelElementType) => c.id);
            const matchCount = topLevelNodeIds.filter(id => savedIds.has(id)).length;
            const matchRatio = topLevelNodeIds.length > 0 ? matchCount / topLevelNodeIds.length : 0;

            this.logger.debug({ matchCount, total: topLevelNodeIds.length, ratio: matchRatio.toFixed(2) },
                '[DiagramWidget] Saved layout coverage');

            if (matchRatio < 0.5) {
                this.logger.info('[DiagramWidget] Stale saved layout detected — falling back to auto-layout');
                hasSavedLayout = false;
                this.savedLayout = undefined;
                this.state.positions.clear();
                this.state.sizes.clear();
            }
        }

        // Set model in Sprotty
        if (this.sprottyManager && this.sprottyInitialized) {
            try {
                // T011: Add layout-pending class IMMEDIATELY to hide diagram during rendering
                // This prevents any visual jarring regardless of saved layout state
                // BUT: Skip if we've already revealed (to avoid race condition with multiple setModel calls)
                const shouldHide = !this.initialLayoutDone;
                if (this.svgContainer && shouldHide) {
                    this.layoutPending = true;
                    this.svgContainer.classList.add('layout-pending');
                    this.logger.debug('[DiagramWidget] Layout pending - diagram hidden');
                }

                // Convert to Sprotty format with positions
                const sprottyModel = this.convertToSprottyModel(gModel);
                await this.sprottyManager.setModel(sprottyModel);
                this.logger.debug('[DiagramWidget] Model set in Sprotty');

                if (hasSavedLayout) {
                    // Skip auto-layout - we have saved positions
                    this.initialLayoutDone = true;

                    // Wait for Sprotty to actually render the SVG content
                    // setModel() only dispatches the action, it doesn't wait for rendering
                    await this.waitForSvgContent();

                    // Restore saved viewport and toggle state if available (FR-002, FR-003, FR-004)
                    const sl = this.savedLayout as DiagramLayout | undefined;
                    const savedViewState = sl && 'viewState' in sl
                        ? (sl as DiagramLayoutV3).viewState
                        : undefined;
                    if (savedViewState?.zoom !== undefined) {
                        await this.restoreViewState(savedViewState);
                    } else {
                        // No saved viewport — fit to screen as fallback
                        await this.sprottyManager.fitToScreen();
                    }

                    // Reveal diagram after restore completes
                    this.revealDiagramAfterLayout();
                    // Update minimap
                    this.updateMinimapAfterLayout();
                } else {
                    // Request automatic layout for fresh diagrams
                    await this.sprottyManager.requestLayout();
                    this.logger.debug('[DiagramWidget] Layout requested');
                    // Note: fitToScreen and revealDiagramAfterLayout are called in onLayoutComplete

                    // Safety timeout: if layout doesn't complete within 5 seconds, reveal anyway
                    // This prevents the diagram from being permanently hidden if layout fails silently
                    setTimeout(() => {
                        if (this.layoutPending) {
                            this.logger.warn('[DiagramWidget] Layout timeout - revealing diagram anyway');
                            this.initialLayoutDone = true;
                            this.sprottyManager?.fitToScreen().then(() => {
                                this.revealDiagramAfterLayout();
                                this.updateMinimapAfterLayout();
                            }).catch(() => {
                                this.revealDiagramAfterLayout();
                            });
                        }
                    }, 5000);
                }
            } catch (error) {
                this.logger.error({ err: error }, 'Failed to set model in Sprotty');
                // Reveal diagram on error (so user sees error state, not blank)
                this.revealDiagramAfterLayout();
                this.setModelInProgress = false;
                return;
            }
        } else {
            this.logger.warn({
                sprottyInitialized: this.sprottyInitialized,
                hasSprottyManager: !!this.sprottyManager,
            }, '[DiagramWidget] setModel called but Sprotty not ready - model stored for later');
        }

        this.setModelInProgress = false;

        // Process queued model if one arrived while we were busy
        const queued = this.pendingModel;
        if (queued) {
            this.pendingModel = undefined;
            this.logger.debug('[DiagramWidget] Processing queued model');
            // Don't await — let it run asynchronously to avoid deep recursion
            this.setModel(queued).catch(err => {
                this.logger.error({ err }, 'Failed to process queued model');
            });
        }

        this.onModelChangedEmitter.fire(gModel);
    }

    /**
     * Handle layout completion.
     * Called when the ELK layout engine finishes positioning elements.
     */
    protected onLayoutComplete(success: boolean, error?: string): void {
        this.logger.info(`[DiagramWidget] onLayoutComplete: success=${success}, initialLayoutDone=${this.initialLayoutDone}${error ? ', error=' + error : ''}`);

        if (success) {
            if (!this.initialLayoutDone) {
                // First layout: fit to screen BEFORE revealing (while still hidden)
                this.initialLayoutDone = true;
                const applyInitialView = this.sprottyManager?.fitToScreen();
                (applyInitialView ?? Promise.resolve()).then(() => {
                    // Now reveal the diagram with smooth transition
                    this.revealDiagramAfterLayout();
                    // Update minimap after reveal
                    this.updateMinimapAfterLayout();
                }).catch(err => {
                    this.logger.warn({ err }, 'Failed to apply initial view');
                    // Still reveal even if it fails
                    this.revealDiagramAfterLayout();
                });
            } else if (this.expandCollapseInProgress) {
                // Expand/collapse: ELK recomputes the full layout, so all
                // positions change.  Fit to screen so the user sees the
                // result centered, then reveal the hidden diagram.
                this.expandCollapseInProgress = false;
                const fitPromise = this.sprottyManager?.fitToScreen() ?? Promise.resolve();
                fitPromise.then(() => {
                    this.revealDiagramAfterLayout();
                    this.updateMinimapAfterLayout();
                }).catch(() => {
                    this.revealDiagramAfterLayout();
                    this.updateMinimapAfterLayout();
                });
            } else {
                // Subsequent layouts (edge routing change, manual auto-layout):
                // preserve current viewport, just update minimap
                this.updateMinimapAfterLayout();
            }
        } else {
            // On error, just reveal without fitToScreen
            this.revealDiagramAfterLayout();
        }
    }

    /**
     * Reveal the diagram after layout completes with smooth transition.
     */
    protected revealDiagramAfterLayout(): void {
        if (!this.svgContainer || !this.layoutPending) {
            return;
        }

        this.layoutPending = false;

        // Hide the progress bar
        if (this.progressBar) {
            this.progressBar.classList.add('hidden');
        }

        // Remove layout-pending (which had visibility: hidden)
        this.svgContainer.classList.remove('layout-pending');

        // Add layout-complete (sets opacity: 0, visibility: visible)
        this.svgContainer.classList.add('layout-complete');

        // Use double requestAnimationFrame to ensure the browser has painted the opacity: 0 state
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.svgContainer) {
                    // Add layout-reveal to trigger the opacity transition to 1
                    this.svgContainer.classList.add('layout-reveal');

                    // Clean up classes after transition completes
                    setTimeout(() => {
                        if (this.svgContainer) {
                            this.svgContainer.classList.remove('layout-complete', 'layout-reveal');
                        }
                    }, 200); // Match transition duration
                }
            });
        });

        this.logger.debug('[DiagramWidget] Layout complete - revealing diagram');
    }

    /**
     * Wait for SVG to have rendered content from Sprotty.
     * Sprotty's setModel dispatches actions but doesn't wait for rendering.
     * This polls until the SVG has at least one graph group (g.sprotty-graph).
     */
    protected waitForSvgContent(maxAttempts: number = 50, interval: number = 20): Promise<boolean> {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                attempts++;
                const svg = this.svgContainer?.querySelector('svg');
                // Check for sprotty-graph group (the main content group)
                const graphGroup = svg?.querySelector('g.sprotty-graph');
                // Also check if there are any child elements rendered
                const hasContent = graphGroup && graphGroup.children.length > 0;

                if (hasContent) {
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    this.logger.warn('[DiagramWidget] waitForSvgContent timeout - no content after max attempts');
                    resolve(false);
                } else {
                    requestAnimationFrame(check);
                }
            };
            // Start checking after one animation frame
            requestAnimationFrame(check);
        });
    }

    /**
     * Update minimap after layout completes (with small delay for DOM to settle).
     */
    protected updateMinimapAfterLayout(): void {
        setTimeout(() => {
            const registry = this.sprottyManager?.getUIExtensionRegistry();
            if (registry) {
                const minimap = registry.get('sanyam-minimap');
                if (minimap && 'forceUpdate' in minimap) {
                    (minimap as any).forceUpdate();
                } else if (minimap && 'updateMinimap' in minimap) {
                    (minimap as any).updateMinimap();
                }
            }
        }, 200);
    }

    /**
     * Update resize handles based on current selection.
     * Shows handles for single-node selection, hides for multi/no selection.
     */
    protected updateResizeHandles(selectedIds: string[]): void {
        const registry = this.sprottyManager?.getUIExtensionRegistry();
        if (!registry) {
            return;
        }
        const resizeHandles = registry.get(RESIZE_HANDLES_ID);
        if (!resizeHandles) {
            return;
        }
        const ext = resizeHandles as ResizeHandlesExtension;
        if (selectedIds.length === 1) {
            ext.showHandlesForElement(selectedIds[0]);
        } else {
            ext.hideHandles();
        }
    }

    /**
     * Collect current view state (zoom, toggles) for persistence.
     */
    protected collectViewState(): DiagramViewState {
        const viewState: DiagramViewState = {
            zoom: this.state.viewport.zoom,
            scroll: { ...this.state.viewport.scroll },
        };

        // Collect toggle states from UI extensions
        const registry = this.sprottyManager?.getUIExtensionRegistry();
        if (registry) {
            const snapGridTool = registry.get('sanyam-snap-grid-tool');
            if (snapGridTool && 'getConfig' in snapGridTool) {
                viewState.snapToGrid = (snapGridTool as any).getConfig().enabled ?? false;
            }
            const minimap = registry.get('sanyam-minimap');
            if (minimap && 'isVisible' in minimap) {
                viewState.minimapVisible = (minimap as any).isVisible();
            }
        }

        // Collect edge routing state
        if (this.edgeRoutingService) {
            viewState.arrowheadsVisible = this.edgeRoutingService.arrowheadsVisible;
            viewState.edgeJumpsEnabled = this.edgeRoutingService.edgeJumpsEnabled;
            viewState.edgeRoutingMode = this.edgeRoutingService.currentMode;
        }

        return viewState;
    }

    /**
     * Restore view state (zoom, toggles) from saved layout.
     */
    protected async restoreViewState(viewState: DiagramViewState): Promise<void> {
        // Restore zoom and scroll
        if (viewState.zoom !== undefined) {
            const zoom = Math.max(0.1, Math.min(5, viewState.zoom));
            this.state.viewport.zoom = zoom;
            const scroll = viewState.scroll ?? { x: 0, y: 0 };
            this.state.viewport.scroll = scroll;
            await this.sprottyManager?.setViewport(scroll, zoom, false);
        }

        // Restore toggle states
        if (viewState.snapToGrid !== undefined) {
            const registry = this.sprottyManager?.getUIExtensionRegistry();
            if (registry) {
                const snapGridTool = registry.get('sanyam-snap-grid-tool');
                if (snapGridTool && 'getConfig' in snapGridTool && 'setEnabled' in snapGridTool) {
                    const currentEnabled = (snapGridTool as any).getConfig().enabled ?? false;
                    if (currentEnabled !== viewState.snapToGrid) {
                        (snapGridTool as any).setEnabled(viewState.snapToGrid);
                    }
                }
            }
        }

        if (viewState.minimapVisible !== undefined) {
            const registry = this.sprottyManager?.getUIExtensionRegistry();
            if (registry) {
                const minimap = registry.get('sanyam-minimap');
                if (minimap && 'setVisible' in minimap) {
                    (minimap as any).setVisible(viewState.minimapVisible);
                }
            }
        }

        // Restore edge routing state
        if (this.edgeRoutingService) {
            if (viewState.arrowheadsVisible !== undefined) {
                this.edgeRoutingService.setArrowheadsVisible(viewState.arrowheadsVisible);
            }
            if (viewState.edgeJumpsEnabled !== undefined) {
                this.edgeRoutingService.setEdgeJumpsEnabled(viewState.edgeJumpsEnabled);
            }
            if (viewState.edgeRoutingMode !== undefined) {
                this.edgeRoutingService.setMode(viewState.edgeRoutingMode as any);
            }
        }
    }

    /**
     * Save layout to storage (debounced).
     * Collects all element positions, sizes, and view state.
     */
    protected saveLayoutDebounced(): void {
        if (!this.layoutStorageService) {
            return;
        }

        // Build element layouts from current state
        const elements: Record<string, ElementLayout> = {};
        for (const [id, position] of this.state.positions) {
            const size = this.state.sizes.get(id);
            elements[id] = {
                position,
                size,
            };
        }

        const viewState = this.collectViewState();

        this.logger.info({
            event: 'uuid:layout-save',
            uri: this.uri,
            idMapSize: Object.keys(this.state.idMap ?? {}).length,
            fingerprintCount: Object.keys(this.state.fingerprints ?? {}).length,
            elementCount: Object.keys(elements).length,
        }, 'UUID registry saved to browser storage');

        // Use debounced save, including UUID registry data and view state
        this.layoutStorageService.saveLayoutDebounced(
            this.uri, elements, this.state.idMap, this.state.fingerprints, viewState
        );
    }

    /**
     * Save layout immediately (without debouncing).
     */
    protected async saveLayoutImmediate(): Promise<void> {
        if (!this.layoutStorageService) {
            return;
        }

        // Build element layouts from current state
        const elements: Record<string, ElementLayout> = {};
        for (const [id, position] of this.state.positions) {
            const size = this.state.sizes.get(id);
            elements[id] = {
                position,
                size,
            };
        }

        const viewState = this.collectViewState();

        await this.layoutStorageService.saveLayout(
            this.uri, elements, this.state.idMap, this.state.fingerprints, viewState
        );
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
                this.logger.debug('[DiagramWidget] Model updated in Sprotty');
            } catch (error) {
                this.logger.error({ err: error }, 'Failed to update model in Sprotty');
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

        // Add position if available and valid (guards against NaN/Infinity)
        const position = this.state.positions.get(element.id);
        if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
            result.position = position;
        } else if (position) {
            this.logger.warn({ elementId: element.id, position }, 'Skipping invalid position (non-finite values)');
        }

        // Add size if available and valid
        const size = this.state.sizes.get(element.id);
        if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
            result.size = size;
        } else if (size) {
            this.logger.warn({ elementId: element.id, size }, 'Skipping invalid size (non-finite values)');
        }

        // Process children recursively
        if (element.children) {
            result.children = element.children.map(child => this.addPositionsToModel(child));
        }

        return result;
    }

    /**
     * Collect all element IDs from a GModel tree.
     */
    protected collectElementIds(element: GModelElementType, ids: Set<string>): void {
        ids.add(element.id);
        if (element.children) {
            for (const child of element.children) {
                this.collectElementIds(child, ids);
            }
        }
    }

    /**
     * Get the current diagram model.
     */
    getModel(): GModelRootType | undefined {
        return this.state.gModel;
    }

    /**
     * Get the source ranges map for outline↔diagram mapping.
     * Maps element IDs to their source code ranges (LSP line/character positions).
     */
    getSourceRanges(): ReadonlyMap<string, { start: { line: number; character: number }; end: { line: number; character: number } }> | undefined {
        return this.state.sourceRanges;
    }

    /**
     * Get the SVG container element for external integrations (e.g., drop handling).
     *
     * Snabbdom's virtual DOM patching may replace the original DOM element with a
     * new one (same ID, different reference) during the first render cycle.  To
     * ensure callers always receive the **live** element that is actually in the
     * DOM, we look it up by ID rather than returning the potentially stale private
     * field directly.
     */
    getSvgContainer(): HTMLElement | undefined {
        if (this.svgContainer) {
            const live = document.getElementById(this.svgContainer.id);
            if (live && live !== this.svgContainer) {
                // Snabbdom replaced the element — update our reference.
                this.svgContainer = live as HTMLDivElement;
            }
            return this.svgContainer;
        }
        return undefined;
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
     * Update positions in state (without triggering a re-render).
     * Callers should follow with setModel() to render the updated positions.
     */
    updatePositions(positions: Map<string, Point>): void {
        this.state.positions = new Map(positions);
    }

    /**
     * Update sizes in state (without triggering a re-render).
     * Callers should follow with setModel() to render the updated sizes.
     */
    updateSizes(sizes: Map<string, Dimension>): void {
        this.state.sizes = new Map(sizes);
    }

    /**
     * Update source ranges in state (for outline↔diagram mapping).
     * Maps element IDs to their source code ranges (LSP line/character positions).
     */
    updateSourceRanges(sourceRanges: Map<string, { start: { line: number; character: number }; end: { line: number; character: number } }>): void {
        this.state.sourceRanges = new Map(sourceRanges);
    }

    /**
     * Update UUID registry data (idMap and fingerprints) for layout persistence.
     * Called by CompositeEditorWidget after loadModel to ensure layout saves
     * include the registry data needed for UUID stability across restarts.
     */
    updateIdRegistry(idMap: Record<string, string>, fingerprints: Record<string, unknown>): void {
        this.state.idMap = idMap;
        this.state.fingerprints = fingerprints;
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
     * Zoom in by a factor.
     * Delegates to ViewportActionHandler which reads the live viewport from the DOM.
     */
    async zoomIn(factor: number = 1.2): Promise<void> {
        await this.dispatchAction({ kind: 'zoomIn', factor } as Action);
        this.saveLayoutDebounced();
    }

    /**
     * Zoom out by a factor.
     * Delegates to ViewportActionHandler which reads the live viewport from the DOM.
     */
    async zoomOut(factor: number = 1.2): Promise<void> {
        await this.dispatchAction({ kind: 'zoomOut', factor } as Action);
        this.saveLayoutDebounced();
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
        this.logger.debug({ actionKind: action.kind }, 'dispatchAction called');
        if (!this.sprottyManager) {
            this.logger.warn('[DiagramWidget] Cannot dispatch action - sprottyManager not initialized');
            return;
        }
        if (!this.sprottyInitialized) {
            this.logger.warn('[DiagramWidget] Cannot dispatch action - sprotty not fully initialized');
            return;
        }
        try {
            const modelSource = this.sprottyManager.getModelSource();
            this.logger.debug('[DiagramWidget] Dispatching to action dispatcher...');
            await modelSource.actionDispatcher.dispatch(action);
            this.logger.debug({ actionKind: action.kind }, 'Action dispatched successfully');
        } catch (error) {
            this.logger.error({ err: error }, 'Error dispatching action');
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
     * Check if snap-to-grid is enabled.
     */
    isSnapToGridEnabled(): boolean {
        const registry = this.sprottyManager?.getUIExtensionRegistry();
        if (registry) {
            const snapGridTool = registry.get('sanyam-snap-grid-tool');
            if (snapGridTool && 'getConfig' in snapGridTool) {
                return (snapGridTool as any).getConfig().enabled ?? false;
            }
        }
        return false;
    }

    /**
     * Dispose the widget.
     * T018: Saves layout immediately before disposing to ensure positions persist.
     */
    dispose(): void {
        // T018: Save layout immediately on close (don't wait for debounce)
        this.saveLayoutImmediate().catch(error => {
            this.logger.warn({ err: error }, 'Failed to save layout on dispose');
        });

        // Remove event listeners
        if (this.svgContainer) {
            this.svgContainer.removeEventListener('mousedown', this.handleCanvasMouseDown);
            this.svgContainer.removeEventListener('contextmenu', this.handleContextMenu);
        }

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

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    @inject(DiagramLayoutStorageService)
    protected readonly layoutStorageService: DiagramLayoutStorageService;

    @inject(EdgeRoutingService)
    protected readonly edgeRoutingService: EdgeRoutingService;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    /**
     * Create a diagram widget.
     */
    createWidget(options: DiagramWidget.Options): DiagramWidget {
        const widget = new DiagramWidget(options);
        widget.setPreferenceService(this.preferenceService);
        widget.setDiagramLanguageClient(this.diagramLanguageClient);
        widget.setLayoutStorageService(this.layoutStorageService);
        widget.setEdgeRoutingService(this.edgeRoutingService);
        widget.setContextMenuRenderer(this.contextMenuRenderer);
        return widget;
    }
}

/**
 * Export GModelRoot type for backwards compatibility.
 */
export type { GModelRootType as GModelRoot };
