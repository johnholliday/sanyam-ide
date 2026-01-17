/**
 * Feature Merger Unit Tests (T096)
 *
 * Tests for the LSP feature merger functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { LspFeatureProviders } from '@sanyam/types';

import {
  FeatureMerger,
  createFeatureMerger,
  defaultFeatureMerger,
  mergeProviders,
  isFeatureEnabled,
  getProvider,
  type FeatureMergerOptions,
  type MergeResult,
} from '../../../packages/sanyam-lsp/src/lsp/feature-merger';

describe('FeatureMerger', () => {
  let merger: FeatureMerger;

  beforeEach(() => {
    merger = createFeatureMerger();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const fm = new FeatureMerger();
      expect(fm).toBeInstanceOf(FeatureMerger);
    });

    it('should create with custom options', () => {
      const fm = new FeatureMerger({
        verbose: true,
        conflictResolution: 'default-wins',
      });
      expect(fm).toBeInstanceOf(FeatureMerger);
    });
  });

  describe('merge', () => {
    it('should return all default providers when no custom providers', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
        hover: { provide: () => null } as any,
      };

      const result = merger.merge(defaults as LspFeatureProviders);

      expect(result.providers.completion).toBe(defaults.completion);
      expect(result.providers.hover).toBe(defaults.hover);
      expect(result.overriddenFeatures).toHaveLength(0);
    });

    it('should override defaults with custom providers (custom-wins)', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
        hover: { provide: () => null } as any,
      };

      const custom: Partial<LspFeatureProviders> = {
        hover: { provide: () => ({ contents: 'custom' }) } as any,
      };

      const result = merger.merge(
        defaults as LspFeatureProviders,
        custom
      );

      expect(result.providers.completion).toBe(defaults.completion);
      expect(result.providers.hover).toBe(custom.hover);
      expect(result.overriddenFeatures).toContain('hover');
    });

    it('should keep defaults with default-wins policy', () => {
      const fm = FeatureMerger.defaultWins();

      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: () => null } as any,
      };

      const custom: Partial<LspFeatureProviders> = {
        hover: { provide: () => ({ contents: 'custom' }) } as any,
      };

      const result = fm.merge(
        defaults as LspFeatureProviders,
        custom
      );

      expect(result.providers.hover).toBe(defaults.hover);
      expect(result.warnings).toContain('Custom hover ignored due to default-wins policy');
    });

    it('should throw on conflict with throw policy', () => {
      const fm = new FeatureMerger({ conflictResolution: 'throw' });

      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: () => null } as any,
      };

      const custom: Partial<LspFeatureProviders> = {
        hover: { provide: () => ({ contents: 'custom' }) } as any,
      };

      expect(() => {
        fm.merge(defaults as LspFeatureProviders, custom);
      }).toThrow('Conflict: both default and custom hover provided');
    });

    it('should disable features in disabledFeatures list', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
        hover: { provide: () => null } as any,
        definition: { provide: () => null } as any,
      };

      const result = merger.merge(
        defaults as LspFeatureProviders,
        undefined,
        ['hover', 'definition']
      );

      expect(result.providers.completion).toBe(defaults.completion);
      expect(result.providers.hover).toBeNull();
      expect(result.providers.definition).toBeNull();
      expect(result.disabledFeatures).toContain('hover');
      expect(result.disabledFeatures).toContain('definition');
    });

    it('should handle normalized feature names for disabling', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
      };

      const result = merger.merge(
        defaults as LspFeatureProviders,
        undefined,
        ['CompletionProvider'] // Should match 'completion'
      );

      expect(result.providers.completion).toBeNull();
      expect(result.disabledFeatures).toContain('completion');
    });

    it('should add custom-only providers', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
      };

      const custom: Partial<LspFeatureProviders> = {
        hover: { provide: () => ({ contents: 'new' }) } as any,
      };

      const result = merger.merge(
        defaults as LspFeatureProviders,
        custom
      );

      expect(result.providers.completion).toBe(defaults.completion);
      expect(result.providers.hover).toBe(custom.hover);
      // Not marked as overridden since there was no default
      expect(result.overriddenFeatures).not.toContain('hover');
    });

    it('should return empty providers for empty inputs', () => {
      const result = merger.merge({} as LspFeatureProviders);

      expect(Object.keys(result.providers)).toHaveLength(0);
      expect(result.disabledFeatures).toHaveLength(0);
      expect(result.overriddenFeatures).toHaveLength(0);
    });
  });

  describe('mergeFeature', () => {
    it('should return default when no custom provided', () => {
      const defaultProvider = { provide: () => [] } as any;

      const result = merger.mergeFeature('completion', defaultProvider);

      expect(result).toBe(defaultProvider);
    });

    it('should return custom when custom provided (custom-wins)', () => {
      const defaultProvider = { provide: () => [] } as any;
      const customProvider = { provide: () => ['custom'] } as any;

      const result = merger.mergeFeature('completion', defaultProvider, customProvider);

      expect(result).toBe(customProvider);
    });

    it('should return null when disabled', () => {
      const defaultProvider = { provide: () => [] } as any;

      const result = merger.mergeFeature('completion', defaultProvider, undefined, true);

      expect(result).toBeNull();
    });

    it('should return custom when disabled is false', () => {
      const defaultProvider = { provide: () => [] } as any;
      const customProvider = { provide: () => ['custom'] } as any;

      const result = merger.mergeFeature('completion', defaultProvider, customProvider, false);

      expect(result).toBe(customProvider);
    });
  });

  describe('isDisabled', () => {
    it('should return false when no disabled features', () => {
      expect(merger.isDisabled('completion')).toBe(false);
      expect(merger.isDisabled('completion', [])).toBe(false);
    });

    it('should return true for exact match', () => {
      expect(merger.isDisabled('completion', ['completion'])).toBe(true);
    });

    it('should return true for normalized match', () => {
      expect(merger.isDisabled('completion', ['CompletionProvider'])).toBe(true);
      expect(merger.isDisabled('completionProvider', ['completion'])).toBe(true);
    });

    it('should return false for non-matching features', () => {
      expect(merger.isDisabled('hover', ['completion', 'definition'])).toBe(false);
    });
  });

  describe('static methods', () => {
    describe('getFeatureNames', () => {
      it('should return all feature names', () => {
        const names = FeatureMerger.getFeatureNames();

        expect(names).toContain('completion');
        expect(names).toContain('hover');
        expect(names).toContain('definition');
        expect(names).toContain('references');
        expect(names).toContain('diagnostics');
        expect(names.length).toBeGreaterThan(10);
      });
    });

    describe('customWins', () => {
      it('should create merger with custom-wins policy', () => {
        const fm = FeatureMerger.customWins();

        const defaults: Partial<LspFeatureProviders> = {
          hover: { provide: () => null } as any,
        };
        const custom: Partial<LspFeatureProviders> = {
          hover: { provide: () => ({ contents: 'custom' }) } as any,
        };

        const result = fm.merge(defaults as LspFeatureProviders, custom);

        expect(result.providers.hover).toBe(custom.hover);
      });
    });

    describe('defaultWins', () => {
      it('should create merger with default-wins policy', () => {
        const fm = FeatureMerger.defaultWins();

        const defaults: Partial<LspFeatureProviders> = {
          hover: { provide: () => null } as any,
        };
        const custom: Partial<LspFeatureProviders> = {
          hover: { provide: () => ({ contents: 'custom' }) } as any,
        };

        const result = fm.merge(defaults as LspFeatureProviders, custom);

        expect(result.providers.hover).toBe(defaults.hover);
      });
    });
  });
});

describe('convenience functions', () => {
  describe('createFeatureMerger', () => {
    it('should create a FeatureMerger instance', () => {
      const fm = createFeatureMerger();
      expect(fm).toBeInstanceOf(FeatureMerger);
    });

    it('should create with options', () => {
      const fm = createFeatureMerger({ verbose: true });
      expect(fm).toBeInstanceOf(FeatureMerger);
    });
  });

  describe('defaultFeatureMerger', () => {
    it('should be a FeatureMerger instance', () => {
      expect(defaultFeatureMerger).toBeInstanceOf(FeatureMerger);
    });
  });

  describe('mergeProviders', () => {
    it('should merge providers using default merger', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
      };
      const custom: Partial<LspFeatureProviders> = {
        hover: { provide: () => null } as any,
      };

      const result = mergeProviders(
        defaults as LspFeatureProviders,
        custom
      );

      expect(result.completion).toBe(defaults.completion);
      expect(result.hover).toBe(custom.hover);
    });

    it('should respect disabled features', () => {
      const defaults: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
        hover: { provide: () => null } as any,
      };

      const result = mergeProviders(
        defaults as LspFeatureProviders,
        undefined,
        ['hover']
      );

      expect(result.completion).toBe(defaults.completion);
      expect(result.hover).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      const providers: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
      };

      expect(isFeatureEnabled('completion', providers as LspFeatureProviders)).toBe(true);
    });

    it('should return false for disabled features (null)', () => {
      const providers: any = {
        completion: null,
      };

      expect(isFeatureEnabled('completion', providers)).toBe(false);
    });

    it('should return false for missing features (undefined)', () => {
      const providers: any = {};

      expect(isFeatureEnabled('completion', providers)).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return provider for enabled features', () => {
      const completionProvider = { provide: () => [] } as any;
      const providers: Partial<LspFeatureProviders> = {
        completion: completionProvider,
      };

      const result = getProvider('completion', providers as LspFeatureProviders);

      expect(result).toBe(completionProvider);
    });

    it('should return undefined for disabled features (null)', () => {
      const providers: any = {
        completion: null,
      };

      const result = getProvider('completion', providers);

      expect(result).toBeUndefined();
    });

    it('should return undefined for missing features', () => {
      const providers: any = {};

      const result = getProvider('completion', providers);

      expect(result).toBeUndefined();
    });
  });
});

describe('edge cases', () => {
  let merger: FeatureMerger;

  beforeEach(() => {
    merger = createFeatureMerger();
  });

  it('should handle undefined custom providers gracefully', () => {
    const defaults: Partial<LspFeatureProviders> = {
      completion: { provide: () => [] } as any,
    };

    const result = merger.merge(defaults as LspFeatureProviders, undefined);

    expect(result.providers.completion).toBe(defaults.completion);
  });

  it('should handle empty disabled features array', () => {
    const defaults: Partial<LspFeatureProviders> = {
      completion: { provide: () => [] } as any,
    };

    const result = merger.merge(defaults as LspFeatureProviders, undefined, []);

    expect(result.providers.completion).toBe(defaults.completion);
    expect(result.disabledFeatures).toHaveLength(0);
  });

  it('should handle provider with same key in defaults and custom', () => {
    const defaults: Partial<LspFeatureProviders> = {
      completion: { provide: () => [] } as any,
    };

    const custom: Partial<LspFeatureProviders> = {
      completion: { provide: () => ['overridden'] } as any,
    };

    const result = merger.merge(defaults as LspFeatureProviders, custom);

    expect(result.providers.completion).toBe(custom.completion);
    expect(result.overriddenFeatures).toContain('completion');
  });

  it('should not include disabled features in overridden list', () => {
    const defaults: Partial<LspFeatureProviders> = {
      completion: { provide: () => [] } as any,
    };

    const custom: Partial<LspFeatureProviders> = {
      completion: { provide: () => ['overridden'] } as any,
    };

    const result = merger.merge(
      defaults as LspFeatureProviders,
      custom,
      ['completion']
    );

    expect(result.providers.completion).toBeNull();
    expect(result.disabledFeatures).toContain('completion');
    expect(result.overriddenFeatures).not.toContain('completion');
  });
});
