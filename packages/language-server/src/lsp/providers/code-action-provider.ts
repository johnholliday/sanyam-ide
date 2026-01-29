/**
 * Default Code Action Provider (T045)
 *
 * Provides quick fixes and refactorings for diagnostics.
 *
 * @packageDocumentation
 */

import type {
  CodeAction,
  CodeActionParams,
  Command,
  CodeActionKind,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default code action kinds supported.
 */
export const DEFAULT_CODE_ACTION_KINDS: CodeActionKind[] = [
  'quickfix',
  'refactor',
  'refactor.extract',
  'refactor.inline',
  'refactor.rewrite',
  'source',
  'source.organizeImports',
];

/**
 * Default code action provider.
 */
export const defaultCodeActionProvider = {
  /**
   * Provide code actions for the given range and context.
   */
  async provide(
    context: LspContext,
    params: CodeActionParams
  ): Promise<(CodeAction | Command)[] | null> {
    const { document, services, token } = context;

    // Check for built-in code action provider first
    const codeActionProvider = services.lsp.CodeActionProvider;
    if (codeActionProvider) {
      try {
        const result = await codeActionProvider.getCodeActions(document, params, token);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium CodeActionProvider');
      }
    }

    // Fall back to our implementation
    const codeActions: CodeAction[] = [];

    // Generate quick fixes based on diagnostics
    const diagnostics = params.context.diagnostics;
    for (const diagnostic of diagnostics) {
      const fixes = generateQuickFixes(diagnostic, context);
      codeActions.push(...fixes);
    }

    return codeActions.length > 0 ? codeActions : null;
  },

  /**
   * Resolve additional details for a code action.
   */
  async resolve(
    action: CodeAction,
    context: LspContext
  ): Promise<CodeAction> {
    const { services, token } = context;

    // Check for built-in resolver
    const codeActionProvider = services.lsp.CodeActionProvider;
    if (codeActionProvider && 'resolveCodeAction' in codeActionProvider) {
      try {
        const resolved = await (codeActionProvider as { resolveCodeAction: (action: CodeAction) => Promise<CodeAction> }).resolveCodeAction(action);
        if (resolved) {
          return resolved;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error resolving code action');
      }
    }

    return action;
  },

  /** Supported code action kinds */
  codeActionKinds: DEFAULT_CODE_ACTION_KINDS,
};

/**
 * Generate quick fixes for a diagnostic.
 */
function generateQuickFixes(
  diagnostic: CodeActionParams['context']['diagnostics'][0],
  context: LspContext
): CodeAction[] {
  const fixes: CodeAction[] = [];
  const { document } = context;

  // Check diagnostic code for known fixable issues
  const code = diagnostic.code;

  if (typeof code === 'string') {
    // Handle linking errors (undefined reference)
    if (code.includes('linking') || code.includes('unresolved')) {
      // Suggest creating the missing element
      fixes.push({
        title: 'Create missing element',
        kind: 'quickfix',
        diagnostics: [diagnostic],
        isPreferred: true,
        edit: {
          changes: {
            [document.uri.toString()]: [
              {
                range: {
                  start: { line: document.textDocument.lineCount, character: 0 },
                  end: { line: document.textDocument.lineCount, character: 0 },
                },
                newText: `\n// TODO: Define missing element\n`,
              },
            ],
          },
        },
      });
    }

    // Handle validation errors
    if (code.includes('validation') || code.includes('duplicate')) {
      // Suggest removing duplicate
      fixes.push({
        title: 'Remove duplicate',
        kind: 'quickfix',
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri.toString()]: [
              {
                range: diagnostic.range,
                newText: '',
              },
            ],
          },
        },
      });
    }
  }

  // Generic "suppress warning" action for warnings
  if (diagnostic.severity === 2) {
    fixes.push({
      title: 'Suppress this warning',
      kind: 'quickfix',
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line, character: 0 },
              },
              newText: '// @suppress-warning\n',
            },
          ],
        },
      },
    });
  }

  return fixes;
}

/**
 * Create a code action provider with custom action generators.
 */
export function createCodeActionProvider(
  customGenerator?: (
    diagnostic: CodeActionParams['context']['diagnostics'][0],
    context: LspContext
  ) => CodeAction[]
): typeof defaultCodeActionProvider {
  if (!customGenerator) {
    return defaultCodeActionProvider;
  }

  return {
    ...defaultCodeActionProvider,
    async provide(
      context: LspContext,
      params: CodeActionParams
    ): Promise<(CodeAction | Command)[] | null> {
      const codeActions: CodeAction[] = [];

      // Generate custom fixes based on diagnostics
      for (const diagnostic of params.context.diagnostics) {
        const fixes = customGenerator(diagnostic, context);
        codeActions.push(...fixes);
      }

      return codeActions.length > 0 ? codeActions : null;
    },
  };
}
