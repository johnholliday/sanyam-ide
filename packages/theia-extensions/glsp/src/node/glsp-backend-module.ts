/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * GLSP Backend Module
 *
 * Theia backend ContainerModule for GLSP integration.
 * Binds the GLSP server contribution and backend service that connect the
 * frontend to the unified language server's GLSP endpoints.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { GLSPServerContribution } from '@eclipse-glsp/theia-integration/lib/node';
import {
    SanyamGlspService,
    SanyamGlspServicePath,
} from '@sanyam/types';
import {
    SanyamGlspServerContribution,
    SanyamGlspServicePath as LegacyServicePath,
    SANYAM_GLSP_SERVICE_PATH,
} from './sanyam-glsp-server-contribution';
import { SanyamGlspBackendServiceImpl } from './sanyam-glsp-backend-service';

/**
 * GLSP backend module.
 *
 * Sets up:
 * - GLSP server contribution for Eclipse GLSP integration
 * - SanyamGlspService backend implementation with JSON-RPC handler
 */
export default new ContainerModule((bind) => {
    // =========================================================================
    // Legacy GLSP Server Contribution (for Eclipse GLSP compatibility)
    // =========================================================================

    // Bind the legacy service path constant
    bind(LegacyServicePath).toConstantValue(SANYAM_GLSP_SERVICE_PATH);

    // Bind the GLSP server contribution
    bind(SanyamGlspServerContribution).toSelf().inSingletonScope();
    bind(GLSPServerContribution).toService(SanyamGlspServerContribution);

    // =========================================================================
    // SanyamGlspService (New RPC-based service)
    // =========================================================================

    // Bind the backend service implementation
    bind(SanyamGlspBackendServiceImpl).toSelf().inSingletonScope();
    bind(SanyamGlspService).toService(SanyamGlspBackendServiceImpl);

    // Register JSON-RPC connection handler for frontend-backend communication
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(SanyamGlspServicePath, () =>
            ctx.container.get<SanyamGlspBackendServiceImpl>(SanyamGlspService)
        )
    ).inSingletonScope();

    const logger = createLogger({ name: 'GlspBackend' });
    logger.info('GLSP backend module loaded');
    logger.info({ path: SanyamGlspServicePath }, 'Registered RPC handler');
});
