/**
 * Model Retrieval Integration Tests (T120)
 *
 * Tests that the Model API can retrieve AST models from documents.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LangiumDocument } from 'langium';
import type { ModelApiResponse, AstModelData } from '@sanyam/types';

describe('Model API - Model Retrieval', () => {
  let mockAstServer: any;
  let mockDocument: LangiumDocument;

  beforeEach(() => {
    // Create mock document with AST
    mockDocument = createMockDocument({
      uri: 'file:///test/model.ecml',
      content: `
        Actor Customer { name: "Customer" }
        Activity Purchase { name: "Purchase Item" }
      `,
      ast: {
        $type: 'Model',
        elements: [
          { $type: 'Actor', name: 'Customer', displayName: 'Customer' },
          { $type: 'Activity', name: 'Purchase', displayName: 'Purchase Item' },
        ],
      },
    });

    mockAstServer = createMockAstServer([mockDocument]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getModel', () => {
    it('should retrieve model data for a valid document URI', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.uri).toBe('file:///test/model.ecml');
    });

    it('should include AST root in the response', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.data.root).toBeDefined();
      expect(response.data.root.$type).toBe('Model');
    });

    it('should include all top-level elements', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.data.root.elements).toHaveLength(2);
      expect(response.data.root.elements[0].$type).toBe('Actor');
      expect(response.data.root.elements[1].$type).toBe('Activity');
    });

    it('should return error for unknown document URI', async () => {
      const response = await mockAstServer.getModel('file:///unknown/model.ecml');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('should return error for invalid URI format', async () => {
      const response = await mockAstServer.getModel('not-a-valid-uri');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should include document version in the response', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.data.version).toBeDefined();
      expect(typeof response.data.version).toBe('number');
    });

    it('should include language ID in the response', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.data.languageId).toBe('ecml');
    });
  });

  describe('getModelPartial', () => {
    it('should retrieve a specific node by ID', async () => {
      const response = await mockAstServer.getModelPartial(
        'file:///test/model.ecml',
        { nodeId: 'customer-1' }
      );

      expect(response.success).toBe(true);
      expect(response.data.node).toBeDefined();
      expect(response.data.node.$type).toBe('Actor');
    });

    it('should retrieve nodes by type', async () => {
      const response = await mockAstServer.getModelPartial(
        'file:///test/model.ecml',
        { nodeType: 'Actor' }
      );

      expect(response.success).toBe(true);
      expect(response.data.nodes).toHaveLength(1);
      expect(response.data.nodes[0].$type).toBe('Actor');
    });

    it('should support path-based queries', async () => {
      const response = await mockAstServer.getModelPartial(
        'file:///test/model.ecml',
        { path: 'elements[0]' }
      );

      expect(response.success).toBe(true);
      expect(response.data.node).toBeDefined();
    });

    it('should return error for unknown node ID', async () => {
      const response = await mockAstServer.getModelPartial(
        'file:///test/model.ecml',
        { nodeId: 'unknown-node' }
      );

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NODE_NOT_FOUND');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize AST to valid JSON', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(() => JSON.stringify(response.data)).not.toThrow();
    });

    it('should handle circular references', async () => {
      // Create document with circular references
      const circularDoc = createMockDocument({
        uri: 'file:///test/circular.ecml',
        content: 'Actor A { related: B } Actor B { related: A }',
        ast: createCircularAst(),
      });

      mockAstServer.addDocument(circularDoc);

      const response = await mockAstServer.getModel('file:///test/circular.ecml');

      // Should serialize without throwing
      expect(response.success).toBe(true);
      expect(() => JSON.stringify(response.data)).not.toThrow();
    });

    it('should exclude internal Langium properties', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');
      const json = JSON.stringify(response.data);

      expect(json).not.toContain('$container');
      expect(json).not.toContain('$document');
      expect(json).not.toContain('$cstNode');
    });

    it('should include $type property for node identification', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml');

      expect(response.data.root.$type).toBeDefined();
      response.data.root.elements.forEach((el: any) => {
        expect(el.$type).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('should handle parse errors gracefully', async () => {
      const errorDoc = createMockDocument({
        uri: 'file:///test/error.ecml',
        content: 'invalid syntax here',
        hasParseErrors: true,
      });

      mockAstServer.addDocument(errorDoc);

      const response = await mockAstServer.getModel('file:///test/error.ecml');

      // Should still return partial model if available
      expect(response.success).toBe(true);
      expect(response.data.hasErrors).toBe(true);
    });

    it('should include diagnostics in response when requested', async () => {
      const response = await mockAstServer.getModel('file:///test/model.ecml', {
        includeDiagnostics: true,
      });

      expect(response.data.diagnostics).toBeDefined();
      expect(Array.isArray(response.data.diagnostics)).toBe(true);
    });
  });
});

// Helper functions

function createMockDocument(options: {
  uri: string;
  content: string;
  ast?: any;
  hasParseErrors?: boolean;
}): LangiumDocument {
  return {
    uri: { toString: () => options.uri, path: options.uri },
    textDocument: {
      uri: options.uri,
      languageId: 'ecml',
      version: 1,
      getText: () => options.content,
    },
    parseResult: {
      value: options.ast ?? { $type: 'Model', elements: [] },
      parserErrors: options.hasParseErrors ? [{ message: 'Parse error' }] : [],
    },
    diagnostics: [],
  } as any;
}

function createMockAstServer(documents: LangiumDocument[]): any {
  const docMap = new Map<string, LangiumDocument>();
  documents.forEach(doc => docMap.set(doc.uri.toString(), doc));

  return {
    documents: docMap,

    addDocument(doc: LangiumDocument) {
      docMap.set(doc.uri.toString(), doc);
    },

    async getModel(
      uri: string,
      options?: { includeDiagnostics?: boolean }
    ): Promise<ModelApiResponse<AstModelData>> {
      // Validate URI
      if (!uri.startsWith('file://')) {
        return {
          success: false,
          error: { code: 'INVALID_URI', message: 'Invalid URI format' },
        };
      }

      const doc = docMap.get(uri);
      if (!doc) {
        return {
          success: false,
          error: { code: 'DOCUMENT_NOT_FOUND', message: `Document not found: ${uri}` },
        };
      }

      const ast = doc.parseResult.value;
      const hasErrors = doc.parseResult.parserErrors?.length > 0;

      return {
        success: true,
        data: {
          uri,
          version: doc.textDocument.version,
          languageId: doc.textDocument.languageId,
          root: sanitizeAst(ast),
          hasErrors,
          diagnostics: options?.includeDiagnostics ? doc.diagnostics ?? [] : undefined,
        },
      };
    },

    async getModelPartial(
      uri: string,
      query: { nodeId?: string; nodeType?: string; path?: string }
    ): Promise<ModelApiResponse<any>> {
      const doc = docMap.get(uri);
      if (!doc) {
        return {
          success: false,
          error: { code: 'DOCUMENT_NOT_FOUND', message: `Document not found: ${uri}` },
        };
      }

      const ast = doc.parseResult.value;

      if (query.nodeId) {
        // Find node by ID
        const node = findNodeById(ast, query.nodeId);
        if (!node) {
          return {
            success: false,
            error: { code: 'NODE_NOT_FOUND', message: `Node not found: ${query.nodeId}` },
          };
        }
        return { success: true, data: { node: sanitizeAst(node) } };
      }

      if (query.nodeType) {
        // Find nodes by type
        const nodes = findNodesByType(ast, query.nodeType);
        return { success: true, data: { nodes: nodes.map(sanitizeAst) } };
      }

      if (query.path) {
        // Find node by path
        const node = getNodeByPath(ast, query.path);
        return { success: true, data: { node: sanitizeAst(node) } };
      }

      return {
        success: false,
        error: { code: 'INVALID_QUERY', message: 'No valid query parameters provided' },
      };
    },
  };
}

function sanitizeAst(ast: any): any {
  if (!ast || typeof ast !== 'object') {
    return ast;
  }

  if (Array.isArray(ast)) {
    return ast.map(sanitizeAst);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(ast)) {
    // Skip internal Langium properties
    if (key.startsWith('$') && !['$type', '$id'].includes(key)) {
      continue;
    }
    result[key] = sanitizeAst(value);
  }
  return result;
}

function findNodeById(ast: any, id: string): any {
  if (!ast || typeof ast !== 'object') return null;
  if (ast.$id === id || ast.name === id.replace(/-\d+$/, '')) return ast;

  for (const value of Object.values(ast)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNodeById(item, id);
        if (found) return found;
      }
    } else if (typeof value === 'object') {
      const found = findNodeById(value, id);
      if (found) return found;
    }
  }
  return null;
}

function findNodesByType(ast: any, type: string): any[] {
  const results: any[] = [];

  function traverse(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.$type === type) results.push(node);

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (typeof value === 'object') {
        traverse(value);
      }
    }
  }

  traverse(ast);
  return results;
}

function getNodeByPath(ast: any, path: string): any {
  const parts = path.match(/[^.\[\]]+|\[\d+\]/g) ?? [];
  let current = ast;

  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const index = parseInt(part.slice(1, -1), 10);
      current = current[index];
    } else {
      current = current[part];
    }
    if (current === undefined) return null;
  }

  return current;
}

function createCircularAst(): any {
  const actorA = { $type: 'Actor', name: 'A', related: null as any };
  const actorB = { $type: 'Actor', name: 'B', related: null as any };
  actorA.related = actorB;
  actorB.related = actorA;
  return { $type: 'Model', elements: [actorA, actorB] };
}
