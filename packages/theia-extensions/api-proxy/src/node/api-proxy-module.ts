import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { ApiProxyContribution } from './api-proxy-contribution';

export default new ContainerModule(bind => {
  bind(ApiProxyContribution).toSelf().inSingletonScope();
  bind(BackendApplicationContribution).toService(ApiProxyContribution);
});
