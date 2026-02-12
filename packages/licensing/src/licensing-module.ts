/**
 * Licensing DI Module
 *
 * Inversify container module for @sanyam/licensing services.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import {
  LicenseValidator,
  LicenseValidatorImpl,
} from './license-validator.js';
import {
  FeatureGate,
  FeatureGateImpl,
  registerBuiltInFeatures,
} from './feature-gate.js';

/**
 * Create DI bindings for licensing services.
 *
 * @param registerBuiltIn - Whether to register built-in features (default: true)
 * @returns Container module
 */
export function createLicensingModule(registerBuiltIn = true): ContainerModule {
  return new ContainerModule((bind) => {
    // License validator
    bind(LicenseValidator).to(LicenseValidatorImpl).inSingletonScope();

    // Feature gate
    bind(FeatureGate).to(FeatureGateImpl).inSingletonScope();

    // Register built-in features after gate is created
    if (registerBuiltIn) {
      bind('LicensingInit').toDynamicValue((context) => {
        const featureGate = context.container.get<FeatureGate>(FeatureGate);
        registerBuiltInFeatures(featureGate);
        return true;
      }).inSingletonScope();
    }
  });
}
