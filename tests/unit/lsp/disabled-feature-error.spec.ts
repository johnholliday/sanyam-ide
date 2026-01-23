/**
 * Disabled Feature Error Handling Tests (T118)
 *
 * Tests that disabled features return appropriate LSP errors.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LanguageContribution,
  LspFeatureProviders,
  LspContext,
} from '@sanyam/types';

import {
  ProviderResolver,
  createProviderResolver,
  createProviderHandler,
} from '../../../packages/language-server/src/lsp/provider-resolver';
import {
  createFeatureMerger,
  isFeatureEnabled,
} from '../../../packages/language-server/src/lsp/feature-merger';

describe('Disabled Feature Error Handling', () => {
  let resolver: ProviderResolver;
  let defaultProviders: LspFeatureProviders;

  beforeEach(() => {
    resolver = createProviderResolver({ logResolution: false });

    defaultProviders = {
      hover: { provide: vi.fn().mockResolvedValue({ contents: 'hover' }) },
      completion: { provide: vi.fn().mockResolvedValue([]) },
      definition: { provide: vi.fn().mockResolvedValue(null) },
      references: { provide: vi.fn().mockResolvedValue([]) },
      diagnostics: { provide: vi.fn().mockResolvedValue([]) },
    } as any;

    resolver.setDefaultProviders(defaultProviders);
  });

  describe('resolver behavior for disabled features', () => {
    it('should return isDisabled=true for disabled features', () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['hover'],
      };

      const result = resolver.resolve('hover', contribution);

      expect(result.isDisabled).toBe(true);
      expect(result.provider).toBeUndefined();
    });

    it('should return undefined provider for disabled features', () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['completion'],
      };

      const result = resolver.resolve('completion', contribution);

      expect(result.provider).toBeUndefined();
    });

    it('should report feature as not enabled', () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['definition'],
      };

      const isEnabled = resolver.isEnabled('definition', contribution);

      expect(isEnabled).toBe(false);
    });
  });

  describe('provider handler behavior for disabled features', () => {
    it('should return null when feature is disabled', async () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['hover'],
      };

      const getContribution = () => contribution;
      const handler = createProviderHandler('hover', resolver, getContribution);

      const mockContext = createMockLspContext();
      const result = await handler(mockContext);

      expect(result).toBeNull();
    });

    it('should not invoke provider when feature is disabled', async () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['hover'],
      };

      const getContribution = () => contribution;
      const handler = createProviderHandler('hover', resolver, getContribution);

      const mockContext = createMockLspContext();
      await handler(mockContext);

      // Default provider should not be called
      expect(defaultProviders.hover?.provide).not.toHaveBeenCalled();
    });

    it('should invoke provider when feature is enabled', async () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: [], // No disabled features
      };

      const getContribution = () => contribution;
      const handler = createProviderHandler('hover', resolver, getContribution);

      const mockContext = createMockLspContext();
      await handler(mockContext, { line: 0, character: 0 });

      // Default provider should be called
      expect(defaultProviders.hover?.provide).toHaveBeenCalled();
    });
  });

  describe('merge result for disabled features', () => {
    it('should set disabled features to null in merged providers', () => {
      const merger = createFeatureMerger();

      const result = merger.merge(
        defaultProviders,
        {},
        ['hover', 'completion']
      );

      expect(result.providers.hover).toBeNull();
      expect(result.providers.completion).toBeNull();
      expect(result.disabledFeatures).toContain('hover');
      expect(result.disabledFeatures).toContain('completion');
    });

    it('should report disabled features correctly in isFeatureEnabled', () => {
      const merger = createFeatureMerger();

      const result = merger.merge(
        defaultProviders,
        {},
        ['hover']
      );

      expect(isFeatureEnabled('hover', result.providers)).toBe(false);
      expect(isFeatureEnabled('completion', result.providers)).toBe(true);
    });
  });

  describe('error responses for disabled features', () => {
    it('should handle multiple disabled features correctly', () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['hover', 'completion', 'definition', 'references'],
      };

      const hoverResult = resolver.resolve('hover', contribution);
      const completionResult = resolver.resolve('completion', contribution);
      const definitionResult = resolver.resolve('definition', contribution);
      const referencesResult = resolver.resolve('references', contribution);
      const diagnosticsResult = resolver.resolve('diagnostics', contribution);

      expect(hoverResult.isDisabled).toBe(true);
      expect(completionResult.isDisabled).toBe(true);
      expect(definitionResult.isDisabled).toBe(true);
      expect(referencesResult.isDisabled).toBe(true);
      expect(diagnosticsResult.isDisabled).toBe(false); // Not in disabled list
    });

    it('should handle case variations in disabled feature names', () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['HoverProvider', 'COMPLETION'],
      };

      const hoverResult = resolver.resolve('hover', contribution);
      const completionResult = resolver.resolve('completion', contribution);

      expect(hoverResult.isDisabled).toBe(true);
      expect(completionResult.isDisabled).toBe(true);
    });
  });

  describe('error message formatting', () => {
    it('should return consistent null for disabled features', async () => {
      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        disabledFeatures: ['hover', 'completion'],
      };

      const getContribution = () => contribution;
      const hoverHandler = createProviderHandler('hover', resolver, getContribution);
      const completionHandler = createProviderHandler('completion', resolver, getContribution);

      const mockContext = createMockLspContext();

      const hoverResult = await hoverHandler(mockContext);
      const completionResult = await completionHandler(mockContext);

      // Both should return null (not throw errors)
      expect(hoverResult).toBeNull();
      expect(completionResult).toBeNull();
    });
  });
});

// Helper functions

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
    cancellationToken: {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose: () => { } }),
    },
  };
}
