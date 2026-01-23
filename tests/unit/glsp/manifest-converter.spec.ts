/**
 * ManifestDrivenGModelFactory Unit Tests (T089)
 *
 * Tests for the manifest-driven AST to GModel conversion.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GrammarManifest, LanguageContribution, DiagramNodeConfig, DiagramEdgeConfig } from '@sanyam/types';

// Import the module under test
import {
  ManifestDrivenGModelFactory,
  createManifestDrivenGModelFactory,
  type ConversionContext,
} from '../../../packages/language-server/src/glsp/manifest-converter';

describe('ManifestDrivenGModelFactory', () => {
  let factory: ManifestDrivenGModelFactory;

  beforeEach(() => {
    factory = createManifestDrivenGModelFactory();
  });

  describe('configure', () => {
    it('should configure the factory with a language contribution', () => {
      const contribution = createMockContribution();
      factory.configure(contribution);

      const types = factory.getConfiguredTypes();
      expect(types).toContain('ecml');
    });

    it('should handle contributions without manifest', () => {
      const contribution: LanguageContribution = {
        languageId: 'test',
        fileExtensions: ['.test'],
        generatedModule: {},
      };

      // Should not throw
      expect(() => factory.configure(contribution)).not.toThrow();
    });

    it('should handle multiple contributions', () => {
      const contribution1 = createMockContribution('lang1', '.l1');
      const contribution2 = createMockContribution('lang2', '.l2');

      factory.configure(contribution1);
      factory.configure(contribution2);

      const types = factory.getConfiguredTypes();
      expect(types).toContain('lang1');
      expect(types).toContain('lang2');
    });
  });

  describe('convert', () => {
    beforeEach(() => {
      factory.configure(createMockContribution());
    });

    it('should convert an empty AST to empty GModel', () => {
      const context = createMockContext({});

      const result = factory.convert(context);

      expect(result).toBeDefined();
      expect(result.id).toBe('root');
      expect(result.type).toBe('graph');
      expect(result.children).toEqual([]);
    });

    it('should convert AST nodes to GModel nodes', () => {
      const context = createMockContext({
        entities: [
          { $type: 'Entity', name: 'User', properties: [] },
          { $type: 'Entity', name: 'Order', properties: [] },
        ],
      });

      const result = factory.convert(context);

      expect(result.children).toHaveLength(2);
      expect(result.children[0].type).toContain('node');
      expect(result.children[1].type).toContain('node');
    });

    it('should use AST node name as element ID', () => {
      const context = createMockContext({
        entities: [{ $type: 'Entity', name: 'Customer', properties: [] }],
      });

      const result = factory.convert(context);

      expect(result.children[0].id).toBe('Customer');
    });

    it('should apply manifest node configuration', () => {
      const context = createMockContext({
        entities: [{ $type: 'Entity', name: 'Product', properties: [] }],
      });

      const result = factory.convert(context);

      // Node type should match manifest configuration
      expect(result.children[0].type).toBe('node:entity');
    });

    it('should create labels for nodes', () => {
      const context = createMockContext({
        entities: [
          { $type: 'Entity', name: 'Account', label: 'User Account', properties: [] },
        ],
      });

      const result = factory.convert(context);

      const node = result.children[0];
      const label = node.children?.find((c: any) => c.type.includes('label'));
      expect(label).toBeDefined();
    });

    it('should handle nested AST nodes', () => {
      const context = createMockContext({
        entities: [
          {
            $type: 'Entity',
            name: 'Person',
            properties: [
              { $type: 'Property', name: 'firstName', type: 'string' },
              { $type: 'Property', name: 'lastName', type: 'string' },
            ],
          },
        ],
      });

      const result = factory.convert(context);

      const entityNode = result.children[0];
      // Properties should be in a compartment
      const compartment = entityNode.children?.find((c: any) => c.type.includes('compartment'));
      expect(compartment).toBeDefined();
    });
  });

  describe('edge conversion', () => {
    beforeEach(() => {
      factory.configure(createMockContribution());
    });

    it('should convert references to edges', () => {
      const context = createMockContext({
        entities: [
          {
            $type: 'Entity',
            name: 'Order',
            properties: [
              { $type: 'Reference', name: 'customer', target: { $ref: 'Customer' } },
            ],
          },
          { $type: 'Entity', name: 'Customer', properties: [] },
        ],
      });

      const result = factory.convert(context);

      // Should have 2 nodes and 1 edge
      const nodes = result.children.filter((c: any) => c.type.includes('node'));
      const edges = result.children.filter((c: any) => c.type.includes('edge'));

      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(1);
    });

    it('should set edge source and target', () => {
      const context = createMockContext({
        entities: [
          {
            $type: 'Entity',
            name: 'Employee',
            properties: [
              { $type: 'Reference', name: 'department', target: { $ref: 'Department' } },
            ],
          },
          { $type: 'Entity', name: 'Department', properties: [] },
        ],
      });

      const result = factory.convert(context);

      const edge = result.children.find((c: any) => c.type.includes('edge'));
      expect(edge.sourceId).toBe('Employee');
      expect(edge.targetId).toBe('Department');
    });

    it('should apply manifest edge configuration', () => {
      const context = createMockContext({
        entities: [
          {
            $type: 'Entity',
            name: 'Parent',
            properties: [
              { $type: 'Inheritance', target: { $ref: 'Child' } },
            ],
          },
          { $type: 'Entity', name: 'Child', properties: [] },
        ],
      });

      const result = factory.convert(context);

      const edge = result.children.find((c: any) => c.type.includes('edge'));
      // Edge type should match manifest configuration
      expect(edge?.type).toBe('edge:inheritance');
    });
  });

  describe('position and size', () => {
    beforeEach(() => {
      factory.configure(createMockContribution());
    });

    it('should use positions from metadata', () => {
      const context = createMockContext(
        {
          entities: [{ $type: 'Entity', name: 'Widget', properties: [] }],
        },
        {
          positions: new Map([['Widget', { x: 100, y: 200 }]]),
        }
      );

      const result = factory.convert(context);

      expect(result.children[0].position).toEqual({ x: 100, y: 200 });
    });

    it('should use sizes from metadata', () => {
      const context = createMockContext(
        {
          entities: [{ $type: 'Entity', name: 'Component', properties: [] }],
        },
        {
          sizes: new Map([['Component', { width: 150, height: 80 }]]),
        }
      );

      const result = factory.convert(context);

      expect(result.children[0].size).toEqual({ width: 150, height: 80 });
    });

    it('should use default position when not in metadata', () => {
      const context = createMockContext({
        entities: [{ $type: 'Entity', name: 'Service', properties: [] }],
      });

      const result = factory.convert(context);

      expect(result.children[0].position).toBeDefined();
      expect(result.children[0].position.x).toBeGreaterThanOrEqual(0);
      expect(result.children[0].position.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('incremental updates', () => {
    beforeEach(() => {
      factory.configure(createMockContribution());
    });

    it('should preserve revision on update', () => {
      const context = createMockContext({
        entities: [{ $type: 'Entity', name: 'Model', properties: [] }],
      });

      const result1 = factory.convert(context);
      const revision1 = result1.revision ?? 0;

      // Simulate update
      context.gModel = result1;
      const result2 = factory.convert(context);

      expect(result2.revision).toBeGreaterThan(revision1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid AST gracefully', () => {
      factory.configure(createMockContribution());

      const context = createMockContext(null as any);

      // Should not throw
      const result = factory.convert(context);
      expect(result.children).toEqual([]);
    });

    it('should handle missing type information', () => {
      factory.configure(createMockContribution());

      const context = createMockContext({
        entities: [{ name: 'NoType', properties: [] }], // Missing $type
      });

      // Should not throw
      const result = factory.convert(context);
      expect(result).toBeDefined();
    });
  });
});

// Helper functions

function createMockContribution(
  languageId = 'ecml',
  extension = '.ecml'
): LanguageContribution {
  const manifest: GrammarManifest = {
    name: languageId,
    fileExtensions: [extension],
    diagram: {
      nodeTypes: {
        Entity: {
          type: 'node:entity',
          labelProperty: 'name',
          shape: 'rectangle',
          layout: { defaultWidth: 120, defaultHeight: 60 },
        } as DiagramNodeConfig,
      },
      edgeTypes: {
        Reference: {
          type: 'edge:reference',
          sourceProperty: '$container',
          targetProperty: 'target',
        } as DiagramEdgeConfig,
        Inheritance: {
          type: 'edge:inheritance',
          sourceProperty: '$container',
          targetProperty: 'target',
        } as DiagramEdgeConfig,
      },
    },
  };

  return {
    languageId,
    fileExtensions: [extension],
    manifest,
    generatedModule: {},
  };
}

function createMockContext(
  ast: any,
  metadata?: {
    positions?: Map<string, { x: number; y: number }>;
    sizes?: Map<string, { width: number; height: number }>;
  }
): ConversionContext {
  return {
    document: {
      parseResult: {
        value: ast ?? {},
      },
      uri: { toString: () => 'file:///test.ecml' },
      textDocument: {
        uri: 'file:///test.ecml',
        languageId: 'ecml',
        version: 1,
        getText: () => '',
      },
    } as any,
    services: {} as any,
    token: { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { } }) },
    options: {},
    metadata: {
      positions: metadata?.positions ?? new Map(),
      sizes: metadata?.sizes ?? new Map(),
      routingPoints: new Map(),
    },
  };
}
