/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Text Editor Drop Handler
 *
 * Handles drop events on the Monaco text editor from the sidebar element palette.
 * Resolves the cursor position at the drop point and dispatches a createNode
 * operation with an insertAtPosition argument so the server inserts the text
 * snippet at the correct location.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { createLogger } from '@sanyam/logger';
import { ELEMENT_PALETTE_DRAG_MIME_TYPE, decodeDragData } from './drag-drop-actions';
import { DiagramLanguageClient, type ExecuteOperationResponse } from '../diagram-language-client';

/**
 * Symbol for TextEditorDropHandler injection.
 */
export const TextEditorDropHandlerSymbol = Symbol('TextEditorDropHandler');

/**
 * Text Editor Drop Handler.
 *
 * Attaches to the Monaco editor container to handle drag-and-drop from the sidebar.
 * Only accepts `createNode` items — edges require two endpoints and don't make sense
 * as text drops.
 */
@injectable()
export class TextEditorDropHandler {
    protected readonly logger = createLogger({ name: 'TextEditorDropHandler' });

    @inject(DiagramLanguageClient)
    protected readonly diagramLanguageClient: DiagramLanguageClient;

    protected editorContainer: HTMLElement | null = null;
    protected monacoEditor: unknown | null = null;
    protected currentDocumentUri: string | null = null;
    protected isInitialized = false;

    /**
     * Callback invoked after a successful create-node operation.
     * The composite editor sets this to apply returned text edits,
     * save the file, and invalidate the diagram model.
     */
    onOperationComplete?: (response: ExecuteOperationResponse) => void;

    /**
     * Initialize the drop handler by attaching to the editor container.
     *
     * @param container - The Monaco editor DOM container element
     * @param monacoEditor - The Monaco ICodeEditor instance
     * @param documentUri - The URI of the document being edited
     */
    initialize(container: HTMLElement, monacoEditor: unknown, documentUri: string): void {
        if (this.isInitialized && this.editorContainer === container && this.currentDocumentUri === documentUri) {
            this.logger.debug('Text editor drop handler already initialized for this container');
            return;
        }

        this.cleanup();
        this.editorContainer = container;
        this.monacoEditor = monacoEditor;
        this.currentDocumentUri = documentUri;

        // Add drag event listeners
        container.addEventListener('dragover', this.handleDragOver);
        container.addEventListener('dragenter', this.handleDragEnter);
        container.addEventListener('dragleave', this.handleDragLeave);
        container.addEventListener('drop', this.handleDrop);

        this.isInitialized = true;

        this.logger.info({
            documentUri,
            containerId: container.id,
            containerClass: container.className,
        }, 'Text editor drop handler initialized');
    }

    /**
     * Cleanup event listeners.
     */
    cleanup(): void {
        if (this.editorContainer) {
            this.editorContainer.removeEventListener('dragover', this.handleDragOver);
            this.editorContainer.removeEventListener('dragenter', this.handleDragEnter);
            this.editorContainer.removeEventListener('dragleave', this.handleDragLeave);
            this.editorContainer.removeEventListener('drop', this.handleDrop);
            this.editorContainer.classList.remove('drag-over');
            this.editorContainer = null;
        }
        this.monacoEditor = null;
        this.currentDocumentUri = null;
        this.isInitialized = false;
    }

    /**
     * Check if the drag event carries a valid createNode palette item.
     * Edges are rejected because they require two endpoints.
     */
    protected isAcceptableDrag(event: DragEvent): boolean {
        const types = event.dataTransfer?.types;
        if (!types || !Array.from(types).includes(ELEMENT_PALETTE_DRAG_MIME_TYPE)) {
            return false;
        }

        // During dragover/dragenter we cannot read getData() due to browser security,
        // so we accept all palette drags here. The handleDrop method will filter edges.
        return true;
    }

    /**
     * Handle dragover to allow drop.
     */
    protected handleDragOver = (event: DragEvent): void => {
        if (this.isAcceptableDrag(event)) {
            event.preventDefault();
            // Stop propagation to prevent Theia's ApplicationShell handler from
            // overriding dropEffect to 'link' (incompatible with effectAllowed='copy')
            event.stopPropagation();
            event.dataTransfer!.dropEffect = 'copy';
        }
    };

    /**
     * Handle dragenter for visual feedback.
     */
    protected handleDragEnter = (event: DragEvent): void => {
        if (this.isAcceptableDrag(event)) {
            event.preventDefault();
            event.stopPropagation();
            this.editorContainer?.classList.add('drag-over');
        }
    };

    /**
     * Handle dragleave to remove visual feedback.
     */
    protected handleDragLeave = (event: DragEvent): void => {
        // Only remove class if leaving the container (not entering a child)
        if (event.relatedTarget && !this.editorContainer?.contains(event.relatedTarget as Node)) {
            this.editorContainer?.classList.remove('drag-over');
        }
    };

    /**
     * Handle drop to create the element at the text cursor position.
     */
    protected handleDrop = async (event: DragEvent): Promise<void> => {
        event.preventDefault();
        event.stopPropagation();
        this.editorContainer?.classList.remove('drag-over');

        this.logger.debug({
            types: event.dataTransfer?.types,
            clientX: event.clientX,
            clientY: event.clientY,
        }, 'Text editor drop event received');

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

        // Reject edge drops — edges need two endpoints and don't make sense in text
        if (dragData.kind === 'createEdge') {
            this.logger.debug({ elementTypeId: dragData.elementTypeId }, 'Rejected edge drop on text editor');
            return;
        }

        if (!this.currentDocumentUri) {
            this.logger.warn('No document URI set for drop handler');
            return;
        }

        // Resolve text position at drop point via Monaco
        const insertPosition = this.getTextPositionAtPoint(event.clientX, event.clientY);
        if (!insertPosition) {
            this.logger.warn('Failed to resolve text position at drop point');
            return;
        }

        this.logger.info({
            elementTypeId: dragData.elementTypeId,
            insertPosition,
        }, 'Creating element from text editor drop');

        // Execute create operation via language client with insert position override
        try {
            const result = await this.diagramLanguageClient.executeOperation(
                this.currentDocumentUri,
                {
                    kind: 'createNode',
                    elementTypeId: dragData.elementTypeId,
                    args: {
                        insertAtPosition: {
                            line: insertPosition.line,
                            character: insertPosition.character,
                        },
                    },
                }
            );
            this.logger.info({ result }, 'Text editor create operation result');
            this.onOperationComplete?.(result);
        } catch (error) {
            this.logger.error({ error }, 'Failed to create element from text editor drop');
        }
    };

    /**
     * Resolve the text cursor position at a screen point using Monaco's API.
     *
     * Uses ICodeEditor.getTargetAtClientPoint(clientX, clientY) to map
     * screen coordinates to a text position.
     *
     * @param clientX - Screen X coordinate
     * @param clientY - Screen Y coordinate
     * @returns 0-based LSP position or undefined if resolution fails
     */
    protected getTextPositionAtPoint(
        clientX: number,
        clientY: number
    ): { line: number; character: number } | undefined {
        const editor = this.monacoEditor as {
            getTargetAtClientPoint?(clientX: number, clientY: number): {
                position?: { lineNumber: number; column: number };
            } | null;
        } | null;

        if (!editor?.getTargetAtClientPoint) {
            this.logger.warn('Monaco editor does not expose getTargetAtClientPoint');
            return undefined;
        }

        const target = editor.getTargetAtClientPoint(clientX, clientY);
        if (!target?.position) {
            this.logger.debug({ clientX, clientY }, 'No text position at drop point');
            return undefined;
        }

        // Monaco positions are 1-based; LSP positions are 0-based
        return {
            line: target.position.lineNumber - 1,
            character: target.position.column - 1,
        };
    }
}
