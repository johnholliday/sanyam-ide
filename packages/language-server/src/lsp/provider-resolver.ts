/**
 * LSP Provider Resolver (T110)
 *
 * Resolves LSP providers for a language contribution, checking for
 * custom providers and falling back to defaults.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  LspFeatureProviders,
  LspContext,
} from '@sanyam/types';

import {
  FeatureMerger,
  createFeatureMerger,
  isFeatureEnabled,
  getProvider,
  type FeatureMergerOptions,
} from './feature-merger.js';

/**
 * Provider resolver options.
 */
export interface ProviderResolverOptions extends FeatureMergerOptions {
  /** Whether to cache resolved providers */
  cacheProviders?: boolean;
  /** Whether to log resolution decisions */
  logResolution?: boolean;
}

/**
 * Resolved provider result.
 */
export interface ResolvedProvider<T> {
  /** The resolved provider (or undefined if disabled) */
  provider?: T;
  /** Whether the provider is from a custom contribution */
  isCustom: boolean;
  /** Whether the feature is disabled */
  isDisabled: boolean;
  /** The language ID this was resolved for */
  languageId: string;
}

/**
 * LSP Provider Resolver.
 *
 * Resolves providers for LSP requests by:
 * 1. Checking if the feature is disabled
 * 2. Checking for a custom provider in the language contribution
 * 3. Falling back to the default provider
 */
export class ProviderResolver {
  private readonly merger: FeatureMerger;
  private readonly options: Required<ProviderResolverOptions>;
  private readonly providerCache: Map<string, LspFeatureProviders>;
  private defaultProviders?: LspFeatureProviders;

  constructor(options?: ProviderResolverOptions) {
    this.options = {
      verbose: options?.verbose ?? false,
      conflictResolution: options?.conflictResolution ?? 'custom-wins',
      cacheProviders: options?.cacheProviders ?? true,
      logResolution: options?.logResolution ?? false,
    };

    this.merger = createFeatureMerger({
      verbose: this.options.verbose,
      conflictResolution: this.options.conflictResolution,
    });

    this.providerCache = new Map();
  }

  /**
   * Set the default providers.
   *
   * @param providers - Default LSP providers
   */
  setDefaultProviders(providers: LspFeatureProviders): void {
    this.defaultProviders = providers;
    // Clear cache when defaults change
    this.providerCache.clear();
  }

  /**
   * Resolve a provider for a specific feature and language.
   *
   * @param featureName - Name of the LSP feature
   * @param contribution - Language contribution
   * @returns Resolved provider information
   */
  resolve<K extends keyof LspFeatureProviders>(
    featureName: K,
    contribution: LanguageContribution
  ): ResolvedProvider<LspFeatureProviders[K]> {
    const languageId = contribution.languageId;
    const disabledFeatures = contribution.disabledLspFeatures ?? [];

    // Check if feature is disabled
    if (this.merger.isDisabled(featureName, disabledFeatures)) {
      if (this.options.logResolution) {
        console.log(`[${languageId}] Feature '${featureName}' is disabled`);
      }

      return {
        provider: undefined,
        isCustom: false,
        isDisabled: true,
        languageId,
      };
    }

    // Get merged providers for this contribution
    const mergedProviders = this.getMergedProviders(contribution);
    const provider = getProvider(featureName, mergedProviders);

    // Determine if this is a custom provider
    const isCustom = this.isCustomProvider(featureName, contribution);

    if (this.options.logResolution) {
      console.log(
        `[${languageId}] Resolved '${featureName}': ${isCustom ? 'custom' : 'default'}`
      );
    }

    return {
      provider,
      isCustom,
      isDisabled: false,
      languageId,
    };
  }

  /**
   * Resolve all providers for a language contribution.
   *
   * @param contribution - Language contribution
   * @returns All merged providers
   */
  resolveAll(contribution: LanguageContribution): LspFeatureProviders {
    return this.getMergedProviders(contribution);
  }

  /**
   * Check if a feature is enabled for a contribution.
   *
   * @param featureName - Name of the LSP feature
   * @param contribution - Language contribution
   * @returns True if the feature is enabled
   */
  isEnabled(
    featureName: keyof LspFeatureProviders,
    contribution: LanguageContribution
  ): boolean {
    const disabledFeatures = contribution.disabledLspFeatures ?? [];
    return !this.merger.isDisabled(featureName, disabledFeatures);
  }

  /**
   * Get merged providers for a contribution.
   */
  private getMergedProviders(contribution: LanguageContribution): LspFeatureProviders {
    const cacheKey = contribution.languageId;

    // Check cache
    if (this.options.cacheProviders) {
      const cached = this.providerCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Merge providers
    if (!this.defaultProviders) {
      throw new Error('Default providers not set. Call setDefaultProviders first.');
    }

    const result = this.merger.merge(
      this.defaultProviders,
      contribution.lspProviders,
      contribution.disabledLspFeatures
    );

    // Cache result
    if (this.options.cacheProviders) {
      this.providerCache.set(cacheKey, result.providers);
    }

    return result.providers;
  }

  /**
   * Check if a provider is from a custom contribution.
   */
  private isCustomProvider(
    featureName: keyof LspFeatureProviders,
    contribution: LanguageContribution
  ): boolean {
    return contribution.lspProviders?.[featureName] !== undefined;
  }

  /**
   * Clear the provider cache.
   */
  clearCache(): void {
    this.providerCache.clear();
  }

  /**
   * Clear cache for a specific language.
   */
  clearCacheFor(languageId: string): void {
    this.providerCache.delete(languageId);
  }
}

/**
 * Create a provider resolver instance.
 *
 * @param options - Resolver options
 * @returns ProviderResolver instance
 */
export function createProviderResolver(
  options?: ProviderResolverOptions
): ProviderResolver {
  return new ProviderResolver(options);
}

/**
 * Default provider resolver instance.
 */
export const defaultProviderResolver = createProviderResolver();

/**
 * Convenience function to resolve a single provider.
 *
 * @param featureName - Name of the LSP feature
 * @param contribution - Language contribution
 * @param defaultProviders - Default providers
 * @returns Resolved provider or undefined
 */
export function resolveProvider<K extends keyof LspFeatureProviders>(
  featureName: K,
  contribution: LanguageContribution,
  defaultProviders: LspFeatureProviders
): LspFeatureProviders[K] | undefined {
  const merger = createFeatureMerger();
  const disabledFeatures = contribution.disabledLspFeatures ?? [];

  // Check if disabled
  if (merger.isDisabled(featureName, disabledFeatures)) {
    return undefined;
  }

  // Check for custom provider
  const customProvider = contribution.lspProviders?.[featureName];
  if (customProvider !== undefined) {
    return customProvider;
  }

  // Return default provider
  return defaultProviders[featureName];
}

/**
 * Create an LSP handler wrapper that uses the provider resolver.
 *
 * This creates a handler function that automatically resolves the
 * correct provider based on the document's language.
 *
 * @param featureName - Name of the LSP feature
 * @param resolver - Provider resolver to use
 * @param getContribution - Function to get contribution from context
 * @returns Handler function
 */
export function createProviderHandler<K extends keyof LspFeatureProviders>(
  featureName: K,
  resolver: ProviderResolver,
  getContribution: (context: LspContext) => LanguageContribution | undefined
): (context: LspContext, ...args: any[]) => Promise<any> {
  return async (context: LspContext, ...args: any[]): Promise<any> => {
    const contribution = getContribution(context);
    if (!contribution) {
      return null;
    }

    const { provider, isDisabled } = resolver.resolve(featureName, contribution);
    if (isDisabled || !provider) {
      return null;
    }

    // Invoke the provider's main method
    // Most providers have a `provide` method
    if ('provide' in provider && typeof (provider as any).provide === 'function') {
      return (provider as any).provide(context, ...args);
    }

    return null;
  };
}
