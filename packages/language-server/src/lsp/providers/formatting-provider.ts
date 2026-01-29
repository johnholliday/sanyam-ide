/**
 * Default Formatting Provider (T047)
 *
 * Provides document and range formatting.
 *
 * @packageDocumentation
 */

import type {
  TextEdit,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default formatting provider.
 */
export const defaultFormattingProvider = {
  /**
   * Format the entire document.
   */
  async provide(
    context: LspContext,
    params: DocumentFormattingParams
  ): Promise<TextEdit[] | null> {
    const { document, services, token } = context;

    // Check for built-in formatter first
    const formatter = services.lsp.Formatter;
    if (formatter) {
      try {
        const result = await formatter.formatDocument(document, params, token);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium Formatter');
      }
    }

    // Fall back to basic formatting
    return formatDocument(document, params.options);
  },
};

/**
 * Default range formatting provider.
 */
export const defaultRangeFormattingProvider = {
  /**
   * Format a range within the document.
   */
  async provide(
    context: LspContext,
    params: DocumentRangeFormattingParams
  ): Promise<TextEdit[] | null> {
    const { document, services, token } = context;

    // Check for built-in range formatter first
    const formatter = services.lsp.Formatter;
    if (formatter && 'formatRange' in formatter) {
      try {
        const result = await (formatter as { formatRange: (doc: unknown, params: DocumentRangeFormattingParams, token: unknown) => Promise<TextEdit[]> }).formatRange(document, params, token);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium Range Formatter');
      }
    }

    // Fall back to basic range formatting
    return formatRange(document, params);
  },
};

/**
 * Basic document formatting implementation.
 */
function formatDocument(
  document: LspContext['document'],
  options: DocumentFormattingParams['options']
): TextEdit[] {
  const text = document.textDocument.getText();
  const formatted = formatText(text, options);

  if (formatted === text) {
    return [];
  }

  // Replace entire document
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: document.textDocument.positionAt(text.length),
      },
      newText: formatted,
    },
  ];
}

/**
 * Basic range formatting implementation.
 */
function formatRange(
  document: LspContext['document'],
  params: DocumentRangeFormattingParams
): TextEdit[] {
  const text = document.textDocument.getText(params.range);
  const formatted = formatText(text, params.options);

  if (formatted === text) {
    return [];
  }

  return [
    {
      range: params.range,
      newText: formatted,
    },
  ];
}

/**
 * Format text with basic rules.
 */
function formatText(
  text: string,
  options: { tabSize: number; insertSpaces: boolean }
): string {
  const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  const lines = text.split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;

  for (let line of lines) {
    line = line.trim();

    // Decrease indent for closing braces/brackets
    if (line.startsWith('}') || line.startsWith(']') || line.startsWith(')')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add indented line
    if (line.length > 0) {
      formatted.push(indent.repeat(indentLevel) + line);
    } else {
      formatted.push('');
    }

    // Increase indent after opening braces/brackets
    if (line.endsWith('{') || line.endsWith('[') || line.endsWith('(')) {
      indentLevel++;
    }

    // Handle inline braces like `{ content }`
    const openCount = (line.match(/[{[(]/g) || []).length;
    const closeCount = (line.match(/[}\])]/g) || []).length;
    if (openCount > closeCount) {
      indentLevel += openCount - closeCount - (line.endsWith('{') || line.endsWith('[') || line.endsWith('(') ? 1 : 0);
    }
  }

  // Normalize line endings
  let result = formatted.join('\n');

  // Ensure trailing newline
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  // Remove consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Add space after keywords
  result = result.replace(/\b(if|for|while|switch|catch)\(/g, '$1 (');

  // Add space around operators
  result = result.replace(/([^<>!])=([^=])/g, '$1 = $2');
  result = result.replace(/([^<])>([^>])/g, '$1 > $2');
  result = result.replace(/([^>])<([^<])/g, '$1 < $2');

  return result;
}

/**
 * Create a formatting provider with custom formatter.
 */
export function createFormattingProvider(
  customFormatter?: (text: string, options: { tabSize: number; insertSpaces: boolean }) => string
): typeof defaultFormattingProvider {
  if (!customFormatter) {
    return defaultFormattingProvider;
  }

  return {
    async provide(
      context: LspContext,
      params: DocumentFormattingParams
    ): Promise<TextEdit[] | null> {
      const { document } = context;
      const text = document.textDocument.getText();
      const formatted = customFormatter(text, params.options);

      if (formatted === text) {
        return [];
      }

      return [
        {
          range: {
            start: { line: 0, character: 0 },
            end: document.textDocument.positionAt(text.length),
          },
          newText: formatted,
        },
      ];
    },
  };
}
