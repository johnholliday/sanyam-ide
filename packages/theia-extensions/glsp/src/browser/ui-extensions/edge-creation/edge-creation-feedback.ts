/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Edge Creation Feedback Extension
 *
 * Provides visual feedback during edge creation with preview lines
 * and valid target highlighting.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Edge Creation Extension ID.
 */
export const EDGE_CREATION_ID = 'sanyam-edge-creation';

/**
 * CSS classes for edge creation.
 */
export const EdgeCreationClasses = {
    CONTAINER: 'sanyam-edge-creation-container',
    PREVIEW_LINE: 'sanyam-edge-preview-line',
    SOURCE_INDICATOR: 'sanyam-edge-source-indicator',
    TARGET_INDICATOR: 'sanyam-edge-target-indicator',
    VALID_TARGET: 'sanyam-valid-target',
    INVALID_TARGET: 'sanyam-invalid-target',
} as const;

/**
 * Edge creation state.
 */
interface EdgeCreationState {
    isActive: boolean;
    sourceId?: string;
    sourcePosition?: { x: number; y: number };
    currentPosition?: { x: number; y: number };
    validTargets: string[];
    hoveredTargetId?: string;
}

/**
 * Start edge creation action.
 */
export interface StartEdgeCreationAction extends Action {
    kind: 'startEdgeCreation';
    sourceId: string;
    elementTypeId: string;
}

export namespace StartEdgeCreationAction {
    export const KIND = 'startEdgeCreation';

    export function create(sourceId: string, elementTypeId: string): StartEdgeCreationAction {
        return { kind: KIND, sourceId, elementTypeId };
    }
}

/**
 * Update edge preview action.
 */
export interface UpdateEdgePreviewAction extends Action {
    kind: 'updateEdgePreview';
    position: { x: number; y: number };
    hoveredElementId?: string;
}

export namespace UpdateEdgePreviewAction {
    export const KIND = 'updateEdgePreview';

    export function create(position: { x: number; y: number }, hoveredElementId?: string): UpdateEdgePreviewAction {
        return { kind: KIND, position, hoveredElementId };
    }
}

/**
 * Complete edge creation action.
 */
export interface CompleteEdgeCreationAction extends Action {
    kind: 'completeEdgeCreation';
    sourceId: string;
    targetId: string;
    elementTypeId: string;
}

export namespace CompleteEdgeCreationAction {
    export const KIND = 'completeEdgeCreation';

    export function create(sourceId: string, targetId: string, elementTypeId: string): CompleteEdgeCreationAction {
        return { kind: KIND, sourceId, targetId, elementTypeId };
    }
}

/**
 * Cancel edge creation action.
 */
export interface CancelEdgeCreationAction extends Action {
    kind: 'cancelEdgeCreation';
}

export namespace CancelEdgeCreationAction {
    export const KIND = 'cancelEdgeCreation';

    export function create(): CancelEdgeCreationAction {
        return { kind: KIND };
    }
}

/**
 * Set valid edge targets action.
 */
export interface SetValidEdgeTargetsAction extends Action {
    kind: 'setValidEdgeTargets';
    validTargetIds: string[];
}

export namespace SetValidEdgeTargetsAction {
    export const KIND = 'setValidEdgeTargets';

    export function create(validTargetIds: string[]): SetValidEdgeTargetsAction {
        return { kind: KIND, validTargetIds };
    }
}

/**
 * Edge Creation Feedback Extension.
 *
 * Renders visual feedback during edge creation:
 * - Dashed preview line from source to cursor
 * - Connection point indicators
 * - Valid/invalid target highlighting
 */
@injectable()
export class EdgeCreationFeedbackExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Current edge creation state */
    protected edgeCreationState: EdgeCreationState = {
        isActive: false,
        validTargets: [],
    };

    /** SVG container for feedback elements */
    protected svgOverlay: SVGSVGElement | undefined;

    /** Preview line element */
    protected previewLine: SVGLineElement | undefined;

    /** Source indicator */
    protected sourceIndicator: SVGCircleElement | undefined;

    /** Target indicator */
    protected targetIndicator: SVGCircleElement | undefined;

    /** Element type being created */
    protected elementTypeId: string = '';

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    id(): string {
        return EDGE_CREATION_ID;
    }

    containerClass(): string {
        return EdgeCreationClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        if (this.parentContainerElement) {
            return this.parentContainerElement;
        }

        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container?.parentElement) {
                return container.parentElement;
            }
        }

        return undefined;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        containerElement.style.position = 'absolute';
        containerElement.style.top = '0';
        containerElement.style.left = '0';
        containerElement.style.width = '100%';
        containerElement.style.height = '100%';
        containerElement.style.pointerEvents = 'none';
        containerElement.style.overflow = 'hidden';

        // Create SVG overlay
        this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgOverlay.setAttribute('width', '100%');
        this.svgOverlay.setAttribute('height', '100%');
        this.svgOverlay.style.position = 'absolute';
        this.svgOverlay.style.top = '0';
        this.svgOverlay.style.left = '0';

        // Create preview line
        this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.previewLine.classList.add(EdgeCreationClasses.PREVIEW_LINE);
        this.previewLine.style.display = 'none';
        this.svgOverlay.appendChild(this.previewLine);

        // Create source indicator
        this.sourceIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.sourceIndicator.classList.add(EdgeCreationClasses.SOURCE_INDICATOR);
        this.sourceIndicator.setAttribute('r', '6');
        this.sourceIndicator.style.display = 'none';
        this.svgOverlay.appendChild(this.sourceIndicator);

        // Create target indicator
        this.targetIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.targetIndicator.classList.add(EdgeCreationClasses.TARGET_INDICATOR);
        this.targetIndicator.setAttribute('r', '8');
        this.targetIndicator.style.display = 'none';
        this.svgOverlay.appendChild(this.targetIndicator);

        containerElement.appendChild(this.svgOverlay);
    }

    /**
     * Start edge creation from a source element.
     */
    startEdgeCreation(sourceId: string, elementTypeId: string): void {
        const sourcePosition = this.getElementCenter(sourceId);
        if (!sourcePosition) {
            console.warn(`[EdgeCreation] Source element not found: ${sourceId}`);
            return;
        }

        this.elementTypeId = elementTypeId;
        this.edgeCreationState = {
            isActive: true,
            sourceId,
            sourcePosition,
            currentPosition: sourcePosition,
            validTargets: [],
        };

        // Show source indicator
        if (this.sourceIndicator) {
            this.sourceIndicator.setAttribute('cx', String(sourcePosition.x));
            this.sourceIndicator.setAttribute('cy', String(sourcePosition.y));
            this.sourceIndicator.style.display = '';
        }

        // Show preview line
        if (this.previewLine) {
            this.previewLine.setAttribute('x1', String(sourcePosition.x));
            this.previewLine.setAttribute('y1', String(sourcePosition.y));
            this.previewLine.setAttribute('x2', String(sourcePosition.x));
            this.previewLine.setAttribute('y2', String(sourcePosition.y));
            this.previewLine.style.display = '';
        }

        this.show();

        // Request valid targets from server
        this.dispatch({
            kind: 'requestValidEdgeTargets',
            sourceId,
            elementTypeId,
        } as import('sprotty-protocol').Action);
    }

    /**
     * Update the preview during mouse move.
     */
    updatePreview(position: { x: number; y: number }, hoveredElementId?: string): void {
        if (!this.edgeCreationState.isActive) {
            return;
        }

        this.edgeCreationState.currentPosition = position;
        this.edgeCreationState.hoveredTargetId = hoveredElementId;

        // Update preview line
        if (this.previewLine) {
            this.previewLine.setAttribute('x2', String(position.x));
            this.previewLine.setAttribute('y2', String(position.y));
        }

        // Update target indicator
        if (this.targetIndicator && hoveredElementId) {
            const isValid = this.edgeCreationState.validTargets.includes(hoveredElementId);
            const targetCenter = this.getElementCenter(hoveredElementId);

            if (targetCenter) {
                this.targetIndicator.setAttribute('cx', String(targetCenter.x));
                this.targetIndicator.setAttribute('cy', String(targetCenter.y));
                this.targetIndicator.classList.toggle(EdgeCreationClasses.VALID_TARGET, isValid);
                this.targetIndicator.classList.toggle(EdgeCreationClasses.INVALID_TARGET, !isValid);
                this.targetIndicator.style.display = '';
            }
        } else if (this.targetIndicator) {
            this.targetIndicator.style.display = 'none';
        }

        // Highlight valid targets
        this.updateTargetHighlighting(hoveredElementId);
    }

    /**
     * Set the list of valid targets.
     */
    setValidTargets(targetIds: string[]): void {
        this.edgeCreationState.validTargets = targetIds;
        this.updateTargetHighlighting();
    }

    /**
     * Update target highlighting in the SVG.
     */
    protected updateTargetHighlighting(hoveredId?: string): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return;
        }

        // Remove existing highlighting
        svgContainer.querySelectorAll(`.${EdgeCreationClasses.VALID_TARGET}, .${EdgeCreationClasses.INVALID_TARGET}`)
            .forEach(el => {
                el.classList.remove(EdgeCreationClasses.VALID_TARGET, EdgeCreationClasses.INVALID_TARGET);
            });

        // Add highlighting to valid targets
        for (const targetId of this.edgeCreationState.validTargets) {
            const element = svgContainer.querySelector(`[id="${targetId}"]`);
            if (element) {
                element.classList.add(EdgeCreationClasses.VALID_TARGET);
            }
        }
    }

    /**
     * Complete the edge creation.
     */
    completeEdgeCreation(targetId: string): boolean {
        if (!this.edgeCreationState.isActive || !this.edgeCreationState.sourceId) {
            return false;
        }

        const isValid = this.edgeCreationState.validTargets.includes(targetId);
        if (!isValid) {
            return false;
        }

        // Dispatch create edge action
        this.dispatch(CompleteEdgeCreationAction.create(
            this.edgeCreationState.sourceId,
            targetId,
            this.elementTypeId
        ));

        this.cancelEdgeCreation();
        return true;
    }

    /**
     * Cancel edge creation.
     */
    cancelEdgeCreation(): void {
        this.edgeCreationState = {
            isActive: false,
            validTargets: [],
        };

        // Hide feedback elements
        if (this.previewLine) {
            this.previewLine.style.display = 'none';
        }
        if (this.sourceIndicator) {
            this.sourceIndicator.style.display = 'none';
        }
        if (this.targetIndicator) {
            this.targetIndicator.style.display = 'none';
        }

        // Remove highlighting
        const svgContainer = this.findSvgContainer();
        if (svgContainer) {
            svgContainer.querySelectorAll(`.${EdgeCreationClasses.VALID_TARGET}, .${EdgeCreationClasses.INVALID_TARGET}`)
                .forEach(el => {
                    el.classList.remove(EdgeCreationClasses.VALID_TARGET, EdgeCreationClasses.INVALID_TARGET);
                });
        }

        this.hide();
        this.dispatch(CancelEdgeCreationAction.create());
    }

    /**
     * Check if edge creation is active.
     */
    isActive(): boolean {
        return this.edgeCreationState.isActive;
    }

    /**
     * Get the center position of an element.
     */
    protected getElementCenter(elementId: string): { x: number; y: number } | undefined {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return undefined;
        }

        const element = svgContainer.querySelector(`[id="${elementId}"]`);
        if (!element) {
            return undefined;
        }

        try {
            const bbox = (element as SVGGraphicsElement).getBBox();
            const ctm = (element as SVGGraphicsElement).getCTM();

            if (!ctm) {
                return {
                    x: bbox.x + bbox.width / 2,
                    y: bbox.y + bbox.height / 2,
                };
            }

            const svg = (element as SVGElement).ownerSVGElement;
            if (!svg) {
                return undefined;
            }

            const point = svg.createSVGPoint();
            point.x = bbox.x + bbox.width / 2;
            point.y = bbox.y + bbox.height / 2;
            const transformed = point.matrixTransform(ctm);

            return { x: transformed.x, y: transformed.y };
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Find the SVG container.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                return container.querySelector('svg.sprotty-graph') as SVGSVGElement;
            }
        }
        return undefined;
    }

    override modelChanged(_model: SModelRootImpl): void {
        // Cancel edge creation if model changes significantly
        if (this.edgeCreationState.isActive && this.edgeCreationState.sourceId) {
            const svgContainer = this.findSvgContainer();
            if (svgContainer && !svgContainer.querySelector(`[id="${this.edgeCreationState.sourceId}"]`)) {
                this.cancelEdgeCreation();
            }
        }
    }
}
