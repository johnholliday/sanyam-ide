/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { CommandContribution } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { GrammarRegistry, GrammarManifestMapToken } from './grammar-registry';
import { TheiaIDEAboutDialog } from './sanyam-ide-about-dialog';
import { TheiaIDEContribution } from './sanyam-ide-contribution';
import { TheiaIDEGettingStartedWidget } from './sanyam-ide-getting-started-widget';

// Import grammar manifests via webpack alias - resolved at bundle time
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { grammarManifests } from '@app/grammar-manifests';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    // Grammar manifest map - provided by application via webpack alias
    bind(GrammarManifestMapToken).toConstantValue(grammarManifests);
    bind(GrammarRegistry).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(GrammarRegistry);

    bind(TheiaIDEGettingStartedWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: GettingStartedWidget.ID,
        createWidget: () => context.container.get<TheiaIDEGettingStartedWidget>(TheiaIDEGettingStartedWidget),
    })).inSingletonScope();
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    }

    bind(TheiaIDEContribution).toSelf().inSingletonScope();
    [CommandContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(TheiaIDEContribution)
    );

});
