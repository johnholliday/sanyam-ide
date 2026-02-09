/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { createLogger } from '@sanyam/logger';
import { Emitter, Disposable, DisposableCollection } from '@theia/core/lib/common';
import { LanguageClientProvider } from './diagram-language-client';
import {
    type SanyamGlspServiceInterface,
    type DiagramOperation,
    type LayoutOptions,
    type GlspPoint,
} from '@sanyam/types';

/**
 * Symbol for GLSP service proxy injection.
 * Must match GLSP_FRONTEND_TYPES.GlspServiceProxy in glsp-frontend-module.ts
 */
export const GlspServiceProxySymbol = Symbol.for('SanyamGlspServiceProxy');

/**
 * Static holder for the GLSP service proxy (for external access).
 */
const moduleLogger = createLogger({ name: 'LangClientProvider' });

let _glspServiceProxy: SanyamGlspServiceInterface | undefined;

/**
 * Set the GLSP service proxy.
 * Called from glsp-frontend-module.ts when the proxy is created.
 */
export function setGlspServiceProxy(proxy: SanyamGlspServiceInterface): void {
    _glspServiceProxy = proxy;
    moduleLogger.debug('GLSP service proxy set');
}

/**
 * Get the GLSP service proxy.
 * Returns undefined if not yet set.
 */
export function getGlspServiceProxy(): SanyamGlspServiceInterface | undefined {
    return _glspServiceProxy;
}

/**
 * Event emitted when connection status changes.
 */
export interface ConnectionStatusEvent {
    connected: boolean;
    error?: string;
}

/**
 * Sanyam Language Client Provider.
 *
 * Provides a bridge between the Theia frontend and the unified language server
 * for GLSP operations. This implementation uses the static GlspServiceProxyHolder
 * to lazily create the service proxy, avoiding Inversify async dependency issues.
 *
 * Request flow:
 * 1. DiagramLanguageClient calls sendRequest()
 * 2. This provider routes to the appropriate service method
 * 3. Service proxy sends JSON-RPC to backend
 * 4. Backend service processes via unified language server
 *
 * The DiagramLanguageClient will inject this provider and use it for
 * sending GLSP requests to the backend.
 */
@injectable()
export class SanyamLanguageClientProvider implements LanguageClientProvider {
    protected readonly logger = createLogger({ name: 'LangClientProvider' });
    protected readonly toDispose = new DisposableCollection();
    protected notificationHandlers = new Map<string, Set<(params: unknown) => void>>();

    protected readonly onConnectionStatusChangedEmitter = new Emitter<ConnectionStatusEvent>();
    readonly onConnectionStatusChanged = this.onConnectionStatusChangedEmitter.event;

    /**
     * Injected GLSP service proxy.
     * Created via ServiceConnectionProvider.createProxy() in the frontend module.
     */
    @inject(GlspServiceProxySymbol)
    protected readonly glspService: SanyamGlspServiceInterface;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.onConnectionStatusChangedEmitter);
        // Also set the static proxy for external access
        setGlspServiceProxy(this.glspService);
        this.logger.debug('Initialized with GLSP service proxy');
    }

    /**
     * Send a request to the backend GLSP service.
     *
     * This method translates glsp/* request methods to the appropriate
     * backend service methods via the RPC proxy.
     */
    async sendRequest<R>(method: string, params: unknown): Promise<R> {
        this.logger.debug({ method, params }, 'sendRequest');

        const glspService = this.glspService;

        // Route to the appropriate service method based on the request method
        switch (method) {
            case 'glsp/loadModel': {
                const { uri, savedIdMap, savedFingerprints } = params as {
                    uri: string;
                    savedIdMap?: Record<string, string>;
                    savedFingerprints?: Record<string, unknown>;
                };
                const result = await glspService.loadModel(uri, savedIdMap, savedFingerprints);
                return result as R;
            }

            case 'glsp/saveModel': {
                const { uri } = params as { uri: string };
                const result = await glspService.saveModel(uri);
                return result as R;
            }

            case 'glsp/executeOperation': {
                const { uri, operation } = params as { uri: string; operation: DiagramOperation };
                const result = await glspService.executeOperation(uri, operation);
                return result as R;
            }

            case 'glsp/layout':
            case 'glsp/requestLayout': {
                const { uri, options } = params as { uri: string; options?: LayoutOptions };
                const result = await glspService.requestLayout(uri, options);
                return result as R;
            }

            case 'glsp/toolPalette':
            case 'glsp/getToolPalette': {
                const { uri } = params as { uri: string };
                const result = await glspService.getToolPalette(uri);
                return result as R;
            }

            case 'glsp/contextMenu':
            case 'glsp/getContextMenu': {
                const { uri, selectedIds, position } = params as {
                    uri: string;
                    selectedIds: string[];
                    position?: GlspPoint;
                };
                const result = await glspService.getContextMenu(uri, selectedIds, position);
                return result as R;
            }

            case 'glsp/validate': {
                const { uri } = params as { uri: string };
                const result = await glspService.validate(uri);
                return result as R;
            }

            case 'glsp/syncDocument': {
                const { uri, content, version } = params as { uri: string; content: string; version: number };
                await glspService.syncDocument(uri, content, version);
                return undefined as R;
            }

            case 'glsp/supportedOperations':
            case 'glsp/getSupportedOperations': {
                const result = await glspService.getSupportedOperations();
                return result as R;
            }

            case 'glsp/diagramLanguages':
            case 'glsp/getDiagramLanguages': {
                const result = await glspService.getDiagramLanguages();
                return result as R;
            }

            case 'workspace/executeCommand': {
                const { command, arguments: cmdArgs } = params as {
                    command: string;
                    arguments: unknown[];
                };
                const result = await glspService.executeCommand(command, cmdArgs ?? []);
                return result as R;
            }

            default:
                throw new Error(`Unknown GLSP method: ${method}`);
        }
    }

    /**
     * Register a notification handler.
     *
     * Notifications are used for asynchronous updates from the server,
     * such as model changes triggered by text editor edits.
     */
    onNotification(method: string, handler: (params: unknown) => void): Disposable {
        let handlers = this.notificationHandlers.get(method);
        if (!handlers) {
            handlers = new Set();
            this.notificationHandlers.set(method, handlers);
        }
        handlers.add(handler);

        this.logger.debug({ method }, 'Registered notification handler');

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
    fireNotification(method: string, params: unknown): void {
        const handlers = this.notificationHandlers.get(method);
        if (handlers) {
            this.logger.debug({ method }, 'Firing notification');
            for (const handler of handlers) {
                try {
                    handler(params);
                } catch (error) {
                    this.logger.error({ err: error, method }, 'Handler error');
                }
            }
        }
    }

    /**
     * Check if connected to the backend.
     * Always returns true since the proxy is created lazily on first use.
     */
    isConnected(): boolean {
        return true;
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        this.toDispose.dispose();
        this.notificationHandlers.clear();
    }
}
