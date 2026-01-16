/********************************************************************************
 * Grammar Manifest Contribution - ISO 42001
 *
 * Registers the ISO 42001 grammar manifest with the SANYAM platform.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';
import { ISO_42001_MANIFEST } from '../../manifest';

export default new ContainerModule(bind => {
    bind(GrammarManifestContribution).toConstantValue({
        manifest: ISO_42001_MANIFEST
    });
});
