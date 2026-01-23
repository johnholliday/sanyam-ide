/**
 * SPDevKit Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 *
 * @packageDocumentation
 */

import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { ContainerModule } from 'inversify';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  SPDevKitGeneratedModule,
  SPDevKitGeneratedSharedModule,
} from './generated/module.js';
import { spdevkitDiagramModule } from './diagram/index.js';

/**
 * Custom LSP providers for SPDevKit.
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
 * Custom GLSP providers for SPDevKit.
 *
 * Override default diagram behavior here. Omitted providers use manifest-driven defaults.
 */
const glspProviders: Partial<GlspFeatureProviders> = {
  // Add custom GLSP providers here
  // Example:
  // astToGModel: {
  //   getLabel: (ast) => (ast as any).title ?? (ast as any).name ?? 'Unnamed'
  // }
};

/**
 * SPDevKit Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 */
export const contribution: LanguageContribution = {
  languageId: 'spdevkit',
  fileExtensions: ['.spdk'],
  generatedSharedModule: SPDevKitGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: SPDevKitGeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
  diagramModule: spdevkitDiagramModule as ContainerModule,
};

export default contribution;
