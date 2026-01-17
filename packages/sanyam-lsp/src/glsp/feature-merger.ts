/**
 * GLSP Feature Merger (T095)
 *
 * Merges custom GLSP providers with defaults and respects disabled features.
 *
 * @packageDocumentation
 */

import type { GlspFeatureProviders } from '@sanyam/types';

/**
 * GLSP feature merger options.
 */
export interface GlspFeatureMergerOptions {
  /** Whether to log merge operations */
  verbose?: boolean;
  /** How to handle conflicts */
  conflictResolution?: 'custom-wins' | 'default-wins' | 'throw';
  /** Whether to deep merge provider configurations */
  deepMerge?: boolean;
}

/**
 * GLSP merge result containing the merged providers and metadata.
 */
export interface GlspMergeResult {
  /** Merged providers */
  providers: GlspFeatureProviders;
  /** Features that were disabled */
  disabledFeatures: string[];
  /** Features that were overridden */
  overriddenFeatures: string[];
  /** Features that were partially merged */
  partiallyMergedFeatures: string[];
  /** Warnings generated during merge */
  warnings: string[];
}

/**
 * GLSP Feature Merger.
 *
 * Merges custom GLSP providers with default implementations,
 * respecting the disabledFeatures configuration.
 * Supports deep merging for providers with nested configurations.
 */
export class GlspFeatureMerger {
  private readonly options: Required<GlspFeatureMergerOptions>;

  constructor(options?: GlspFeatureMergerOptions) {
    this.options = {
      verbose: options?.verbose ?? false,
      conflictResolution: options?.conflictResolution ?? 'custom-wins',
      deepMerge: options?.deepMerge ?? false,
    };
  }

  /**
   * Merge custom GLSP providers with defaults.
   *
   * @param defaultProviders - Default provider implementations
   * @param customProviders - Custom provider implementations (optional)
   * @param disabledFeatures - Features to disable (optional)
   * @returns Merged providers with merge metadata
   */
  merge(
    defaultProviders: GlspFeatureProviders,
    customProviders?: Partial<GlspFeatureProviders>,
    disabledFeatures?: string[]
  ): GlspMergeResult {
    const result: GlspMergeResult = {
      providers: {} as GlspFeatureProviders,
      disabledFeatures: [],
      overriddenFeatures: [],
      partiallyMergedFeatures: [],
      warnings: [],
    };

    const disabledSet = new Set(disabledFeatures ?? []);

    // Get all provider keys
    const allKeys = new Set([
      ...Object.keys(defaultProviders),
      ...Object.keys(customProviders ?? {}),
    ]);

    for (const key of allKeys) {
      const featureName = key as keyof GlspFeatureProviders;

      // Check if feature is disabled
      if (this.isFeatureDisabled(featureName, disabledSet)) {
        result.disabledFeatures.push(featureName);
        (result.providers as any)[featureName] = null;

        if (this.options.verbose) {
          console.log(`GLSP Feature '${featureName}' is disabled`);
        }
        continue;
      }

      // Get default and custom providers
      const defaultProvider = (defaultProviders as any)[featureName];
      const customProvider = customProviders ? (customProviders as any)[featureName] : undefined;

      // Merge based on availability and options
      const mergeResult = this.mergeProvider(
        featureName,
        defaultProvider,
        customProvider
      );

      (result.providers as any)[featureName] = mergeResult.provider;

      if (mergeResult.overridden) {
        result.overriddenFeatures.push(featureName);
      }
      if (mergeResult.partiallyMerged) {
        result.partiallyMergedFeatures.push(featureName);
      }
      if (mergeResult.warning) {
        result.warnings.push(mergeResult.warning);
      }
    }

    return result;
  }

  /**
   * Merge a single provider.
   */
  private mergeProvider(
    featureName: string,
    defaultProvider: any,
    customProvider: any
  ): {
    provider: any;
    overridden: boolean;
    partiallyMerged: boolean;
    warning?: string;
  } {
    // No custom provider - use default
    if (customProvider === undefined) {
      return {
        provider: defaultProvider,
        overridden: false,
        partiallyMerged: false,
      };
    }

    // No default provider - use custom
    if (defaultProvider === undefined) {
      return {
        provider: customProvider,
        overridden: false,
        partiallyMerged: false,
      };
    }

    // Both exist - apply conflict resolution
    switch (this.options.conflictResolution) {
      case 'custom-wins':
        if (this.options.deepMerge && this.canDeepMerge(defaultProvider, customProvider)) {
          return {
            provider: this.deepMergeProviders(defaultProvider, customProvider),
            overridden: false,
            partiallyMerged: true,
          };
        }
        return {
          provider: customProvider,
          overridden: true,
          partiallyMerged: false,
        };

      case 'default-wins':
        return {
          provider: defaultProvider,
          overridden: false,
          partiallyMerged: false,
          warning: `Custom ${featureName} ignored due to default-wins policy`,
        };

      case 'throw':
        throw new Error(`Conflict: both default and custom ${featureName} provided`);
    }
  }

  /**
   * Check if a feature is disabled.
   */
  private isFeatureDisabled(featureName: string, disabledSet: Set<string>): boolean {
    return (
      disabledSet.has(featureName) ||
      disabledSet.has(this.normalizeFeatureName(featureName)) ||
      disabledSet.has(`glsp.${featureName}`)
    );
  }

  /**
   * Check if two providers can be deep merged.
   */
  private canDeepMerge(defaultProvider: any, customProvider: any): boolean {
    return (
      typeof defaultProvider === 'object' &&
      typeof customProvider === 'object' &&
      defaultProvider !== null &&
      customProvider !== null &&
      !Array.isArray(defaultProvider) &&
      !Array.isArray(customProvider)
    );
  }

  /**
   * Deep merge two providers.
   */
  private deepMergeProviders(defaultProvider: any, customProvider: any): any {
    const result: any = { ...defaultProvider };

    for (const key of Object.keys(customProvider)) {
      const defaultValue = defaultProvider[key];
      const customValue = customProvider[key];

      if (this.canDeepMerge(defaultValue, customValue)) {
        result[key] = this.deepMergeProviders(defaultValue, customValue);
      } else if (customValue !== undefined) {
        result[key] = customValue;
      }
    }

    return result;
  }

  /**
   * Normalize feature name for comparison.
   */
  private normalizeFeatureName(name: string): string {
    return name
      .replace(/Provider$/i, '')
      .toLowerCase();
  }

  /**
   * Merge specific GLSP feature methods.
   *
   * For providers that have multiple methods (like astToGModel),
   * this allows merging specific methods while keeping defaults for others.
   */
  mergeProviderMethods<T extends object>(
    defaultProvider: T,
    customMethods: Partial<T>
  ): T {
    if (!this.options.deepMerge) {
      return { ...defaultProvider, ...customMethods };
    }

    return this.deepMergeProviders(defaultProvider, customMethods);
  }

  /**
   * Get list of all GLSP feature names.
   */
  static getFeatureNames(): string[] {
    return [
      'astToGModel',
      'gModelToAst',
      'toolPalette',
      'validation',
      'layout',
      'contextMenu',
      'popup',
      'selection',
      'navigation',
      'export',
    ];
  }

  /**
   * Create a feature merger with custom-wins policy.
   */
  static customWins(
    options?: Omit<GlspFeatureMergerOptions, 'conflictResolution'>
  ): GlspFeatureMerger {
    return new GlspFeatureMerger({ ...options, conflictResolution: 'custom-wins' });
  }

  /**
   * Create a feature merger with default-wins policy.
   */
  static defaultWins(
    options?: Omit<GlspFeatureMergerOptions, 'conflictResolution'>
  ): GlspFeatureMerger {
    return new GlspFeatureMerger({ ...options, conflictResolution: 'default-wins' });
  }

  /**
   * Create a feature merger with deep merge enabled.
   */
  static withDeepMerge(
    options?: Omit<GlspFeatureMergerOptions, 'deepMerge'>
  ): GlspFeatureMerger {
    return new GlspFeatureMerger({ ...options, deepMerge: true });
  }
}

/**
 * Create a GLSP feature merger instance.
 *
 * @param options - Merger options
 * @returns GlspFeatureMerger instance
 */
export function createGlspFeatureMerger(
  options?: GlspFeatureMergerOptions
): GlspFeatureMerger {
  return new GlspFeatureMerger(options);
}

/**
 * Default GLSP feature merger instance.
 */
export const defaultGlspFeatureMerger = createGlspFeatureMerger();

/**
 * Convenience function to merge GLSP providers.
 *
 * @param defaultProviders - Default provider implementations
 * @param customProviders - Custom provider implementations
 * @param disabledFeatures - Features to disable
 * @returns Merged providers
 */
export function mergeGlspProviders(
  defaultProviders: GlspFeatureProviders,
  customProviders?: Partial<GlspFeatureProviders>,
  disabledFeatures?: string[]
): GlspFeatureProviders {
  return defaultGlspFeatureMerger.merge(
    defaultProviders,
    customProviders,
    disabledFeatures
  ).providers;
}

/**
 * Check if a GLSP feature is enabled.
 *
 * @param featureName - Name of the feature
 * @param providers - Merged providers
 * @returns True if the feature is enabled
 */
export function isGlspFeatureEnabled(
  featureName: keyof GlspFeatureProviders,
  providers: GlspFeatureProviders
): boolean {
  return providers[featureName] !== null && providers[featureName] !== undefined;
}

/**
 * Get the GLSP provider for a feature, or undefined if disabled.
 *
 * @param featureName - Name of the feature
 * @param providers - Merged providers
 * @returns Provider or undefined
 */
export function getGlspProvider<K extends keyof GlspFeatureProviders>(
  featureName: K,
  providers: GlspFeatureProviders
): GlspFeatureProviders[K] | undefined {
  const provider = providers[featureName];
  return provider === null ? undefined : provider;
}

/**
 * Create a partial provider override.
 *
 * Useful for overriding specific methods on a provider
 * while inheriting the rest from the default.
 *
 * @example
 * ```typescript
 * const customAstToGModel = createPartialOverride(defaultAstToGModel, {
 *   getLabel: (node) => node.customLabel ?? node.name,
 * });
 * ```
 */
export function createPartialOverride<T extends object>(
  baseProvider: T,
  overrides: Partial<T>
): T {
  return { ...baseProvider, ...overrides };
}
