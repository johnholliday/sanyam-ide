/**
 * GLSP Provider Resolver (T111)
 *
 * Resolves GLSP providers for a language contribution, checking for
 * custom providers and falling back to defaults.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  GlspFeatureProviders,
  GlspContext,
} from '@sanyam/types';

import {
  GlspFeatureMerger,
  createGlspFeatureMerger,
  isGlspFeatureEnabled,
  getGlspProvider,
  type GlspFeatureMergerOptions,
} from './feature-merger.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'GlspProviderResolver' });

/**
 * GLSP provider resolver options.
 */
export interface GlspProviderResolverOptions extends GlspFeatureMergerOptions {
  /** Whether to cache resolved providers */
  cacheProviders?: boolean;
}

/**
 * Resolved GLSP provider result.
 */
export interface ResolvedGlspProvider<T> {
  /** The resolved provider (or undefined if disabled) */
  provider?: T;
  /** Whether the provider is from a custom contribution */
  isCustom: boolean;
  /** Whether the feature is disabled */
  isDisabled: boolean;
  /** Whether partial methods were merged */
  isPartiallyMerged: boolean;
  /** The language ID this was resolved for */
  languageId: string;
}

/**
 * GLSP Provider Resolver.
 *
 * Resolves providers for GLSP operations by:
 * 1. Checking if the feature is disabled
 * 2. Checking for a custom provider in the language contribution
 * 3. Deep merging provider methods when enabled
 * 4. Falling back to the default provider
 */
export class GlspProviderResolver {
  private readonly merger: GlspFeatureMerger;
  private readonly options: Required<GlspProviderResolverOptions>;
  private readonly providerCache: Map<string, GlspFeatureProviders>;
  private defaultProviders?: GlspFeatureProviders;

  constructor(options?: GlspProviderResolverOptions) {
    this.options = {
      conflictResolution: options?.conflictResolution ?? 'custom-wins',
      deepMerge: options?.deepMerge ?? true, // Enable deep merge by default for GLSP
      cacheProviders: options?.cacheProviders ?? true,
    };

    this.merger = createGlspFeatureMerger({
      conflictResolution: this.options.conflictResolution,
      deepMerge: this.options.deepMerge,
    });

    this.providerCache = new Map();
  }

  /**
   * Set the default providers.
   *
   * @param providers - Default GLSP providers
   */
  setDefaultProviders(providers: GlspFeatureProviders): void {
    this.defaultProviders = providers;
    // Clear cache when defaults change
    this.providerCache.clear();
  }

  /**
   * Resolve a provider for a specific feature and language.
   *
   * @param featureName - Name of the GLSP feature
   * @param contribution - Language contribution
   * @returns Resolved provider information
   */
  resolve<K extends keyof GlspFeatureProviders>(
    featureName: K,
    contribution: LanguageContribution
  ): ResolvedGlspProvider<GlspFeatureProviders[K]> {
    const languageId = contribution.languageId;
    const disabledFeatures = contribution.disabledGlspFeatures ?? [];

    // Check if feature is disabled (with glsp. prefix support)
    const isDisabled = this.isFeatureDisabled(featureName, disabledFeatures);
    if (isDisabled) {
      logger.debug({ languageId, feature: featureName }, 'GLSP feature disabled');

      return {
        provider: undefined,
        isCustom: false,
        isDisabled: true,
        isPartiallyMerged: false,
        languageId,
      };
    }

    // Get merged providers for this contribution
    const mergeResult = this.getMergeResult(contribution);
    const provider = getGlspProvider(featureName, mergeResult.providers);

    // Determine if this is a custom provider
    const isCustom = this.isCustomProvider(featureName, contribution);
    const isPartiallyMerged = mergeResult.partiallyMergedFeatures.includes(featureName);

    logger.debug({ languageId, feature: featureName, source: isCustom ? (isPartiallyMerged ? 'custom+merged' : 'custom') : 'default' }, 'GLSP provider resolved');

    return {
      provider,
      isCustom,
      isDisabled: false,
      isPartiallyMerged,
      languageId,
    };
  }

  /**
   * Resolve all providers for a language contribution.
   *
   * @param contribution - Language contribution
   * @returns All merged providers
   */
  resolveAll(contribution: LanguageContribution): GlspFeatureProviders {
    return this.getMergeResult(contribution).providers;
  }

  /**
   * Check if a feature is enabled for a contribution.
   *
   * @param featureName - Name of the GLSP feature
   * @param contribution - Language contribution
   * @returns True if the feature is enabled
   */
  isEnabled(
    featureName: keyof GlspFeatureProviders,
    contribution: LanguageContribution
  ): boolean {
    const disabledFeatures = contribution.disabledGlspFeatures ?? [];
    return !this.isFeatureDisabled(featureName, disabledFeatures);
  }

  /**
   * Check if a GLSP feature is disabled.
   *
   * Handles both bare feature names and glsp. prefixed names.
   */
  private isFeatureDisabled(
    featureName: string,
    disabledFeatures: readonly string[]
  ): boolean {
    const disabledSet = new Set(disabledFeatures);
    return (
      disabledSet.has(featureName) ||
      disabledSet.has(`glsp.${featureName}`) ||
      disabledSet.has(featureName.replace(/Provider$/i, '').toLowerCase())
    );
  }

  /**
   * Get merge result for a contribution.
   */
  private getMergeResult(contribution: LanguageContribution): {
    providers: GlspFeatureProviders;
    partiallyMergedFeatures: string[];
  } {
    const cacheKey = contribution.languageId;

    // Check cache
    if (this.options.cacheProviders) {
      const cached = this.providerCache.get(cacheKey);
      if (cached) {
        return {
          providers: cached,
          partiallyMergedFeatures: [],
        };
      }
    }

    // Merge providers
    if (!this.defaultProviders) {
      throw new Error('Default GLSP providers not set. Call setDefaultProviders first.');
    }

    const result = this.merger.merge(
      this.defaultProviders,
      contribution.glspProviders,
      contribution.disabledGlspFeatures
    );

    // Cache result
    if (this.options.cacheProviders) {
      this.providerCache.set(cacheKey, result.providers);
    }

    return {
      providers: result.providers,
      partiallyMergedFeatures: result.partiallyMergedFeatures,
    };
  }

  /**
   * Check if a provider is from a custom contribution.
   */
  private isCustomProvider(
    featureName: keyof GlspFeatureProviders,
    contribution: LanguageContribution
  ): boolean {
    return contribution.glspProviders?.[featureName] !== undefined;
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

  /**
   * Resolve a provider method with potential partial override.
   *
   * When deep merge is enabled, this allows custom contributions to
   * override specific methods while inheriting the rest.
   *
   * @param featureName - Name of the GLSP feature
   * @param methodName - Name of the method to resolve
   * @param contribution - Language contribution
   * @returns The resolved method or undefined
   */
  resolveMethod<
    K extends keyof GlspFeatureProviders,
    M extends keyof NonNullable<GlspFeatureProviders[K]>
  >(
    featureName: K,
    methodName: M,
    contribution: LanguageContribution
  ): NonNullable<GlspFeatureProviders[K]>[M] | undefined {
    const { provider, isDisabled } = this.resolve(featureName, contribution);

    if (isDisabled || !provider) {
      return undefined;
    }

    return (provider as any)[methodName];
  }
}

/**
 * Create a GLSP provider resolver instance.
 *
 * @param options - Resolver options
 * @returns GlspProviderResolver instance
 */
export function createGlspProviderResolver(
  options?: GlspProviderResolverOptions
): GlspProviderResolver {
  return new GlspProviderResolver(options);
}

/**
 * Default GLSP provider resolver instance.
 */
export const defaultGlspProviderResolver = createGlspProviderResolver();

/**
 * Convenience function to resolve a single GLSP provider.
 *
 * @param featureName - Name of the GLSP feature
 * @param contribution - Language contribution
 * @param defaultProviders - Default providers
 * @returns Resolved provider or undefined
 */
export function resolveGlspProvider<K extends keyof GlspFeatureProviders>(
  featureName: K,
  contribution: LanguageContribution,
  defaultProviders: GlspFeatureProviders
): GlspFeatureProviders[K] | undefined {
  const merger = createGlspFeatureMerger({ deepMerge: true });
  const disabledFeatures = contribution.disabledGlspFeatures ?? [];

  // Check if disabled
  const disabledSet = new Set<string>(disabledFeatures);
  const featureNameStr = String(featureName);
  if (
    disabledSet.has(featureNameStr) ||
    disabledSet.has(`glsp.${featureNameStr}`)
  ) {
    return undefined;
  }

  // Check for custom provider
  const customProvider = contribution.glspProviders?.[featureName];
  if (customProvider !== undefined) {
    // Potentially deep merge with default
    const defaultProvider = defaultProviders[featureName];
    if (defaultProvider && merger['canDeepMerge']?.(defaultProvider, customProvider)) {
      return merger.mergeProviderMethods(defaultProvider, customProvider as any);
    }
    return customProvider;
  }

  // Return default provider
  return defaultProviders[featureName];
}

/**
 * Create a GLSP handler wrapper that uses the provider resolver.
 *
 * @param featureName - Name of the GLSP feature
 * @param methodName - Name of the method to invoke
 * @param resolver - Provider resolver to use
 * @param getContribution - Function to get contribution from context
 * @returns Handler function
 */
export function createGlspProviderHandler<
  K extends keyof GlspFeatureProviders,
  M extends keyof NonNullable<GlspFeatureProviders[K]>
>(
  featureName: K,
  methodName: M,
  resolver: GlspProviderResolver,
  getContribution: (context: GlspContext) => LanguageContribution | undefined
): (context: GlspContext, ...args: any[]) => Promise<any> {
  return async (context: GlspContext, ...args: any[]): Promise<any> => {
    const contribution = getContribution(context);
    if (!contribution) {
      return null;
    }

    const method = resolver.resolveMethod(featureName, methodName, contribution);
    if (!method || typeof method !== 'function') {
      return null;
    }

    return (method as Function).call(null, context, ...args);
  };
}
