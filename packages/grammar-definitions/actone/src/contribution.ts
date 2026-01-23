/**
 * ActOne Language Contribution
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
  ActOneGeneratedModule,
  ActOneGeneratedSharedModule,
} from './generated/module.js';

/**
 * Custom LSP providers for ActOne.
 *
 * Override default LSP behavior here. Omitted providers use Langium defaults.
 */
const lspProviders: Partial<LspFeatureProviders> = {
  // Add custom LSP providers here
  // Example:
  // completion: {
  //   provide: async (ctx, params) => [
  //     { label: 'character', kind: 14, detail: 'Create a new character' },
  //     { label: 'scene', kind: 14, detail: 'Create a new scene' },
  //   ]
  // }
};

/**
 * Custom GLSP providers for ActOne.
 *
 * Override default diagram behavior here. Omitted providers use manifest-driven defaults.
 */
const glspProviders: Partial<GlspFeatureProviders> = {
  // Custom AST to GModel conversion
  astToGModel: {
    // Extract label from ActOne elements
    getLabel: (ast: unknown) => {
      const node = ast as { name?: string; title?: string };
      // For Story nodes, use the string title; for others use the ID name
      return node.name ?? node.title ?? 'Unnamed';
    },
  },
};

/**
 * ActOne Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 */
export const contribution: LanguageContribution = {
  languageId: 'actone',
  fileExtensions: ['.actone'],
  generatedSharedModule: ActOneGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: ActOneGeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
};

export default contribution;
