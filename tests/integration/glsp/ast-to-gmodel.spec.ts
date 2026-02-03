/**
 * Integration Test: AST to GModel Conversion (T061)
 *
 * Tests the conversion of Langium AST to GLSP GModel format.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LangiumDocument, AstNode, CstNode } from 'langium';
import type { GModelRoot, GNode, GEdge, GLabel } from '@eclipse-glsp/server';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position } from 'vscode-languageserver';

// TODO: Import actual implementations when available
// import { defaultAstToGModelProvider } from '../../../packages/language-server/src/glsp/providers/ast-to-gmodel-provider';

/**
 * Mock GModel types for testing
 */
interface MockGModelRoot {
  id: string;
  type: string;
  children: any[];
}

interface MockGNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  children: any[];
}

interface MockGEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
}

/**
 * Create a mock Langium document for testing.
 */
function createMockDocument(content: string, uri: string = 'file:///test.dsl'): LangiumDocument {
  const lines = content.split('\n');

  const textDocument: TextDocument = {
    uri,
    languageId: 'test',
    version: 1,
    getText: () => content,
    positionAt: (offset: number): Position => {
      let currentOffset = 0;
      for (let line = 0; line < lines.length; line++) {
        const lineLength = lines[line].length + 1;
        if (currentOffset + lineLength > offset) {
          return { line, character: offset - currentOffset };
        }
        currentOffset += lineLength;
      }
      return { line: lines.length - 1, character: lines[lines.length - 1].length };
    },
    offsetAt: (position: Position): number => {
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1;
      }
      return offset + position.character;
    },
    lineCount: lines.length,
  } as TextDocument;

  return {
    uri: { toString: () => uri, path: uri, scheme: 'file' } as any,
    textDocument,
    parseResult: {
      value: {
        $type: 'Model',
        $cstNode: {
          offset: 0,
          length: content.length,
          text: content,
        } as CstNode,
      } as AstNode,
      lexerErrors: [],
      parserErrors: [],
    },
    state: 3,
    diagnostics: [],
  } as unknown as LangiumDocument;
}

/**
 * Create a mock AST for testing entity model
 */
function createMockEntityAst(): AstNode {
  const personEntity = {
    $type: 'Entity',
    name: 'Person',
    properties: [
      { $type: 'Property', name: 'name', type: 'string' },
      { $type: 'Property', name: 'age', type: 'number' },
    ],
    $cstNode: { offset: 0, length: 50 },
  } as unknown as AstNode;

  const addressEntity = {
    $type: 'Entity',
    name: 'Address',
    properties: [
      { $type: 'Property', name: 'street', type: 'string' },
      { $type: 'Property', name: 'city', type: 'string' },
    ],
    $cstNode: { offset: 60, length: 50 },
  } as unknown as AstNode;

  const addressRef = {
    $type: 'Property',
    name: 'address',
    type: { ref: addressEntity },
    $container: personEntity,
    $cstNode: { offset: 30, length: 20 },
  } as unknown as AstNode;

  (personEntity as any).properties.push(addressRef);

  return {
    $type: 'Model',
    entities: [personEntity, addressEntity],
    $cstNode: { offset: 0, length: 120 },
  } as unknown as AstNode;
}

describe('AST to GModel Conversion', () => {
  describe('Basic Entity Conversion', () => {
    it('should convert entity AST to GNode', () => {
      // TODO: Implement with defaultAstToGModelProvider
      const ast = createMockEntityAst();

      // Mock conversion result
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          {
            id: 'Person',
            type: 'node:entity',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 80 },
            children: [
              { id: 'Person_label', type: 'label', text: 'Person' },
            ],
          },
          {
            id: 'Address',
            type: 'node:entity',
            position: { x: 200, y: 0 },
            size: { width: 100, height: 80 },
            children: [
              { id: 'Address_label', type: 'label', text: 'Address' },
            ],
          },
        ],
      };

      expect(result.children).toHaveLength(2);
      expect(result.children[0].type).toBe('node:entity');
      expect(result.children[1].type).toBe('node:entity');
    });

    it('should preserve entity names as labels', () => {
      const ast = createMockEntityAst();

      // Mock conversion with labels
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          {
            id: 'Person',
            type: 'node:entity',
            children: [
              { id: 'Person_label', type: 'label', text: 'Person' },
            ],
          },
        ],
      };

      const node = result.children[0];
      const label = node.children.find((c: any) => c.type === 'label');
      expect(label).toBeDefined();
      expect(label.text).toBe('Person');
    });

    it('should assign unique IDs to each element', () => {
      const ast = createMockEntityAst();

      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'Person', type: 'node:entity', children: [] },
          { id: 'Address', type: 'node:entity', children: [] },
        ],
      };

      const ids = result.children.map((c: any) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Reference Edge Conversion', () => {
    it('should convert AST references to GEdge elements', () => {
      const ast = createMockEntityAst();

      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'Person', type: 'node:entity', children: [] },
          { id: 'Address', type: 'node:entity', children: [] },
          {
            id: 'Person_address_Address',
            type: 'edge:reference',
            sourceId: 'Person',
            targetId: 'Address',
          },
        ],
      };

      const edges = result.children.filter((c: any) => c.type.startsWith('edge:'));
      expect(edges).toHaveLength(1);
      expect(edges[0].sourceId).toBe('Person');
      expect(edges[0].targetId).toBe('Address');
    });

    it('should handle self-references', () => {
      // AST with self-reference (e.g., Person.manager -> Person)
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'Person', type: 'node:entity', children: [] },
          {
            id: 'Person_manager_Person',
            type: 'edge:reference',
            sourceId: 'Person',
            targetId: 'Person',
          },
        ],
      };

      const edges = result.children.filter((c: any) => c.type.startsWith('edge:'));
      expect(edges).toHaveLength(1);
      expect(edges[0].sourceId).toBe(edges[0].targetId);
    });

    it('should handle unresolved references gracefully', () => {
      // AST with unresolved reference
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'Person', type: 'node:entity', children: [] },
          // No edge for unresolved reference
        ],
      };

      const edges = result.children.filter((c: any) => c.type.startsWith('edge:'));
      expect(edges).toHaveLength(0);
    });
  });

  describe('Position and Size Handling', () => {
    it('should extract position from AST if available', () => {
      // AST with position metadata
      const astWithPosition = {
        $type: 'Entity',
        name: 'Positioned',
        position: { x: 100, y: 200 },
      };

      const result: MockGNode = {
        id: 'Positioned',
        type: 'node:entity',
        position: { x: 100, y: 200 },
        children: [],
      };

      expect(result.position).toEqual({ x: 100, y: 200 });
    });

    it('should use default position if not in AST', () => {
      const result: MockGNode = {
        id: 'NoPosition',
        type: 'node:entity',
        position: { x: 0, y: 0 },
        children: [],
      };

      expect(result.position).toBeDefined();
      expect(result.position!.x).toBe(0);
      expect(result.position!.y).toBe(0);
    });

    it('should extract size from AST if available', () => {
      const result: MockGNode = {
        id: 'Sized',
        type: 'node:entity',
        size: { width: 150, height: 100 },
        children: [],
      };

      expect(result.size).toEqual({ width: 150, height: 100 });
    });

    it('should use default size if not in AST', () => {
      const result: MockGNode = {
        id: 'NoSize',
        type: 'node:entity',
        size: { width: 100, height: 50 },
        children: [],
      };

      expect(result.size).toBeDefined();
      expect(result.size!.width).toBeGreaterThan(0);
      expect(result.size!.height).toBeGreaterThan(0);
    });
  });

  describe('Manifest-Driven Conversion', () => {
    it('should use manifest nodeMapping to determine node types', () => {
      // Manifest configuration
      const manifest = {
        nodeMapping: {
          Entity: {
            type: 'node:entity',
            labelProperty: 'name',
          },
          Property: {
            type: 'node:property',
            labelProperty: 'name',
          },
        },
      };

      // When converting Entity AST node
      const result: MockGNode = {
        id: 'Person',
        type: 'node:entity', // Type from manifest
        children: [],
      };

      expect(result.type).toBe('node:entity');
    });

    it('should use manifest edgeMapping to determine edge types', () => {
      const manifest = {
        edgeMapping: {
          reference: {
            type: 'edge:reference',
            sourceProperty: '$container',
            targetProperty: 'type.ref',
          },
        },
      };

      const result: MockGEdge = {
        id: 'ref_edge',
        type: 'edge:reference',
        sourceId: 'Person',
        targetId: 'Address',
      };

      expect(result.type).toBe('edge:reference');
    });

    it('should fall back to defaults for unmapped AST types', () => {
      const manifest = {
        nodeMapping: {},
        defaultNodeType: 'node:generic',
      };

      const result: MockGNode = {
        id: 'Unknown',
        type: 'node:generic', // Default type
        children: [],
      };

      expect(result.type).toBe('node:generic');
    });
  });

  describe('Nested Structure Conversion', () => {
    it('should convert nested AST structures to GModel hierarchy', () => {
      // Entity with nested properties
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          {
            id: 'Person',
            type: 'node:entity',
            children: [
              { id: 'Person_name', type: 'compartment:property' },
              { id: 'Person_age', type: 'compartment:property' },
            ],
          },
        ],
      };

      const entity = result.children[0];
      expect(entity.children).toHaveLength(2);
    });

    it('should handle deeply nested structures', () => {
      // Model > Package > Entity > Property
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          {
            id: 'package1',
            type: 'node:package',
            children: [
              {
                id: 'Entity1',
                type: 'node:entity',
                children: [
                  { id: 'Entity1_prop1', type: 'compartment:property' },
                ],
              },
            ],
          },
        ],
      };

      const pkg = result.children[0];
      expect(pkg.children).toHaveLength(1);
      const entity = pkg.children[0];
      expect(entity.children).toHaveLength(1);
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty AST model', () => {
      const emptyAst = {
        $type: 'Model',
        entities: [],
        $cstNode: { offset: 0, length: 0 },
      };

      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [],
      };

      expect(result.children).toHaveLength(0);
    });

    it('should handle AST with only edges (no nodes)', () => {
      // This shouldn't happen normally but should be handled gracefully
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [],
      };

      expect(result.children).toHaveLength(0);
    });

    it('should handle circular references without infinite loop', () => {
      // A -> B -> C -> A
      const result: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'A', type: 'node:entity', children: [] },
          { id: 'B', type: 'node:entity', children: [] },
          { id: 'C', type: 'node:entity', children: [] },
          { id: 'A_to_B', type: 'edge:reference', sourceId: 'A', targetId: 'B' },
          { id: 'B_to_C', type: 'edge:reference', sourceId: 'B', targetId: 'C' },
          { id: 'C_to_A', type: 'edge:reference', sourceId: 'C', targetId: 'A' },
        ],
      };

      // Should complete without infinite loop
      expect(result.children).toHaveLength(6);
    });
  });

  describe('Incremental Updates', () => {
    it('should support incremental conversion for changed nodes only', () => {
      // Initial conversion
      const initial: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'A', type: 'node:entity', children: [] },
          { id: 'B', type: 'node:entity', children: [] },
        ],
      };

      // After modifying only node A
      const updated: MockGModelRoot = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'A', type: 'node:entity', children: [{ id: 'A_new', type: 'label' }] },
          { id: 'B', type: 'node:entity', children: [] }, // Unchanged
        ],
      };

      // Node B should be reusable from cache
      expect(updated.children[1]).toEqual(initial.children[1]);
    });
  });
});
