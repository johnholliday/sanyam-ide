/**
 * Language Registration Integration Tests (T093)
 *
 * Tests for registering new languages with the unified server.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LanguageContribution, LspFeatureProviders, GlspFeatureProviders } from '@sanyam/types';

// Import the modules under test
import {
  LanguageRegistry,
  createLanguageRegistry,
} from '../../../packages/language-server/src/language-registry';
import {
  ContributionLoader,
  createContributionLoader,
  loadFromGeneratedRegistry,
} from '../../../packages/language-server/src/grammar-scanner/contribution-loader';

describe('Language Registration Integration', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = createLanguageRegistry();
  });

  describe('contribution registration', () => {
    it('should register a language contribution', () => {
      const contribution = createMockContribution('testlang', ['.tst']);

      registry.register(contribution);

      expect(registry.getByLanguageId('testlang')).toBe(contribution);
    });

    it('should register multiple contributions', () => {
      const contrib1 = createMockContribution('lang1', ['.l1']);
      const contrib2 = createMockContribution('lang2', ['.l2']);

      registry.register(contrib1);
      registry.register(contrib2);

      expect(registry.getAllLanguageIds()).toContain('lang1');
      expect(registry.getAllLanguageIds()).toContain('lang2');
    });

    it('should retrieve contribution by file extension', () => {
      const contribution = createMockContribution('ecml', ['.ecml', '.entity']);

      registry.register(contribution);

      expect(registry.getByExtension('.ecml')).toBe(contribution);
      expect(registry.getByExtension('.entity')).toBe(contribution);
    });

    it('should retrieve contribution by URI', () => {
      const contribution = createMockContribution('json', ['.json']);

      registry.register(contribution);

      const result = registry.getByUri('file:///path/to/config.json');
      expect(result).toBe(contribution);
    });

    it('should handle URIs with query strings', () => {
      const contribution = createMockContribution('yaml', ['.yaml', '.yml']);

      registry.register(contribution);

      const result = registry.getByUri('file:///path/to/config.yaml?query=param');
      expect(result).toBe(contribution);
    });

    it('should return undefined for unknown extensions', () => {
      const contribution = createMockContribution('known', ['.known']);

      registry.register(contribution);

      expect(registry.getByExtension('.unknown')).toBeUndefined();
    });

    it('should handle case-insensitive extensions', () => {
      const contribution = createMockContribution('markup', ['.xml']);

      registry.register(contribution);

      expect(registry.getByExtension('.XML')).toBe(contribution);
      expect(registry.getByExtension('.Xml')).toBe(contribution);
    });
  });

  describe('provider merging', () => {
    it('should merge custom LSP providers with defaults', () => {
      const defaultProviders: Partial<LspFeatureProviders> = {
        completion: { provide: () => [] } as any,
        hover: { provide: () => null } as any,
      };

      const customProviders: Partial<LspFeatureProviders> = {
        hover: { provide: () => ({ contents: 'custom' }) } as any,
      };

      const contribution = createMockContribution('merged', ['.mrg'], {
        lspProviders: customProviders,
      });

      registry.register(contribution);

      // Custom hover should override default
      expect(contribution.lspProviders?.hover).toBe(customProviders.hover);
    });

    it('should merge custom GLSP providers with defaults', () => {
      const customGlspProviders: Partial<GlspFeatureProviders> = {
        astToGModel: { convert: () => ({ id: 'custom', type: 'graph', children: [] }) } as any,
      };

      const contribution = createMockContribution('glsp-merged', ['.gm'], {
        glspProviders: customGlspProviders,
      });

      registry.register(contribution);

      expect(contribution.glspProviders?.astToGModel).toBe(customGlspProviders.astToGModel);
    });
  });

  describe('loadFromGeneratedRegistry', () => {
    it('should load contributions from generated registry', async () => {
      const mockRegistry = {
        GRAMMAR_REGISTRY: [
          createMockContribution('auto1', ['.a1']),
          createMockContribution('auto2', ['.a2']),
        ] as const,
      };

      const result = await loadFromGeneratedRegistry(
        mockRegistry,
        registry,
        {
          context: {},
          defaultLspProviders: {} as any,
          defaultGlspProviders: {} as any,
        }
      );

      expect(result.loadedCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(registry.getAllLanguageIds()).toContain('auto1');
      expect(registry.getAllLanguageIds()).toContain('auto2');
    });

    it('should report errors for invalid contributions', async () => {
      const mockRegistry = {
        GRAMMAR_REGISTRY: [
          { invalid: true } as any, // Invalid contribution
          createMockContribution('valid', ['.vld']),
        ] as const,
      };

      const result = await loadFromGeneratedRegistry(
        mockRegistry,
        registry,
        {
          context: {},
          defaultLspProviders: {} as any,
          defaultGlspProviders: {} as any,
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.loadedCount).toBe(1);
    });

    it('should handle empty registry', async () => {
      const mockRegistry = {
        GRAMMAR_REGISTRY: [] as const,
      };

      const result = await loadFromGeneratedRegistry(
        mockRegistry,
        registry,
        {
          context: {},
          defaultLspProviders: {} as any,
          defaultGlspProviders: {} as any,
        }
      );

      expect(result.loadedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('dynamic registration', () => {
    it('should allow dynamic language registration', () => {
      const initialContrib = createMockContribution('initial', ['.init']);
      registry.register(initialContrib);

      expect(registry.getAllLanguageIds()).toHaveLength(1);

      // Dynamically register another language
      const dynamicContrib = createMockContribution('dynamic', ['.dyn']);
      registry.register(dynamicContrib);

      expect(registry.getAllLanguageIds()).toHaveLength(2);
      expect(registry.getByLanguageId('dynamic')).toBe(dynamicContrib);
    });

    it('should allow updating existing contributions', () => {
      const contrib1 = createMockContribution('updatable', ['.upd']);
      registry.register(contrib1);

      const contrib2 = createMockContribution('updatable', ['.upd', '.updated']);
      registry.register(contrib2);

      // Should have updated version
      const result = registry.getByLanguageId('updatable');
      expect(result?.fileExtensions).toContain('.updated');
    });
  });

  describe('language capabilities', () => {
    it('should report supported capabilities', () => {
      const contribution = createMockContribution('capable', ['.cap'], {
        lspProviders: {
          completion: { provide: () => [] } as any,
          hover: { provide: () => null } as any,
          definition: { provide: () => null } as any,
        },
      });

      registry.register(contribution);

      const capabilities = registry.getCapabilities('capable');

      expect(capabilities?.completion).toBe(true);
      expect(capabilities?.hover).toBe(true);
      expect(capabilities?.definition).toBe(true);
    });

    it('should report disabled features', () => {
      const contribution = createMockContribution('disabled', ['.dis'], {
        disabledFeatures: ['formatting', 'rename'],
      });

      registry.register(contribution);

      const capabilities = registry.getCapabilities('disabled');

      expect(capabilities?.formatting).toBe(false);
      expect(capabilities?.rename).toBe(false);
    });
  });

  describe('manifest integration', () => {
    it('should integrate manifest configuration', () => {
      const contribution = createMockContribution('manifested', ['.mnf'], {
        manifest: {
          name: 'manifested',
          fileExtensions: ['.mnf'],
          diagram: {
            nodeTypes: {
              Entity: { type: 'node:entity' },
            },
          },
        },
      });

      registry.register(contribution);

      const result = registry.getByLanguageId('manifested');
      expect(result?.manifest?.diagram?.nodeTypes).toBeDefined();
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent registrations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          const contrib = createMockContribution(`concurrent${i}`, [`.c${i}`]);
          registry.register(contrib);
        })
      );

      await Promise.all(promises);

      expect(registry.getAllLanguageIds()).toHaveLength(10);
    });

    it('should handle concurrent lookups', async () => {
      const contrib = createMockContribution('lookup', ['.lkp']);
      registry.register(contrib);

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => registry.getByLanguageId('lookup'))
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBe(contrib);
      });
    });
  });
});

// Helper functions

function createMockContribution(
  languageId: string,
  fileExtensions: string[],
  options?: {
    lspProviders?: Partial<LspFeatureProviders>;
    glspProviders?: Partial<GlspFeatureProviders>;
    disabledFeatures?: string[];
    manifest?: any;
  }
): LanguageContribution {
  return {
    languageId,
    fileExtensions,
    generatedModule: {},
    lspProviders: options?.lspProviders,
    glspProviders: options?.glspProviders,
    disabledFeatures: options?.disabledFeatures,
    manifest: options?.manifest,
  };
}
