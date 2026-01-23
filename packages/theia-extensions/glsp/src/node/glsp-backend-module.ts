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
 * Binds the GLSP server contribution that connects the frontend to the
 * unified language server's GLSP endpoints.
 *
 * @packageDocumentation
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { GLSPServerContribution } from '@eclipse-glsp/theia-integration/lib/node';
import {
    SanyamGlspServerContribution,
    SanyamGlspServicePath,
    SANYAM_GLSP_SERVICE_PATH,
} from './sanyam-glsp-server-contribution';

/**
 * GLSP backend module.
 *
 * Sets up the GLSP server contribution that bridges the Theia frontend
 * to the unified language server.
 */
export default new ContainerModule((bind) => {
    // Bind the service path constant
    bind(SanyamGlspServicePath).toConstantValue(SANYAM_GLSP_SERVICE_PATH);

    // Bind the GLSP server contribution
    bind(SanyamGlspServerContribution).toSelf().inSingletonScope();
    bind(GLSPServerContribution).toService(SanyamGlspServerContribution);

    console.log('[glsp-backend-module] GLSP backend module loaded');
});
