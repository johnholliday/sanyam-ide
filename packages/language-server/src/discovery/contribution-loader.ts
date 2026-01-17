/**
 * Contribution Loader - Runtime Language Loading
 *
 * Loads LanguageContribution objects from grammar packages at runtime,
 * composing Langium services and registering with the language registry.
 *
 * @packageDocumentation
 */

import { inject } from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
} from 'langium/lsp';
import type {
  LanguageContributionInterface,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';
import { LanguageRegistry } from '../language-registry.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = any;

/**
 * Options for loading contributions.
 */
export interface ContributionLoaderOptions {
  /**
   * Connection context for creating shared services.
   * In a real server, this includes the connection and document management.
   */
  readonly context: DefaultSharedModuleContext;

  /**
   * Default LSP providers to merge with custom ones.
   */
  readonly defaultLspProviders: Required<LspFeatureProviders>;

  /**
   * Default GLSP providers to merge with custom ones.
   */
  readonly defaultGlspProviders: Required<GlspFeatureProviders>;
}

/**
 * Result of loading contributions.
 */
export interface LoadResult {
  /** Shared services across all languages */
  readonly sharedServices: LangiumSharedServices;
  /** Number of languages successfully loaded */
  readonly loadedCount: number;
  /** Errors encountered during loading */
  readonly errors: readonly string[];
}

/**
 * Loads language contributions into the registry.
 *
 * This function:
 * 1. Creates shared Langium services
 * 2. For each contribution, composes the Langium modules
 * 3. Merges custom providers with defaults
 * 4. Registers the language with the registry
 *
 * @param contributions - Array of contributions to load
 * @param registry - Language registry to populate
 * @param options - Loader options
 * @returns Load result with stats and errors
 */
export async function loadContributions(
  contributions: readonly LanguageContributionInterface[],
  registry: LanguageRegistry,
  options: ContributionLoaderOptions
): Promise<LoadResult> {
  const errors: string[] = [];

  // Collect all shared modules to compose together
  // Using AnyModule to handle Langium 4.x module type variance
  const sharedModules: AnyModule[] = [
    createDefaultSharedModule(options.context),
  ];

  // Add each contribution's shared module
  for (const contribution of contributions) {
    sharedModules.push(contribution.generatedSharedModule);
  }

  // Create composed shared services
  // Cast to tuple to satisfy TypeScript's spread requirement
  const sharedServices = inject(...(sharedModules as [AnyModule, ...AnyModule[]])) as LangiumSharedServices;

  // Set shared services on registry
  registry.setSharedServices(sharedServices);

  let loadedCount = 0;

  // Load each contribution
  for (const contribution of contributions) {
    try {
      const services = createLanguageServices(contribution, sharedServices);

      // Merge providers
      const mergedLspProviders = mergeProviders(
        options.defaultLspProviders,
        contribution.lspProviders ?? {},
        contribution.disabledLspFeatures ?? []
      );

      const mergedGlspProviders = mergeProviders(
        options.defaultGlspProviders,
        contribution.glspProviders ?? {},
        contribution.disabledGlspFeatures ?? []
      );

      // Register with the registry
      registry.register(
        contribution,
        services,
        mergedLspProviders as Required<LspFeatureProviders>,
        mergedGlspProviders as Required<GlspFeatureProviders>
      );

      loadedCount++;
    } catch (error) {
      errors.push(
        `Failed to load ${contribution.languageId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    sharedServices,
    loadedCount,
    errors,
  };
}

/**
 * Create Langium services for a single language.
 *
 * Composes the generated module with any custom module, layered
 * on top of Langium's default module.
 *
 * @param contribution - The language contribution
 * @param sharedServices - Shared services instance
 * @returns Composed language services
 */
function createLanguageServices(
  contribution: LanguageContributionInterface,
  sharedServices: LangiumSharedServices
): LangiumServices {
  // Using AnyModule to handle Langium 4.x module type variance
  const modules: AnyModule[] = [
    // Start with Langium defaults
    createDefaultModule({ shared: sharedServices }),
    // Add generated module
    contribution.generatedModule,
  ];

  // Add custom module if provided (applied last for overrides)
  if (contribution.customModule) {
    modules.push(contribution.customModule);
  }

  // Compose all modules
  // Cast to tuple to satisfy TypeScript's spread requirement
  const services = inject(...(modules as [AnyModule, ...AnyModule[]])) as LangiumServices;

  // Register with shared service registry
  sharedServices.ServiceRegistry.register(services);

  return services;
}

/**
 * Merge custom providers with defaults, respecting disabled features.
 *
 * Custom providers override defaults. Disabled features return undefined.
 *
 * @param defaults - Default provider implementations
 * @param custom - Custom provider implementations (partial)
 * @param disabled - Feature names to disable
 * @returns Merged providers
 */
function mergeProviders<T extends object>(
  defaults: T,
  custom: Partial<T>,
  disabled: readonly string[]
): T {
  const result = { ...defaults };
  const disabledSet = new Set(disabled);

  // Apply custom overrides
  for (const [key, value] of Object.entries(custom)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  // Set disabled features to undefined
  for (const featureName of disabledSet) {
    if (featureName in result) {
      (result as Record<string, unknown>)[featureName] = undefined;
    }
  }

  return result;
}

/**
 * Load contributions from the generated grammar registry.
 *
 * This is the primary entry point for loading languages during server startup.
 *
 * @param registryModule - The generated grammar-registry module
 * @param registry - Language registry to populate
 * @param options - Loader options
 * @returns Load result
 */
export async function loadFromGeneratedRegistry(
  registryModule: { GRAMMAR_REGISTRY: readonly LanguageContributionInterface[] },
  registry: LanguageRegistry,
  options: ContributionLoaderOptions
): Promise<LoadResult> {
  return loadContributions(registryModule.GRAMMAR_REGISTRY, registry, options);
}
