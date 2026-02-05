/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Canvas Drop Handler
 *
 * Handles drop events on the diagram canvas from the sidebar element palette.
 * Converts screen coordinates to model coordinates and dispatches CreateElementAction.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { Point } from 'sprotty-protocol';
import { createLogger } from '@sanyam/logger';
import { ELEMENT_PALETTE_DRAG_MIME_TYPE, decodeDragData } from './drag-drop-actions';
import { DiagramLanguageClient } from '../diagram-language-client';

/**
 * Symbol for CanvasDropHandler injection.
 */
export const CanvasDropHandlerSymbol = Symbol('CanvasDropHandler');

/**
 * Canvas Drop Handler.
 *
 * Attaches to the diagram SVG container to handle drag-and-drop from the sidebar.
 * Uses DiagramLanguageClient to execute create operations on the backend.
 */
@injectable()
export class CanvasDropHandler {
    protected readonly logger = createLogger({ name: 'CanvasDropHandler' });

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    protected svgContainer: HTMLElement | null = null;
    protected isInitialized = false;
    protected currentDocumentUri: string | null = null;

    /**
     * Initialize the drop handler by attaching to the SVG container.
     *
     * @param container - The diagram SVG container element
     * @param documentUri - The URI of the document being edited
     */
    initialize(container: HTMLElement, documentUri: string): void {
        if (this.isInitialized && this.svgContainer === container && this.currentDocumentUri === documentUri) {
            this.logger.debug('Canvas drop handler already initialized for this container');
            return;
        }

        this.cleanup();
        this.svgContainer = container;
        this.currentDocumentUri = documentUri;

        // Add drag event listeners
        container.addEventListener('dragover', this.handleDragOver);
        container.addEventListener('dragenter', this.handleDragEnter);
        container.addEventListener('dragleave', this.handleDragLeave);
        container.addEventListener('drop', this.handleDrop);

        this.isInitialized = true;

        // Log container details for debugging
        const svgElement = container.querySelector('svg.sprotty-graph');
        this.logger.info({
            documentUri,
            containerId: container.id,
            containerClass: container.className,
            hasSvgElement: !!svgElement,
        }, 'Canvas drop handler initialized');
    }

    /**
     * Cleanup event listeners.
     */
    cleanup(): void {
        if (this.svgContainer) {
            this.svgContainer.removeEventListener('dragover', this.handleDragOver);
            this.svgContainer.removeEventListener('dragenter', this.handleDragEnter);
            this.svgContainer.removeEventListener('dragleave', this.handleDragLeave);
            this.svgContainer.removeEventListener('drop', this.handleDrop);
            this.svgContainer.classList.remove('drag-over');
            this.svgContainer = null;
        }
        this.currentDocumentUri = null;
        this.isInitialized = false;
    }

    /**
     * Handle dragover to allow drop.
     */
    protected handleDragOver = (event: DragEvent): void => {
        // Check if this is a valid element palette drag
        if (event.dataTransfer?.types.includes(ELEMENT_PALETTE_DRAG_MIME_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        }
    };

    /**
     * Handle dragenter for visual feedback.
     */
    protected handleDragEnter = (event: DragEvent): void => {
        if (event.dataTransfer?.types.includes(ELEMENT_PALETTE_DRAG_MIME_TYPE)) {
            event.preventDefault();
            this.svgContainer?.classList.add('drag-over');
        }
    };

    /**
     * Handle dragleave to remove visual feedback.
     */
    protected handleDragLeave = (event: DragEvent): void => {
        // Only remove class if leaving the container (not entering a child)
        if (event.relatedTarget && !this.svgContainer?.contains(event.relatedTarget as Node)) {
            this.svgContainer?.classList.remove('drag-over');
        }
    };

    /**
     * Handle drop to create the element.
     */
    protected handleDrop = async (event: DragEvent): Promise<void> => {
        event.preventDefault();
        this.svgContainer?.classList.remove('drag-over');

        this.logger.debug({
            types: event.dataTransfer?.types,
            clientX: event.clientX,
            clientY: event.clientY,
        }, 'Drop event received');

        // Get drag data
        const dataStr = event.dataTransfer?.getData(ELEMENT_PALETTE_DRAG_MIME_TYPE);
        if (!dataStr) {
            this.logger.warn({ types: event.dataTransfer?.types }, 'Drop event without element palette data');
            return;
        }

        const dragData = decodeDragData(dataStr);
        if (!dragData) {
            this.logger.warn({ dataStr }, 'Failed to decode drag data');
            return;
        }

        if (!this.currentDocumentUri) {
            this.logger.warn('No document URI set for drop handler');
            return;
        }

        // Convert screen coordinates to model coordinates
        const position = this.getModelPosition(event.clientX, event.clientY);
        if (!position) {
            this.logger.warn('Failed to get model position - SVG element may not be ready');
            return;
        }

        this.logger.info({ elementTypeId: dragData.elementTypeId, position }, 'Creating element from drop');

        // Execute create operation via language client
        try {
            const result = await this.diagramLanguageClient.executeOperation(
                this.currentDocumentUri,
                {
                    kind: 'createNode',
                    elementTypeId: dragData.elementTypeId,
                    location: { x: position.x, y: position.y },
                }
            );
            this.logger.info({ result }, 'Create operation result');
        } catch (error) {
            this.logger.error({ error }, 'Failed to create element');
        }
    };

    /**
     * Convert screen coordinates to model coordinates.
     *
     * @param clientX - Screen X coordinate
     * @param clientY - Screen Y coordinate
     * @returns Model coordinates or undefined if conversion fails
     */
    protected getModelPosition(clientX: number, clientY: number): Point | undefined {
        // Find the SVG element - try multiple selectors for compatibility
        let svgElement = this.svgContainer?.querySelector('svg.sprotty-graph') as SVGSVGElement | null;
        if (!svgElement) {
            // Fallback: look for any SVG with sprotty in the class
            svgElement = this.svgContainer?.querySelector('svg[class*="sprotty"]') as SVGSVGElement | null;
        }
        if (!svgElement) {
            // Fallback: just get the first SVG element
            svgElement = this.svgContainer?.querySelector('svg') as SVGSVGElement | null;
        }
        if (!svgElement) {
            this.logger.warn({
                containerId: this.svgContainer?.id,
                innerHTML: this.svgContainer?.innerHTML?.substring(0, 200),
            }, 'SVG element not found in container');
            return undefined;
        }

        // Create SVG point and transform to model coordinates
        const point = svgElement.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        const ctm = svgElement.getScreenCTM();
        if (!ctm) {
            this.logger.warn('Could not get screen CTM');
            return undefined;
        }

        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }
}
