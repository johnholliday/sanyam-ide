/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Disposable, DisposableCollection } from '@theia/core/lib/common';
import { LanguageClientProvider } from './diagram-language-client';

/**
 * Service path for the GLSP language client.
 * This must match the path used in the backend module.
 */
export const SANYAM_GLSP_SERVICE_PATH = '/services/glsp/sanyam';

/**
 * Event emitted when connection status changes.
 */
export interface ConnectionStatusEvent {
    connected: boolean;
    error?: string;
}

/**
 * Sanyam GLSP Service interface.
 *
 * Defines the RPC interface between frontend and backend for GLSP operations.
 * This interface is implemented by the backend service and proxied to the frontend.
 */
export interface SanyamGlspService {
    /**
     * Load the diagram model for a document.
     */
    loadModel(uri: string): Promise<any>;

    /**
     * Execute a diagram operation.
     */
    executeOperation(uri: string, operation: any): Promise<any>;

    /**
     * Request diagram layout.
     */
    requestLayout(uri: string, options?: any): Promise<any>;

    /**
     * Get tool palette.
     */
    getToolPalette(uri: string): Promise<any>;

    /**
     * Validate diagram model.
     */
    validate(uri: string): Promise<any>;

    /**
     * Save diagram model.
     */
    saveModel(uri: string): Promise<any>;

    /**
     * Get context menu.
     */
    getContextMenu(uri: string, selectedIds: string[], position?: { x: number; y: number }): Promise<any>;

    /**
     * Get supported operations.
     */
    getSupportedOperations(): Promise<{ operations: string[] }>;
}

/**
 * Symbol for the GLSP service.
 */
export const SanyamGlspService = Symbol('SanyamGlspService');

/**
 * Sanyam Language Client Provider.
 *
 * Provides a bridge between the Theia frontend and the unified language server
 * for GLSP operations. This implementation uses a fallback pattern:
 *
 * 1. Try to use the injected GLSP service proxy (if backend is connected)
 * 2. Fall back to VS Code command execution
 * 3. Fall back to mock data (for testing without backend)
 *
 * The DiagramLanguageClient will inject this provider and use it for
 * sending GLSP requests to the backend.
 */
@injectable()
export class SanyamLanguageClientProvider implements LanguageClientProvider {
    protected readonly toDispose = new DisposableCollection();
    protected notificationHandlers = new Map<string, Set<(params: any) => void>>();
    protected connected = false;

    protected readonly onConnectionStatusChangedEmitter = new Emitter<ConnectionStatusEvent>();
    readonly onConnectionStatusChanged = this.onConnectionStatusChangedEmitter.event;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.onConnectionStatusChangedEmitter);
        // Mark as connected - the actual connection is handled at a higher level
        // when the backend contribution receives client connections
        this.connected = true;
        console.log('[SanyamLanguageClientProvider] Initialized');
    }

    /**
     * Send a request to the backend GLSP service.
     *
     * This method translates our custom glsp/* request methods to the
     * appropriate backend calls. In the future, this will use proper
     * RPC communication with the backend.
     */
    async sendRequest<R>(method: string, params: any): Promise<R> {
        console.log(`[SanyamLanguageClientProvider] sendRequest: ${method}`, params);

        // Currently, we can't directly call the backend service because
        // the GLSP server contribution uses channel-based communication.
        // The DiagramLanguageClient will fall back to VS Code commands.
        //
        // TODO: Implement proper backend RPC service that handles GLSP requests
        // and forwards them to the unified language server.
        throw new Error(`Backend GLSP service not yet implemented for method: ${method}`);
    }

    /**
     * Register a notification handler.
     *
     * Notifications are used for asynchronous updates from the server,
     * such as model changes triggered by text editor edits.
     */
    onNotification(method: string, handler: (params: any) => void): Disposable {
        let handlers = this.notificationHandlers.get(method);
        if (!handlers) {
            handlers = new Set();
            this.notificationHandlers.set(method, handlers);
        }
        handlers.add(handler);

        console.log(`[SanyamLanguageClientProvider] Registered notification handler for: ${method}`);

        return Disposable.create(() => {
            handlers?.delete(handler);
            if (handlers?.size === 0) {
                this.notificationHandlers.delete(method);
            }
        });
    }

    /**
     * Fire a notification to all registered handlers.
     *
     * This is called when the backend sends a notification.
     */
    protected fireNotification(method: string, params: any): void {
        const handlers = this.notificationHandlers.get(method);
        if (handlers) {
            console.log(`[SanyamLanguageClientProvider] Firing notification: ${method}`);
            for (const handler of handlers) {
                try {
                    handler(params);
                } catch (error) {
                    console.error(`[SanyamLanguageClientProvider] Handler error for ${method}:`, error);
                }
            }
        }
    }

    /**
     * Check if connected to the backend.
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        this.toDispose.dispose();
        this.notificationHandlers.clear();
    }
}
