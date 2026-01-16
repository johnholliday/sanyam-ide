/********************************************************************************
 * Grammar Manifest Contribution - ECML
 *
 * Registers the ECML grammar manifest with the SANYAM platform.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';
import { ECML_MANIFEST } from '../../manifest';

export default new ContainerModule(bind => {
    bind(GrammarManifestContribution).toConstantValue({
        manifest: ECML_MANIFEST
    });
});
