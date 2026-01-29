/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { createLogger, type SanyamLogger } from '@sanyam/logger';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import {
    GLSPServerContribution,
    GLSPServerContributionOptions,
} from '@eclipse-glsp/theia-integration/lib/node';
import { Channel, Disposable, DisposableCollection, MaybePromise } from '@theia/core';
import { ReadBuffer } from '@theia/core/lib/common/message-rpc/message-buffer';

/**
 * Symbol for injecting the GLSP service path.
 */
export const SanyamGlspServicePath = Symbol('SanyamGlspServicePath');

/**
 * Default GLSP service path for Sanyam diagrams.
 */
export const SANYAM_GLSP_SERVICE_PATH = '/services/glsp/sanyam';

/**
 * Sanyam GLSP Server Contribution.
 *
 * This contribution connects the Theia frontend to the unified language server's
 * GLSP endpoints. Instead of spawning a separate GLSP server process, it bridges
 * the frontend's GLSP requests to the language server via custom LSP methods.
 *
 * Architecture:
 * - Frontend (Sprotty) → Backend (this contribution) → Language Server (GLSP handlers)
 * - The language server already implements GLSP protocol via glsp/loadModel, glsp/executeOperation, etc.
 */
@injectable()
export class SanyamGlspServerContribution implements GLSPServerContribution {
    readonly id = 'sanyam';

    readonly options: GLSPServerContributionOptions = {
        launchOnDemand: false,     // Don't launch on demand - we use the embedded server
        launchedExternally: true,  // Server is managed externally (by VS Code extension)
    };

    protected readonly toDispose = new DisposableCollection();
    protected clientConnections = new Map<string, Channel>();
    protected readonly logger: SanyamLogger = createLogger({ name: 'GlspServerContribution' });

    @postConstruct()
    protected initialize(): void {
        this.logger.info('Initialized');
    }

    /**
     * Connect a GLSP client to the server.
     *
     * This method is called when a diagram editor opens and needs to connect
     * to the GLSP server. We forward messages from the client channel to the
     * unified language server.
     */
    connect(clientChannel: Channel): MaybePromise<Disposable> {
        const clientId = this.generateClientId();
        this.logger.info({ clientId }, `Client ${clientId} connecting...`);

        try {
            // Store the client channel for communication
            this.clientConnections.set(clientId, clientChannel);

            // Set up message handling from the client
            const messageHandler = clientChannel.onMessage((msgProvider) => {
                const buffer: ReadBuffer = msgProvider();
                // For now, log messages - in a full implementation, we would
                // forward these to the language server
                this.logger.info({ clientId }, `Received message from client ${clientId}`);
                this.handleClientMessage(clientId, buffer);
            });

            const closeHandler = clientChannel.onClose(() => {
                this.logger.info({ clientId }, `Client ${clientId} channel closed`);
                this.clientConnections.delete(clientId);
            });

            const errorHandler = clientChannel.onError((error) => {
                this.logger.error({ clientId, err: error }, `Client ${clientId} error`);
            });

            this.logger.info({ clientId }, `Client ${clientId} connected successfully`);

            // Return a disposable that cleans up the connection
            return Disposable.create(() => {
                this.logger.info({ clientId }, `Client ${clientId} disconnecting...`);
                this.clientConnections.delete(clientId);
                messageHandler.dispose();
                closeHandler.dispose();
                errorHandler.dispose();
            });
        } catch (error) {
            this.logger.error({ clientId, err: error }, `Failed to connect client ${clientId}`);
            throw error;
        }
    }

    /**
     * Handle a message from a connected client.
     *
     * In a full implementation, this would parse the JSON-RPC message
     * and forward GLSP requests to the language server.
     */
    protected handleClientMessage(clientId: string, buffer: ReadBuffer): void {
        try {
            const content = buffer.readString();
            const message = JSON.parse(content);
            this.logger.debug({ clientId, method: message.method || message.id }, `Message from ${clientId}`);

            // TODO: Forward to language server and send response back to client
            // For now, just log the message
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to parse message');
        }
    }

    /**
     * Send a message to a connected client.
     */
    protected sendToClient(clientId: string, message: any): void {
        const channel = this.clientConnections.get(clientId);
        if (channel) {
            const content = JSON.stringify(message);
            channel.getWriteBuffer().writeString(content).commit();
        }
    }

    /**
     * Launch is not implemented since we use the embedded language server.
     * The language server is started by the VS Code extension.
     */
    launch?(): Promise<Disposable> {
        this.logger.info('Launch called - using embedded server');
        return Promise.resolve(Disposable.NULL);
    }

    /**
     * Generate a unique client ID.
     */
    protected generateClientId(): string {
        return `sanyam-glsp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.logger.info('Disposing...');
        this.clientConnections.clear();
        this.toDispose.dispose();
    }
}
