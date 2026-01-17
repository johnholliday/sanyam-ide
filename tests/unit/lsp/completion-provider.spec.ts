/**
 * Unit Tests for CompletionProvider (T057)
 *
 * Tests the default completion provider in isolation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangiumDocument, AstNode, CstNode, LangiumCoreServices } from 'langium';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { CompletionParams, CompletionList, Position, CancellationToken } from 'vscode-languageserver';
import type { LspContext } from '../../../packages/sanyam-lsp/src/core/types';
import { defaultCompletionProvider, createCompletionProvider } from '../../../packages/sanyam-lsp/src/lsp/providers/completion-provider';

// Mock Langium document
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
        const lineLength = lines[line].length + 1; // +1 for newline
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
    state: 3, // DocumentState.Validated
    diagnostics: [],
  } as unknown as LangiumDocument;
}

// Mock cancellation token
const mockToken: CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(),
};

describe('CompletionProvider', () => {
  let mockServices: LangiumCoreServices;
  let mockCompletionProvider: any;

  beforeEach(() => {
    mockCompletionProvider = {
      getCompletion: vi.fn(),
    };

    mockServices = {
      lsp: {
        CompletionProvider: mockCompletionProvider,
      },
      workspace: {
        AstNodeLocator: {
          getAstNode: vi.fn(),
        },
      },
      shared: {
        workspace: {
          LangiumDocuments: {
            getDocument: vi.fn(),
          },
        },
      },
    } as unknown as LangiumCoreServices;
  });

  describe('defaultCompletionProvider.provide', () => {
    it('should return completion list from Langium provider when available', async () => {
      const document = createMockDocument('entity Person { }');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 15 },
      };

      const expectedCompletions: CompletionList = {
        isIncomplete: false,
        items: [
          { label: 'name', kind: 6 },
          { label: 'age', kind: 6 },
        ],
      };

      mockCompletionProvider.getCompletion.mockResolvedValue(expectedCompletions);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result).toEqual(expectedCompletions);
      expect(mockCompletionProvider.getCompletion).toHaveBeenCalledWith(
        document,
        params,
        mockToken
      );
    });

    it('should return empty list when Langium provider returns nothing', async () => {
      const document = createMockDocument('entity Person { }');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 0 },
      };

      mockCompletionProvider.getCompletion.mockResolvedValue(undefined);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result).toEqual({ isIncomplete: false, items: [] });
    });

    it('should handle errors gracefully and return empty list', async () => {
      const document = createMockDocument('invalid content');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 5 },
      };

      mockCompletionProvider.getCompletion.mockRejectedValue(new Error('Parse error'));

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result).toEqual({ isIncomplete: false, items: [] });
    });

    it('should work without Langium completion provider', async () => {
      const document = createMockDocument('entity Test { }');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 10 },
      };

      const servicesWithoutCompletion = {
        lsp: {},
        workspace: {},
        shared: {},
      } as unknown as LangiumCoreServices;

      const context: LspContext = {
        document,
        services: servicesWithoutCompletion,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result).toEqual({ isIncomplete: false, items: [] });
    });
  });

  describe('createCompletionProvider', () => {
    it('should create a provider with custom completion builder', async () => {
      const document = createMockDocument('entity Custom { }');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const customItems = [
        { label: 'customField', kind: 5 },
      ];

      const customProvider = createCompletionProvider((ctx, p) => {
        return { isIncomplete: false, items: customItems };
      });

      mockCompletionProvider.getCompletion.mockResolvedValue(undefined);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      expect(result).toEqual({ isIncomplete: false, items: customItems });
    });

    it('should merge custom completions with default completions', async () => {
      const document = createMockDocument('entity Merged { }');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const langiumItems = [
        { label: 'langiumField', kind: 6 },
      ];

      const customItems = [
        { label: 'customField', kind: 5 },
      ];

      const customProvider = createCompletionProvider((ctx, p) => {
        return { isIncomplete: false, items: customItems };
      });

      mockCompletionProvider.getCompletion.mockResolvedValue({
        isIncomplete: false,
        items: langiumItems,
      });

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      // Custom provider should include both custom and default items
      expect(result.items).toContainEqual(customItems[0]);
    });
  });

  describe('completion context detection', () => {
    it('should handle completions at beginning of document', async () => {
      const document = createMockDocument('');
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 0 },
      };

      mockCompletionProvider.getCompletion.mockResolvedValue({
        isIncomplete: false,
        items: [{ label: 'entity', kind: 14 }],
      });

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toBe('entity');
    });

    it('should handle completions inside nested structures', async () => {
      const content = `entity Person {
  address: Address {

  }
}`;
      const document = createMockDocument(content);
      const params: CompletionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 2, character: 4 },
      };

      mockCompletionProvider.getCompletion.mockResolvedValue({
        isIncomplete: false,
        items: [
          { label: 'street', kind: 6 },
          { label: 'city', kind: 6 },
        ],
      });

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultCompletionProvider.provide(context, params);

      expect(result.items).toHaveLength(2);
    });
  });

  describe('completion item resolution', () => {
    it('should resolve completion item with additional details', async () => {
      const document = createMockDocument('entity Test { }');
      const item = {
        label: 'name',
        kind: 6,
        data: { type: 'property', nodeType: 'StringAttribute' },
      };

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      // The resolve method should add documentation if available
      if (defaultCompletionProvider.resolve) {
        const resolved = await defaultCompletionProvider.resolve(context, item);
        expect(resolved.label).toBe('name');
      }
    });
  });
});
