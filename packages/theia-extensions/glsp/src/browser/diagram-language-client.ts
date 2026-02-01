/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject, postConstruct, optional } from '@theia/core/shared/inversify';
import { createLogger } from '@sanyam/logger';
import { Emitter, Event, DisposableCollection, Disposable, MessageService, CommandService } from '@theia/core/lib/common';
import type { GModelRoot, GNode, GEdge, GLabel } from '@sanyam/types';

/**
 * Response from glsp/loadModel request.
 */
export interface LoadModelResponse {
    success: boolean;
    gModel?: GModelRoot;
    metadata?: {
        positions: Record<string, { x: number; y: number }>;
        sizes: Record<string, { width: number; height: number }>;
        sourceRanges?: Record<string, { start: { line: number; character: number }; end: { line: number; character: number } }>;
        /** UUID registry exact-match index: fingerprintKey → UUID */
        idMap?: Record<string, string>;
        /** UUID registry fingerprints: UUID → StructuralFingerprint */
        fingerprints?: Record<string, unknown>;
    };
    error?: string;
}

/**
 * Response from glsp/executeOperation request.
 */
export interface ExecuteOperationResponse {
    success: boolean;
    error?: string;
    edits?: any[];
}

/**
 * Response from glsp/layout request.
 */
export interface LayoutResponse {
    positions: Record<string, { x: number; y: number }>;
    routingPoints?: Record<string, Array<{ x: number; y: number }>>;
    bounds: { width: number; height: number };
    error?: string;
}

/**
 * Response from glsp/toolPalette request.
 */
export interface ToolPaletteResponse {
    groups: Array<{
        id: string;
        label: string;
        items: Array<{
            id: string;
            label: string;
            icon?: string;
            sortString?: string;
        }>;
    }>;
    error?: string;
}

/**
 * Response from glsp/contextMenu request.
 */
export interface ContextMenuResponse {
    items: Array<{
        id: string;
        label: string;
        icon?: string;
        group?: string;
        sortString?: string;
        children?: ContextMenuResponse['items'];
    }>;
    error?: string;
}

/**
 * Diagram operation types.
 */
export interface DiagramOperation {
    kind: string;
    [key: string]: any;
}

/**
 * Diagram model update event.
 */
export interface DiagramModelUpdate {
    uri: string;
    gModel: GModelRoot;
    metadata?: {
        positions: Map<string, { x: number; y: number }>;
        sizes: Map<string, { width: number; height: number }>;
        sourceRanges?: Map<string, { start: { line: number; character: number }; end: { line: number; character: number } }>;
        /** UUID registry exact-match index: fingerprintKey → UUID */
        idMap?: Record<string, string>;
        /** UUID registry fingerprints: UUID → StructuralFingerprint */
        fingerprints?: Record<string, unknown>;
    };
}

/**
 * Interface for language client with sendRequest capability.
 */
export interface LanguageClientProvider {
    sendRequest<R>(method: string, params: any): Promise<R>;
    onNotification(method: string, handler: (params: any) => void): Disposable;
}

/**
 * Symbol for injecting the language client provider.
 */
export const LanguageClientProviderSymbol = Symbol.for('LanguageClientProvider');

/**
 * Service for communicating with the language server for diagram operations.
 *
 * This service provides the frontend API for diagram operations via GLSP protocol.
 * It sends requests to the language server and handles notifications.
 */
@injectable()
export class DiagramLanguageClient implements Disposable {
    protected readonly logger = createLogger({ name: 'DiagramLangClient' });

    @inject(LanguageClientProviderSymbol) @optional()
    protected readonly languageClientProvider?: LanguageClientProvider;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(MessageService) @optional()
    protected readonly messageService?: MessageService;

    protected readonly toDispose = new DisposableCollection();
    protected readonly cachedModels = new Map<string, GModelRoot>();
    protected readonly pendingRequests = new Map<string, Promise<LoadModelResponse>>();

    protected readonly onModelUpdatedEmitter = new Emitter<DiagramModelUpdate>();
    readonly onModelUpdated: Event<DiagramModelUpdate> = this.onModelUpdatedEmitter.event;

    protected readonly onModelLoadingEmitter = new Emitter<{ uri: string; loading: boolean }>();
    readonly onModelLoading: Event<{ uri: string; loading: boolean }> = this.onModelLoadingEmitter.event;

    protected readonly onErrorEmitter = new Emitter<{ uri: string; error: string }>();
    readonly onError: Event<{ uri: string; error: string }> = this.onErrorEmitter.event;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.onModelUpdatedEmitter);
        this.toDispose.push(this.onModelLoadingEmitter);
        this.toDispose.push(this.onErrorEmitter);

        // Subscribe to language server notifications
        this.subscribeToNotifications();
    }

    /**
     * Subscribe to language server notifications.
     */
    protected subscribeToNotifications(): void {
        if (this.languageClientProvider) {
            // Subscribe to model update notifications
            const subscription = this.languageClientProvider.onNotification(
                'glsp/modelUpdated',
                (params: { uri: string; gModel: GModelRoot; metadata?: { positions?: Record<string, any>; sizes?: Record<string, any>; sourceRanges?: Record<string, any> } }) => {
                    this.handleModelUpdateNotification(params);
                }
            );
            this.toDispose.push(subscription);
        }
    }

    /**
     * Handle model update notification from language server.
     */
    protected handleModelUpdateNotification(params: {
        uri: string;
        gModel: GModelRoot;
        metadata?: { positions?: Record<string, any>; sizes?: Record<string, any>; sourceRanges?: Record<string, any>; idMap?: Record<string, string>; fingerprints?: Record<string, unknown> };
    }): void {
        this.cachedModels.set(params.uri, params.gModel);
        this.onModelUpdatedEmitter.fire({
            uri: params.uri,
            gModel: params.gModel,
            metadata: params.metadata ? {
                positions: new Map(Object.entries(params.metadata.positions || {})),
                sizes: new Map(Object.entries(params.metadata.sizes || {})),
                sourceRanges: params.metadata.sourceRanges ? new Map(Object.entries(params.metadata.sourceRanges)) : undefined,
                idMap: params.metadata.idMap,
                fingerprints: params.metadata.fingerprints,
            } : undefined,
        });
    }

    /**
     * Check if language client is available.
     */
    isConnected(): boolean {
        return !!this.languageClientProvider;
    }

    /**
     * Load the diagram model for a document.
     */
    async loadModel(uri: string): Promise<LoadModelResponse> {
        // Check for pending request
        const pending = this.pendingRequests.get(uri);
        if (pending) {
            return pending;
        }

        // Emit loading state
        this.onModelLoadingEmitter.fire({ uri, loading: true });

        const requestPromise = this.doLoadModel(uri);
        this.pendingRequests.set(uri, requestPromise);

        try {
            const response = await requestPromise;
            return response;
        } finally {
            this.pendingRequests.delete(uri);
            this.onModelLoadingEmitter.fire({ uri, loading: false });
        }
    }

    /**
     * Internal method to load the model via language server.
     */
    protected async doLoadModel(uri: string): Promise<LoadModelResponse> {
        this.logger.debug({ uri }, 'doLoadModel called');
        this.logger.debug({ available: !!this.languageClientProvider }, 'languageClientProvider');

        try {
            // If language client provider is available, use it directly
            if (this.languageClientProvider) {
                this.logger.debug('[DiagramLanguageClient] Sending glsp/loadModel request...');
                const response = await this.languageClientProvider.sendRequest<LoadModelResponse>(
                    'glsp/loadModel',
                    { uri }
                );
                this.logger.debug({
                    success: response.success,
                    hasGModel: !!response.gModel,
                    childCount: response.gModel?.children?.length ?? 0,
                    error: response.error,
                }, 'Response received');

                if (response.success && response.gModel) {
                    this.cachedModels.set(uri, response.gModel);
                    this.onModelUpdatedEmitter.fire({
                        uri,
                        gModel: response.gModel,
                        metadata: response.metadata ? {
                            positions: new Map(Object.entries(response.metadata.positions || {})),
                            sizes: new Map(Object.entries(response.metadata.sizes || {})),
                            sourceRanges: response.metadata.sourceRanges ? new Map(Object.entries(response.metadata.sourceRanges)) : undefined,
                            idMap: response.metadata.idMap,
                            fingerprints: response.metadata.fingerprints,
                        } : undefined,
                    });
                }

                return response;
            }

            // Use VS Code command to communicate with the language server extension
            // This works because the extension registers 'sanyam.glsp.loadModel' command
            try {
                const response = await this.commandService.executeCommand<LoadModelResponse>(
                    'sanyam.glsp.loadModel',
                    uri
                );

                if (response && response.success && response.gModel) {
                    this.cachedModels.set(uri, response.gModel);
                    this.onModelUpdatedEmitter.fire({
                        uri,
                        gModel: response.gModel,
                        metadata: response.metadata ? {
                            positions: new Map(Object.entries(response.metadata.positions || {})),
                            sizes: new Map(Object.entries(response.metadata.sizes || {})),
                            sourceRanges: response.metadata.sourceRanges ? new Map(Object.entries(response.metadata.sourceRanges)) : undefined,
                            idMap: response.metadata.idMap,
                            fingerprints: response.metadata.fingerprints,
                        } : undefined,
                    });
                    return response;
                }

                // If command returned but no success, fall through to mock
                if (response && !response.success) {
                    this.logger.warn({ error: response.error }, 'GLSP command failed');
                }
            } catch (cmdError) {
                // Command not found or failed - this is expected if extension not loaded
                this.logger.warn({ err: cmdError }, 'GLSP command not available');
            }

            // Fall back to mock implementation if command failed
            return this.createMockModel(uri);

        } catch (error) {
            this.logger.error({ err: error }, 'Error loading model');
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.onErrorEmitter.fire({ uri, error: errorMessage });
            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Create a mock model for demonstration purposes.
     * Used when language client is not available.
     */
    protected async createMockModel(uri: string): Promise<LoadModelResponse> {
        // Create a simple placeholder model for demonstration
        const label1: GLabel = {
            id: 'label1',
            type: 'label',
            text: 'Sample Node',
        };

        const label2: GLabel = {
            id: 'label2',
            type: 'label',
            text: 'Connected Node',
        };

        const node1: GNode = {
            id: 'node1',
            type: 'node:default',
            children: [label1],
        };

        const node2: GNode = {
            id: 'node2',
            type: 'node:default',
            children: [label2],
        };

        const edge1: GEdge = {
            id: 'edge1',
            type: 'edge:default',
            sourceId: 'node1',
            targetId: 'node2',
        };

        const mockModel: GModelRoot = {
            id: 'root',
            type: 'graph',
            children: [node1, node2, edge1],
        };

        // Mock positions
        const positions: Record<string, { x: number; y: number }> = {
            node1: { x: 50, y: 50 },
            node2: { x: 250, y: 150 },
        };

        // Mock sizes
        const sizes: Record<string, { width: number; height: number }> = {
            node1: { width: 120, height: 60 },
            node2: { width: 140, height: 60 },
        };

        // Simulate a small delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Cache the model
        this.cachedModels.set(uri, mockModel);

        // Emit update event
        this.onModelUpdatedEmitter.fire({
            uri,
            gModel: mockModel,
            metadata: {
                positions: new Map(Object.entries(positions)),
                sizes: new Map(Object.entries(sizes)),
            },
        });

        return {
            success: true,
            gModel: mockModel,
            metadata: { positions, sizes },
        };
    }

    /**
     * Execute a diagram operation.
     */
    async executeOperation(uri: string, operation: DiagramOperation): Promise<ExecuteOperationResponse> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest<ExecuteOperationResponse>(
                    'glsp/executeOperation',
                    { uri, operation }
                );
            }

            // Use VS Code command
            try {
                const response = await this.commandService.executeCommand<ExecuteOperationResponse>(
                    'sanyam.glsp.executeOperation',
                    uri,
                    operation
                );
                if (response) {
                    return response;
                }
            } catch (cmdError) {
                this.logger.warn({ err: cmdError }, 'GLSP executeOperation command not available');
            }

            // Mock response when no command available
            this.logger.debug({ operation }, 'Mock executeOperation');
            return { success: true };

        } catch (error) {
            this.logger.error({ err: error }, 'Error executing operation');
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Request diagram layout from the server.
     */
    async requestLayout(uri: string, options?: { algorithm?: string; spacing?: number }): Promise<LayoutResponse> {
        try {
            if (this.languageClientProvider) {
                const response = await this.languageClientProvider.sendRequest<LayoutResponse>(
                    'glsp/layout',
                    { uri, options }
                );
                return response;
            }

            // Use VS Code command
            try {
                const response = await this.commandService.executeCommand<LayoutResponse>(
                    'sanyam.glsp.requestLayout',
                    uri,
                    options
                );
                if (response) {
                    return response;
                }
            } catch (cmdError) {
                this.logger.warn({ err: cmdError }, 'GLSP requestLayout command not available');
            }

            // Mock response when no command available
            return { positions: {}, bounds: { width: 0, height: 0 } };

        } catch (error) {
            this.logger.error({ err: error }, 'Error requesting layout');
            return {
                positions: {},
                bounds: { width: 0, height: 0 },
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get tool palette from the server.
     */
    async getToolPalette(uri: string): Promise<ToolPaletteResponse> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest<ToolPaletteResponse>(
                    'glsp/toolPalette',
                    { uri }
                );
            }

            // Use VS Code command
            try {
                const response = await this.commandService.executeCommand<ToolPaletteResponse>(
                    'sanyam.glsp.getToolPalette',
                    uri
                );
                if (response) {
                    return response;
                }
            } catch (cmdError) {
                this.logger.warn({ err: cmdError }, 'GLSP getToolPalette command not available');
            }

            // Mock response when no command available
            return { groups: [] };

        } catch (error) {
            this.logger.error({ err: error }, 'Error getting tool palette');
            return {
                groups: [],
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get context menu from the server.
     */
    async getContextMenu(uri: string, selectedIds: string[], position?: { x: number; y: number }): Promise<ContextMenuResponse> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest<ContextMenuResponse>(
                    'glsp/contextMenu',
                    { uri, selectedIds, position }
                );
            }

            // Mock response when no language client
            return { items: [] };

        } catch (error) {
            this.logger.error({ err: error }, 'Error getting context menu');
            return {
                items: [],
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Validate the diagram model.
     */
    async validateModel(uri: string): Promise<{
        markers: Array<{ elementId: string; severity: string; message: string }>;
        isValid: boolean;
        errorCount: number;
        warningCount: number;
    }> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest(
                    'glsp/validate',
                    { uri }
                );
            }

            // Use VS Code command
            try {
                const response = await this.commandService.executeCommand<{
                    markers: Array<{ elementId: string; severity: string; message: string }>;
                    isValid: boolean;
                    errorCount: number;
                    warningCount: number;
                }>(
                    'sanyam.glsp.validate',
                    uri
                );
                if (response) {
                    return response;
                }
            } catch (cmdError) {
                this.logger.warn({ err: cmdError }, 'GLSP validate command not available');
            }

            // Mock response when no command available
            return { markers: [], isValid: true, errorCount: 0, warningCount: 0 };

        } catch (error) {
            this.logger.error({ err: error }, 'Error validating model');
            return {
                markers: [],
                isValid: false,
                errorCount: 1,
                warningCount: 0,
            };
        }
    }

    /**
     * Save the diagram model.
     */
    async saveModel(uri: string): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest(
                    'glsp/saveModel',
                    { uri }
                );
            }

            // Mock response when no language client
            return { success: true };

        } catch (error) {
            this.logger.error({ err: error }, 'Error saving model');
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get supported operations from the server.
     */
    async getSupportedOperations(): Promise<{ operations: string[] }> {
        try {
            if (this.languageClientProvider) {
                return await this.languageClientProvider.sendRequest(
                    'glsp/supportedOperations',
                    {}
                );
            }

            // Mock response when no language client
            return { operations: [] };

        } catch (error) {
            this.logger.error({ err: error }, 'Error getting supported operations');
            return { operations: [] };
        }
    }

    /**
     * Receive a model update from an external source (e.g., language server notification).
     */
    handleModelUpdate(uri: string, gModel: GModelRoot, metadata?: { positions?: Record<string, any>; sizes?: Record<string, any>; sourceRanges?: Record<string, any> }): void {
        this.cachedModels.set(uri, gModel);
        this.onModelUpdatedEmitter.fire({
            uri,
            gModel,
            metadata: metadata ? {
                positions: new Map(Object.entries(metadata.positions || {})),
                sizes: new Map(Object.entries(metadata.sizes || {})),
                sourceRanges: metadata.sourceRanges ? new Map(Object.entries(metadata.sourceRanges)) : undefined,
            } : undefined,
        });
    }

    /**
     * Get cached model for a URI.
     */
    getCachedModel(uri: string): GModelRoot | undefined {
        return this.cachedModels.get(uri);
    }

    /**
     * Subscribe to model changes for a document.
     */
    subscribeToChanges(uri: string, callback: (update: DiagramModelUpdate) => void): Disposable {
        const subscription = this.onModelUpdated((update) => {
            if (update.uri === uri) {
                callback(update);
            }
        });

        this.toDispose.push(subscription);
        return subscription;
    }

    /**
     * Clear cached model for a URI.
     */
    clearCache(uri: string): void {
        this.cachedModels.delete(uri);
    }

    /**
     * Clear all cached models.
     */
    clearAllCache(): void {
        this.cachedModels.clear();
    }

    dispose(): void {
        this.toDispose.dispose();
        this.cachedModels.clear();
        this.pendingRequests.clear();
    }
}
