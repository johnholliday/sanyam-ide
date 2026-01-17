/**
 * Unit Tests for DefinitionProvider (T059)
 *
 * Tests the default definition provider in isolation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangiumDocument, AstNode, CstNode, LangiumCoreServices } from 'langium';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  DefinitionParams,
  Location,
  LocationLink,
  Position,
  CancellationToken,
} from 'vscode-languageserver';
import type { LspContext } from '../../../packages/sanyam-lsp/src/core/types';
import {
  defaultDefinitionProvider,
  createDefinitionProvider,
} from '../../../packages/sanyam-lsp/src/lsp/providers/definition-provider';

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

describe('DefinitionProvider', () => {
  let mockServices: LangiumCoreServices;
  let mockDefinitionProvider: any;

  beforeEach(() => {
    mockDefinitionProvider = {
      getDefinition: vi.fn(),
    };

    mockServices = {
      lsp: {
        DefinitionProvider: mockDefinitionProvider,
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

  describe('defaultDefinitionProvider.provide', () => {
    it('should return definition location from Langium provider', async () => {
      const document = createMockDocument('entity Person { ref: Address }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 22 }, // On "Address" reference
      };

      const expectedLocation: Location = {
        uri: 'file:///types.dsl',
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 7 },
        },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(expectedLocation);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toEqual(expectedLocation);
      expect(mockDefinitionProvider.getDefinition).toHaveBeenCalledWith(
        document,
        params,
        mockToken
      );
    });

    it('should return multiple locations for overloaded definitions', async () => {
      const document = createMockDocument('call process()');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 6 }, // On "process"
      };

      const expectedLocations: Location[] = [
        {
          uri: 'file:///handlers.dsl',
          range: { start: { line: 10, character: 0 }, end: { line: 10, character: 7 } },
        },
        {
          uri: 'file:///utils.dsl',
          range: { start: { line: 20, character: 0 }, end: { line: 20, character: 7 } },
        },
      ];

      mockDefinitionProvider.getDefinition.mockResolvedValue(expectedLocations);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(Array.isArray(result)).toBe(true);
      expect((result as Location[]).length).toBe(2);
    });

    it('should return null when no definition found', async () => {
      const document = createMockDocument('entity Unknown { ref: Missing }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 24 }, // On unresolved "Missing"
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const document = createMockDocument('invalid content');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 5 },
      };

      mockDefinitionProvider.getDefinition.mockRejectedValue(new Error('Parse error'));

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should work without Langium definition provider', async () => {
      const document = createMockDocument('entity Test { }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 7 },
      };

      const servicesWithoutDefinition = {
        lsp: {},
        workspace: {},
        shared: {},
      } as unknown as LangiumCoreServices;

      const context: LspContext = {
        document,
        services: servicesWithoutDefinition,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toBeNull();
    });
  });

  describe('createDefinitionProvider', () => {
    it('should create provider with custom definition resolver', async () => {
      const document = createMockDocument('entity Custom { ref: Special }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 22 },
      };

      const customLocation: Location = {
        uri: 'file:///custom.dsl',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      };

      const customProvider = createDefinitionProvider((ctx, p) => customLocation);

      mockDefinitionProvider.getDefinition.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      expect(result).toEqual(customLocation);
    });

    it('should prefer Langium definition over custom', async () => {
      const document = createMockDocument('entity Preferred { ref: Target }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 25 },
      };

      const langiumLocation: Location = {
        uri: 'file:///langium.dsl',
        range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
      };

      const customLocation: Location = {
        uri: 'file:///custom.dsl',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      };

      const customProvider = createDefinitionProvider((ctx, p) => customLocation);

      mockDefinitionProvider.getDefinition.mockResolvedValue(langiumLocation);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, params);

      expect(result).toEqual(langiumLocation);
    });
  });

  describe('LocationLink support', () => {
    it('should support LocationLink responses', async () => {
      const document = createMockDocument('entity Person { ref: Address }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 22 },
      };

      const locationLink: LocationLink = {
        originSelectionRange: {
          start: { line: 0, character: 21 },
          end: { line: 0, character: 28 },
        },
        targetUri: 'file:///types.dsl',
        targetRange: {
          start: { line: 5, character: 0 },
          end: { line: 10, character: 1 },
        },
        targetSelectionRange: {
          start: { line: 5, character: 7 },
          end: { line: 5, character: 14 },
        },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue([locationLink]);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(Array.isArray(result)).toBe(true);
      const links = result as LocationLink[];
      expect(links[0].targetUri).toBe('file:///types.dsl');
      expect(links[0].originSelectionRange).toBeDefined();
    });
  });

  describe('same-file definitions', () => {
    it('should return definition in same file', async () => {
      const content = `entity Address {
  street: string
}

entity Person {
  addr: Address
}`;
      const document = createMockDocument(content);
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 5, character: 10 }, // On "Address" in Person
      };

      const expectedLocation: Location = {
        uri: document.uri.toString(),
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(expectedLocation);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toEqual(expectedLocation);
      expect((result as Location).uri).toBe(document.uri.toString());
    });
  });

  describe('cross-file definitions', () => {
    it('should return definition in different file', async () => {
      const document = createMockDocument('import { Address } from "./types"');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 10 }, // On "Address"
      };

      const expectedLocation: Location = {
        uri: 'file:///types.dsl',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 5, character: 1 },
        },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(expectedLocation);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect((result as Location).uri).toBe('file:///types.dsl');
    });
  });

  describe('definition at declaration', () => {
    it('should return self when cursor is on declaration', async () => {
      const document = createMockDocument('entity Person { name: string }');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 9 }, // On "Person" declaration
      };

      const selfLocation: Location = {
        uri: document.uri.toString(),
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 13 },
        },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(selfLocation);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toEqual(selfLocation);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', async () => {
      const document = createMockDocument('');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 0 },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should handle position at end of file', async () => {
      const document = createMockDocument('entity Test');
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 11 },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(null);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toBeNull();
    });

    it('should handle multiline content', async () => {
      const content = `entity Person {
  name: string
  address: Address
}`;
      const document = createMockDocument(content);
      const params: DefinitionParams = {
        textDocument: { uri: document.uri.toString() },
        position: { line: 2, character: 12 }, // On "Address"
      };

      const location: Location = {
        uri: 'file:///types.dsl',
        range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
      };

      mockDefinitionProvider.getDefinition.mockResolvedValue(location);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDefinitionProvider.provide(context, params);

      expect(result).toEqual(location);
    });
  });
});
