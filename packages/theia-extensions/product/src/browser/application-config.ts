import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import type { ApplicationMetadata } from '@sanyam/types';

/**
 * Extended frontend config interface with applicationData field.
 */
interface ExtendedFrontendConfig {
    applicationData?: ApplicationMetadata;
    applicationName: string;
}

/**
 * Get the application metadata from the frontend configuration.
 * Returns undefined if applicationData is not configured.
 */
export function getApplicationMetadata(): ApplicationMetadata | undefined {
    const config = FrontendApplicationConfigProvider.get() as ExtendedFrontendConfig;
    return config.applicationData;
}

/**
 * Get the application name from the frontend configuration.
 */
export function getApplicationName(): string {
    return FrontendApplicationConfigProvider.get().applicationName;
}
