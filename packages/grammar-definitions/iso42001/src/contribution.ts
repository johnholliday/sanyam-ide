/**
 * ISO 42001 Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  ISO42001GeneratedModule,
  Iso42001GeneratedSharedModule,
} from './generated/module.js';

/**
 * Custom LSP providers for ISO 42001.
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
 * Custom GLSP providers for ISO 42001.
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
 * ISO 42001 Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 */
export const contribution: LanguageContribution = {
  languageId: 'iso42001',
  fileExtensions: ['.iso42001'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatedSharedModule: Iso42001GeneratedSharedModule as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatedModule: ISO42001GeneratedModule as any,
  manifest,
  lspProviders,
  glspProviders,
};

export default contribution;
