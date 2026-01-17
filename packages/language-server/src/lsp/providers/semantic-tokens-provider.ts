/**
 * Default Semantic Tokens Provider (T037)
 *
 * Provides semantic tokens for enhanced syntax highlighting.
 *
 * @packageDocumentation
 */

import type {
  SemanticTokens,
  SemanticTokensDelta,
  SemanticTokensParams,
  SemanticTokensDeltaParams,
  SemanticTokensRangeParams,
} from 'vscode-languageserver';
import type { LspContext, SemanticTokensLegend } from '@sanyam/types';
import type { AstNode, CstNode } from 'langium';
import { streamAllContents, isNamed } from '../helpers/langium-compat.js';
import { isReference } from 'langium';

/**
 * Default token types for semantic highlighting.
 */
export const DEFAULT_TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'event',
  'function',
  'method',
  'macro',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator',
] as const;

/**
 * Default token modifiers for semantic highlighting.
 */
export const DEFAULT_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
] as const;

/**
 * Token type indices for quick lookup.
 */
const TOKEN_TYPE_INDEX = new Map<string, number>(
  DEFAULT_TOKEN_TYPES.map((type, index) => [type, index])
);

/**
 * Token modifier indices for quick lookup.
 */
const TOKEN_MODIFIER_INDEX = new Map<string, number>(
  DEFAULT_TOKEN_MODIFIERS.map((mod, index) => [mod, index])
);

/**
 * Default semantic tokens provider.
 */
export const defaultSemanticTokensProvider = {
  /**
   * Provide semantic tokens for the entire document.
   */
  async full(
    context: LspContext,
    params: SemanticTokensParams
  ): Promise<SemanticTokens | null> {
    const { document, services, token } = context;

    // Check for built-in semantic tokens provider first
    const semanticTokensProvider = services.lsp.SemanticTokenProvider;
    if (semanticTokensProvider) {
      try {
        const result = await semanticTokensProvider.semanticHighlight(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium SemanticTokenProvider:', error);
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    const tokens = collectSemanticTokens(rootNode, document);
    const data = encodeTokens(tokens, document);

    return {
      data,
      resultId: generateResultId(),
    };
  },

  /**
   * Provide delta updates for semantic tokens.
   */
  async delta(
    context: LspContext,
    params: SemanticTokensDeltaParams
  ): Promise<SemanticTokens | SemanticTokensDelta | null> {
    // For simplicity, always return full tokens
    // A more sophisticated implementation would track changes
    return this.full(context, { textDocument: params.textDocument });
  },

  /**
   * Provide semantic tokens for a specific range.
   */
  async range(
    context: LspContext,
    params: SemanticTokensRangeParams
  ): Promise<SemanticTokens | null> {
    const { document } = context;

    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Collect all tokens
    const allTokens = collectSemanticTokens(rootNode, document);

    // Filter to only tokens in range
    const startOffset = document.textDocument.offsetAt(params.range.start);
    const endOffset = document.textDocument.offsetAt(params.range.end);

    const filteredTokens = allTokens.filter(
      (t) => t.offset >= startOffset && t.offset + t.length <= endOffset
    );

    const data = encodeTokens(filteredTokens, document);

    return {
      data,
    };
  },

  /**
   * Default semantic tokens legend.
   */
  legend: {
    tokenTypes: [...DEFAULT_TOKEN_TYPES],
    tokenModifiers: [...DEFAULT_TOKEN_MODIFIERS],
  } as SemanticTokensLegend,
};

/**
 * Represents a collected semantic token before encoding.
 */
interface CollectedToken {
  offset: number;
  length: number;
  tokenType: string;
  modifiers: string[];
}

/**
 * Collect semantic tokens from the AST.
 */
function collectSemanticTokens(
  rootNode: AstNode,
  document: LspContext['document']
): CollectedToken[] {
  const tokens: CollectedToken[] = [];

  // Process all AST nodes
  for (const node of streamAllContents(rootNode)) {
    const nodeTokens = getTokensForNode(node);
    tokens.push(...nodeTokens);
  }

  // Sort by offset
  tokens.sort((a, b) => a.offset - b.offset);

  return tokens;
}

/**
 * Get semantic tokens for a single AST node.
 */
function getTokensForNode(node: AstNode): CollectedToken[] {
  const tokens: CollectedToken[] = [];
  const cstNode = node.$cstNode;

  if (!cstNode) {
    return tokens;
  }

  // Map AST node type to token type
  const tokenType = mapNodeTypeToTokenType(node);
  if (!tokenType) {
    return tokens;
  }

  // Get modifiers based on node properties
  const modifiers = getModifiersForNode(node);

  // If this is a named element, add a token for the name
  if (isNamed(node)) {
    tokens.push({
      offset: cstNode.offset,
      length: cstNode.length,
      tokenType,
      modifiers: [...modifiers, 'declaration'],
    });
  }

  // Process reference properties
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;

    if (isReference(value) && value.$refNode) {
      tokens.push({
        offset: value.$refNode.offset,
        length: value.$refNode.length,
        tokenType: mapRefTypeToTokenType(value) ?? 'variable',
        modifiers: [],
      });
    }

    // Handle arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isReference(item) && item.$refNode) {
          tokens.push({
            offset: item.$refNode.offset,
            length: item.$refNode.length,
            tokenType: mapRefTypeToTokenType(item) ?? 'variable',
            modifiers: [],
          });
        }
      }
    }
  }

  return tokens;
}

/**
 * Map AST node type to semantic token type.
 */
function mapNodeTypeToTokenType(node: AstNode): string | null {
  const type = node.$type.toLowerCase();

  if (type.includes('class') || type.includes('entity')) {
    return 'class';
  }
  if (type.includes('interface')) {
    return 'interface';
  }
  if (type.includes('enum')) {
    return 'enum';
  }
  if (type.includes('type')) {
    return 'type';
  }
  if (type.includes('function') || type.includes('method') || type.includes('rule')) {
    return 'function';
  }
  if (type.includes('property') || type.includes('attribute') || type.includes('field')) {
    return 'property';
  }
  if (type.includes('parameter') || type.includes('argument')) {
    return 'parameter';
  }
  if (type.includes('variable')) {
    return 'variable';
  }
  if (type.includes('namespace') || type.includes('module') || type.includes('package')) {
    return 'namespace';
  }

  return null;
}

/**
 * Map reference type to semantic token type.
 */
function mapRefTypeToTokenType(ref: unknown): string | null {
  // Try to determine type from the reference's target
  if (typeof ref === 'object' && ref !== null && 'ref' in ref) {
    const target = (ref as { ref: AstNode | undefined }).ref;
    if (target) {
      return mapNodeTypeToTokenType(target);
    }
  }
  return null;
}

/**
 * Get modifiers for a node based on its properties.
 */
function getModifiersForNode(node: AstNode): string[] {
  const modifiers: string[] = [];

  // Check for common modifier properties
  if ('readonly' in node && node.readonly) {
    modifiers.push('readonly');
  }
  if ('static' in node && node.static) {
    modifiers.push('static');
  }
  if ('abstract' in node && node.abstract) {
    modifiers.push('abstract');
  }
  if ('deprecated' in node && node.deprecated) {
    modifiers.push('deprecated');
  }
  if ('async' in node && node.async) {
    modifiers.push('async');
  }

  return modifiers;
}

/**
 * Encode tokens into LSP format (delta-encoded array).
 */
function encodeTokens(
  tokens: CollectedToken[],
  document: LspContext['document']
): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (const token of tokens) {
    const pos = document.textDocument.positionAt(token.offset);
    const line = pos.line;
    const char = pos.character;

    // Calculate deltas
    const deltaLine = line - prevLine;
    const deltaChar = deltaLine === 0 ? char - prevChar : char;

    // Get token type index
    const typeIndex = TOKEN_TYPE_INDEX.get(token.tokenType) ?? 0;

    // Encode modifiers as bitmask
    let modifiersBitmask = 0;
    for (const mod of token.modifiers) {
      const modIndex = TOKEN_MODIFIER_INDEX.get(mod);
      if (modIndex !== undefined) {
        modifiersBitmask |= 1 << modIndex;
      }
    }

    // Add encoded token (5 integers)
    data.push(deltaLine, deltaChar, token.length, typeIndex, modifiersBitmask);

    prevLine = line;
    prevChar = char;
  }

  return data;
}

/**
 * Generate a unique result ID for delta tracking.
 */
function generateResultId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Create a semantic tokens provider with custom token mapping.
 */
export function createSemanticTokensProvider(
  customMapper?: (node: AstNode) => { type: string; modifiers: string[] } | null
): typeof defaultSemanticTokensProvider {
  if (!customMapper) {
    return defaultSemanticTokensProvider;
  }

  return {
    ...defaultSemanticTokensProvider,
    async full(
      context: LspContext,
      params: SemanticTokensParams
    ): Promise<SemanticTokens | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const tokens: CollectedToken[] = [];

      for (const node of streamAllContents(rootNode)) {
        const mapped = customMapper(node);
        if (mapped && node.$cstNode) {
          tokens.push({
            offset: node.$cstNode.offset,
            length: node.$cstNode.length,
            tokenType: mapped.type,
            modifiers: mapped.modifiers,
          });
        }
      }

      tokens.sort((a, b) => a.offset - b.offset);
      const data = encodeTokens(tokens, document);

      return {
        data,
        resultId: generateResultId(),
      };
    },
  };
}
