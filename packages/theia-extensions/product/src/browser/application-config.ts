import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import type { ApplicationMetadata } from '@sanyam/types';

/**
 * Extended frontend config interface with applicationData and applicationGrammar fields.
 */
export interface ExtendedFrontendConfig {
    applicationName: string;
    applicationGrammar?: string;           // Primary grammar ID (e.g., 'ecml')
    applicationData?: ApplicationMetadata;
}

/**
 * Get the full extended frontend configuration.
 */
export function getExtendedConfig(): ExtendedFrontendConfig {
    return FrontendApplicationConfigProvider.get() as ExtendedFrontendConfig;
}

/**
 * Get the application name from the frontend configuration.
 */
export function getApplicationName(): string {
    return FrontendApplicationConfigProvider.get().applicationName;
}

/**
 * Get the primary grammar ID from the frontend configuration.
 * Returns undefined if applicationGrammar is not configured.
 *
 * @example 'ecml'
 */
export function getApplicationGrammar(): string | undefined {
    return getExtendedConfig().applicationGrammar;
}

/**
 * Get the application metadata from the frontend configuration.
 * Returns undefined if applicationData is not configured.
 */
export function getApplicationMetadata(): ApplicationMetadata | undefined {
    return getExtendedConfig().applicationData;
}
