/**
 * Default LSP Providers (T051)
 *
 * Barrel export for all default LSP provider implementations.
 * These providers delegate to Langium's built-in services where available
 * and provide sensible defaults otherwise.
 *
 * @packageDocumentation
 */

// Core providers
export {
  defaultCompletionProvider,
  createCompletionProvider,
} from './providers/completion-provider.js';

export {
  defaultHoverProvider,
  createHoverProvider,
} from './providers/hover-provider.js';

export {
  defaultDefinitionProvider,
  createDefinitionProvider,
} from './providers/definition-provider.js';

export {
  defaultReferencesProvider,
  createReferencesProvider,
} from './providers/references-provider.js';

export {
  defaultDocumentSymbolProvider,
  createDocumentSymbolProvider,
} from './providers/document-symbol-provider.js';

export {
  defaultRenameProvider,
  createRenameProvider,
} from './providers/rename-provider.js';

export {
  defaultDiagnosticsProvider,
  createDiagnosticsProvider,
  createDiagnostic,
  filterDiagnosticsBySeverity,
  groupDiagnosticsByLine,
} from './providers/diagnostics-provider.js';

export {
  defaultFoldingRangeProvider,
  createFoldingRangeProvider,
} from './providers/folding-range-provider.js';

export {
  defaultSemanticTokensProvider,
  createSemanticTokensProvider,
  DEFAULT_TOKEN_TYPES,
  DEFAULT_TOKEN_MODIFIERS,
} from './providers/semantic-tokens-provider.js';

export {
  defaultSignatureHelpProvider,
  createSignatureHelpProvider,
} from './providers/signature-help-provider.js';

// Navigation providers
export {
  defaultDeclarationProvider,
  createDeclarationProvider,
} from './providers/declaration-provider.js';

export {
  defaultTypeDefinitionProvider,
  createTypeDefinitionProvider,
} from './providers/type-definition-provider.js';

export {
  defaultImplementationProvider,
  createImplementationProvider,
} from './providers/implementation-provider.js';

export {
  defaultDocumentHighlightProvider,
  createDocumentHighlightProvider,
} from './providers/document-highlight-provider.js';

// Hierarchy providers
export {
  defaultCallHierarchyProvider,
  createCallHierarchyProvider,
} from './providers/call-hierarchy-provider.js';

export {
  defaultTypeHierarchyProvider,
  createTypeHierarchyProvider,
} from './providers/type-hierarchy-provider.js';

// Editing providers
export {
  defaultCodeActionProvider,
  createCodeActionProvider,
  DEFAULT_CODE_ACTION_KINDS,
} from './providers/code-action-provider.js';

export {
  defaultCodeLensProvider,
  createCodeLensProvider,
} from './providers/code-lens-provider.js';

export {
  defaultFormattingProvider,
  defaultRangeFormattingProvider,
  createFormattingProvider,
} from './providers/formatting-provider.js';

export {
  defaultSelectionRangeProvider,
  createSelectionRangeProvider,
} from './providers/selection-range-provider.js';

export {
  defaultLinkedEditingRangeProvider,
  createLinkedEditingRangeProvider,
} from './providers/linked-editing-range-provider.js';

export {
  defaultInlayHintProvider,
  createInlayHintProvider,
} from './providers/inlay-hint-provider.js';

// Re-export types
export type { LspContext, WorkspaceContext, LspFeatureProviders } from '@sanyam/types';

/**
 * Merged default providers for all LSP features.
 *
 * This object provides all default implementations that can be used
 * as fallbacks when grammar packages don't provide custom implementations.
 */
import { defaultCompletionProvider } from './providers/completion-provider.js';
import { defaultHoverProvider } from './providers/hover-provider.js';
import { defaultDefinitionProvider } from './providers/definition-provider.js';
import { defaultReferencesProvider } from './providers/references-provider.js';
import { defaultDocumentSymbolProvider } from './providers/document-symbol-provider.js';
import { defaultRenameProvider } from './providers/rename-provider.js';
import { defaultDiagnosticsProvider } from './providers/diagnostics-provider.js';
import { defaultFoldingRangeProvider } from './providers/folding-range-provider.js';
import { defaultSemanticTokensProvider } from './providers/semantic-tokens-provider.js';
import { defaultSignatureHelpProvider } from './providers/signature-help-provider.js';
import { defaultDeclarationProvider } from './providers/declaration-provider.js';
import { defaultTypeDefinitionProvider } from './providers/type-definition-provider.js';
import { defaultImplementationProvider } from './providers/implementation-provider.js';
import { defaultDocumentHighlightProvider } from './providers/document-highlight-provider.js';
import { defaultCallHierarchyProvider } from './providers/call-hierarchy-provider.js';
import { defaultTypeHierarchyProvider } from './providers/type-hierarchy-provider.js';
import { defaultCodeActionProvider } from './providers/code-action-provider.js';
import { defaultCodeLensProvider } from './providers/code-lens-provider.js';
import { defaultFormattingProvider, defaultRangeFormattingProvider } from './providers/formatting-provider.js';
import { defaultSelectionRangeProvider } from './providers/selection-range-provider.js';
import { defaultLinkedEditingRangeProvider } from './providers/linked-editing-range-provider.js';
import { defaultInlayHintProvider } from './providers/inlay-hint-provider.js';

import type { LspFeatureProviders } from '@sanyam/types';

/**
 * All default LSP providers bundled together.
 *
 * Use this when you need all default implementations at once.
 */
export const allDefaultProviders: Required<LspFeatureProviders> = {
  completion: defaultCompletionProvider,
  hover: defaultHoverProvider,
  signatureHelp: defaultSignatureHelpProvider,
  declaration: defaultDeclarationProvider,
  definition: defaultDefinitionProvider,
  typeDefinition: defaultTypeDefinitionProvider,
  implementation: defaultImplementationProvider,
  references: defaultReferencesProvider,
  documentHighlight: defaultDocumentHighlightProvider,
  documentSymbol: defaultDocumentSymbolProvider,
  codeAction: defaultCodeActionProvider,
  codeLens: defaultCodeLensProvider,
  documentLink: undefined as never, // Not implemented yet
  documentColor: undefined as never, // Not implemented yet
  colorPresentation: undefined as never, // Not implemented yet
  formatting: defaultFormattingProvider,
  rangeFormatting: defaultRangeFormattingProvider,
  onTypeFormatting: undefined as never, // Not implemented yet
  rename: defaultRenameProvider,
  foldingRange: defaultFoldingRangeProvider,
  selectionRange: defaultSelectionRangeProvider,
  linkedEditingRange: defaultLinkedEditingRangeProvider,
  callHierarchy: defaultCallHierarchyProvider,
  typeHierarchy: defaultTypeHierarchyProvider,
  semanticTokens: defaultSemanticTokensProvider,
  inlayHint: defaultInlayHintProvider,
  inlineValue: undefined as never, // Not implemented yet
  moniker: undefined as never, // Not implemented yet
  diagnostics: defaultDiagnosticsProvider,
  workspaceSymbol: undefined as never, // Not implemented yet
  commands: undefined as never, // Not implemented yet
  fileOperations: undefined as never, // Not implemented yet
};
