/**
 * Feature Merger (T094)
 *
 * Merges custom LSP providers with defaults and respects disabled features.
 *
 * @packageDocumentation
 */

import type { LspFeatureProviders } from '@sanyam/types';

/**
 * Feature merger options.
 */
export interface FeatureMergerOptions {
  /** Whether to log merge operations */
  verbose?: boolean;
  /** How to handle conflicts */
  conflictResolution?: 'custom-wins' | 'default-wins' | 'throw';
}

/**
 * Merge result containing the merged providers and any warnings.
 */
export interface MergeResult<T> {
  /** Merged providers */
  providers: T;
  /** Features that were disabled */
  disabledFeatures: string[];
  /** Features that were overridden */
  overriddenFeatures: string[];
  /** Warnings generated during merge */
  warnings: string[];
}

/**
 * LSP Feature Merger.
 *
 * Merges custom LSP providers with default implementations,
 * respecting the disabledFeatures configuration.
 */
export class FeatureMerger {
  private readonly options: Required<FeatureMergerOptions>;

  constructor(options?: FeatureMergerOptions) {
    this.options = {
      verbose: options?.verbose ?? false,
      conflictResolution: options?.conflictResolution ?? 'custom-wins',
    };
  }

  /**
   * Merge custom providers with defaults.
   *
   * @param defaultProviders - Default provider implementations
   * @param customProviders - Custom provider implementations (optional)
   * @param disabledFeatures - Features to disable (optional)
   * @returns Merged providers with merge metadata
   */
  merge(
    defaultProviders: LspFeatureProviders,
    customProviders?: Partial<LspFeatureProviders>,
    disabledFeatures?: readonly string[]
  ): MergeResult<LspFeatureProviders> {
    const result: MergeResult<LspFeatureProviders> = {
      providers: {} as LspFeatureProviders,
      disabledFeatures: [],
      overriddenFeatures: [],
      warnings: [],
    };

    const disabledSet = new Set(disabledFeatures ?? []);

    // Get all provider keys
    const allKeys = new Set([
      ...Object.keys(defaultProviders),
      ...Object.keys(customProviders ?? {}),
    ]);

    for (const key of allKeys) {
      const featureName = key as keyof LspFeatureProviders;

      // Check if feature is disabled
      if (disabledSet.has(featureName) || disabledSet.has(this.normalizeFeatureName(featureName))) {
        result.disabledFeatures.push(featureName);
        // Set to undefined or null to indicate disabled
        (result.providers as any)[featureName] = null;

        if (this.options.verbose) {
          console.log(`Feature '${featureName}' is disabled`);
        }
        continue;
      }

      // Get default and custom providers
      const defaultProvider = (defaultProviders as any)[featureName];
      const customProvider = customProviders ? (customProviders as any)[featureName] : undefined;

      // Merge based on availability
      if (customProvider !== undefined) {
        // Custom provider exists
        if (defaultProvider !== undefined) {
          // Both exist - use conflict resolution
          switch (this.options.conflictResolution) {
            case 'custom-wins':
              (result.providers as any)[featureName] = customProvider;
              result.overriddenFeatures.push(featureName);
              break;
            case 'default-wins':
              (result.providers as any)[featureName] = defaultProvider;
              result.warnings.push(`Custom ${featureName} ignored due to default-wins policy`);
              break;
            case 'throw':
              throw new Error(`Conflict: both default and custom ${featureName} provided`);
          }
        } else {
          // Only custom exists
          (result.providers as any)[featureName] = customProvider;
        }

        if (this.options.verbose && result.overriddenFeatures.includes(featureName)) {
          console.log(`Feature '${featureName}' overridden by custom provider`);
        }
      } else if (defaultProvider !== undefined) {
        // Only default exists
        (result.providers as any)[featureName] = defaultProvider;
      }
    }

    return result;
  }

  /**
   * Merge providers for a specific feature.
   *
   * Useful when you want to merge individual features
   * rather than all providers at once.
   */
  mergeFeature<K extends keyof LspFeatureProviders>(
    featureName: K,
    defaultProvider: LspFeatureProviders[K],
    customProvider?: LspFeatureProviders[K],
    disabled?: boolean
  ): LspFeatureProviders[K] | null {
    if (disabled) {
      return null;
    }

    if (customProvider !== undefined) {
      switch (this.options.conflictResolution) {
        case 'custom-wins':
          return customProvider;
        case 'default-wins':
          return defaultProvider;
        case 'throw':
          if (defaultProvider !== undefined) {
            throw new Error(`Conflict: both default and custom ${featureName} provided`);
          }
          return customProvider;
      }
    }

    return defaultProvider;
  }

  /**
   * Check if a feature is disabled.
   */
  isDisabled(featureName: string, disabledFeatures?: readonly string[]): boolean {
    if (!disabledFeatures || disabledFeatures.length === 0) {
      return false;
    }

    const normalizedName = this.normalizeFeatureName(featureName);
    return disabledFeatures.some(
      f => f === featureName || this.normalizeFeatureName(f) === normalizedName
    );
  }

  /**
   * Normalize feature name for comparison.
   *
   * Handles different naming conventions:
   * - completion, Completion, CompletionProvider
   * - hover, Hover, HoverProvider
   */
  private normalizeFeatureName(name: string): string {
    return name
      .replace(/Provider$/i, '')
      .toLowerCase();
  }

  /**
   * Get list of all available feature names.
   */
  static getFeatureNames(): string[] {
    return [
      'completion',
      'hover',
      'definition',
      'declaration',
      'typeDefinition',
      'implementation',
      'references',
      'documentSymbol',
      'workspaceSymbol',
      'documentHighlight',
      'codeAction',
      'codeLens',
      'formatting',
      'rangeFormatting',
      'onTypeFormatting',
      'rename',
      'prepareRename',
      'foldingRange',
      'selectionRange',
      'semanticTokens',
      'inlayHint',
      'linkedEditingRange',
      'callHierarchy',
      'typeHierarchy',
      'signatureHelp',
      'diagnostics',
    ];
  }

  /**
   * Create a feature merger with custom-wins policy.
   */
  static customWins(options?: Omit<FeatureMergerOptions, 'conflictResolution'>): FeatureMerger {
    return new FeatureMerger({ ...options, conflictResolution: 'custom-wins' });
  }

  /**
   * Create a feature merger with default-wins policy.
   */
  static defaultWins(options?: Omit<FeatureMergerOptions, 'conflictResolution'>): FeatureMerger {
    return new FeatureMerger({ ...options, conflictResolution: 'default-wins' });
  }
}

/**
 * Create a feature merger instance.
 *
 * @param options - Merger options
 * @returns FeatureMerger instance
 */
export function createFeatureMerger(options?: FeatureMergerOptions): FeatureMerger {
  return new FeatureMerger(options);
}

/**
 * Default feature merger instance.
 */
export const defaultFeatureMerger = createFeatureMerger();

/**
 * Convenience function to merge providers.
 *
 * @param defaultProviders - Default provider implementations
 * @param customProviders - Custom provider implementations
 * @param disabledFeatures - Features to disable
 * @returns Merged providers
 */
export function mergeProviders(
  defaultProviders: LspFeatureProviders,
  customProviders?: Partial<LspFeatureProviders>,
  disabledFeatures?: readonly string[]
): LspFeatureProviders {
  return defaultFeatureMerger.merge(defaultProviders, customProviders, disabledFeatures).providers;
}

/**
 * Check if a feature should be enabled.
 *
 * @param featureName - Name of the feature
 * @param providers - Merged providers
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(
  featureName: keyof LspFeatureProviders,
  providers: LspFeatureProviders
): boolean {
  return providers[featureName] !== null && providers[featureName] !== undefined;
}

/**
 * Check if a feature is in the disabled features list.
 *
 * This function is useful for checking at runtime whether a feature
 * should be skipped based on the contribution's disabledFeatures.
 *
 * @param featureName - Name of the feature to check
 * @param disabledFeatures - List of disabled feature names
 * @returns True if the feature is disabled
 */
export function isFeatureDisabled(
  featureName: string,
  disabledFeatures: readonly string[]
): boolean {
  if (!disabledFeatures || disabledFeatures.length === 0) {
    return false;
  }

  // Normalize the feature name for comparison
  const normalizedName = featureName.replace(/Provider$/i, '').toLowerCase();

  return disabledFeatures.some(f => {
    const normalizedDisabled = f.replace(/Provider$/i, '').toLowerCase();
    return f === featureName || normalizedDisabled === normalizedName;
  });
}

/**
 * Get the provider for a feature, or undefined if disabled.
 *
 * @param featureName - Name of the feature
 * @param providers - Merged providers
 * @returns Provider or undefined
 */
export function getProvider<K extends keyof LspFeatureProviders>(
  featureName: K,
  providers: LspFeatureProviders
): LspFeatureProviders[K] | undefined {
  const provider = providers[featureName];
  return provider === null ? undefined : provider;
}
