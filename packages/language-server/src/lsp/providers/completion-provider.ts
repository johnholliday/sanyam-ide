/**
 * Default Completion Provider (T029)
 *
 * Provides code completion suggestions by delegating to Langium's
 * built-in completion infrastructure.
 *
 * @packageDocumentation
 */

import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
} from 'vscode-languageserver';
import type { LspContext, MaybePromise } from '@sanyam/types';
import type { LangiumDocument } from 'langium';
import { URI } from 'vscode-uri';

/**
 * Default completion provider that delegates to Langium's completion service.
 */
export const defaultCompletionProvider = {
  /**
   * Provide completion items for the given position.
   *
   * Uses Langium's CompletionProvider to generate context-aware completions.
   */
  async provide(
    context: LspContext,
    params: CompletionParams
  ): Promise<CompletionItem[] | CompletionList | null> {
    const { document, services, token } = context;

    // Get Langium's completion provider
    const completionProvider = services.lsp.CompletionProvider;
    if (!completionProvider) {
      return null;
    }

    try {
      // Langium's completion provider expects the document and params
      const completionList = await completionProvider.getCompletion(
        document,
        params,
        token
      );

      return completionList ?? null;
    } catch (error) {
      console.error('Error providing completions:', error);
      return null;
    }
  },

  /**
   * Resolve additional details for a completion item.
   *
   * Uses Langium's completion resolver if available.
   */
  async resolve(
    item: CompletionItem,
    context: LspContext
  ): Promise<CompletionItem> {
    const { services, token } = context;

    // Langium doesn't have a separate resolve method by default,
    // but we can add custom resolution logic here
    const completionProvider = services.lsp.CompletionProvider;
    if (completionProvider && 'resolveCompletion' in completionProvider) {
      try {
        const resolved = await (completionProvider as { resolveCompletion: (item: CompletionItem) => Promise<CompletionItem> }).resolveCompletion(item);
        return resolved ?? item;
      } catch {
        return item;
      }
    }

    // If the item has data for lazy resolution, we can enhance it here
    if (item.data) {
      // Add documentation if not present
      if (!item.documentation) {
        item.documentation = {
          kind: 'markdown',
          value: `**${item.label}**\n\n${item.detail ?? 'No additional details available.'}`,
        };
      }
    }

    return item;
  },

  /** Default trigger characters */
  triggerCharacters: ['.', ':', '<', '"', "'", '/', '@'] as readonly string[],

  /** Enable resolve support */
  resolveProvider: true,
};

/**
 * Create a completion provider with custom configuration.
 *
 * @param config - Custom configuration options
 * @returns A configured completion provider
 */
export function createCompletionProvider(config?: {
  triggerCharacters?: readonly string[];
  resolveProvider?: boolean;
}): typeof defaultCompletionProvider {
  return {
    ...defaultCompletionProvider,
    triggerCharacters: config?.triggerCharacters ?? defaultCompletionProvider.triggerCharacters,
    resolveProvider: config?.resolveProvider ?? defaultCompletionProvider.resolveProvider,
  };
}
