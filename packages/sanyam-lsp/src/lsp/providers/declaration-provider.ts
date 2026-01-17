/**
 * Default Declaration Provider (T039)
 *
 * Provides go-to-declaration functionality.
 * In most DSLs, declaration and definition are the same.
 *
 * @packageDocumentation
 */

import type {
  Location,
  LocationLink,
  DeclarationParams,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import { defaultDefinitionProvider } from './definition-provider.js';

/**
 * Default declaration provider that delegates to definition provider.
 *
 * For most DSLs, declaration and definition are equivalent.
 * Override this if your language distinguishes between them
 * (e.g., forward declarations vs implementations).
 */
export const defaultDeclarationProvider = {
  /**
   * Provide declaration locations for the given position.
   */
  async provide(
    context: LspContext,
    params: DeclarationParams
  ): Promise<Location | Location[] | LocationLink[] | null> {
    const { document, services, token } = context;

    // Check for built-in declaration provider first
    const declarationProvider = services.lsp.DeclarationProvider;
    if (declarationProvider) {
      try {
        const result = await declarationProvider.getDeclaration(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium DeclarationProvider:', error);
      }
    }

    // Fall back to definition provider
    // Most DSLs don't distinguish declaration from definition
    return defaultDefinitionProvider.provide(context, params);
  },
};

/**
 * Create a declaration provider with custom logic.
 *
 * Use this when your language distinguishes between declarations
 * and definitions (e.g., forward declarations, interface declarations).
 */
export function createDeclarationProvider(
  customProvider?: typeof defaultDeclarationProvider.provide
): typeof defaultDeclarationProvider {
  if (!customProvider) {
    return defaultDeclarationProvider;
  }

  return {
    provide: customProvider,
  };
}
