/**
 * Product Backend Module
 *
 * Binds the `BackendApplicationServer` to `ConfigInjectionServer`,
 * which injects `window.__SANYAM_CONFIG__` into `index.html` at runtime.
 *
 * @packageDocumentation
 */

// Side-effect: load .env.local / .env before anything reads process.env
import './dotenv-loader';

import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationServer } from '@theia/core/lib/node';
import { ConfigInjectionServer } from './config-injection-server';

export default new ContainerModule(bind => {
    bind(ConfigInjectionServer).toSelf().inSingletonScope();
    bind(BackendApplicationServer).toService(ConfigInjectionServer);
});
