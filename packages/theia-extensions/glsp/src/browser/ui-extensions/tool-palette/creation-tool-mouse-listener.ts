/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Creation Tool Mouse Listener
 *
 * Handles mouse events for element creation when a creation tool is active.
 * Listens for tool state changes and creates elements on canvas clicks.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional, postConstruct } from 'inversify';
import {
    MouseListener,
    SModelElementImpl,
    SGraphImpl,
    findParentByFeature,
    isViewport,
    TYPES,
    IActionDispatcher,
    SNodeImpl,
} from 'sprotty';
import { Action, Point } from 'sprotty-protocol';
import {
    ToolPaletteActionHandler,
    CreationToolState,
} from './tool-palette-action-handler';
import {
    CreateElementAction,
    EnableDefaultToolsAction,
} from './tool-palette-actions';

/**
 * Mouse listener that handles element creation when a creation tool is active.
 */
@injectable()
export class CreationToolMouseListener extends MouseListener {
    protected readonly logger = createLogger({ name: 'CreationTool' });

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher!: IActionDispatcher;

    @inject(ToolPaletteActionHandler) @optional()
    protected toolPaletteActionHandler?: ToolPaletteActionHandler;

    /** Current creation tool state */
    protected creationToolState: CreationToolState = { isActive: false };

    /** For edge creation: the source element ID */
    protected edgeSourceId?: string;

    @postConstruct()
    protected init(): void {
        // Subscribe to tool state changes
        if (this.toolPaletteActionHandler) {
            this.toolPaletteActionHandler.addToolStateListener((state) => {
                this.logger.info({ state }, 'Tool state changed');
                this.creationToolState = state;
                // Reset edge source when tool changes
                if (!state.isActive || state.toolKind !== 'edge') {
                    this.edgeSourceId = undefined;
                }
            });
        }
    }

    /**
     * Handle mouse down events for element creation.
     */
    override mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (!this.creationToolState.isActive) {
            return [];
        }

        const { toolKind, elementTypeId, args } = this.creationToolState;
        this.logger.info({ toolKind, elementTypeId, targetType: target.type, targetId: target.id }, 'Mouse down with active tool');

        if (toolKind === 'node') {
            // Create node at click position
            return this.handleNodeCreation(target, event, elementTypeId!, args);
        } else if (toolKind === 'edge') {
            // Handle edge creation (source then target selection)
            return this.handleEdgeCreation(target, event, elementTypeId!, args);
        }

        return [];
    }

    /**
     * Handle node creation on canvas click.
     */
    protected handleNodeCreation(
        target: SModelElementImpl,
        event: MouseEvent,
        elementTypeId: string,
        args?: Record<string, any>
    ): (Action | Promise<Action>)[] {
        // Get the position in model coordinates
        const position = this.getModelPosition(target, event);
        if (!position) {
            this.logger.warn('Could not determine click position');
            return [];
        }

        this.logger.info({ position }, 'Creating node at position');

        // Dispatch create element action
        const createAction = CreateElementAction.createNode(elementTypeId, position, args);

        // Reset to default tool after creation
        const resetAction = EnableDefaultToolsAction.create();

        return [createAction, resetAction];
    }

    /**
     * Handle edge creation (two-click: source then target).
     */
    protected handleEdgeCreation(
        target: SModelElementImpl,
        event: MouseEvent,
        elementTypeId: string,
        args?: Record<string, any>
    ): (Action | Promise<Action>)[] {
        // Find the clicked node (if any)
        const node = this.findNode(target);

        if (!node) {
            this.logger.info('Click was not on a node, ignoring for edge creation');
            // If clicking on empty canvas, reset edge source
            if (this.isOnCanvas(target)) {
                this.edgeSourceId = undefined;
            }
            return [];
        }

        if (!this.edgeSourceId) {
            // First click: select source
            this.edgeSourceId = node.id;
            this.logger.info({ nodeId: node.id }, 'Edge source selected');
            // Visual feedback could be added here
            return [];
        } else {
            // Second click: select target and create edge
            const sourceId = this.edgeSourceId;
            const targetId = node.id;

            // Don't allow self-loops by default
            if (sourceId === targetId) {
                this.logger.info('Self-loop not allowed');
                return [];
            }

            this.logger.info({ sourceId, targetId }, 'Creating edge');

            // Reset edge source
            this.edgeSourceId = undefined;

            // Dispatch create element action
            const createAction = CreateElementAction.createEdge(elementTypeId, sourceId, targetId, args);

            // Reset to default tool after creation
            const resetAction = EnableDefaultToolsAction.create();

            return [createAction, resetAction];
        }
    }

    /**
     * Get the position in model coordinates.
     */
    protected getModelPosition(target: SModelElementImpl, event: MouseEvent): Point | undefined {
        // Find the viewport/graph to get proper model coordinates
        const viewport = findParentByFeature(target, isViewport);
        if (!viewport) {
            // If no viewport, try to find the graph
            const graph = this.findGraph(target);
            if (graph) {
                // Get position relative to SVG
                const svgElement = document.querySelector(`#${graph.id} svg`) as SVGSVGElement;
                if (svgElement) {
                    const point = svgElement.createSVGPoint();
                    point.x = event.clientX;
                    point.y = event.clientY;
                    const ctm = svgElement.getScreenCTM();
                    if (ctm) {
                        const svgPoint = point.matrixTransform(ctm.inverse());
                        return { x: svgPoint.x, y: svgPoint.y };
                    }
                }
            }
            return { x: event.offsetX, y: event.offsetY };
        }

        // Use viewport scroll and zoom to convert client coordinates to model coordinates
        const svgElement = document.querySelector('svg.sprotty-graph') as SVGSVGElement;
        if (svgElement) {
            const point = svgElement.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const ctm = svgElement.getScreenCTM();
            if (ctm) {
                const svgPoint = point.matrixTransform(ctm.inverse());
                return { x: svgPoint.x, y: svgPoint.y };
            }
        }

        // Fallback: use offset coordinates adjusted by viewport
        const scroll = viewport.scroll;
        const zoom = viewport.zoom;
        return {
            x: (event.offsetX / zoom) + scroll.x,
            y: (event.offsetY / zoom) + scroll.y,
        };
    }

    /**
     * Find a node element from the target or its ancestors.
     */
    protected findNode(target: SModelElementImpl): SNodeImpl | undefined {
        let current: SModelElementImpl | undefined = target;
        while (current) {
            if (current instanceof SNodeImpl) {
                return current;
            }
            // Access parent through the root's index or by traversing the model
            const parent = (current as any).parent;
            current = parent as SModelElementImpl | undefined;
        }
        return undefined;
    }

    /**
     * Find the graph element.
     */
    protected findGraph(target: SModelElementImpl): SGraphImpl | undefined {
        let current: SModelElementImpl | undefined = target;
        while (current) {
            if (current instanceof SGraphImpl) {
                return current;
            }
            // Access parent through the root's index or by traversing the model
            const parent = (current as any).parent;
            current = parent as SModelElementImpl | undefined;
        }
        return undefined;
    }

    /**
     * Check if the click is on the canvas (graph background).
     */
    protected isOnCanvas(target: SModelElementImpl): boolean {
        return target instanceof SGraphImpl;
    }
}
