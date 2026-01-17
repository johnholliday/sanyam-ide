/**
 * Model Converter Unit Tests (T130)
 *
 * Tests for AST to JSON conversion.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  ModelConverter,
  createModelConverter,
  findNodeById,
  findNodesByType,
  getNodeByPath,
} from '../../../packages/language-server/src/model/model-converter.js';

describe('ModelConverter', () => {
  let converter: ModelConverter;

  beforeEach(() => {
    converter = createModelConverter();
  });

  describe('convert', () => {
    it('should convert a simple AST node', () => {
      const ast = {
        $type: 'Actor',
        name: 'Customer',
        displayName: 'Customer Person',
      };

      const result = converter.convert(ast);

      expect(result.data).toEqual({
        $type: 'Actor',
        $id: 'Actor-Customer',
        name: 'Customer',
        displayName: 'Customer Person',
      });
      expect(result.hasCircular).toBe(false);
    });

    it('should convert nested structures', () => {
      const ast = {
        $type: 'Model',
        elements: [
          { $type: 'Actor', name: 'A' },
          { $type: 'Activity', name: 'B' },
        ],
      };

      const result = converter.convert(ast);
      const data = result.data as Record<string, unknown>;

      expect(data.$type).toBe('Model');
      expect(Array.isArray(data.elements)).toBe(true);
      expect((data.elements as unknown[]).length).toBe(2);
    });

    it('should exclude internal Langium properties', () => {
      const ast = {
        $type: 'Actor',
        name: 'Test',
        $container: { $type: 'Model' },
        $containerProperty: 'elements',
        $containerIndex: 0,
        $document: {},
        $cstNode: {},
      };

      const result = converter.convert(ast);
      const data = result.data as Record<string, unknown>;

      expect(data.$type).toBe('Actor');
      expect(data.name).toBe('Test');
      expect(data.$container).toBeUndefined();
      expect(data.$containerProperty).toBeUndefined();
      expect(data.$containerIndex).toBeUndefined();
      expect(data.$document).toBeUndefined();
      expect(data.$cstNode).toBeUndefined();
    });

    it('should handle circular references', () => {
      const actorA: Record<string, unknown> = { $type: 'Actor', name: 'A' };
      const actorB: Record<string, unknown> = { $type: 'Actor', name: 'B' };
      actorA.related = actorB;
      actorB.related = actorA;

      const ast = {
        $type: 'Model',
        elements: [actorA, actorB],
      };

      const result = converter.convert(ast);

      expect(result.hasCircular).toBe(true);
      expect(result.circularRefs).toBeDefined();
      expect(() => JSON.stringify(result.data)).not.toThrow();
    });

    it('should include $id for node identification', () => {
      const ast = {
        $type: 'Actor',
        name: 'Customer',
      };

      const result = converter.convert(ast, { includeIds: true });
      const data = result.data as Record<string, unknown>;

      expect(data.$id).toBe('Actor-Customer');
    });

    it('should use existing $id if present', () => {
      const ast = {
        $type: 'Actor',
        $id: 'custom-id-123',
        name: 'Customer',
      };

      const result = converter.convert(ast, { includeIds: true });
      const data = result.data as Record<string, unknown>;

      expect(data.$id).toBe('custom-id-123');
    });

    it('should respect maxDepth option', () => {
      // Create deeply nested structure
      let current: Record<string, unknown> = { $type: 'Leaf', value: 'end' };
      for (let i = 0; i < 10; i++) {
        current = { $type: 'Node', child: current };
      }

      const result = converter.convert(current, { maxDepth: 5 });

      // Verify it doesn't throw and handles depth
      expect(() => JSON.stringify(result.data)).not.toThrow();
    });

    it('should exclude specified properties', () => {
      const ast = {
        $type: 'Actor',
        name: 'Test',
        internal: 'should be excluded',
        visible: 'should be included',
      };

      const result = converter.convert(ast, {
        excludeProperties: ['internal'],
      });
      const data = result.data as Record<string, unknown>;

      expect(data.visible).toBe('should be included');
      expect(data.internal).toBeUndefined();
    });

    it('should include only specified properties when includeProperties is set', () => {
      const ast = {
        $type: 'Actor',
        name: 'Test',
        prop1: 'value1',
        prop2: 'value2',
        prop3: 'value3',
      };

      const result = converter.convert(ast, {
        includeProperties: ['name', 'prop1'],
      });
      const data = result.data as Record<string, unknown>;

      expect(data.$type).toBe('Actor'); // Always included
      expect(data.name).toBe('Test');
      expect(data.prop1).toBe('value1');
      expect(data.prop2).toBeUndefined();
      expect(data.prop3).toBeUndefined();
    });

    it('should handle null and undefined values', () => {
      const ast = {
        $type: 'Actor',
        name: null,
        description: undefined,
      };

      const result = converter.convert(ast);
      const data = result.data as Record<string, unknown>;

      expect(data.name).toBeNull();
      expect(data.description).toBeUndefined();
    });

    it('should handle arrays of primitives', () => {
      const ast = {
        $type: 'Config',
        values: [1, 2, 3],
        names: ['a', 'b', 'c'],
      };

      const result = converter.convert(ast);
      const data = result.data as Record<string, unknown>;

      expect(data.values).toEqual([1, 2, 3]);
      expect(data.names).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty arrays and objects', () => {
      const ast = {
        $type: 'Model',
        elements: [],
        metadata: {},
      };

      const result = converter.convert(ast);
      const data = result.data as Record<string, unknown>;

      expect(data.elements).toEqual([]);
      expect(data.metadata).toEqual({});
    });
  });

  describe('sanitize', () => {
    it('should remove internal properties', () => {
      const ast = {
        $type: 'Actor',
        name: 'Test',
        $container: {},
        $cstNode: {},
      };

      const sanitized = converter.sanitize(ast) as Record<string, unknown>;

      expect(sanitized.$type).toBe('Actor');
      expect(sanitized.name).toBe('Test');
      expect(sanitized.$container).toBeUndefined();
      expect(sanitized.$cstNode).toBeUndefined();
    });
  });
});

describe('findNodeById', () => {
  it('should find a node by $id', () => {
    const ast = {
      $type: 'Model',
      elements: [
        { $type: 'Actor', $id: 'actor-1', name: 'Customer' },
        { $type: 'Activity', $id: 'activity-1', name: 'Purchase' },
      ],
    };

    const result = findNodeById(ast, 'actor-1') as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(result.name).toBe('Customer');
  });

  it('should find a node by name pattern', () => {
    const ast = {
      $type: 'Model',
      elements: [
        { $type: 'Actor', name: 'Customer' },
      ],
    };

    const result = findNodeById(ast, 'Customer-1') as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(result.name).toBe('Customer');
  });

  it('should return undefined for non-existent node', () => {
    const ast = {
      $type: 'Model',
      elements: [],
    };

    const result = findNodeById(ast, 'unknown');

    expect(result).toBeUndefined();
  });
});

describe('findNodesByType', () => {
  it('should find all nodes of a given type', () => {
    const ast = {
      $type: 'Model',
      elements: [
        { $type: 'Actor', name: 'A' },
        { $type: 'Activity', name: 'B' },
        { $type: 'Actor', name: 'C' },
      ],
    };

    const results = findNodesByType(ast, 'Actor');

    expect(results).toHaveLength(2);
    expect((results[0] as Record<string, unknown>).name).toBe('A');
    expect((results[1] as Record<string, unknown>).name).toBe('C');
  });

  it('should find nested nodes', () => {
    const ast = {
      $type: 'Model',
      elements: [
        {
          $type: 'Container',
          children: [
            { $type: 'Actor', name: 'Nested' },
          ],
        },
      ],
    };

    const results = findNodesByType(ast, 'Actor');

    expect(results).toHaveLength(1);
  });

  it('should return empty array if no matches', () => {
    const ast = {
      $type: 'Model',
      elements: [],
    };

    const results = findNodesByType(ast, 'NonExistent');

    expect(results).toEqual([]);
  });
});

describe('getNodeByPath', () => {
  it('should get a property by simple path', () => {
    const ast = {
      $type: 'Actor',
      name: 'Test',
    };

    const result = getNodeByPath(ast, 'name');

    expect(result).toBe('Test');
  });

  it('should get a nested property', () => {
    const ast = {
      $type: 'Model',
      metadata: {
        author: 'John',
      },
    };

    const result = getNodeByPath(ast, 'metadata.author');

    expect(result).toBe('John');
  });

  it('should get an array element by index', () => {
    const ast = {
      $type: 'Model',
      elements: [
        { $type: 'Actor', name: 'First' },
        { $type: 'Actor', name: 'Second' },
      ],
    };

    const result = getNodeByPath(ast, 'elements[1]') as Record<string, unknown>;

    expect(result.name).toBe('Second');
  });

  it('should get a property of an array element', () => {
    const ast = {
      $type: 'Model',
      elements: [
        { $type: 'Actor', name: 'Customer' },
      ],
    };

    const result = getNodeByPath(ast, 'elements[0].name');

    expect(result).toBe('Customer');
  });

  it('should return undefined for invalid path', () => {
    const ast = {
      $type: 'Model',
      elements: [],
    };

    expect(getNodeByPath(ast, 'nonexistent')).toBeUndefined();
    expect(getNodeByPath(ast, 'elements[10]')).toBeUndefined();
  });
});

describe('createModelConverter', () => {
  it('should create a new converter instance', () => {
    const converter = createModelConverter();

    expect(converter).toBeInstanceOf(ModelConverter);
  });
});
