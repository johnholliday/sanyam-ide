/**
 * Language Contribution for {{languageId}}
 *
 * This file exports the LanguageContribution which provides
 * custom LSP and GLSP providers for this grammar.
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
 * Custom LSP providers for {{languageId}}.
 *
 * Override default LSP behavior by implementing custom providers.
 * Only implement providers where you need custom behavior.
 */
const customLspProviders: Partial<LspFeatureProviders> = {
  // Example: Custom completion provider
  // completion: {
  //   provide: async (document, position, context) => {
  //     // Return custom completion items
  //     return [];
  //   },
  // },

  // Example: Custom hover provider
  // hover: {
  //   provide: async (document, position) => {
  //     // Return custom hover content
  //     return null;
  //   },
  // },
};

/**
 * Custom GLSP providers for {{languageId}}.
 *
 * Override default GLSP behavior for diagram operations.
 * Only implement providers where you need custom behavior.
 */
const customGlspProviders: Partial<GlspFeatureProviders> = {
  // Example: Custom AST to GModel conversion
  // astToGModel: {
  //   convert: (astNode, context) => {
  //     // Return custom GModel representation
  //     return { id: 'custom', type: 'graph', children: [] };
  //   },
  // },

  // Example: Custom validation
  // validation: {
  //   validate: async (model, context) => {
  //     // Return custom validation markers
  //     return [];
  //   },
  // },
};

/**
 * Create the language contribution.
 *
 * This function is called during server initialization to register
 * the language with the unified server.
 *
 * @param context - Contribution context with services and configuration
 * @returns The language contribution configuration
 */
export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: '{{languageId}}',
    fileExtensions: {{fileExtensionsArray}},
    generatedModule: context.generatedModule,
    manifest,
    lspProviders: customLspProviders,
    glspProviders: customGlspProviders,
    disabledFeatures: manifest.disabledFeatures,
  };
}

/**
 * Default export for auto-discovery.
 */
export default createContribution;
