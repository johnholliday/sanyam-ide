/**
 * LangiumModelState Unit Tests (T090)
 *
 * Tests for the Langium model state wrapper.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the module under test
import {
  LangiumModelState,
  createLangiumModelState,
} from '../../../packages/sanyam-lsp/src/glsp/langium-model-state';

describe('LangiumModelState', () => {
  let modelState: LangiumModelState;
  let mockDocument: any;

  beforeEach(() => {
    mockDocument = createMockDocument();
    modelState = createLangiumModelState(mockDocument);
  });

  describe('creation', () => {
    it('should create a model state from a Langium document', () => {
      expect(modelState).toBeDefined();
      expect(modelState.getDocument()).toBe(mockDocument);
    });

    it('should generate a unique ID', () => {
      const modelState2 = createLangiumModelState(createMockDocument('file:///other.ecml'));
      expect(modelState.getId()).not.toBe(modelState2.getId());
    });

    it('should use document URI as ID basis', () => {
      expect(modelState.getId()).toContain('test.ecml');
    });
  });

  describe('document access', () => {
    it('should return the wrapped document', () => {
      const doc = modelState.getDocument();
      expect(doc).toBe(mockDocument);
    });

    it('should return document URI', () => {
      expect(modelState.getUri()).toBe('file:///test.ecml');
    });

    it('should return language ID', () => {
      expect(modelState.getLanguageId()).toBe('ecml');
    });

    it('should return document version', () => {
      expect(modelState.getVersion()).toBe(1);
    });
  });

  describe('AST access', () => {
    it('should return the AST root', () => {
      const ast = modelState.getAst();
      expect(ast).toEqual(mockDocument.parseResult.value);
    });

    it('should handle null AST', () => {
      const emptyDoc = createMockDocument('file:///empty.ecml', null);
      const emptyState = createLangiumModelState(emptyDoc);
      expect(emptyState.getAst()).toBeNull();
    });
  });

  describe('element mappings', () => {
    it('should allow registering element mappings', () => {
      const astNode = { $type: 'Entity', name: 'User' };
      modelState.registerElement('user_node', astNode);

      expect(modelState.getAstNodeForElement('user_node')).toBe(astNode);
    });

    it('should allow registering reverse mappings', () => {
      const astNode = { $type: 'Entity', name: 'Order' };
      modelState.registerElement('order_node', astNode);

      expect(modelState.getElementIdForAstNode(astNode)).toBe('order_node');
    });

    it('should return undefined for unknown element', () => {
      expect(modelState.getAstNodeForElement('unknown')).toBeUndefined();
    });

    it('should return undefined for unmapped AST node', () => {
      const unmappedNode = { $type: 'Entity', name: 'Unmapped' };
      expect(modelState.getElementIdForAstNode(unmappedNode)).toBeUndefined();
    });

    it('should allow unregistering elements', () => {
      const astNode = { $type: 'Entity', name: 'Temp' };
      modelState.registerElement('temp_node', astNode);
      modelState.unregisterElement('temp_node');

      expect(modelState.getAstNodeForElement('temp_node')).toBeUndefined();
      expect(modelState.getElementIdForAstNode(astNode)).toBeUndefined();
    });

    it('should clear all mappings', () => {
      modelState.registerElement('node1', { $type: 'Entity', name: 'E1' });
      modelState.registerElement('node2', { $type: 'Entity', name: 'E2' });

      modelState.clearMappings();

      expect(modelState.getAstNodeForElement('node1')).toBeUndefined();
      expect(modelState.getAstNodeForElement('node2')).toBeUndefined();
    });
  });

  describe('dirty state', () => {
    it('should start as not dirty', () => {
      expect(modelState.isDirty()).toBe(false);
    });

    it('should become dirty when marked', () => {
      modelState.markDirty();
      expect(modelState.isDirty()).toBe(true);
    });

    it('should become clean when marked clean', () => {
      modelState.markDirty();
      modelState.markClean();
      expect(modelState.isDirty()).toBe(false);
    });
  });

  describe('version tracking', () => {
    it('should track document version', () => {
      expect(modelState.getVersion()).toBe(1);
    });

    it('should detect version changes', () => {
      const originalVersion = modelState.getVersion();
      mockDocument.textDocument.version = 2;

      expect(modelState.hasVersionChanged(originalVersion)).toBe(true);
    });

    it('should not detect change for same version', () => {
      const currentVersion = modelState.getVersion();
      expect(modelState.hasVersionChanged(currentVersion)).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should allow setting metadata', () => {
      modelState.setMetadata('custom', 'value');
      expect(modelState.getMetadata('custom')).toBe('value');
    });

    it('should return undefined for unknown metadata', () => {
      expect(modelState.getMetadata('unknown')).toBeUndefined();
    });

    it('should allow removing metadata', () => {
      modelState.setMetadata('temp', 123);
      modelState.removeMetadata('temp');
      expect(modelState.getMetadata('temp')).toBeUndefined();
    });

    it('should allow checking metadata existence', () => {
      modelState.setMetadata('exists', true);
      expect(modelState.hasMetadata('exists')).toBe(true);
      expect(modelState.hasMetadata('notexists')).toBe(false);
    });
  });

  describe('change tracking', () => {
    it('should emit change events', () => {
      const listener = vi.fn();
      modelState.onChanged(listener);

      modelState.notifyChange();

      expect(listener).toHaveBeenCalled();
    });

    it('should include change type in event', () => {
      const listener = vi.fn();
      modelState.onChanged(listener);

      modelState.notifyChange('ast');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        changeType: 'ast',
      }));
    });

    it('should allow unsubscribing from changes', () => {
      const listener = vi.fn();
      const disposable = modelState.onChanged(listener);

      disposable.dispose();
      modelState.notifyChange();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('GModel integration', () => {
    it('should store and retrieve GModel', () => {
      const gModel = { id: 'root', type: 'graph', children: [] };
      modelState.setGModel(gModel);

      expect(modelState.getGModel()).toBe(gModel);
    });

    it('should return undefined if no GModel set', () => {
      expect(modelState.getGModel()).toBeUndefined();
    });

    it('should emit change on GModel update', () => {
      const listener = vi.fn();
      modelState.onChanged(listener);

      modelState.setGModel({ id: 'root', type: 'graph', children: [] });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        changeType: 'gmodel',
      }));
    });
  });

  describe('selection state', () => {
    it('should track selected elements', () => {
      modelState.setSelection(['node1', 'node2']);
      expect(modelState.getSelection()).toEqual(['node1', 'node2']);
    });

    it('should start with empty selection', () => {
      expect(modelState.getSelection()).toEqual([]);
    });

    it('should emit change on selection update', () => {
      const listener = vi.fn();
      modelState.onChanged(listener);

      modelState.setSelection(['node1']);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        changeType: 'selection',
      }));
    });

    it('should allow clearing selection', () => {
      modelState.setSelection(['node1', 'node2']);
      modelState.clearSelection();
      expect(modelState.getSelection()).toEqual([]);
    });
  });

  describe('disposal', () => {
    it('should dispose without errors', () => {
      expect(() => modelState.dispose()).not.toThrow();
    });

    it('should clear state on disposal', () => {
      modelState.registerElement('node', { $type: 'Entity', name: 'E' });
      modelState.setMetadata('key', 'value');

      modelState.dispose();

      expect(modelState.getAstNodeForElement('node')).toBeUndefined();
    });

    it('should not emit events after disposal', () => {
      const listener = vi.fn();
      modelState.onChanged(listener);

      modelState.dispose();
      modelState.notifyChange();

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// Helper functions

function createMockDocument(uri = 'file:///test.ecml', ast: any = {}): any {
  return {
    uri: {
      toString: () => uri,
      path: uri.replace('file://', ''),
    },
    textDocument: {
      uri,
      languageId: 'ecml',
      version: 1,
      getText: () => 'entity User {}',
    },
    parseResult: {
      value: ast ?? { entities: [] },
      parserErrors: [],
      lexerErrors: [],
    },
    state: 2, // DocumentState.Validated
  };
}
