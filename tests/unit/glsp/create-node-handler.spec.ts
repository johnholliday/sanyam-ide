/**
 * CreateNodeHandler Unit Tests (T091)
 *
 * Tests for the create node operation handler.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GlspContext } from '@sanyam/types';

// Import the module under test
import {
  createNodeHandler,
  createCreateNodeHandler,
  type CreateNodeOperation,
  type CreateNodeResult,
} from '../../../packages/sanyam-lsp/src/glsp/handlers/create-node-handler';

describe('CreateNodeHandler', () => {
  let context: GlspContext;
  let operation: CreateNodeOperation;

  beforeEach(() => {
    context = createMockContext();
    operation = {
      kind: 'createNode',
      elementTypeId: 'node:entity',
      location: { x: 100, y: 200 },
    };
  });

  describe('canExecute', () => {
    it('should return true for valid operation', () => {
      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(true);
    });

    it('should return false for unsupported element type', () => {
      operation.elementTypeId = 'unknown:type';
      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(false);
    });

    it('should return false without location', () => {
      operation.location = undefined;
      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(false);
    });

    it('should return true for element type from manifest', () => {
      // Add custom type via manifest
      (context as any).manifest = {
        diagram: {
          nodeTypes: {
            CustomNode: {
              type: 'node:custom',
            },
          },
        },
      };
      operation.elementTypeId = 'node:custom';

      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(true);
    });

    it('should validate container if specified', () => {
      operation.containerId = 'nonexistent';
      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(false);
    });

    it('should accept valid container', () => {
      // Add a valid container to context
      context.gModel = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'container1', type: 'node:container', children: [] },
        ],
      };
      operation.containerId = 'container1';

      const result = createNodeHandler.canExecute(context, operation);
      expect(result).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create a node successfully', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(result.success).toBe(true);
      expect(result.nodeId).toBeDefined();
      expect(result.node).toBeDefined();
    });

    it('should return the created node in result', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(result.node?.type).toBe('node:entity');
      expect(result.node?.position).toEqual({ x: 100, y: 200 });
    });

    it('should add node to GModel children', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(context.gModel?.children).toContainEqual(
        expect.objectContaining({ id: result.nodeId })
      );
    });

    it('should generate unique node ID', () => {
      const result1 = createNodeHandler.execute(context, operation);
      const result2 = createNodeHandler.execute(context, operation);

      expect(result1.nodeId).not.toBe(result2.nodeId);
    });

    it('should use provided node name in ID', () => {
      operation.args = { name: 'Customer' };
      const result = createNodeHandler.execute(context, operation);

      expect(result.nodeId).toContain('Customer');
    });

    it('should set default size for new node', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(result.node?.size).toBeDefined();
      expect(result.node?.size?.width).toBeGreaterThan(0);
      expect(result.node?.size?.height).toBeGreaterThan(0);
    });

    it('should create node with label if name provided', () => {
      operation.args = { name: 'Product' };
      const result = createNodeHandler.execute(context, operation);

      const labelChild = result.node?.children?.find((c: any) => c.type.includes('label'));
      expect(labelChild).toBeDefined();
    });

    it('should create node in container if specified', () => {
      context.gModel = {
        id: 'root',
        type: 'graph',
        children: [
          { id: 'container1', type: 'node:container', children: [] },
        ],
      };
      operation.containerId = 'container1';

      const result = createNodeHandler.execute(context, operation);

      const container = context.gModel.children.find((c: any) => c.id === 'container1');
      expect(container?.children).toContainEqual(
        expect.objectContaining({ id: result.nodeId })
      );
    });

    it('should increment model revision', () => {
      const initialRevision = context.gModel?.revision ?? 0;
      createNodeHandler.execute(context, operation);

      expect(context.gModel?.revision).toBe(initialRevision + 1);
    });

    it('should return text edits for AST modification', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(result.textEdits).toBeDefined();
      expect(Array.isArray(result.textEdits)).toBe(true);
    });

    it('should fail for unsupported element type', () => {
      operation.elementTypeId = 'unknown:type';
      const result = createNodeHandler.execute(context, operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should store position in metadata', () => {
      const result = createNodeHandler.execute(context, operation);

      expect(context.metadata?.positions?.get(result.nodeId!)).toEqual({ x: 100, y: 200 });
    });
  });

  describe('undo', () => {
    it('should undo node creation', () => {
      const createResult = createNodeHandler.execute(context, operation);
      expect(createResult.success).toBe(true);

      const undoResult = createNodeHandler.undo(context, createResult);

      expect(undoResult).toBe(true);
      expect(context.gModel?.children.find((c: any) => c.id === createResult.nodeId)).toBeUndefined();
    });

    it('should return false for failed creation result', () => {
      const failedResult: CreateNodeResult = {
        success: false,
        error: 'Failed',
      };

      const undoResult = createNodeHandler.undo(context, failedResult);
      expect(undoResult).toBe(false);
    });

    it('should return false if node not found', () => {
      const result: CreateNodeResult = {
        success: true,
        nodeId: 'nonexistent',
      };

      const undoResult = createNodeHandler.undo(context, result);
      expect(undoResult).toBe(false);
    });

    it('should remove position from metadata on undo', () => {
      const createResult = createNodeHandler.execute(context, operation);
      createNodeHandler.undo(context, createResult);

      expect(context.metadata?.positions?.has(createResult.nodeId!)).toBe(false);
    });

    it('should increment revision on undo', () => {
      const createResult = createNodeHandler.execute(context, operation);
      const revisionAfterCreate = context.gModel?.revision ?? 0;

      createNodeHandler.undo(context, createResult);

      expect(context.gModel?.revision).toBe(revisionAfterCreate + 1);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return default supported types', () => {
      const types = createNodeHandler.getSupportedTypes(context);

      expect(types).toContain('node:entity');
      expect(types).toContain('node:class');
      expect(types).toContain('node:interface');
    });

    it('should include types from manifest', () => {
      (context as any).manifest = {
        diagram: {
          nodeTypes: {
            Service: { type: 'node:service' },
            Component: { type: 'node:component' },
          },
        },
      };

      const types = createNodeHandler.getSupportedTypes(context);

      expect(types).toContain('node:service');
      expect(types).toContain('node:component');
    });
  });

  describe('createCreateNodeHandler', () => {
    it('should create a custom handler', () => {
      const customHandler = createCreateNodeHandler({
        canExecute: () => false,
      });

      expect(customHandler.canExecute(context, operation)).toBe(false);
    });

    it('should preserve default methods when not overridden', () => {
      const customHandler = createCreateNodeHandler({
        getSupportedTypes: () => ['custom:type'],
      });

      // Execute should still work
      const result = customHandler.execute(context, operation);
      expect(result).toBeDefined();
    });

    it('should allow custom execute implementation', () => {
      const customResult: CreateNodeResult = {
        success: true,
        nodeId: 'custom-id',
      };

      const customHandler = createCreateNodeHandler({
        execute: () => customResult,
      });

      const result = customHandler.execute(context, operation);
      expect(result.nodeId).toBe('custom-id');
    });
  });

  describe('edge cases', () => {
    it('should handle operation at origin', () => {
      operation.location = { x: 0, y: 0 };
      const result = createNodeHandler.execute(context, operation);

      expect(result.success).toBe(true);
      expect(result.node?.position).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative coordinates', () => {
      operation.location = { x: -50, y: -100 };
      const result = createNodeHandler.execute(context, operation);

      // Should normalize to non-negative
      expect(result.success).toBe(true);
      expect(result.node?.position?.x).toBeGreaterThanOrEqual(0);
      expect(result.node?.position?.y).toBeGreaterThanOrEqual(0);
    });

    it('should handle operation with empty args', () => {
      operation.args = {};
      const result = createNodeHandler.execute(context, operation);

      expect(result.success).toBe(true);
    });

    it('should handle null GModel', () => {
      context.gModel = undefined;
      const result = createNodeHandler.execute(context, operation);

      expect(result.success).toBe(true);
      expect(context.gModel).toBeDefined();
    });
  });
});

// Helper functions

function createMockContext(): GlspContext {
  return {
    document: {
      uri: { toString: () => 'file:///test.ecml' },
      textDocument: {
        uri: 'file:///test.ecml',
        languageId: 'ecml',
        version: 1,
        getText: () => '',
      },
      parseResult: {
        value: { entities: [] },
      },
    } as any,
    services: {} as any,
    token: {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose: () => {} }),
    },
    options: {},
    gModel: {
      id: 'root',
      type: 'graph',
      children: [],
      revision: 0,
    },
    metadata: {
      positions: new Map(),
      sizes: new Map(),
      routingPoints: new Map(),
    },
  };
}
