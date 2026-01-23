/**
 * LSP Context Factory
 *
 * Creates LspContext objects for LSP request handling.
 * The context provides access to the document, services,
 * and cancellation token for a single request.
 *
 * @packageDocumentation
 */

import type { LangiumDocument, AstNode } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { CancellationToken } from 'vscode-languageserver';
import type { LspContext, WorkspaceContext } from '@sanyam/types';
import { URI } from 'vscode-uri';
import { languageRegistry } from '../language-registry.js';

/**
 * Create an LSP context for document-level operations.
 *
 * @param documentUri - URI of the document
 * @param token - Cancellation token for the request
 * @returns LSP context or undefined if document not found
 */
export function createLspContext<T extends AstNode = AstNode>(
  documentUri: string,
  token: CancellationToken
): LspContext<T> | undefined {
  const language = languageRegistry.getByUri(documentUri);
  if (!language) {
    return undefined;
  }

  const { services } = language;
  const shared = languageRegistry.sharedServices;

  // Get the document from the document builder
  const documents = shared.workspace.LangiumDocuments;
  const uri = URI.parse(documentUri);
  const document = documents.getDocument(uri) as LangiumDocument<T> | undefined;

  if (!document) {
    return undefined;
  }

  return {
    document,
    services,
    shared,
    token,
  };
}

/**
 * Create an LSP context from a specific document.
 *
 * Use this when you already have the document instance.
 *
 * @param document - The Langium document
 * @param services - Language services for this document
 * @param shared - Shared services
 * @param token - Cancellation token
 * @returns LSP context
 */
export function createLspContextFromDocument<T extends AstNode = AstNode>(
  document: LangiumDocument<T>,
  services: LangiumServices,
  shared: LangiumSharedServices,
  token: CancellationToken
): LspContext<T> {
  return {
    document,
    services,
    shared,
    token,
  };
}

/**
 * Create a workspace context for workspace-level operations.
 *
 * @param languageId - Language ID for the operation
 * @param token - Cancellation token
 * @returns Workspace context or undefined if language not found
 */
export function createWorkspaceContext(
  languageId: string,
  token: CancellationToken
): WorkspaceContext | undefined {
  const language = languageRegistry.getByLanguageId(languageId);
  if (!language) {
    return undefined;
  }

  return {
    services: language.services,
    shared: languageRegistry.sharedServices,
    token,
  };
}

/**
 * Create a workspace context for any registered language.
 *
 * Use this when the operation isn't language-specific.
 *
 * @param token - Cancellation token
 * @returns Workspace context using the first registered language, or undefined
 */
export function createAnyWorkspaceContext(
  token: CancellationToken
): WorkspaceContext | undefined {
  const languages = languageRegistry.getAllLanguages();
  if (languages.length === 0) {
    return undefined;
  }

  const language = languages[0];
  if (!language) {
    return undefined;
  }

  return {
    services: language.services,
    shared: languageRegistry.sharedServices,
    token,
  };
}

/**
 * Check if a document URI is supported by any registered language.
 *
 * @param documentUri - URI of the document
 * @returns True if supported
 */
export function isDocumentSupported(documentUri: string): boolean {
  return languageRegistry.getByUri(documentUri) !== undefined;
}

/**
 * Get the language ID for a document URI.
 *
 * @param documentUri - URI of the document
 * @returns Language ID or undefined if not found
 */
export function getLanguageIdForDocument(documentUri: string): string | undefined {
  const language = languageRegistry.getByUri(documentUri);
  return language?.contribution.languageId;
}

/**
 * Get the services for a document URI.
 *
 * @param documentUri - URI of the document
 * @returns Language services or undefined if not found
 */
export function getServicesForDocument(documentUri: string): LangiumServices | undefined {
  const language = languageRegistry.getByUri(documentUri);
  return language?.services;
}
