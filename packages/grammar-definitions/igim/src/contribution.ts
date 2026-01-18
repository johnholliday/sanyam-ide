/**
 * IGIM Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 * This file enables the IGIM grammar to be discovered and loaded by the
 * SANYAM platform's unified language server.
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
  IgimGeneratedModule,
  IgimGeneratedSharedModule,
} from './generated/module.js';

/**
 * Custom LSP providers for IGIM.
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
 * Custom GLSP providers for IGIM.
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
 * IGIM Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 * It provides all configuration needed for the IGIM language including:
 * - Langium-generated modules for parsing and validation
 * - Grammar manifest for UI and diagram configuration
 * - LSP/GLSP provider customizations
 */
export const contribution: LanguageContribution = {
  languageId: 'igim',
  fileExtensions: ['.igim'],
  generatedSharedModule: IgimGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: IgimGeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
};

export default contribution;
