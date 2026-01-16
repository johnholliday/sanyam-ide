/********************************************************************************
 * Grammar Manifest Contribution - ActOne
 *
 * Registers the ActOne grammar manifest with the SANYAM platform.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';
import { ACTONE_MANIFEST } from '../../manifest';

export default new ContainerModule(bind => {
    bind(GrammarManifestContribution).toConstantValue({
        manifest: ACTONE_MANIFEST
    });
});
