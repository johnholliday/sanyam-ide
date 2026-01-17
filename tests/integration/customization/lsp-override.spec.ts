/**
 * LSP Provider Override Integration Tests (T107)
 *
 * Tests for custom LSP provider overrides in grammar packages.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LanguageContribution,
  LspFeatureProviders,
  LspContext,
  HoverProvider,
  CompletionProvider,
} from '@sanyam/types';

// Import the modules under test
import {
  FeatureMerger,
  createFeatureMerger,
  mergeProviders,
  isFeatureEnabled,
  getProvider,
} from '../../../packages/language-server/src/lsp/feature-merger';

describe('LSP Provider Override Integration', () => {
  let merger: FeatureMerger;
  let defaultProviders: Partial<LspFeatureProviders>;

  beforeEach(() => {
    merger = createFeatureMerger();

    // Create mock default providers
    defaultProviders = {
      hover: createMockHoverProvider('default hover'),
      completion: createMockCompletionProvider(['default1', 'default2']),
      definition: { provide: vi.fn().mockResolvedValue(null) } as any,
    };
  });

  describe('custom provider override', () => {
    it('should use custom hover provider when provided', async () => {
      const customHover = createMockHoverProvider('custom hover content');

      const customProviders: Partial<LspFeatureProviders> = {
        hover: customHover,
      };

      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        customProviders
      );

      expect(result.providers.hover).toBe(customHover);
      expect(result.overriddenFeatures).toContain('hover');

      // Verify the custom provider is used
      const mockContext = createMockLspContext();
      const hoverResult = await result.providers.hover?.provide(mockContext, { line: 0, character: 0 });
      expect(hoverResult).toEqual({ contents: 'custom hover content' });
    });

    it('should use custom completion provider when provided', async () => {
      const customCompletion = createMockCompletionProvider(['custom1', 'custom2', 'custom3']);

      const customProviders: Partial<LspFeatureProviders> = {
        completion: customCompletion,
      };

      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        customProviders
      );

      expect(result.providers.completion).toBe(customCompletion);
      expect(result.overriddenFeatures).toContain('completion');

      // Verify the custom provider is used
      const mockContext = createMockLspContext();
      const completionResult = await result.providers.completion?.provide(
        mockContext,
        { line: 0, character: 0 },
        {}
      );
      expect(completionResult).toHaveLength(3);
    });

    it('should use default provider when no custom provider', () => {
      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        {} // No custom providers
      );

      expect(result.providers.hover).toBe(defaultProviders.hover);
      expect(result.providers.completion).toBe(defaultProviders.completion);
      expect(result.overriddenFeatures).toHaveLength(0);
    });

    it('should mix custom and default providers', async () => {
      const customHover = createMockHoverProvider('custom hover only');

      const customProviders: Partial<LspFeatureProviders> = {
        hover: customHover, // Override hover only
      };

      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        customProviders
      );

      // Custom hover
      expect(result.providers.hover).toBe(customHover);
      expect(result.overriddenFeatures).toContain('hover');

      // Default completion (not overridden)
      expect(result.providers.completion).toBe(defaultProviders.completion);
      expect(result.overriddenFeatures).not.toContain('completion');

      // Default definition (not overridden)
      expect(result.providers.definition).toBe(defaultProviders.definition);
    });
  });

  describe('language contribution with custom providers', () => {
    it('should create contribution with custom LSP providers', () => {
      const customHover = createMockHoverProvider('language-specific hover');

      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        lspProviders: {
          hover: customHover,
        },
        disabledFeatures: [],
      };

      // Merge contribution providers with defaults
      const merged = merger.merge(
        defaultProviders as LspFeatureProviders,
        contribution.lspProviders
      );

      expect(merged.providers.hover).toBe(customHover);
      expect(merged.overriddenFeatures).toContain('hover');
    });

    it('should support partial provider overrides', () => {
      // Provider that only overrides some methods
      const partialHover: Partial<HoverProvider> = {
        provide: vi.fn().mockResolvedValue({ contents: 'partial' }),
      };

      const customProviders: Partial<LspFeatureProviders> = {
        hover: partialHover as HoverProvider,
      };

      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        customProviders
      );

      expect(result.providers.hover).toBe(partialHover);
    });
  });

  describe('provider resolution order', () => {
    it('should prioritize custom over default (custom-wins policy)', () => {
      const customMerger = FeatureMerger.customWins();
      const customHover = createMockHoverProvider('custom wins');

      const result = customMerger.merge(
        defaultProviders as LspFeatureProviders,
        { hover: customHover }
      );

      expect(result.providers.hover).toBe(customHover);
    });

    it('should prioritize default over custom (default-wins policy)', () => {
      const defaultMerger = FeatureMerger.defaultWins();
      const customHover = createMockHoverProvider('custom should lose');

      const result = defaultMerger.merge(
        defaultProviders as LspFeatureProviders,
        { hover: customHover }
      );

      expect(result.providers.hover).toBe(defaultProviders.hover);
      expect(result.warnings).toContain('Custom hover ignored due to default-wins policy');
    });
  });

  describe('provider availability checking', () => {
    it('should correctly identify enabled features', () => {
      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        {}
      );

      expect(isFeatureEnabled('hover', result.providers)).toBe(true);
      expect(isFeatureEnabled('completion', result.providers)).toBe(true);
    });

    it('should correctly identify disabled features', () => {
      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        {},
        ['hover']
      );

      expect(isFeatureEnabled('hover', result.providers)).toBe(false);
      expect(isFeatureEnabled('completion', result.providers)).toBe(true);
    });

    it('should safely retrieve providers', () => {
      const result = merger.merge(
        defaultProviders as LspFeatureProviders,
        {},
        ['hover']
      );

      expect(getProvider('hover', result.providers)).toBeUndefined();
      expect(getProvider('completion', result.providers)).toBe(defaultProviders.completion);
    });
  });
});

// Helper functions

function createMockHoverProvider(content: string): HoverProvider {
  return {
    provide: vi.fn().mockResolvedValue({ contents: content }),
  };
}

function createMockCompletionProvider(items: string[]): CompletionProvider {
  return {
    provide: vi.fn().mockResolvedValue(
      items.map((label, index) => ({
        label,
        kind: 1,
        sortText: String(index).padStart(4, '0'),
      }))
    ),
  };
}

function createMockLspContext(): LspContext {
  return {
    document: {
      uri: 'file:///test.tst',
      getText: () => 'test content',
      positionAt: () => ({ line: 0, character: 0 }),
      offsetAt: () => 0,
      lineCount: 1,
      version: 1,
      languageId: 'test-lang',
    },
    services: {} as any,
    position: { line: 0, character: 0 },
    cancellationToken: { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { } }) },
  };
}
