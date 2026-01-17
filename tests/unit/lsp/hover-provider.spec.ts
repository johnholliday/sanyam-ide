/**
 * Unit Tests for HoverProvider (T058)
 *
 * Tests the default hover provider in isolation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangiumDocument, AstNode, CstNode, LangiumCoreServices } from 'langium';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { HoverParams, Hover, Position, CancellationToken } from 'vscode-languageserver';
import type { LspContext } from '../../../packages/sanyam-lsp/src/core/types';
import { defaultHoverProvider, createHoverProvider } from '../../../packages/sanyam-lsp/src/lsp/providers/hover-provider';

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

const mockToken: CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(),
};

describe('HoverProvider', () => {
  let mockServices: LangiumCoreServices;
  let mockHoverProvider: any;

  beforeEach(() => {
    mockHoverProvider = {
      getHoverContent: vi.fn(),
    };

    mockServices = {
      lsp: {
        HoverProvider: mockHoverProvider,
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

  describe('defaultHoverProvider.provide', () => {
    it('should return hover content from Langium provider', async () => {
      const document = createMockDocument('entity Person { name: string }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 }, // On "Person"
      };

      const expectedHover: Hover = {
        contents: {
          kind: 'markdown',
          value: '**Entity** `Person`\n\nAn entity definition.',
        },
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 13 },
        },
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(expectedHover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result).toEqual(expectedHover);
      expect(mockHoverProvider.getHoverContent).toHaveBeenCalledWith(
        document,
        params,
        mockToken
      );
    });

    it('should return null when no hover content available', async () => {
      const document = createMockDocument('entity Person { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 0 }, // On whitespace/keyword
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const document = createMockDocument('invalid { content }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 5 },
      };

      mockHoverProvider.getHoverContent.mockRejectedValue(new Error('Parse error'));

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should work without Langium hover provider', async () => {
      const document = createMockDocument('entity Test { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const servicesWithoutHover = {
        lsp: {},
        workspace: {},
        shared: {},
      } as unknown as LangiumCoreServices;

      const context: LspContext = {
        document,
        services: servicesWithoutHover,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result).toBeNull();
    });
  });

  describe('createHoverProvider', () => {
    it('should create provider with custom hover builder', async () => {
      const document = createMockDocument('entity Custom { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const customHover: Hover = {
        contents: {
          kind: 'markdown',
          value: '**Custom Entity**\n\nThis is a custom hover.',
        },
      };

      const customProvider = createHoverProvider((ctx, p) => customHover);

      mockHoverProvider.getHoverContent.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      expect(result).toEqual(customHover);
    });

    it('should prefer Langium hover over custom when both available', async () => {
      const document = createMockDocument('entity Preferred { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const langiumHover: Hover = {
        contents: { kind: 'markdown', value: 'Langium hover' },
      };

      const customHover: Hover = {
        contents: { kind: 'markdown', value: 'Custom hover' },
      };

      const customProvider = createHoverProvider((ctx, p) => customHover);

      mockHoverProvider.getHoverContent.mockResolvedValue(langiumHover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      // Should return Langium hover since it's available
      expect(result).toEqual(langiumHover);
    });
  });

  describe('hover content formatting', () => {
    it('should handle plain string content', async () => {
      const document = createMockDocument('entity Simple { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const hover: Hover = {
        contents: 'Simple entity definition',
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result?.contents).toBe('Simple entity definition');
    });

    it('should handle MarkedString array content', async () => {
      const document = createMockDocument('entity Multi { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const hover: Hover = {
        contents: [
          { language: 'dsl', value: 'entity Multi { }' },
          'An entity with multiple content sections.',
        ],
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(Array.isArray(result?.contents)).toBe(true);
      expect((result?.contents as any[]).length).toBe(2);
    });

    it('should handle MarkupContent', async () => {
      const document = createMockDocument('entity Markup { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const hover: Hover = {
        contents: {
          kind: 'markdown',
          value: '# Entity Markup\n\nWith **markdown** formatting.',
        },
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect((result?.contents as any).kind).toBe('markdown');
    });
  });

  describe('hover position handling', () => {
    it('should provide hover at start of identifier', async () => {
      const document = createMockDocument('entity StartPos { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 }, // Start of "StartPos"
      };

      const hover: Hover = {
        contents: { kind: 'markdown', value: 'Start position hover' },
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 15 },
        },
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result?.range?.start.character).toBe(7);
    });

    it('should provide hover at middle of identifier', async () => {
      const document = createMockDocument('entity MiddlePos { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 10 }, // Middle of "MiddlePos"
      };

      const hover: Hover = {
        contents: { kind: 'markdown', value: 'Middle position hover' },
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 16 },
        },
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result?.range?.start.character).toBe(7);
      expect(result?.range?.end.character).toBe(16);
    });

    it('should return null for hover on whitespace', async () => {
      const document = createMockDocument('entity Test { }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 6 }, // Space before "Test"
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result).toBeNull();
    });
  });

  describe('cross-reference hover', () => {
    it('should provide hover for type references', async () => {
      const document = createMockDocument('entity Person { address: Address }');
      const params: HoverParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 27 }, // On "Address" reference
      };

      const hover: Hover = {
        contents: {
          kind: 'markdown',
          value: '**Reference to** `Address`\n\nDefined in other-file.dsl:5',
        },
      };

      mockHoverProvider.getHoverContent.mockResolvedValue(hover);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultHoverProvider.provide(context, params);

      expect(result?.contents).toBeDefined();
    });
  });
});
