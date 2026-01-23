/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

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

    @postConstruct()
    protected initialize(): void {
        console.log('[SanyamGlspServerContribution] Initialized');
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
        console.log(`[SanyamGlspServerContribution] Client ${clientId} connecting...`);

        try {
            // Store the client channel for communication
            this.clientConnections.set(clientId, clientChannel);

            // Set up message handling from the client
            const messageHandler = clientChannel.onMessage((msgProvider) => {
                const buffer: ReadBuffer = msgProvider();
                // For now, log messages - in a full implementation, we would
                // forward these to the language server
                console.log(`[SanyamGlspServerContribution] Received message from client ${clientId}`);
                this.handleClientMessage(clientId, buffer);
            });

            const closeHandler = clientChannel.onClose(() => {
                console.log(`[SanyamGlspServerContribution] Client ${clientId} channel closed`);
                this.clientConnections.delete(clientId);
            });

            const errorHandler = clientChannel.onError((error) => {
                console.error(`[SanyamGlspServerContribution] Client ${clientId} error:`, error);
            });

            console.log(`[SanyamGlspServerContribution] Client ${clientId} connected successfully`);

            // Return a disposable that cleans up the connection
            return Disposable.create(() => {
                console.log(`[SanyamGlspServerContribution] Client ${clientId} disconnecting...`);
                this.clientConnections.delete(clientId);
                messageHandler.dispose();
                closeHandler.dispose();
                errorHandler.dispose();
            });
        } catch (error) {
            console.error(`[SanyamGlspServerContribution] Failed to connect client ${clientId}:`, error);
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
            console.log(`[SanyamGlspServerContribution] Message from ${clientId}:`, message.method || message.id);

            // TODO: Forward to language server and send response back to client
            // For now, just log the message
        } catch (error) {
            console.error(`[SanyamGlspServerContribution] Failed to parse message:`, error);
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
        console.log('[SanyamGlspServerContribution] Launch called - using embedded server');
        return Promise.resolve(Disposable.NULL);
    }

    /**
     * Generate a unique client ID.
     */
    protected generateClientId(): string {
        return `sanyam-glsp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        console.log('[SanyamGlspServerContribution] Disposing...');
        this.clientConnections.clear();
        this.toDispose.dispose();
    }
}
