/**
 * Disabled Features Integration Tests (T109)
 *
 * Tests for disabling specific features in grammar packages.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

// Import the modules under test
import {
  FeatureMerger,
  createFeatureMerger,
  isFeatureEnabled,
} from '../../../packages/sanyam-lsp/src/lsp/feature-merger';
import {
  GlspFeatureMerger,
  createGlspFeatureMerger,
  isGlspFeatureEnabled,
} from '../../../packages/sanyam-lsp/src/glsp/feature-merger';

describe('Disabled Features Integration', () => {
  describe('LSP Feature Disabling', () => {
    let lspMerger: FeatureMerger;
    let defaultLspProviders: Partial<LspFeatureProviders>;

    beforeEach(() => {
      lspMerger = createFeatureMerger();

      defaultLspProviders = {
        hover: { provide: vi.fn().mockResolvedValue({ contents: 'hover' }) } as any,
        completion: { provide: vi.fn().mockResolvedValue([]) } as any,
        definition: { provide: vi.fn().mockResolvedValue(null) } as any,
        references: { provide: vi.fn().mockResolvedValue([]) } as any,
        formatting: { provide: vi.fn().mockResolvedValue([]) } as any,
        rename: { provide: vi.fn().mockResolvedValue(null) } as any,
        diagnostics: { provide: vi.fn().mockResolvedValue([]) } as any,
      };
    });

    it('should disable single LSP feature', () => {
      const result = lspMerger.merge(
        defaultLspProviders as LspFeatureProviders,
        {},
        ['hover']
      );

      expect(result.disabledFeatures).toContain('hover');
      expect(result.providers.hover).toBeNull();
      expect(isFeatureEnabled('hover', result.providers)).toBe(false);

      // Other features still enabled
      expect(isFeatureEnabled('completion', result.providers)).toBe(true);
    });

    it('should disable multiple LSP features', () => {
      const result = lspMerger.merge(
        defaultLspProviders as LspFeatureProviders,
        {},
        ['hover', 'formatting', 'rename']
      );

      expect(result.disabledFeatures).toHaveLength(3);
      expect(result.providers.hover).toBeNull();
      expect(result.providers.formatting).toBeNull();
      expect(result.providers.rename).toBeNull();

      // Other features still enabled
      expect(result.providers.completion).toBe(defaultLspProviders.completion);
    });

    it('should handle feature name variations', () => {
      const result = lspMerger.merge(
        defaultLspProviders as LspFeatureProviders,
        {},
        ['HoverProvider', 'CompletionProvider'] // With Provider suffix
      );

      expect(result.disabledFeatures).toContain('hover');
      expect(result.disabledFeatures).toContain('completion');
    });

    it('should ignore custom providers for disabled features', () => {
      const customHover = { provide: vi.fn().mockResolvedValue({ contents: 'custom' }) } as any;

      const result = lspMerger.merge(
        defaultLspProviders as LspFeatureProviders,
        { hover: customHover },
        ['hover'] // Disable hover
      );

      // Custom provider should be ignored
      expect(result.providers.hover).toBeNull();
      expect(result.overriddenFeatures).not.toContain('hover');
    });

    it('should disable all common LSP features', () => {
      const allFeatures = [
        'hover',
        'completion',
        'definition',
        'references',
        'formatting',
        'rename',
        'diagnostics',
      ];

      const result = lspMerger.merge(
        defaultLspProviders as LspFeatureProviders,
        {},
        allFeatures
      );

      for (const feature of allFeatures) {
        expect(isFeatureEnabled(feature as any, result.providers)).toBe(false);
      }
    });
  });

  describe('GLSP Feature Disabling', () => {
    let glspMerger: GlspFeatureMerger;
    let defaultGlspProviders: Partial<GlspFeatureProviders>;

    beforeEach(() => {
      glspMerger = createGlspFeatureMerger();

      defaultGlspProviders = {
        astToGModel: { convert: vi.fn(), getLabel: vi.fn() } as any,
        gModelToAst: { applyChanges: vi.fn() } as any,
        toolPalette: { getTools: vi.fn() } as any,
        validation: { validate: vi.fn().mockResolvedValue([]) } as any,
        layout: { applyLayout: vi.fn() } as any,
        contextMenu: { getItems: vi.fn().mockResolvedValue([]) } as any,
      };
    });

    it('should disable single GLSP feature', () => {
      const result = glspMerger.merge(
        defaultGlspProviders as GlspFeatureProviders,
        {},
        ['astToGModel']
      );

      expect(result.disabledFeatures).toContain('astToGModel');
      expect(result.providers.astToGModel).toBeNull();
      expect(isGlspFeatureEnabled('astToGModel', result.providers)).toBe(false);

      // Other features still enabled
      expect(isGlspFeatureEnabled('toolPalette', result.providers)).toBe(true);
    });

    it('should disable multiple GLSP features', () => {
      const result = glspMerger.merge(
        defaultGlspProviders as GlspFeatureProviders,
        {},
        ['toolPalette', 'contextMenu', 'validation']
      );

      expect(result.disabledFeatures).toHaveLength(3);
      expect(result.providers.toolPalette).toBeNull();
      expect(result.providers.contextMenu).toBeNull();
      expect(result.providers.validation).toBeNull();

      // Other features still enabled
      expect(result.providers.astToGModel).toBe(defaultGlspProviders.astToGModel);
    });

    it('should handle glsp. prefixed feature names', () => {
      const result = glspMerger.merge(
        defaultGlspProviders as GlspFeatureProviders,
        {},
        ['glsp.astToGModel', 'glsp.toolPalette']
      );

      expect(result.disabledFeatures).toContain('astToGModel');
      expect(result.disabledFeatures).toContain('toolPalette');
    });

    it('should ignore custom providers for disabled GLSP features', () => {
      const customAstToGModel = { convert: vi.fn(), getLabel: vi.fn() } as any;

      const result = glspMerger.merge(
        defaultGlspProviders as GlspFeatureProviders,
        { astToGModel: customAstToGModel },
        ['astToGModel']
      );

      // Custom provider should be ignored
      expect(result.providers.astToGModel).toBeNull();
      expect(result.overriddenFeatures).not.toContain('astToGModel');
    });
  });

  describe('Language Contribution with Disabled Features', () => {
    it('should create LSP contribution with disabled features', () => {
      const contribution: LanguageContribution = {
        languageId: 'restricted-lang',
        fileExtensions: ['.rst'],
        generatedModule: {},
        disabledFeatures: ['formatting', 'rename', 'diagnostics'],
      };

      const lspMerger = createFeatureMerger();
      const defaultProviders: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
        completion: { provide: vi.fn() } as any,
        formatting: { provide: vi.fn() } as any,
        rename: { provide: vi.fn() } as any,
        diagnostics: { provide: vi.fn() } as any,
      };

      const result = lspMerger.merge(
        defaultProviders as LspFeatureProviders,
        contribution.lspProviders,
        contribution.disabledFeatures
      );

      // Disabled features
      expect(result.providers.formatting).toBeNull();
      expect(result.providers.rename).toBeNull();
      expect(result.providers.diagnostics).toBeNull();

      // Enabled features
      expect(result.providers.hover).not.toBeNull();
      expect(result.providers.completion).not.toBeNull();
    });

    it('should create GLSP contribution with disabled features', () => {
      const contribution: LanguageContribution = {
        languageId: 'no-diagram-lang',
        fileExtensions: ['.ndl'],
        generatedModule: {},
        disabledFeatures: ['glsp.astToGModel', 'glsp.toolPalette'],
      };

      const glspMerger = createGlspFeatureMerger();
      const defaultProviders: Partial<GlspFeatureProviders> = {
        astToGModel: { convert: vi.fn() } as any,
        gModelToAst: { applyChanges: vi.fn() } as any,
        toolPalette: { getTools: vi.fn() } as any,
        validation: { validate: vi.fn() } as any,
      };

      const result = glspMerger.merge(
        defaultProviders as GlspFeatureProviders,
        contribution.glspProviders,
        contribution.disabledFeatures
      );

      // Disabled GLSP features
      expect(result.providers.astToGModel).toBeNull();
      expect(result.providers.toolPalette).toBeNull();

      // Enabled GLSP features
      expect(result.providers.gModelToAst).not.toBeNull();
      expect(result.providers.validation).not.toBeNull();
    });

    it('should handle mixed LSP and GLSP disabled features', () => {
      const contribution: LanguageContribution = {
        languageId: 'mixed-lang',
        fileExtensions: ['.mxd'],
        generatedModule: {},
        disabledFeatures: [
          'hover',           // LSP feature
          'formatting',      // LSP feature
          'glsp.toolPalette', // GLSP feature
        ],
      };

      // Test LSP
      const lspMerger = createFeatureMerger();
      const lspDefaults: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
        completion: { provide: vi.fn() } as any,
        formatting: { provide: vi.fn() } as any,
      };

      const lspResult = lspMerger.merge(
        lspDefaults as LspFeatureProviders,
        contribution.lspProviders,
        contribution.disabledFeatures
      );

      expect(lspResult.providers.hover).toBeNull();
      expect(lspResult.providers.formatting).toBeNull();
      expect(lspResult.providers.completion).not.toBeNull();

      // Test GLSP
      const glspMerger = createGlspFeatureMerger();
      const glspDefaults: Partial<GlspFeatureProviders> = {
        toolPalette: { getTools: vi.fn() } as any,
        validation: { validate: vi.fn() } as any,
      };

      const glspResult = glspMerger.merge(
        glspDefaults as GlspFeatureProviders,
        contribution.glspProviders,
        contribution.disabledFeatures
      );

      expect(glspResult.providers.toolPalette).toBeNull();
      expect(glspResult.providers.validation).not.toBeNull();
    });
  });

  describe('Disabled Feature Edge Cases', () => {
    it('should handle empty disabled features array', () => {
      const lspMerger = createFeatureMerger();
      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
      };

      const result = lspMerger.merge(
        defaults as LspFeatureProviders,
        {},
        []
      );

      expect(result.disabledFeatures).toHaveLength(0);
      expect(result.providers.hover).toBe(defaults.hover);
    });

    it('should handle undefined disabled features', () => {
      const lspMerger = createFeatureMerger();
      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
      };

      const result = lspMerger.merge(
        defaults as LspFeatureProviders,
        {},
        undefined
      );

      expect(result.disabledFeatures).toHaveLength(0);
      expect(result.providers.hover).toBe(defaults.hover);
    });

    it('should handle non-existent feature names gracefully', () => {
      const lspMerger = createFeatureMerger();
      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
      };

      // Disabling a feature that doesn't exist in defaults
      const result = lspMerger.merge(
        defaults as LspFeatureProviders,
        {},
        ['nonExistentFeature']
      );

      // Should still process without error
      expect(result.providers.hover).toBe(defaults.hover);
    });

    it('should handle duplicate feature names in disabled list', () => {
      const lspMerger = createFeatureMerger();
      const defaults: Partial<LspFeatureProviders> = {
        hover: { provide: vi.fn() } as any,
        completion: { provide: vi.fn() } as any,
      };

      const result = lspMerger.merge(
        defaults as LspFeatureProviders,
        {},
        ['hover', 'hover', 'HOVER'] // Duplicates with case variations
      );

      // Should dedupe and still disable
      expect(result.providers.hover).toBeNull();
    });
  });
});
