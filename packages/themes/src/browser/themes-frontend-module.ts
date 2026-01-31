import '../../src/browser/style/blueprint-theme.css';

import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ContainerModule } from '@theia/core/shared/inversify';
import { SanyamThemeContribution } from './sanyam-theme-contribution';

export default new ContainerModule(bind => {
    bind(SanyamThemeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SanyamThemeContribution);
});
