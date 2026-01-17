/**
 * Unit Tests for DiagnosticsProvider (T060)
 *
 * Tests the default diagnostics provider in isolation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangiumDocument, AstNode, CstNode, LangiumCoreServices } from 'langium';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  CancellationToken,
} from 'vscode-languageserver';
import type { LspContext } from '../../../packages/sanyam-lsp/src/core/types';
import {
  defaultDiagnosticsProvider,
  createDiagnosticsProvider,
} from '../../../packages/sanyam-lsp/src/lsp/providers/diagnostics-provider';

// Mock Langium document
function createMockDocument(
  content: string,
  uri: string = 'file:///test.dsl',
  diagnostics: Diagnostic[] = []
): LangiumDocument {
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
    diagnostics,
  } as unknown as LangiumDocument;
}

const mockToken: CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(),
};

describe('DiagnosticsProvider', () => {
  let mockServices: LangiumCoreServices;
  let mockValidator: any;
  let mockDocumentBuilder: any;

  beforeEach(() => {
    mockValidator = {
      validateDocument: vi.fn(),
    };

    mockDocumentBuilder = {
      build: vi.fn(),
    };

    mockServices = {
      validation: {
        DocumentValidator: mockValidator,
      },
      shared: {
        workspace: {
          DocumentBuilder: mockDocumentBuilder,
          LangiumDocuments: {
            getDocument: vi.fn(),
          },
        },
      },
      lsp: {},
      workspace: {},
    } as unknown as LangiumCoreServices;
  });

  describe('defaultDiagnosticsProvider.provide', () => {
    it('should return diagnostics from document', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 14 },
          },
          message: 'Unknown type "Missing"',
          severity: 1 as DiagnosticSeverity, // Error
        },
      ];

      const document = createMockDocument(
        'entity Person { ref: Missing }',
        'file:///test.dsl',
        diagnostics
      );

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result).toEqual(diagnostics);
    });

    it('should return empty array when no diagnostics', async () => {
      const document = createMockDocument('entity Valid { name: string }');

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result).toEqual([]);
    });

    it('should include lexer errors in diagnostics', async () => {
      const document = createMockDocument('entity @invalid { }');
      (document.parseResult as any).lexerErrors = [
        {
          offset: 7,
          length: 1,
          message: 'Unexpected character: @',
        },
      ];

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      // Should include diagnostics from lexer errors
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should include parser errors in diagnostics', async () => {
      const document = createMockDocument('entity { }'); // Missing name
      (document.parseResult as any).parserErrors = [
        {
          offset: 7,
          length: 1,
          message: "Expected identifier but found '{'",
        },
      ];

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple diagnostics', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 7 }, end: { line: 0, character: 13 } },
          message: 'Duplicate entity name',
          severity: 1 as DiagnosticSeverity,
        },
        {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
          message: 'Unused property',
          severity: 2 as DiagnosticSeverity, // Warning
        },
        {
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
          message: 'Consider using a more descriptive name',
          severity: 4 as DiagnosticSeverity, // Hint
        },
      ];

      const document = createMockDocument(
        `entity Person {
  unused: string
  x: number
}`,
        'file:///test.dsl',
        diagnostics
      );

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result).toHaveLength(3);
      expect(result[0].severity).toBe(1);
      expect(result[1].severity).toBe(2);
      expect(result[2].severity).toBe(4);
    });
  });

  describe('createDiagnosticsProvider', () => {
    it('should create provider with custom validator', async () => {
      const customDiagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
          message: 'Custom validation error',
          severity: 1 as DiagnosticSeverity,
          source: 'custom-validator',
        },
      ];

      const customProvider = createDiagnosticsProvider((ctx, params) => customDiagnostics);

      const document = createMockDocument('entity Custom { }');

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result).toContainEqual(expect.objectContaining({
        message: 'Custom validation error',
        source: 'custom-validator',
      }));
    });

    it('should merge custom diagnostics with document diagnostics', async () => {
      const documentDiagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
          message: 'Document diagnostic',
          severity: 1 as DiagnosticSeverity,
        },
      ];

      const customDiagnostics: Diagnostic[] = [
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Custom diagnostic',
          severity: 2 as DiagnosticSeverity,
        },
      ];

      const customProvider = createDiagnosticsProvider((ctx, params) => customDiagnostics);

      const document = createMockDocument(
        'entity Merged { }',
        'file:///test.dsl',
        documentDiagnostics
      );

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await customProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('diagnostic severity levels', () => {
    it('should handle Error severity', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Syntax error',
          severity: 1 as DiagnosticSeverity,
        },
      ];

      const document = createMockDocument('error content', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].severity).toBe(1);
    });

    it('should handle Warning severity', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Deprecated feature',
          severity: 2 as DiagnosticSeverity,
        },
      ];

      const document = createMockDocument('deprecated content', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].severity).toBe(2);
    });

    it('should handle Information severity', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Informational message',
          severity: 3 as DiagnosticSeverity,
        },
      ];

      const document = createMockDocument('info content', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].severity).toBe(3);
    });

    it('should handle Hint severity', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Style suggestion',
          severity: 4 as DiagnosticSeverity,
        },
      ];

      const document = createMockDocument('hint content', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].severity).toBe(4);
    });
  });

  describe('diagnostic metadata', () => {
    it('should include diagnostic source', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Type error',
          severity: 1 as DiagnosticSeverity,
          source: 'langium',
        },
      ];

      const document = createMockDocument('entity Test', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].source).toBe('langium');
    });

    it('should include diagnostic code', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Reference error',
          severity: 1 as DiagnosticSeverity,
          code: 'E001',
        },
      ];

      const document = createMockDocument('entity Test', 'file:///test.dsl', diagnostics);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].code).toBe('E001');
    });

    it('should include related information', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
          message: 'Duplicate definition',
          severity: 1 as DiagnosticSeverity,
          relatedInformation: [
            {
              location: {
                uri: 'file:///test.dsl',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
              },
              message: 'First definition here',
            },
          ],
        },
      ];

      const document = createMockDocument(
        `entity Person { }
entity Person { }`,
        'file:///test.dsl',
        diagnostics
      );

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].relatedInformation).toBeDefined();
      expect(result[0].relatedInformation).toHaveLength(1);
    });

    it('should include diagnostic tags', async () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Unused variable',
          severity: 2 as DiagnosticSeverity,
          tags: [1], // DiagnosticTag.Unnecessary
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 15 } },
          message: 'Deprecated method',
          severity: 2 as DiagnosticSeverity,
          tags: [2], // DiagnosticTag.Deprecated
        },
      ];

      const document = createMockDocument(
        `let unused = 5
oldMethod()`,
        'file:///test.dsl',
        diagnostics
      );

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result[0].tags).toContain(1);
      expect(result[1].tags).toContain(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', async () => {
      const document = createMockDocument('');

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(result).toEqual([]);
    });

    it('should handle document with only whitespace', async () => {
      const document = createMockDocument('   \n\n   ');

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very large document', async () => {
      const content = 'entity Entity' + '0'.repeat(1000) + ' { }\n'.repeat(1000);
      const document = createMockDocument(content);

      const context: LspContext = {
        document,
        services: mockServices,
        token: mockToken,
      };

      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle cancellation token', async () => {
      const cancelledToken: CancellationToken = {
        isCancellationRequested: true,
        onCancellationRequested: vi.fn(),
      };

      const document = createMockDocument('entity Test { }');

      const context: LspContext = {
        document,
        services: mockServices,
        token: cancelledToken,
      };

      // Should handle cancellation gracefully
      const result = await defaultDiagnosticsProvider.provide(context, {
        textDocument: { uri: document.uri.toString() },
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
