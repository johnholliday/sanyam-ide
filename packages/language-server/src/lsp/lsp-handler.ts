/**
 * LSP Handler (T052, T112)
 *
 * Routes LSP messages to appropriate providers based on document language.
 * Uses the provider resolver pattern for consistent handling of:
 * - Disabled feature checks
 * - Provider resolution logging
 * - Null handling for unavailable providers
 *
 * @packageDocumentation
 */

import type {
  Connection,
  CompletionParams,
  HoverParams,
  DefinitionParams,
  ReferenceParams,
  DocumentSymbolParams,
  RenameParams,
  PrepareRenameParams,
  FoldingRangeParams,
  SelectionRangeParams,
  DocumentHighlightParams,
  CodeActionParams,
  CodeLensParams,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  SignatureHelpParams,
  LinkedEditingRangeParams,
  InlayHintParams,
  DeclarationParams,
  TypeDefinitionParams,
  ImplementationParams,
  CallHierarchyPrepareParams,
  TypeHierarchyPrepareParams,
  SemanticTokensParams,
  SemanticTokensDeltaParams,
  SemanticTokensRangeParams,
  CompletionItem,
  CodeAction,
  CodeLens,
  InlayHint,
  CallHierarchyItem,
  TypeHierarchyItem,
  CancellationToken,
} from 'vscode-languageserver';
import type { LspContext, WorkspaceContext, LspFeatureProviders, RegisteredLanguage } from '@sanyam/types';
import { languageRegistry, type LanguageRegistry } from '../language-registry.js';
import { createLspContext, createWorkspaceContext, createAnyWorkspaceContext } from './lsp-context-factory.js';
import { isFeatureDisabled } from './feature-merger.js';

/**
 * LSP Handler configuration.
 */
export interface LspHandlerConfig {
  /** The LSP connection to register handlers on */
  connection: Connection;
  /** The language registry to use for lookups */
  registry: LanguageRegistry;
  /** Enable debug logging for provider resolution */
  logResolution?: boolean;
}

/**
 * Handler context for internal use.
 */
interface HandlerContext {
  registry: LanguageRegistry;
  logResolution: boolean;
}

/**
 * Log provider resolution decision.
 */
function logResolution(
  ctx: HandlerContext,
  feature: string,
  languageId: string,
  available: boolean,
  reason?: string
): void {
  if (ctx.logResolution) {
    const status = available ? 'resolved' : 'unavailable';
    const msg = reason ? ` (${reason})` : '';
    console.log(`[LSP] [${languageId}] ${feature}: ${status}${msg}`);
  }
}

/**
 * Check if a feature is enabled for a language.
 * Checks the contribution's disabledFeatures list.
 */
function isFeatureEnabled(
  feature: keyof LspFeatureProviders,
  language: RegisteredLanguage
): boolean {
  const disabledFeatures = language.contribution.disabledLspFeatures ?? [];
  return !isFeatureDisabled(feature, disabledFeatures);
}

/**
 * Get a provider if the feature is enabled.
 * Returns null if the feature is disabled or provider doesn't exist.
 */
function getEnabledProvider<K extends keyof LspFeatureProviders>(
  ctx: HandlerContext,
  feature: K,
  language: RegisteredLanguage
): LspFeatureProviders[K] | null {
  const languageId = language.contribution.languageId;

  // Check if feature is disabled
  if (!isFeatureEnabled(feature, language)) {
    logResolution(ctx, feature, languageId, false, 'disabled');
    return null;
  }

  const provider = language.mergedLspProviders[feature];
  if (!provider) {
    logResolution(ctx, feature, languageId, false, 'no provider');
    return null;
  }

  logResolution(ctx, feature, languageId, true);
  return provider;
}

/**
 * Register all LSP handlers on the connection.
 *
 * This function wires up all LSP protocol handlers to route requests
 * to the appropriate language provider based on the document URI.
 *
 * Uses the provider resolver pattern to:
 * - Check if features are disabled before invoking providers
 * - Log provider resolution decisions when enabled
 * - Return null consistently for unavailable providers
 */
export function registerLspHandlers(config: LspHandlerConfig): void {
  const { connection, registry, logResolution = false } = config;

  // Handler context for all handlers
  const ctx: HandlerContext = { registry, logResolution };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETION
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onCompletion(async (params: CompletionParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'completion', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onCompletionResolve(async (item: CompletionItem, token) => {
    // Get language from item data if available
    const uri = (item.data as { uri?: string })?.uri;
    if (!uri) return item;

    const context = createLspContext(uri, token);
    if (!context) return item;

    const language = registry.getByUri(uri);
    if (!language) return item;

    const provider = getEnabledProvider(ctx, 'completion', language);
    if (!provider?.resolve) return item;

    return provider.resolve(item, context);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOVER
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onHover(async (params: HoverParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'hover', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNATURE HELP
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onSignatureHelp(async (params: SignatureHelpParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'signatureHelp', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onDeclaration(async (params: DeclarationParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'declaration', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onDefinition(async (params: DefinitionParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'definition', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onTypeDefinition(async (params: TypeDefinitionParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'typeDefinition', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onImplementation(async (params: ImplementationParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'implementation', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onReferences(async (params: ReferenceParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'references', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SYMBOLS & HIGHLIGHTS
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onDocumentSymbol(async (params: DocumentSymbolParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'documentSymbol', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onDocumentHighlight(async (params: DocumentHighlightParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'documentHighlight', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE ACTIONS & LENSES
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onCodeAction(async (params: CodeActionParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'codeAction', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onCodeActionResolve(async (action: CodeAction, token) => {
    const uri = (action.data as { uri?: string })?.uri;
    if (!uri) return action;

    const context = createLspContext(uri, token);
    if (!context) return action;

    const language = registry.getByUri(uri);
    if (!language) return action;

    const provider = getEnabledProvider(ctx, 'codeAction', language);
    if (!provider?.resolve) return action;

    return provider.resolve(action, context);
  });

  connection.onCodeLens(async (params: CodeLensParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'codeLens', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onCodeLensResolve(async (lens: CodeLens, token) => {
    const uri = (lens.data as { uri?: string })?.uri;
    if (!uri) return lens;

    const context = createLspContext(uri, token);
    if (!context) return lens;

    const language = registry.getByUri(uri);
    if (!language) return lens;

    const provider = getEnabledProvider(ctx, 'codeLens', language);
    if (!provider?.resolve) return lens;

    return provider.resolve(lens, context);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENAME
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onPrepareRename(async (params: PrepareRenameParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'rename', language);
    if (!provider?.prepare) return null;

    return provider.prepare(context, params);
  });

  connection.onRenameRequest(async (params: RenameParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'rename', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onDocumentFormatting(async (params: DocumentFormattingParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'formatting', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onDocumentRangeFormatting(async (params: DocumentRangeFormattingParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'rangeFormatting', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FOLDING & SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  connection.onFoldingRanges(async (params: FoldingRangeParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'foldingRange', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.onSelectionRanges(async (params: SelectionRangeParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'selectionRange', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  // Linked editing range - some versions of vscode-languageserver have this
  // We'll skip this handler if the connection doesn't support it
  try {
    const langConn = connection as unknown as { onLinkedEditingRange?: (handler: any) => void };
    if (langConn.onLinkedEditingRange) {
      langConn.onLinkedEditingRange(async (params: LinkedEditingRangeParams, token: CancellationToken) => {
        const context = createLspContext(params.textDocument.uri, token);
        if (!context) return null;

        const language = registry.getByUri(params.textDocument.uri);
        if (!language) return null;

        const provider = getEnabledProvider(ctx, 'linkedEditingRange', language);
        if (!provider?.provide) return null;

        return provider.provide(context, params);
      });
    }
  } catch {
    // Linked editing range not supported in this version
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL & TYPE HIERARCHY
  // ═══════════════════════════════════════════════════════════════════════════

  connection.languages.callHierarchy.onPrepare(async (params: CallHierarchyPrepareParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'callHierarchy', language);
    if (!provider?.prepare) return null;

    return provider.prepare(context, params);
  });

  connection.languages.callHierarchy.onIncomingCalls(async (params, token) => {
    const workspaceContext = createAnyWorkspaceContext(token);
    if (!workspaceContext) return null;

    // Determine language from item URI
    const language = registry.getByUri(params.item.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'callHierarchy', language);
    if (!provider?.incomingCalls) return null;

    return provider.incomingCalls(params.item, workspaceContext);
  });

  connection.languages.callHierarchy.onOutgoingCalls(async (params, token) => {
    const workspaceContext = createAnyWorkspaceContext(token);
    if (!workspaceContext) return null;

    const language = registry.getByUri(params.item.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'callHierarchy', language);
    if (!provider?.outgoingCalls) return null;

    return provider.outgoingCalls(params.item, workspaceContext);
  });

  connection.languages.typeHierarchy.onPrepare(async (params: TypeHierarchyPrepareParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'typeHierarchy', language);
    if (!provider?.prepare) return null;

    return provider.prepare(context, params);
  });

  connection.languages.typeHierarchy.onSupertypes(async (params, token) => {
    const workspaceContext = createAnyWorkspaceContext(token);
    if (!workspaceContext) return null;

    const language = registry.getByUri(params.item.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'typeHierarchy', language);
    if (!provider?.supertypes) return null;

    return provider.supertypes(params.item, workspaceContext);
  });

  connection.languages.typeHierarchy.onSubtypes(async (params, token) => {
    const workspaceContext = createAnyWorkspaceContext(token);
    if (!workspaceContext) return null;

    const language = registry.getByUri(params.item.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'typeHierarchy', language);
    if (!provider?.subtypes) return null;

    return provider.subtypes(params.item, workspaceContext);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEMANTIC TOKENS
  // ═══════════════════════════════════════════════════════════════════════════

  connection.languages.semanticTokens.on(async (params: SemanticTokensParams, token) => {
    const emptyTokens = { data: [] };

    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return emptyTokens;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return emptyTokens;

    const provider = getEnabledProvider(ctx, 'semanticTokens', language);
    if (!provider?.full) return emptyTokens;

    const result = await provider.full(context, params);
    return result ?? emptyTokens;
  });

  connection.languages.semanticTokens.onDelta(async (params: SemanticTokensDeltaParams, token) => {
    const emptyTokens = { data: [] };

    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return emptyTokens;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return emptyTokens;

    const provider = getEnabledProvider(ctx, 'semanticTokens', language);
    if (!provider?.delta) return emptyTokens;

    const result = await provider.delta(context, params);
    return result ?? emptyTokens;
  });

  connection.languages.semanticTokens.onRange(async (params: SemanticTokensRangeParams, token) => {
    const emptyTokens = { data: [] };

    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return emptyTokens;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return emptyTokens;

    const provider = getEnabledProvider(ctx, 'semanticTokens', language);
    if (!provider?.range) return emptyTokens;

    const result = await provider.range(context, params);
    return result ?? emptyTokens;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INLAY HINTS
  // ═══════════════════════════════════════════════════════════════════════════

  connection.languages.inlayHint.on(async (params: InlayHintParams, token) => {
    const context = createLspContext(params.textDocument.uri, token);
    if (!context) return null;

    const language = registry.getByUri(params.textDocument.uri);
    if (!language) return null;

    const provider = getEnabledProvider(ctx, 'inlayHint', language);
    if (!provider?.provide) return null;

    return provider.provide(context, params);
  });

  connection.languages.inlayHint.resolve(async (hint: InlayHint, token) => {
    const uri = (hint.data as { uri?: string })?.uri;
    if (!uri) return hint;

    const context = createLspContext(uri, token);
    if (!context) return hint;

    const language = registry.getByUri(uri);
    if (!language) return hint;

    const provider = getEnabledProvider(ctx, 'inlayHint', language);
    if (!provider?.resolve) return hint;

    return provider.resolve(hint, context);
  });
}
