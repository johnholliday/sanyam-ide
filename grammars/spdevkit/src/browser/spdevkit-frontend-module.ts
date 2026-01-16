/********************************************************************************
 * Grammar Manifest Contribution - SPDevKit
 *
 * Registers the SPDevKit grammar manifest with the SANYAM platform.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';
import { SPDEVKIT_MANIFEST } from '../../manifest';

export default new ContainerModule(bind => {
    bind(GrammarManifestContribution).toConstantValue({
        manifest: SPDEVKIT_MANIFEST
    });
});
