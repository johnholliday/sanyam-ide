/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sprotty DI Configuration
 *
 * Configures the Sprotty dependency injection container for diagram rendering.
 * Sets up model sources, views, and action handlers.
 *
 * @packageDocumentation
 */

import { Container, ContainerModule, injectable, inject } from 'inversify';
import { createLogger } from '@sanyam/logger';
import {
    TYPES,
    configureModelElement,
    configureActionHandler,
    SGraphImpl,
    SGraphView,
    SNodeImpl,
    SEdgeImpl,
    SLabelImpl,
    SCompartmentImpl,
    SCompartmentView,
    SRoutingHandleView,
    configureViewerOptions,
    loadDefaultModules,
    LocalModelSource,
    MouseListener,
    SModelRootImpl,
    SModelElementImpl,
    IActionHandler,
} from 'sprotty';
import { SRoutingHandleImpl } from 'sprotty/lib/features/routing/model';
import { Action } from 'sprotty-protocol';
import { SanyamNodeImpl, SanyamNodeView, SanyamLabelImpl, SanyamLabelView } from './sanyam-node-view';
import { SanyamModelFactory, SanyamEdgeImpl, SanyamCompartmentImpl } from './sanyam-model-factory';
import { SanyamPortImpl, SanyamPortView } from '../ports';
import { SanyamEdgeView } from './sanyam-edge-view';
import { ScrollMouseListener } from 'sprotty/lib/features/viewport/scroll';
import { SanyamScrollMouseListener } from './sanyam-scroll-mouse-listener';
import {
    SModelRoot,
    SetModelAction,
    UpdateModelAction,
    CenterAction,
    FitToScreenAction,
    SelectAction,
    SelectAllAction,
    SetViewportAction,
} from 'sprotty-protocol';

import {
    createUIExtensionsModule,
    initializeUIExtensions,
    setUIExtensionsParentContainer,
    UIExtensionsModuleOptions,
    UIExtensionRegistry,
    UI_EXTENSION_REGISTRY,
    RequestToolPaletteAction,
} from '../ui-extensions';

import { createElkLayoutModule, LayoutCompleteAction, EdgeRoutingService, EdgeJumpPostprocessor } from '../layout';
import { GridSnapper, SnapGridServiceSymbol, SnapGridTool, type SnapGridService } from '../ui-extensions/snap-to-grid';

/**
 * Service identifier for the diagram ID.
 */
export const DIAGRAM_ID = Symbol.for('DiagramId');

/**
 * Callback type for layout completion.
 */
export type LayoutCompleteCallback = (success: boolean, error?: string) => void;

/**
 * Service identifier for layout complete callback.
 */
export const LAYOUT_COMPLETE_CALLBACK = Symbol.for('LayoutCompleteCallback');

/**
 * Callback type for selection changes.
 */
export type SelectionChangedCallback = (selectedIds: string[]) => void;

/**
 * Service identifier for selection changed callback.
 */
export const SELECTION_CHANGED_CALLBACK = Symbol.for('SelectionChangedCallback');

/**
 * Action handler for selection changes.
 * Intercepts Sprotty's SelectAction and SelectAllAction to notify external listeners.
 */
@injectable()
export class SelectionChangeActionHandler implements IActionHandler {
    @inject(SELECTION_CHANGED_CALLBACK)
    protected callback: SelectionChangedCallback;

    /** Track currently selected element IDs */
    private selectedIds: Set<string> = new Set();

    handle(action: Action): void {
        if (action.kind === 'elementSelected') {
            const selectAction = action as SelectAction;
            for (const id of selectAction.deselectedElementsIDs ?? []) {
                this.selectedIds.delete(id);
            }
            for (const id of selectAction.selectedElementsIDs ?? []) {
                this.selectedIds.add(id);
            }
            this.callback([...this.selectedIds]);
        } else if (action.kind === 'allSelected') {
            const selectAllAction = action as SelectAllAction;
            if (!selectAllAction.select) {
                this.selectedIds.clear();
            }
            this.callback([...this.selectedIds]);
        }
    }
}

/**
 * Action handler for layout completion.
 * Invokes registered callbacks when layout completes.
 */
@injectable()
export class LayoutCompleteActionHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'SprottyDiConfig' });

    @inject(LAYOUT_COMPLETE_CALLBACK)
    protected callback: LayoutCompleteCallback;

    handle(action: Action): void {
        if (action.kind === LayoutCompleteAction.KIND) {
            const layoutAction = action as LayoutCompleteAction;
            this.logger.debug({ success: layoutAction.success }, 'Layout complete');
            this.callback(layoutAction.success, layoutAction.error);
        }
    }
}

/**
 * Sprotty model element types used in Sanyam diagrams.
 * These must match the ElementTypes from the language-server's conversion-types.ts
 */
export const SanyamModelTypes = {
    // Container types
    GRAPH: 'graph',

    // Node types - must match backend ElementTypes
    NODE: 'node',
    NODE_DEFAULT: 'node:default',
    NODE_ENTITY: 'node:entity',
    NODE_COMPONENT: 'node:component',
    NODE_PROPERTY: 'node:property',
    NODE_PACKAGE: 'node:package',
    NODE_GENERIC: 'node:generic',

    // Edge types - must match backend ElementTypes
    EDGE: 'edge',
    EDGE_DEFAULT: 'edge:default',
    EDGE_REFERENCE: 'edge:reference',
    EDGE_INHERITANCE: 'edge:inheritance',
    EDGE_COMPOSITION: 'edge:composition',
    EDGE_AGGREGATION: 'edge:aggregation',

    // Label types
    LABEL: 'label',
    LABEL_HEADING: 'label:heading',
    LABEL_TEXT: 'label:text',
    LABEL_ICON: 'label:icon',

    // Compartment types
    COMPARTMENT: 'compartment',
    COMPARTMENT_MAIN: 'comp:main',
    COMPARTMENT_HEADER: 'compartment:header',
    COMPARTMENT_BODY: 'compartment:body',

    // Port types
    PORT: 'port',
    PORT_DEFAULT: 'port:default',
    PORT_INPUT: 'port:input',
    PORT_OUTPUT: 'port:output',

    // Routing types
    ROUTING_POINT: 'routing-point',
    VOLATILE_ROUTING_POINT: 'volatile-routing-point',
} as const;

// Re-export model classes from their modules for backwards compatibility
export { SanyamNodeImpl as SanyamNode } from './sanyam-node-view';
export { SanyamEdgeImpl as SanyamEdge, SanyamCompartmentImpl as SanyamCompartment } from './sanyam-model-factory';
export { SanyamLabelImpl as SanyamLabel } from './sanyam-node-view';

/**
 * Callback type for diagram events.
 */
export interface DiagramEventCallbacks {
    onSelectionChanged?: (selectedIds: string[]) => void;
    onMoveCompleted?: (elementId: string, newPosition: { x: number; y: number }) => void;
    onDoubleClick?: (elementId: string) => void;
}

/**
 * Custom mouse listener for handling diagram interactions.
 */
@injectable()
export class SanyamMouseListener extends MouseListener {
    @inject(DIAGRAM_ID) protected diagramId!: string;

    private callbacks: DiagramEventCallbacks = {};

    setCallbacks(callbacks: DiagramEventCallbacks): void {
        this.callbacks = callbacks;
    }

    /** Track whether a canvas mouseDown occurred without Ctrl */
    private canvasMouseDown = false;
    /** Track whether the mouse moved (drag/pan) since mouseDown */
    private hasDraggedSinceDown = false;

    mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        // Track canvas click for deselect-on-mouseUp (not mouseDown, to avoid
        // deselecting when the user is about to pan/drag the canvas)
        if (target instanceof SModelRootImpl && !event.ctrlKey && !event.metaKey) {
            this.canvasMouseDown = true;
            this.hasDraggedSinceDown = false;
        } else {
            this.canvasMouseDown = false;
        }
        return super.mouseDown(target, event);
    }

    override mouseMove(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.canvasMouseDown) {
            this.hasDraggedSinceDown = true;
        }
        return super.mouseMove(target, event);
    }

    mouseUp(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        const actions: (Action | Promise<Action>)[] = [];

        // Deselect all on canvas click (not drag/pan)
        if (this.canvasMouseDown && !this.hasDraggedSinceDown) {
            const deselectAction: SelectAllAction = {
                kind: 'allSelected',
                select: false,
            };
            actions.push(deselectAction);
        }
        this.canvasMouseDown = false;
        this.hasDraggedSinceDown = false;

        // Handle move completion
        if (target instanceof SanyamNodeImpl) {
            const node = target;
            if (this.callbacks.onMoveCompleted && node.position) {
                this.callbacks.onMoveCompleted(node.id, { x: node.position.x, y: node.position.y });
            }
        }
        return [...actions, ...super.mouseUp(target, event)];
    }

    doubleClick(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.callbacks.onDoubleClick) {
            this.callbacks.onDoubleClick(target.id);
        }
        return super.doubleClick(target, event);
    }
}

/**
 * Create the base Sprotty module for Sanyam diagrams.
 *
 * This module registers:
 * - SanyamNodeView for all node types (handles shape-based rendering)
 * - SanyamModelFactory for type-agnostic model instantiation
 * - Standard views for edges, labels, compartments, and ports
 */
function createSanyamDiagramModule(): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        // Configure model element views
        const context = { bind, unbind, isBound, rebind };

        // Rebind model factory to our custom one for grammar-agnostic type handling
        // (Sprotty's default modules already bind IModelFactory)
        rebind(TYPES.IModelFactory).to(SanyamModelFactory).inSingletonScope();

        // Graph root
        configureModelElement(context, SanyamModelTypes.GRAPH, SGraphImpl, SGraphView);

        // Nodes - Use SanyamNodeView for shape-based rendering
        // The custom SanyamModelFactory will instantiate SanyamNodeImpl for any node-like type
        configureModelElement(context, SanyamModelTypes.NODE, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_DEFAULT, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_ENTITY, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_COMPONENT, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_PROPERTY, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_PACKAGE, SanyamNodeImpl, SanyamNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_GENERIC, SanyamNodeImpl, SanyamNodeView);

        // Edges - register all backend edge types with SanyamEdgeView for dynamic routing
        configureModelElement(context, SanyamModelTypes.EDGE, SanyamEdgeImpl, SanyamEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_DEFAULT, SanyamEdgeImpl, SanyamEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_REFERENCE, SanyamEdgeImpl, SanyamEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_INHERITANCE, SanyamEdgeImpl, SanyamEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_COMPOSITION, SanyamEdgeImpl, SanyamEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_AGGREGATION, SanyamEdgeImpl, SanyamEdgeView);

        // Labels - register with custom SanyamLabelView for quote stripping and word-wrap (FR-008, FR-009)
        configureModelElement(context, SanyamModelTypes.LABEL, SanyamLabelImpl, SanyamLabelView);
        configureModelElement(context, SanyamModelTypes.LABEL_HEADING, SanyamLabelImpl, SanyamLabelView);
        configureModelElement(context, SanyamModelTypes.LABEL_TEXT, SanyamLabelImpl, SanyamLabelView);
        configureModelElement(context, SanyamModelTypes.LABEL_ICON, SanyamLabelImpl, SanyamLabelView);

        // Compartments - register all backend compartment types
        configureModelElement(context, SanyamModelTypes.COMPARTMENT, SanyamCompartmentImpl, SCompartmentView);
        configureModelElement(context, SanyamModelTypes.COMPARTMENT_MAIN, SanyamCompartmentImpl, SCompartmentView);
        configureModelElement(context, SanyamModelTypes.COMPARTMENT_HEADER, SanyamCompartmentImpl, SCompartmentView);
        configureModelElement(context, SanyamModelTypes.COMPARTMENT_BODY, SanyamCompartmentImpl, SCompartmentView);

        // T065: Ports - register with custom SanyamPortView for visual feedback
        configureModelElement(context, SanyamModelTypes.PORT, SanyamPortImpl, SanyamPortView);
        configureModelElement(context, SanyamModelTypes.PORT_DEFAULT, SanyamPortImpl, SanyamPortView);
        configureModelElement(context, SanyamModelTypes.PORT_INPUT, SanyamPortImpl, SanyamPortView);
        configureModelElement(context, SanyamModelTypes.PORT_OUTPUT, SanyamPortImpl, SanyamPortView);

        // Routing points (for edge routing handles)
        configureModelElement(context, SanyamModelTypes.ROUTING_POINT, SRoutingHandleImpl, SRoutingHandleView);
        configureModelElement(context, SanyamModelTypes.VOLATILE_ROUTING_POINT, SRoutingHandleImpl, SRoutingHandleView);

        // Bind custom mouse listener
        bind(SanyamMouseListener).toSelf().inSingletonScope();
        bind(TYPES.MouseListener).toService(SanyamMouseListener);

        // Bind edge jump postprocessor for line bridges at edge crossings
        bind(EdgeJumpPostprocessor).toSelf().inSingletonScope();
        bind(TYPES.IVNodePostprocessor).toService(EdgeJumpPostprocessor);
    });
}

/**
 * Options for creating a Sanyam diagram container.
 */
export interface CreateDiagramContainerOptions {
    /** Unique identifier for the diagram widget */
    diagramId: string;
    /** Whether to enable move action support */
    needsMoveAction?: boolean;
    /** UI Extensions options */
    uiExtensions?: Partial<UIExtensionsModuleOptions>;
    /** Callback invoked when layout completes */
    onLayoutComplete?: LayoutCompleteCallback;
    /** Edge routing service for dynamic edge routing mode */
    edgeRoutingService?: EdgeRoutingService;
    /** Snap grid service for snap-to-grid functionality */
    snapGridService?: SnapGridService;
}

/**
 * Create a Sprotty container configured for Sanyam diagrams.
 *
 * @param options - Container creation options
 * @returns Configured Inversify container
 */
export function createSanyamDiagramContainer(options: CreateDiagramContainerOptions): Container {
    const container = new Container();

    // Load default Sprotty modules
    loadDefaultModules(container);

    // Load Sanyam-specific module
    container.load(createSanyamDiagramModule());

    // Rebind ScrollMouseListener to SanyamScrollMouseListener to support preventScrolling.
    // Done on the container directly (not in a ContainerModule) for reliable rebind behavior.
    container.rebind(ScrollMouseListener).to(SanyamScrollMouseListener).inSingletonScope();
    container.bind(SanyamScrollMouseListener).toService(ScrollMouseListener);

    // Load ELK layout module BEFORE binding LocalModelSource
    // This ensures IModelLayoutEngine is available when LocalModelSource is instantiated
    container.load(createElkLayoutModule(undefined, options.edgeRoutingService));

    // Bind LocalModelSource to TYPES.ModelSource directly on the container
    // (modelSourceModule provides the wiring but not the actual binding)
    // NOTE: This must be bound AFTER the ELK module so layoutEngine is injected properly
    container.bind(TYPES.ModelSource).to(LocalModelSource).inSingletonScope();
    container.bind(DIAGRAM_ID).toConstantValue(options.diagramId);

    // Configure viewer options for the diagram
    configureViewerOptions(container, {
        needsClientLayout: true,
        needsServerLayout: false,
        baseDiv: options.diagramId,
        hiddenDiv: `${options.diagramId}-hidden`,
    });

    // Bind layout complete callback (default no-op if not provided)
    const layoutCallback: LayoutCompleteCallback = options.onLayoutComplete ?? (() => {});
    container.bind(LAYOUT_COMPLETE_CALLBACK).toConstantValue(layoutCallback);

    // Bind and configure layout complete action handler
    container.bind(LayoutCompleteActionHandler).toSelf().inSingletonScope();
    configureActionHandler({ bind: container.bind.bind(container), isBound: container.isBound.bind(container) }, LayoutCompleteAction.KIND, LayoutCompleteActionHandler);

    // Bind selection changed callback (default no-op, overridden via setCallbacks)
    container.bind(SELECTION_CHANGED_CALLBACK).toConstantValue(() => {});

    // Bind and configure selection change action handler
    container.bind(SelectionChangeActionHandler).toSelf().inSingletonScope();
    const actionHandlerCtx = { bind: container.bind.bind(container), isBound: container.isBound.bind(container) };
    configureActionHandler(actionHandlerCtx, 'elementSelected', SelectionChangeActionHandler);
    configureActionHandler(actionHandlerCtx, 'allSelected', SelectionChangeActionHandler);

    // Load UI Extensions module if any extensions are enabled
    const uiExtensionsOptions: UIExtensionsModuleOptions = {
        diagramContainerId: options.diagramId,
        enableToolPalette: options.uiExtensions?.enableToolPalette ?? true,
        enableValidation: options.uiExtensions?.enableValidation ?? true,
        enableEditLabel: options.uiExtensions?.enableEditLabel ?? true,
        enableCommandPalette: options.uiExtensions?.enableCommandPalette ?? true,
        enableEdgeCreation: options.uiExtensions?.enableEdgeCreation ?? true,
        enableHelperLines: options.uiExtensions?.enableHelperLines ?? true,
        enableMarqueeSelection: options.uiExtensions?.enableMarqueeSelection ?? true,
        enableResizeHandles: options.uiExtensions?.enableResizeHandles ?? true,
        enablePopup: options.uiExtensions?.enablePopup ?? true,
        enableMinimap: options.uiExtensions?.enableMinimap ?? true,
        enableQuickMenu: options.uiExtensions?.enableQuickMenu ?? true,
        // Pass existing SnapGridTool from Theia container to avoid creating duplicate instance
        snapGridTool: options.snapGridService as SnapGridTool | undefined,
    };

    container.load(createUIExtensionsModule(uiExtensionsOptions));

    // Bind snap-to-grid snapper for Sprotty's ISnapper interface
    // This enables snapping during drag operations
    if (options.snapGridService) {
        console.log('[SprottyDiConfig] Binding SnapGridService from options');
        container.bind(SnapGridServiceSymbol).toConstantValue(options.snapGridService);
    } else {
        console.log('[SprottyDiConfig] No SnapGridService provided in options');
    }
    console.log('[SprottyDiConfig] Binding GridSnapper to TYPES.ISnapper');
    container.bind(GridSnapper).toSelf().inSingletonScope();
    container.bind(TYPES.ISnapper).toService(GridSnapper);

    return container;
}

/**
 * GModel root type alias for compatibility.
 */
export type GModelRoot = SModelRoot;

/**
 * Helper class for managing a Sprotty diagram instance.
 */
export class SprottyDiagramManager {
    private readonly logger = createLogger({ name: 'SprottyDiConfig' });
    private container: Container;
    private modelSource: LocalModelSource;
    private mouseListener: SanyamMouseListener;
    private currentRoot: SModelRootImpl | undefined;
    private uiExtensionsOptions: UIExtensionsModuleOptions;
    private uiExtensionsInitialized: boolean = false;

    constructor(options: CreateDiagramContainerOptions) {
        this.container = createSanyamDiagramContainer(options);
        this.modelSource = this.container.get<LocalModelSource>(TYPES.ModelSource);
        this.mouseListener = this.container.get<SanyamMouseListener>(SanyamMouseListener);

        // Store UI extensions options for later initialization
        this.uiExtensionsOptions = {
            diagramContainerId: options.diagramId,
            enableToolPalette: options.uiExtensions?.enableToolPalette ?? true,
            enableValidation: options.uiExtensions?.enableValidation ?? true,
            enableEditLabel: options.uiExtensions?.enableEditLabel ?? true,
            enableCommandPalette: options.uiExtensions?.enableCommandPalette ?? true,
            enableEdgeCreation: options.uiExtensions?.enableEdgeCreation ?? true,
            enableHelperLines: options.uiExtensions?.enableHelperLines ?? true,
            enableMarqueeSelection: options.uiExtensions?.enableMarqueeSelection ?? true,
            enableResizeHandles: options.uiExtensions?.enableResizeHandles ?? true,
            enablePopup: options.uiExtensions?.enablePopup ?? true,
            enableMinimap: options.uiExtensions?.enableMinimap ?? true,
        };
    }

    /**
     * Set a callback to be invoked when layout completes.
     * Note: This must be called before setModel() to take effect.
     */
    setLayoutCompleteCallback(callback: LayoutCompleteCallback): void {
        // Rebind the callback in the container
        if (this.container.isBound(LAYOUT_COMPLETE_CALLBACK)) {
            this.container.rebind(LAYOUT_COMPLETE_CALLBACK).toConstantValue(callback);
        }
    }

    /**
     * Get the DI container.
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Get the model source.
     */
    getModelSource(): LocalModelSource {
        return this.modelSource;
    }

    /**
     * Set event callbacks.
     */
    setCallbacks(callbacks: DiagramEventCallbacks): void {
        this.mouseListener.setCallbacks(callbacks);

        // Wire selection changed callback into the Sprotty container
        if (callbacks.onSelectionChanged) {
            if (this.container.isBound(SELECTION_CHANGED_CALLBACK)) {
                this.container.rebind(SELECTION_CHANGED_CALLBACK).toConstantValue(callbacks.onSelectionChanged);
            }
        }
    }

    /**
     * Set the diagram model.
     */
    async setModel(model: GModelRoot): Promise<void> {
        this.logger.debug({ id: model.id, type: model.type, childCount: model.children?.length ?? 0 }, 'setModel called');

        // Log child types for debugging
        if (model.children && model.children.length > 0) {
            const typeCount = new Map<string, number>();
            for (const child of model.children) {
                const count = typeCount.get(child.type) ?? 0;
                typeCount.set(child.type, count + 1);
            }
            this.logger.debug({ childTypes: Object.fromEntries(typeCount) }, 'Child types');
        }

        this.currentRoot = model as unknown as SModelRootImpl;
        await this.modelSource.setModel(model);
        this.logger.debug('setModel completed');
    }

    /**
     * Update the diagram model.
     */
    async updateModel(model: GModelRoot): Promise<void> {
        this.currentRoot = model as unknown as SModelRootImpl;
        await this.modelSource.updateModel(model);
    }

    /**
     * Get the current model.
     */
    getModel(): SModelRootImpl | undefined {
        return this.currentRoot;
    }

    /**
     * Center the diagram on specific elements or all elements.
     */
    async center(elementIds?: string[]): Promise<void> {
        const action: CenterAction = {
            kind: 'center',
            elementIds: elementIds ?? [],
            animate: true,
            retainZoom: false,
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Fit the diagram to the screen.
     */
    async fitToScreen(elementIds?: string[], padding?: number): Promise<void> {
        const action: FitToScreenAction = {
            kind: 'fit',
            elementIds: elementIds ?? [],
            padding: padding ?? 20,
            animate: true,
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Select elements.
     */
    async select(elementIds: string[], deselect?: boolean): Promise<void> {
        const action: SelectAction = {
            kind: 'elementSelected',
            selectedElementsIDs: deselect ? [] : elementIds,
            deselectedElementsIDs: deselect ? elementIds : [],
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Select all elements.
     */
    async selectAll(select: boolean = true): Promise<void> {
        const action: SelectAllAction = {
            kind: 'allSelected',
            select,
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Set viewport.
     */
    async setViewport(scroll: { x: number; y: number }, zoom: number, animate: boolean = true): Promise<void> {
        // Get the root element ID from the model (dynamically)
        const model = (this.modelSource as any).model;
        const elementId = model?.id ?? 'graph';

        const action: SetViewportAction = {
            kind: 'viewport',
            elementId,
            newViewport: {
                scroll,
                zoom,
            },
            animate,
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Initialize UI extensions.
     * Call this after the diagram container is added to the DOM.
     */
    initializeUIExtensions(): void {
        if (this.uiExtensionsInitialized) {
            return;
        }

        initializeUIExtensions(this.container, this.uiExtensionsOptions);
        this.uiExtensionsInitialized = true;
    }

    /**
     * Set the parent container element for UI extensions.
     * This allows UI extensions to render their DOM elements.
     *
     * @param parentElement - The HTML element to use as parent for UI extension containers
     */
    setUIExtensionsParentContainer(parentElement: HTMLElement): void {
        setUIExtensionsParentContainer(this.container, parentElement, this.uiExtensionsOptions);
    }

    /**
     * Get the UI extension registry.
     */
    getUIExtensionRegistry(): UIExtensionRegistry | undefined {
        try {
            return this.container.get<UIExtensionRegistry>(UI_EXTENSION_REGISTRY);
        } catch {
            return undefined;
        }
    }

    /**
     * Request the tool palette from the server.
     * Dispatches a RequestToolPaletteAction to fetch palette items.
     */
    async requestToolPalette(): Promise<void> {
        if (this.uiExtensionsOptions.enableToolPalette) {
            await this.modelSource.actionDispatcher.dispatch(RequestToolPaletteAction.create());
        }
    }

    /**
     * Request automatic layout of the diagram using ELK.
     * Dispatches a RequestLayoutAction to trigger the layout engine.
     */
    async requestLayout(): Promise<void> {
        this.logger.debug('Requesting layout...');
        try {
            const { RequestLayoutAction } = await import('../layout');
            this.logger.debug('RequestLayoutAction imported, dispatching...');
            await this.modelSource.actionDispatcher.dispatch(RequestLayoutAction.create());
            this.logger.debug('Layout action dispatched');
        } catch (error) {
            this.logger.error({ err: error }, 'Layout request failed');
        }
    }

    /**
     * Dispose the diagram manager.
     */
    dispose(): void {
        // Clean up UI extensions
        const registry = this.getUIExtensionRegistry();
        if (registry) {
            registry.dispose();
        }

        // Clean up resources
        this.currentRoot = undefined;
    }
}

/**
 * Export types for external use.
 */
export {
    Container,
    TYPES,
    LocalModelSource,
    SGraphImpl as SGraph,
    SNodeImpl as SNode,
    SEdgeImpl as SEdge,
    SLabelImpl as SLabel,
    SCompartmentImpl as SCompartment,
    SModelRootImpl as SModelRoot,
    SetModelAction,
    UpdateModelAction,
    Action,
};
