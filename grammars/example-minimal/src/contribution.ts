/**
 * Example Minimal Language Contribution
 *
 * Demonstrates the contribution pattern for SANYAM integration.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
  ContributionContext,
} from '@sanyam/types';

import { manifest } from './manifest.js';

/**
 * Custom LSP providers for example-minimal.
 *
 * This example shows how to add custom completion items.
 */
const customLspProviders: Partial<LspFeatureProviders> = {
  // Example: Add keyword completions
  // completion: {
  //   provide: async (document, position, context) => {
  //     return [
  //       { label: 'box', kind: 14, detail: 'Create a new box' },
  //       { label: 'arrow', kind: 14, detail: 'Create an arrow' },
  //     ];
  //   },
  // },
};

/**
 * Custom GLSP providers for example-minimal.
 *
 * This example uses the default providers.
 */
const customGlspProviders: Partial<GlspFeatureProviders> = {
  // Default providers are used
};

/**
 * Create the language contribution.
 *
 * @param context - Contribution context with services
 * @returns The language contribution configuration
 */
export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: 'example-minimal',
    fileExtensions: ['.exm', '.example'],
    generatedModule: context.generatedModule,
    manifest,
    lspProviders: customLspProviders,
    glspProviders: customGlspProviders,
    disabledFeatures: manifest.disabledFeatures,
  };
}

export default createContribution;
