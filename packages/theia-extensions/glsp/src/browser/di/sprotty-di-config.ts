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
import {
    TYPES,
    configureModelElement,
    SGraphImpl,
    SGraphView,
    SNodeImpl,
    RectangularNodeView,
    CircularNodeView,
    SEdgeImpl,
    PolylineEdgeView,
    SLabelImpl,
    SLabelView,
    SCompartmentImpl,
    SCompartmentView,
    configureViewerOptions,
    loadDefaultModules,
    LocalModelSource,
    MouseListener,
    SModelRootImpl,
    SModelElementImpl,
    SPortImpl,
} from 'sprotty';
import { Action } from 'sprotty-protocol';
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

/**
 * Service identifier for the diagram ID.
 */
export const DIAGRAM_ID = Symbol.for('DiagramId');

/**
 * Sprotty model element types used in Sanyam diagrams.
 */
export const SanyamModelTypes = {
    GRAPH: 'graph',
    NODE: 'node:default',
    NODE_ENTITY: 'node:entity',
    NODE_COMPONENT: 'node:component',
    EDGE: 'edge:default',
    EDGE_INHERITANCE: 'edge:inheritance',
    EDGE_COMPOSITION: 'edge:composition',
    LABEL: 'label',
    LABEL_HEADING: 'label:heading',
    LABEL_TEXT: 'label:text',
    COMPARTMENT: 'comp:main',
    COMPARTMENT_HEADER: 'comp:header',
    PORT: 'port:default',
} as const;

/**
 * Extended SNode with Sanyam-specific properties.
 */
export class SanyamNode extends SNodeImpl {
    cssClasses?: string[];
    nodeType?: string;
    trace?: string;
}

/**
 * Extended SEdge with Sanyam-specific properties.
 */
export class SanyamEdge extends SEdgeImpl {
    cssClasses?: string[];
    edgeType?: string;
}

/**
 * Extended SLabel with Sanyam-specific properties.
 */
export class SanyamLabel extends SLabelImpl {
    cssClasses?: string[];
}

/**
 * Extended SCompartment with Sanyam-specific properties.
 */
export class SanyamCompartment extends SCompartmentImpl {
    cssClasses?: string[];
}

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

    mouseUp(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        // Handle move completion
        if (target instanceof SNodeImpl) {
            const node = target as SanyamNode;
            if (this.callbacks.onMoveCompleted && node.position) {
                this.callbacks.onMoveCompleted(node.id, { x: node.position.x, y: node.position.y });
            }
        }
        return super.mouseUp(target, event);
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
 */
function createSanyamDiagramModule(): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        // Configure model element views
        const context = { bind, unbind, isBound, rebind };

        // Graph root
        configureModelElement(context, SanyamModelTypes.GRAPH, SGraphImpl, SGraphView);

        // Nodes
        configureModelElement(context, SanyamModelTypes.NODE, SanyamNode, RectangularNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_ENTITY, SanyamNode, RectangularNodeView);
        configureModelElement(context, SanyamModelTypes.NODE_COMPONENT, SanyamNode, RectangularNodeView);

        // Edges
        configureModelElement(context, SanyamModelTypes.EDGE, SanyamEdge, PolylineEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_INHERITANCE, SanyamEdge, PolylineEdgeView);
        configureModelElement(context, SanyamModelTypes.EDGE_COMPOSITION, SanyamEdge, PolylineEdgeView);

        // Labels
        configureModelElement(context, SanyamModelTypes.LABEL, SanyamLabel, SLabelView);
        configureModelElement(context, SanyamModelTypes.LABEL_HEADING, SanyamLabel, SLabelView);
        configureModelElement(context, SanyamModelTypes.LABEL_TEXT, SanyamLabel, SLabelView);

        // Compartments
        configureModelElement(context, SanyamModelTypes.COMPARTMENT, SanyamCompartment, SCompartmentView);
        configureModelElement(context, SanyamModelTypes.COMPARTMENT_HEADER, SanyamCompartment, SCompartmentView);

        // Ports (using CircularNodeView for small port rendering)
        configureModelElement(context, SanyamModelTypes.PORT, SPortImpl, CircularNodeView);

        // Bind custom mouse listener
        bind(SanyamMouseListener).toSelf().inSingletonScope();
        bind(TYPES.MouseListener).toService(SanyamMouseListener);
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

    // Bind LocalModelSource to TYPES.ModelSource directly on the container
    // (modelSourceModule provides the wiring but not the actual binding)
    container.bind(TYPES.ModelSource).to(LocalModelSource).inSingletonScope();
    container.bind(DIAGRAM_ID).toConstantValue(options.diagramId);

    // Configure viewer options for the diagram
    configureViewerOptions(container, {
        needsClientLayout: true,
        needsServerLayout: false,
        baseDiv: options.diagramId,
        hiddenDiv: `${options.diagramId}-hidden`,
    });

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
    private container: Container;
    private modelSource: LocalModelSource;
    private mouseListener: SanyamMouseListener;
    private currentRoot: SModelRootImpl | undefined;

    constructor(options: CreateDiagramContainerOptions) {
        this.container = createSanyamDiagramContainer(options);
        this.modelSource = this.container.get<LocalModelSource>(TYPES.ModelSource);
        this.mouseListener = this.container.get<SanyamMouseListener>(SanyamMouseListener);
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
    }

    /**
     * Set the diagram model.
     */
    async setModel(model: GModelRoot): Promise<void> {
        this.currentRoot = model as unknown as SModelRootImpl;
        await this.modelSource.setModel(model);
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
        const action: SetViewportAction = {
            kind: 'viewport',
            elementId: 'graph',
            newViewport: {
                scroll,
                zoom,
            },
            animate,
        };
        await this.modelSource.actionDispatcher.dispatch(action);
    }

    /**
     * Dispose the diagram manager.
     */
    dispose(): void {
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
