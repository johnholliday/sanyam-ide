/**
 * LSP Feature Provider Contracts
 *
 * This file defines the interfaces for LSP feature providers that grammar packages
 * can implement to customize language server behavior. All methods are optional -
 * defaults are used when not provided.
 *
 * @packageDocumentation
 */

import type { AstNode, LangiumDocument } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';

import type {
  CancellationToken,
  CompletionItem,
  CompletionList,
  CompletionParams,
  Hover,
  HoverParams,
  SignatureHelp,
  SignatureHelpParams,
  Location,
  LocationLink,
  DeclarationParams,
  DefinitionParams,
  TypeDefinitionParams,
  ImplementationParams,
  ReferenceParams,
  DocumentHighlight,
  DocumentHighlightParams,
  SymbolInformation,
  DocumentSymbol,
  DocumentSymbolParams,
  CodeAction,
  CodeActionParams,
  Command,
  CodeLens,
  CodeLensParams,
  DocumentLink,
  DocumentLinkParams,
  ColorInformation,
  ColorPresentation,
  DocumentColorParams,
  ColorPresentationParams,
  TextEdit,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  DocumentOnTypeFormattingParams,
  WorkspaceEdit,
  RenameParams,
  PrepareRenameParams,
  Range,
  FoldingRange,
  FoldingRangeParams,
  SelectionRange,
  SelectionRangeParams,
  LinkedEditingRanges,
  LinkedEditingRangeParams,
  CallHierarchyItem,
  CallHierarchyPrepareParams,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  TypeHierarchyItem,
  TypeHierarchyPrepareParams,
  SemanticTokens,
  SemanticTokensParams,
  SemanticTokensDelta,
  SemanticTokensDeltaParams,
  SemanticTokensRangeParams,
  InlayHint,
  InlayHintParams,
  InlineValue,
  InlineValueParams,
  Moniker,
  MonikerParams,
  Diagnostic,
  WorkspaceSymbol,
  CreateFilesParams,
  RenameFilesParams,
  DeleteFilesParams,
} from 'vscode-languageserver';

/**
 * Utility type for sync or async return values.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Context passed to all LSP feature providers for document-level operations.
 *
 * @typeParam T - The root AST node type for the document
 */
export interface LspContext<T extends AstNode = AstNode> {
  /** The Langium document being operated on */
  readonly document: LangiumDocument<T>;
  /** Language-specific services for this document's language */
  readonly services: LangiumServices;
  /** Shared services across all languages */
  readonly shared: LangiumSharedServices;
  /** Token for request cancellation */
  readonly token: CancellationToken;
}

/**
 * Context for workspace-level operations that don't target a specific document.
 */
export interface WorkspaceContext {
  /** Language-specific services */
  readonly services: LangiumServices;
  /** Shared services across all languages */
  readonly shared: LangiumSharedServices;
  /** Token for request cancellation */
  readonly token: CancellationToken;
}

/**
 * Semantic token legend configuration for syntax highlighting.
 */
export interface SemanticTokensLegend {
  /** Token type names (e.g., 'class', 'function', 'variable') */
  readonly tokenTypes: readonly string[];
  /** Token modifier names (e.g., 'readonly', 'deprecated') */
  readonly tokenModifiers: readonly string[];
}

/**
 * Complete LSP 3.17 feature provider interfaces.
 *
 * Grammar packages implement this interface to customize LSP behavior.
 * All properties are optional - defaults are used when not provided.
 *
 * @example
 * ```typescript
 * export const myLspProviders: LspFeatureProviders = {
 *   hover: {
 *     provide: async (ctx, params) => ({
 *       contents: { kind: 'markdown', value: '**Custom hover**' }
 *     })
 *   }
 * };
 * ```
 */
export interface LspFeatureProviders {
  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - COMPLETION
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/completion - Code completion suggestions */
  completion?: {
    /** Provide completion items for the given position */
    provide?(
      context: LspContext,
      params: CompletionParams
    ): MaybePromise<CompletionItem[] | CompletionList | null>;
    /** Resolve additional details for a completion item */
    resolve?(item: CompletionItem, context: LspContext): MaybePromise<CompletionItem>;
    /** Characters that trigger completion (e.g., '.', ':') */
    triggerCharacters?: readonly string[];
    /** Whether the provider supports resolve requests */
    resolveProvider?: boolean;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - HOVER & SIGNATURE
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/hover - Tooltip information */
  hover?: {
    provide?(context: LspContext, params: HoverParams): MaybePromise<Hover | null>;
  };

  /** textDocument/signatureHelp - Function signature information */
  signatureHelp?: {
    provide?(
      context: LspContext,
      params: SignatureHelpParams
    ): MaybePromise<SignatureHelp | null>;
    /** Characters that trigger signature help */
    triggerCharacters?: readonly string[];
    /** Characters that re-trigger signature help */
    retriggerCharacters?: readonly string[];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/declaration - Go to declaration */
  declaration?: {
    provide?(
      context: LspContext,
      params: DeclarationParams
    ): MaybePromise<Location | Location[] | LocationLink[] | null>;
  };

  /** textDocument/definition - Go to definition */
  definition?: {
    provide?(
      context: LspContext,
      params: DefinitionParams
    ): MaybePromise<Location | Location[] | LocationLink[] | null>;
  };

  /** textDocument/typeDefinition - Go to type definition */
  typeDefinition?: {
    provide?(
      context: LspContext,
      params: TypeDefinitionParams
    ): MaybePromise<Location | Location[] | LocationLink[] | null>;
  };

  /** textDocument/implementation - Go to implementation */
  implementation?: {
    provide?(
      context: LspContext,
      params: ImplementationParams
    ): MaybePromise<Location | Location[] | LocationLink[] | null>;
  };

  /** textDocument/references - Find all references */
  references?: {
    provide?(context: LspContext, params: ReferenceParams): MaybePromise<Location[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - HIGHLIGHTS & SYMBOLS
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/documentHighlight - Highlight occurrences */
  documentHighlight?: {
    provide?(
      context: LspContext,
      params: DocumentHighlightParams
    ): MaybePromise<DocumentHighlight[] | null>;
  };

  /** textDocument/documentSymbol - Document outline */
  documentSymbol?: {
    provide?(
      context: LspContext,
      params: DocumentSymbolParams
    ): MaybePromise<SymbolInformation[] | DocumentSymbol[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - CODE ACTIONS & LENSES
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/codeAction - Quick fixes and refactorings */
  codeAction?: {
    provide?(
      context: LspContext,
      params: CodeActionParams
    ): MaybePromise<(CodeAction | Command)[] | null>;
    resolve?(action: CodeAction, context: LspContext): MaybePromise<CodeAction>;
    /** Supported code action kinds */
    codeActionKinds?: readonly string[];
  };

  /** textDocument/codeLens - Inline actionable information */
  codeLens?: {
    provide?(context: LspContext, params: CodeLensParams): MaybePromise<CodeLens[] | null>;
    resolve?(lens: CodeLens, context: LspContext): MaybePromise<CodeLens>;
  };

  /** textDocument/documentLink - Clickable links in document */
  documentLink?: {
    provide?(
      context: LspContext,
      params: DocumentLinkParams
    ): MaybePromise<DocumentLink[] | null>;
    resolve?(link: DocumentLink, context: LspContext): MaybePromise<DocumentLink>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/documentColor - Color information */
  documentColor?: {
    provide?(
      context: LspContext,
      params: DocumentColorParams
    ): MaybePromise<ColorInformation[] | null>;
  };

  /** textDocument/colorPresentation - Color format options */
  colorPresentation?: {
    provide?(
      context: LspContext,
      params: ColorPresentationParams
    ): MaybePromise<ColorPresentation[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/formatting - Format entire document */
  formatting?: {
    provide?(
      context: LspContext,
      params: DocumentFormattingParams
    ): MaybePromise<TextEdit[] | null>;
  };

  /** textDocument/rangeFormatting - Format selection */
  rangeFormatting?: {
    provide?(
      context: LspContext,
      params: DocumentRangeFormattingParams
    ): MaybePromise<TextEdit[] | null>;
  };

  /** textDocument/onTypeFormatting - Format on keystroke */
  onTypeFormatting?: {
    provide?(
      context: LspContext,
      params: DocumentOnTypeFormattingParams
    ): MaybePromise<TextEdit[] | null>;
    /** First trigger character (required) */
    firstTriggerCharacter?: string;
    /** Additional trigger characters */
    moreTriggerCharacter?: readonly string[];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - RENAME
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/rename - Symbol renaming */
  rename?: {
    provide?(context: LspContext, params: RenameParams): MaybePromise<WorkspaceEdit | null>;
    prepare?(
      context: LspContext,
      params: PrepareRenameParams
    ): MaybePromise<Range | { range: Range; placeholder: string } | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE FEATURES - FOLDING & SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/foldingRange - Code folding regions */
  foldingRange?: {
    provide?(
      context: LspContext,
      params: FoldingRangeParams
    ): MaybePromise<FoldingRange[] | null>;
  };

  /** textDocument/selectionRange - Smart selection expansion */
  selectionRange?: {
    provide?(
      context: LspContext,
      params: SelectionRangeParams
    ): MaybePromise<SelectionRange[] | null>;
  };

  /** textDocument/linkedEditingRange - Synchronized editing */
  linkedEditingRange?: {
    provide?(
      context: LspContext,
      params: LinkedEditingRangeParams
    ): MaybePromise<LinkedEditingRanges | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL HIERARCHY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Call hierarchy (prepare, incoming, outgoing) */
  callHierarchy?: {
    prepare?(
      context: LspContext,
      params: CallHierarchyPrepareParams
    ): MaybePromise<CallHierarchyItem[] | null>;
    incomingCalls?(
      item: CallHierarchyItem,
      context: WorkspaceContext
    ): MaybePromise<CallHierarchyIncomingCall[] | null>;
    outgoingCalls?(
      item: CallHierarchyItem,
      context: WorkspaceContext
    ): MaybePromise<CallHierarchyOutgoingCall[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE HIERARCHY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Type hierarchy (prepare, supertypes, subtypes) */
  typeHierarchy?: {
    prepare?(
      context: LspContext,
      params: TypeHierarchyPrepareParams
    ): MaybePromise<TypeHierarchyItem[] | null>;
    supertypes?(
      item: TypeHierarchyItem,
      context: WorkspaceContext
    ): MaybePromise<TypeHierarchyItem[] | null>;
    subtypes?(
      item: TypeHierarchyItem,
      context: WorkspaceContext
    ): MaybePromise<TypeHierarchyItem[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SEMANTIC TOKENS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Semantic tokens for syntax highlighting */
  semanticTokens?: {
    full?(context: LspContext, params: SemanticTokensParams): MaybePromise<SemanticTokens | null>;
    delta?(
      context: LspContext,
      params: SemanticTokensDeltaParams
    ): MaybePromise<SemanticTokens | SemanticTokensDelta | null>;
    range?(
      context: LspContext,
      params: SemanticTokensRangeParams
    ): MaybePromise<SemanticTokens | null>;
    /** Token type and modifier legend */
    legend?: SemanticTokensLegend;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/inlayHint - Inline parameter/type hints */
  inlayHint?: {
    provide?(context: LspContext, params: InlayHintParams): MaybePromise<InlayHint[] | null>;
    resolve?(hint: InlayHint, context: LspContext): MaybePromise<InlayHint>;
  };

  /** textDocument/inlineValue - Debug inline values */
  inlineValue?: {
    provide?(
      context: LspContext,
      params: InlineValueParams
    ): MaybePromise<InlineValue[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MONIKERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** textDocument/moniker - Cross-repository symbol identification */
  moniker?: {
    provide?(context: LspContext, params: MonikerParams): MaybePromise<Moniker[] | null>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Additional diagnostics beyond Langium's built-in validation */
  diagnostics?: {
    provide?(context: LspContext): MaybePromise<Diagnostic[]>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSPACE FEATURES
  // ═══════════════════════════════════════════════════════════════════════════

  /** workspace/symbol - Workspace-wide symbol search */
  workspaceSymbol?: {
    provide?(
      query: string,
      context: WorkspaceContext
    ): MaybePromise<SymbolInformation[] | WorkspaceSymbol[] | null>;
    resolve?(symbol: WorkspaceSymbol, context: WorkspaceContext): MaybePromise<WorkspaceSymbol>;
  };

  /** Custom commands */
  commands?: {
    /** Command identifiers this provider handles */
    readonly commandIds: readonly string[];
    /** Execute a command */
    execute?(command: string, args: unknown[], context: WorkspaceContext): MaybePromise<unknown>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** File operation handlers */
  fileOperations?: {
    willCreate?(
      params: CreateFilesParams,
      context: WorkspaceContext
    ): MaybePromise<WorkspaceEdit | null>;
    didCreate?(params: CreateFilesParams, context: WorkspaceContext): MaybePromise<void>;
    willRename?(
      params: RenameFilesParams,
      context: WorkspaceContext
    ): MaybePromise<WorkspaceEdit | null>;
    didRename?(params: RenameFilesParams, context: WorkspaceContext): MaybePromise<void>;
    willDelete?(
      params: DeleteFilesParams,
      context: WorkspaceContext
    ): MaybePromise<WorkspaceEdit | null>;
    didDelete?(params: DeleteFilesParams, context: WorkspaceContext): MaybePromise<void>;
  };
}

/**
 * All LSP feature names for selective disabling.
 */
export type LspFeatureName = keyof LspFeatureProviders;

/**
 * Default semantic token types per LSP 3.17.
 */
export const DEFAULT_SEMANTIC_TOKEN_TYPES = [
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
 * Default semantic token modifiers per LSP 3.17.
 */
export const DEFAULT_SEMANTIC_TOKEN_MODIFIERS = [
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
