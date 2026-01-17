/**
 * GLSP Provider Override Integration Tests (T108)
 *
 * Tests for custom GLSP provider overrides in grammar packages.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LanguageContribution,
  GlspFeatureProviders,
  GlspContext,
  AstToGModelProvider,
  GModelToAstProvider,
  ToolPaletteProvider,
} from '@sanyam/types';

// Import the modules under test
import {
  GlspFeatureMerger,
  createGlspFeatureMerger,
  mergeGlspProviders,
  isGlspFeatureEnabled,
  getGlspProvider,
} from '../../../packages/sanyam-lsp/src/glsp/feature-merger';

describe('GLSP Provider Override Integration', () => {
  let merger: GlspFeatureMerger;
  let defaultProviders: Partial<GlspFeatureProviders>;

  beforeEach(() => {
    merger = createGlspFeatureMerger();

    // Create mock default providers
    defaultProviders = {
      astToGModel: createMockAstToGModelProvider('default'),
      gModelToAst: createMockGModelToAstProvider(),
      toolPalette: createMockToolPaletteProvider([
        { id: 'default-tool', label: 'Default Tool' },
      ]),
      validation: { validate: vi.fn().mockResolvedValue([]) } as any,
      layout: { applyLayout: vi.fn().mockResolvedValue({}) } as any,
    };
  });

  describe('custom provider override', () => {
    it('should use custom astToGModel provider when provided', async () => {
      const customAstToGModel = createMockAstToGModelProvider('custom');

      const customProviders: Partial<GlspFeatureProviders> = {
        astToGModel: customAstToGModel,
      };

      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        customProviders
      );

      expect(result.providers.astToGModel).toBe(customAstToGModel);
      expect(result.overriddenFeatures).toContain('astToGModel');

      // Verify the custom provider is used
      const mockContext = createMockGlspContext();
      const gModel = await result.providers.astToGModel?.convert(mockContext);
      expect(gModel?.id).toBe('custom-model');
    });

    it('should use custom toolPalette provider when provided', async () => {
      const customTools = [
        { id: 'custom-entity', label: 'Entity' },
        { id: 'custom-relation', label: 'Relation' },
      ];
      const customToolPalette = createMockToolPaletteProvider(customTools);

      const customProviders: Partial<GlspFeatureProviders> = {
        toolPalette: customToolPalette,
      };

      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        customProviders
      );

      expect(result.providers.toolPalette).toBe(customToolPalette);
      expect(result.overriddenFeatures).toContain('toolPalette');

      // Verify the custom provider is used
      const mockContext = createMockGlspContext();
      const palette = await result.providers.toolPalette?.getTools(mockContext);
      expect(palette?.groups[0].tools).toHaveLength(2);
    });

    it('should use default provider when no custom provider', () => {
      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        {} // No custom providers
      );

      expect(result.providers.astToGModel).toBe(defaultProviders.astToGModel);
      expect(result.providers.toolPalette).toBe(defaultProviders.toolPalette);
      expect(result.overriddenFeatures).toHaveLength(0);
    });

    it('should mix custom and default providers', async () => {
      const customAstToGModel = createMockAstToGModelProvider('custom-ast');

      const customProviders: Partial<GlspFeatureProviders> = {
        astToGModel: customAstToGModel, // Override astToGModel only
      };

      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        customProviders
      );

      // Custom astToGModel
      expect(result.providers.astToGModel).toBe(customAstToGModel);
      expect(result.overriddenFeatures).toContain('astToGModel');

      // Default toolPalette (not overridden)
      expect(result.providers.toolPalette).toBe(defaultProviders.toolPalette);
      expect(result.overriddenFeatures).not.toContain('toolPalette');

      // Default validation (not overridden)
      expect(result.providers.validation).toBe(defaultProviders.validation);
    });
  });

  describe('deep merge for GLSP providers', () => {
    it('should deep merge provider configurations when enabled', () => {
      const deepMergeMerger = GlspFeatureMerger.withDeepMerge();

      const defaultConfig = {
        convert: vi.fn(),
        options: {
          includeMetadata: true,
          includePositions: false,
        },
      };

      const customConfig = {
        options: {
          includePositions: true, // Override only this option
        },
      };

      const result = deepMergeMerger.mergeProviderMethods(
        defaultConfig,
        customConfig
      );

      expect(result.convert).toBe(defaultConfig.convert);
      expect(result.options.includeMetadata).toBe(true); // From default
      expect(result.options.includePositions).toBe(true); // From custom
    });

    it('should shallow merge when deep merge is disabled', () => {
      const shallowMerger = createGlspFeatureMerger({ deepMerge: false });

      const defaultConfig = {
        convert: vi.fn(),
        options: {
          includeMetadata: true,
          includePositions: false,
        },
      };

      const customConfig = {
        options: {
          includePositions: true,
        },
      };

      const result = shallowMerger.mergeProviderMethods(
        defaultConfig,
        customConfig
      );

      // Shallow merge - custom options completely replaces default options
      expect(result.options.includeMetadata).toBeUndefined();
      expect(result.options.includePositions).toBe(true);
    });
  });

  describe('language contribution with custom GLSP providers', () => {
    it('should create contribution with custom GLSP providers', () => {
      const customAstToGModel = createMockAstToGModelProvider('lang-specific');

      const contribution: LanguageContribution = {
        languageId: 'test-lang',
        fileExtensions: ['.tst'],
        generatedModule: {},
        glspProviders: {
          astToGModel: customAstToGModel,
        },
        disabledFeatures: [],
      };

      // Merge contribution providers with defaults
      const merged = merger.merge(
        defaultProviders as GlspFeatureProviders,
        contribution.glspProviders
      );

      expect(merged.providers.astToGModel).toBe(customAstToGModel);
      expect(merged.overriddenFeatures).toContain('astToGModel');
    });

    it('should support partial method overrides', () => {
      // Custom provider that only overrides getLabel
      const partialAstToGModel: Partial<AstToGModelProvider> = {
        getLabel: vi.fn().mockReturnValue('Custom Label'),
      };

      const deepMerger = GlspFeatureMerger.withDeepMerge();
      const result = deepMerger.mergeProviderMethods(
        defaultProviders.astToGModel as AstToGModelProvider,
        partialAstToGModel
      );

      expect(result.getLabel).toBe(partialAstToGModel.getLabel);
      expect(result.convert).toBe((defaultProviders.astToGModel as any).convert);
    });
  });

  describe('disabled GLSP features', () => {
    it('should disable specified GLSP features', () => {
      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        {},
        ['astToGModel', 'toolPalette']
      );

      expect(result.disabledFeatures).toContain('astToGModel');
      expect(result.disabledFeatures).toContain('toolPalette');
      expect(result.providers.astToGModel).toBeNull();
      expect(result.providers.toolPalette).toBeNull();
    });

    it('should handle glsp-prefixed feature names', () => {
      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        {},
        ['glsp.astToGModel', 'glsp.validation']
      );

      expect(result.disabledFeatures).toContain('astToGModel');
      expect(result.disabledFeatures).toContain('validation');
    });

    it('should correctly identify enabled GLSP features', () => {
      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        {},
        ['astToGModel']
      );

      expect(isGlspFeatureEnabled('astToGModel', result.providers)).toBe(false);
      expect(isGlspFeatureEnabled('toolPalette', result.providers)).toBe(true);
    });

    it('should safely retrieve GLSP providers', () => {
      const result = merger.merge(
        defaultProviders as GlspFeatureProviders,
        {},
        ['astToGModel']
      );

      expect(getGlspProvider('astToGModel', result.providers)).toBeUndefined();
      expect(getGlspProvider('toolPalette', result.providers)).toBe(defaultProviders.toolPalette);
    });
  });

  describe('provider resolution policies', () => {
    it('should prioritize custom over default (custom-wins policy)', () => {
      const customMerger = GlspFeatureMerger.customWins();
      const customAstToGModel = createMockAstToGModelProvider('custom wins');

      const result = customMerger.merge(
        defaultProviders as GlspFeatureProviders,
        { astToGModel: customAstToGModel }
      );

      expect(result.providers.astToGModel).toBe(customAstToGModel);
    });

    it('should prioritize default over custom (default-wins policy)', () => {
      const defaultMerger = GlspFeatureMerger.defaultWins();
      const customAstToGModel = createMockAstToGModelProvider('custom should lose');

      const result = defaultMerger.merge(
        defaultProviders as GlspFeatureProviders,
        { astToGModel: customAstToGModel }
      );

      expect(result.providers.astToGModel).toBe(defaultProviders.astToGModel);
      expect(result.warnings).toContain('Custom astToGModel ignored due to default-wins policy');
    });
  });
});

// Helper functions

function createMockAstToGModelProvider(prefix: string): AstToGModelProvider {
  return {
    convert: vi.fn().mockResolvedValue({
      id: `${prefix}-model`,
      type: 'graph',
      children: [],
    }),
    getLabel: vi.fn().mockReturnValue(`${prefix} label`),
    getPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getSize: vi.fn().mockReturnValue({ width: 100, height: 50 }),
  };
}

function createMockGModelToAstProvider(): GModelToAstProvider {
  return {
    applyChanges: vi.fn().mockResolvedValue({ success: true }),
    createNode: vi.fn().mockReturnValue({ id: 'new-node' }),
    createEdge: vi.fn().mockReturnValue({ id: 'new-edge' }),
  };
}

function createMockToolPaletteProvider(tools: Array<{ id: string; label: string }>): ToolPaletteProvider {
  return {
    getTools: vi.fn().mockResolvedValue({
      groups: [
        {
          id: 'default-group',
          label: 'Tools',
          tools: tools.map(t => ({
            id: t.id,
            label: t.label,
            icon: 'icon',
          })),
        },
      ],
    }),
  };
}

function createMockGlspContext(): GlspContext {
  return {
    uri: 'file:///test.tst',
    languageId: 'test-lang',
    modelState: {
      sourceModel: {},
      gModel: { id: 'root', type: 'graph', children: [] },
    },
    services: {} as any,
    cancellationToken: { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) },
  };
}
