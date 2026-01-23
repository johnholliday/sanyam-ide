/**
 * ECML Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 *
 * @packageDocumentation
 */

import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  EcmlGeneratedModule,
  EcmlGeneratedSharedModule,
} from './generated/module.js';

/**
 * Custom LSP providers for ECML.
 *
 * Override default LSP behavior here. Omitted providers use Langium defaults.
 */
const lspProviders: Partial<LspFeatureProviders> = {
  // Add custom LSP providers here
  // Example:
  // hover: {
  //   provide: async (ctx, params) => ({
  //     contents: { kind: 'markdown', value: '**Custom hover**' }
  //   })
  // }
};

/**
 * Custom GLSP providers for ECML.
 *
 * Override default diagram behavior here. Omitted providers use manifest-driven defaults.
 */
const glspProviders: Partial<GlspFeatureProviders> = {
  // Custom AST to GModel conversion
  astToGModel: {
    // Extract label from ECML elements (name + title pattern)
    getLabel: (ast: unknown) => {
      const node = ast as { name?: string; title?: string };
      // ECML uses title as the display name (in quotes), name is the identifier
      return node.title ?? node.name ?? 'Unnamed';
    },
  },
};

/**
 * ECML Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 */
export const contribution: LanguageContribution = {
  languageId: 'ecml',
  fileExtensions: ['.ecml'],
  generatedSharedModule: EcmlGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: EcmlGeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
};

export default contribution;
