/**
 * Language Contribution Contract
 *
 * This file defines the interface that grammar packages must export to be
 * discovered and loaded by the unified language server.
 *
 * @packageDocumentation
 */

import type { Module, LangiumServices, LangiumSharedServices } from 'langium';
import type { GrammarManifest } from './grammar-manifest.js';
import type { LspFeatureProviders, LspFeatureName } from './lsp-providers.js';
import type { GlspFeatureProviders, GlspFeatureName } from './glsp-providers.js';

/**
 * Symbol for dependency injection binding.
 *
 * Use this symbol when binding LanguageContribution in Inversify.
 */
export const LanguageContribution = Symbol('LanguageContribution');

/**
 * Complete contribution interface for grammar packages.
 *
 * Grammar packages export an object implementing this interface,
 * which is discovered at build time via pnpm workspace dependencies
 * and loaded at runtime by the unified server.
 *
 * @example
 * ```typescript
 * // grammars/ecml/src/contribution.ts
 * import type { LanguageContribution } from '@sanyam/types';
 * import { EcmlGeneratedModule, EcmlGeneratedSharedModule } from './generated/module.js';
 * import { EcmlCustomModule } from './ecml-module.js';
 * import { ECML_MANIFEST } from '../manifest.js';
 *
 * export const contribution: LanguageContribution = {
 *   languageId: 'ecml',
 *   fileExtensions: ['.ecml'],
 *   generatedSharedModule: EcmlGeneratedSharedModule,
 *   generatedModule: EcmlGeneratedModule,
 *   customModule: EcmlCustomModule,
 *   manifest: ECML_MANIFEST,
 * };
 * ```
 */
export interface LanguageContribution {
  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Language identifier.
   *
   * Must be unique across all registered languages.
   * Used for file association and VS Code language mode.
   *
   * @example 'ecml', 'actone', 'spdevkit'
   */
  readonly languageId: string;

  /**
   * File extensions this language handles.
   *
   * Include the leading dot.
   *
   * @example ['.ecml'], ['.story', '.character']
   */
  readonly fileExtensions: readonly string[];

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGIUM MODULES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Langium-generated shared module.
   *
   * Created by `langium generate` in `src/generated/module.ts`.
   * Registers the language with the shared ServiceRegistry.
   */
  readonly generatedSharedModule: Module<LangiumSharedServices>;

  /**
   * Langium-generated language module.
   *
   * Created by `langium generate` in `src/generated/module.ts`.
   * Contains AST types, grammar, and default services.
   */
  readonly generatedModule: Module<LangiumServices>;

  /**
   * Optional custom Langium module.
   *
   * Contains custom validators, scope providers, name providers,
   * and other service overrides.
   *
   * Applied last during module composition, so custom services
   * override generated defaults.
   */
  readonly customModule?: Module<LangiumServices>;

  // ═══════════════════════════════════════════════════════════════════════════
  // MANIFEST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Grammar manifest for UI and diagram configuration.
   *
   * Defines:
   * - Display name and documentation
   * - Root types and file organization
   * - Diagram types and element mappings
   * - Tool palette configuration
   */
  readonly manifest: GrammarManifest;

  // ═══════════════════════════════════════════════════════════════════════════
  // LSP CUSTOMIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Optional LSP feature providers.
   *
   * Implement specific providers to customize LSP behavior.
   * Omitted providers use default implementations.
   *
   * @example
   * ```typescript
   * lspProviders: {
   *   hover: {
   *     provide: (ctx, params) => ({
   *       contents: { kind: 'markdown', value: '**Custom hover**' }
   *     })
   *   }
   * }
   * ```
   */
  readonly lspProviders?: LspFeatureProviders;

  /**
   * LSP features to disable for this language.
   *
   * Listed features will not be available even if defaults exist.
   *
   * @example ['inlineValue', 'codeLens']
   */
  readonly disabledLspFeatures?: readonly LspFeatureName[];

  // ═══════════════════════════════════════════════════════════════════════════
  // GLSP CUSTOMIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Optional GLSP feature providers.
   *
   * Implement specific providers to customize diagram behavior.
   * Omitted providers use manifest-driven defaults.
   *
   * @example
   * ```typescript
   * glspProviders: {
   *   astToGModel: {
   *     getLabel: (ast) => ast.title ?? ast.name ?? 'Unnamed'
   *   }
   * }
   * ```
   */
  readonly glspProviders?: GlspFeatureProviders;

  /**
   * GLSP features to disable for this language.
   *
   * Listed features will not be available even if defaults exist.
   *
   * @example ['contextMenu', 'layout']
   */
  readonly disabledGlspFeatures?: readonly GlspFeatureName[];
}

/**
 * Package metadata expected in grammar package.json files.
 *
 * The `sanyam` field enables build-time discovery and provides
 * configuration for the unified server.
 *
 * @example
 * ```json
 * {
 *   "name": "@sanyam/grammar-ecml",
 *   "version": "1.0.0",
 *   "sanyam": {
 *     "grammar": true,
 *     "languageId": "ecml",
 *     "contribution": "./lib/contribution.js"
 *   }
 * }
 * ```
 */
export interface GrammarPackageJson {
  /** Package name (should follow @sanyam/grammar-* convention) */
  readonly name: string;
  /** Package version */
  readonly version: string;
  /** Sanyam-specific configuration */
  readonly sanyam?: {
    /**
     * Set to true to mark as a grammar package.
     * Required for build-time discovery.
     */
    readonly grammar?: boolean;
    /**
     * Language identifier.
     * Defaults to extracting from package name.
     */
    readonly languageId?: string;
    /**
     * Entry point for LanguageContribution export.
     * Relative to package root.
     *
     * @default './lib/contribution.js'
     */
    readonly contribution?: string;
  };
}

/**
 * Registered language entry in the runtime registry.
 *
 * Created when a LanguageContribution is registered with the server.
 */
export interface RegisteredLanguage {
  /** Original contribution from the grammar package */
  readonly contribution: LanguageContribution;
  /** Instantiated Langium services for this language */
  readonly services: LangiumServices;
  /** Merged LSP providers (custom + defaults) */
  readonly mergedLspProviders: Required<LspFeatureProviders>;
  /** Merged GLSP providers (custom + defaults) */
  readonly mergedGlspProviders: Required<GlspFeatureProviders>;
}
