/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Create Element Action Handler
 *
 * Handles CreateElementAction to add new nodes and edges to the diagram model.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import {
    IActionHandler,
    ICommand,
    TYPES,
    LocalModelSource,
} from 'sprotty';
import {
    Action,
    SModelRoot,
    SNode,
    SEdge,
    SLabel,
    SModelElement,
} from 'sprotty-protocol';
import { CreateElementAction } from './tool-palette-actions';

/**
 * Counter for generating unique element IDs.
 */
let elementIdCounter = 0;

/**
 * Generate a unique element ID.
 */
function generateElementId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++elementIdCounter}`;
}

/**
 * Action handler for creating diagram elements (nodes and edges).
 */
@injectable()
export class CreateElementActionHandler implements IActionHandler {
    @inject(TYPES.ModelSource)
    protected modelSource!: LocalModelSource;

    /**
     * Handle CreateElementAction.
     */
    handle(action: Action): void | ICommand | Action {
        if (action.kind === CreateElementAction.KIND) {
            this.handleCreateElement(action as CreateElementAction);
        }
    }

    /**
     * Handle element creation.
     */
    protected async handleCreateElement(action: CreateElementAction): Promise<void> {
        console.info('[CreateElementActionHandler] Creating element:', action);

        const currentModel = await this.getCurrentModel();
        if (!currentModel) {
            console.error('[CreateElementActionHandler] No current model available');
            return;
        }

        if (action.elementKind === 'node') {
            await this.createNode(currentModel, action);
        } else if (action.elementKind === 'edge') {
            await this.createEdge(currentModel, action);
        }
    }

    /**
     * Get the current model.
     */
    protected async getCurrentModel(): Promise<SModelRoot | undefined> {
        // Access the model from LocalModelSource
        // The model is stored internally in LocalModelSource
        const modelSource = this.modelSource as any;
        return modelSource.model as SModelRoot;
    }

    /**
     * Create a new node and add it to the model.
     */
    protected async createNode(model: SModelRoot, action: CreateElementAction): Promise<void> {
        const { elementTypeId, position, args } = action;

        // Determine node type and label based on elementTypeId
        const nodeType = elementTypeId || 'node:default';
        const labelBase = this.getLabelFromElementType(nodeType);

        // Generate unique ID
        const nodeId = generateElementId('node');
        const labelId = generateElementId('label');

        // Create the node
        const node: SNode = {
            type: nodeType,
            id: nodeId,
            position: position || { x: 100, y: 100 },
            size: { width: 120, height: 60 },
            children: [
                {
                    type: 'label:heading',
                    id: labelId,
                    text: `${labelBase} ${elementIdCounter}`,
                } as SLabel,
            ],
        };

        // Add custom args if provided
        if (args) {
            Object.assign(node, args);
        }

        console.info('[CreateElementActionHandler] Adding node to model:', node);

        // Add node to the model's children
        if (!model.children) {
            model.children = [];
        }
        model.children.push(node as SModelElement);

        // Update the model
        await this.modelSource.updateModel(model);

        console.info('[CreateElementActionHandler] Node created successfully:', nodeId);
    }

    /**
     * Create a new edge and add it to the model.
     */
    protected async createEdge(model: SModelRoot, action: CreateElementAction): Promise<void> {
        const { elementTypeId, sourceId, targetId, args } = action;

        if (!sourceId || !targetId) {
            console.error('[CreateElementActionHandler] Edge creation requires sourceId and targetId');
            return;
        }

        // Verify source and target exist
        const sourceExists = this.findElement(model, sourceId);
        const targetExists = this.findElement(model, targetId);

        if (!sourceExists) {
            console.error('[CreateElementActionHandler] Source element not found:', sourceId);
            return;
        }
        if (!targetExists) {
            console.error('[CreateElementActionHandler] Target element not found:', targetId);
            return;
        }

        // Determine edge type
        const edgeType = elementTypeId || 'edge:default';

        // Generate unique ID
        const edgeId = generateElementId('edge');

        // Create the edge
        const edge: SEdge = {
            type: edgeType,
            id: edgeId,
            sourceId,
            targetId,
        };

        // Add custom args if provided
        if (args) {
            Object.assign(edge, args);
        }

        console.info('[CreateElementActionHandler] Adding edge to model:', edge);

        // Add edge to the model's children
        if (!model.children) {
            model.children = [];
        }
        model.children.push(edge as SModelElement);

        // Update the model
        await this.modelSource.updateModel(model);

        console.info('[CreateElementActionHandler] Edge created successfully:', edgeId);
    }

    /**
     * Find an element in the model by ID.
     */
    protected findElement(model: SModelRoot, id: string): SModelElement | undefined {
        if (!model.children) {
            return undefined;
        }

        for (const child of model.children) {
            if (child.id === id) {
                return child;
            }
            // Check children recursively
            const element = child as any;
            if (element.children) {
                const found = this.findElementInChildren(element.children, id);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }

    /**
     * Recursively find an element in children.
     */
    protected findElementInChildren(children: SModelElement[], id: string): SModelElement | undefined {
        for (const child of children) {
            if (child.id === id) {
                return child;
            }
            const element = child as any;
            if (element.children) {
                const found = this.findElementInChildren(element.children, id);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }

    /**
     * Get a readable label from the element type.
     */
    protected getLabelFromElementType(elementType: string): string {
        // Convert 'node:entity' -> 'Entity'
        const parts = elementType.split(':');
        if (parts.length > 1) {
            const name = parts[1];
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return 'Node';
    }
}
