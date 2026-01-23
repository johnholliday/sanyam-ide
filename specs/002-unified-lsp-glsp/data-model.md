# Data Model: Unified LSP/GLSP Language Server

**Feature**: 002-unified-lsp-glsp
**Date**: 2026-01-16

## Overview

This document defines the core entities, their relationships, and state transitions for the unified LSP/GLSP language server. The data model is designed to support grammar-agnostic language services with manifest-driven configuration.

---

## Core Entities

### 1. LanguageContribution

The primary interface that grammar packages export to register with the unified server.

```
┌─────────────────────────────────────────────────────────────┐
│                   LanguageContribution                       │
├─────────────────────────────────────────────────────────────┤
│ languageId: string (unique identifier)                       │
│ fileExtensions: string[] (e.g., ['.ecml'])                  │
│ generatedSharedModule: Module (Langium shared services)      │
│ generatedModule: Module (Langium language services)          │
│ customModule?: Module (optional overrides)                   │
│ manifest: GrammarManifest (UI/diagram config)               │
│ lspProviders?: LspFeatureProviders (optional overrides)     │
│ glspProviders?: GlspFeatureProviders (optional overrides)   │
│ disabledLspFeatures?: string[] (features to disable)        │
│ disabledGlspFeatures?: string[] (features to disable)       │
└─────────────────────────────────────────────────────────────┘
```

**Relationships**:
- Contains exactly one `GrammarManifest`
- Contains zero or one `LspFeatureProviders`
- Contains zero or one `GlspFeatureProviders`
- References Langium `Module` types for DI composition

**Validation Rules**:
- `languageId` must be unique across all contributions
- `fileExtensions` must not overlap with other contributions
- `generatedSharedModule` and `generatedModule` are required
- All referenced modules must be valid Langium modules

---

### 2. GrammarManifest (Existing, Extended)

Configuration that drives UI presentation, diagram rendering, and tool palette generation. Already exists in `@sanyam/types`, extended for this feature.

```
┌─────────────────────────────────────────────────────────────┐
│                      GrammarManifest                         │
├─────────────────────────────────────────────────────────────┤
│ languageId: string                                           │
│ displayName: string                                          │
│ fileExtensions: string[]                                     │
│ baseExtension: string                                        │
│ rootTypes: RootTypeConfig[]                                  │
│ diagramTypes?: DiagramTypeConfig[]                          │
│ toolPalette?: ToolPaletteConfig                             │
│ documentationBaseUrl?: string                               │
│ iconPath?: string                                           │
└─────────────────────────────────────────────────────────────┘
```

**Sub-entities**:

```
RootTypeConfig {
    astType: string
    fileSuffix: string
    folder: string
    diagramNode?: DiagramNodeConfig
}

DiagramNodeConfig {
    glspType: string
    shape: 'rectangle' | 'ellipse' | 'diamond' | 'hexagon'
    cssClass: string
    defaultSize: { width: number, height: number }
}

DiagramTypeConfig {
    id: string
    name: string
    rootAstType: string
    nodeTypes: NodeTypeConfig[]
    edgeTypes: EdgeTypeConfig[]
}

ToolPaletteConfig {
    groups: ToolPaletteGroup[]
}

ToolPaletteGroup {
    id: string
    label: string
    icon: string
    items: ToolPaletteItem[]
}
```

---

### 3. LspFeatureProviders

Interface for providing custom LSP feature implementations.

```
┌─────────────────────────────────────────────────────────────┐
│                    LspFeatureProviders                       │
├─────────────────────────────────────────────────────────────┤
│ completion?: CompletionProvider                              │
│ hover?: HoverProvider                                        │
│ signatureHelp?: SignatureHelpProvider                       │
│ declaration?: DeclarationProvider                            │
│ definition?: DefinitionProvider                              │
│ typeDefinition?: TypeDefinitionProvider                      │
│ implementation?: ImplementationProvider                      │
│ references?: ReferencesProvider                              │
│ documentHighlight?: DocumentHighlightProvider               │
│ documentSymbol?: DocumentSymbolProvider                      │
│ codeAction?: CodeActionProvider                              │
│ codeLens?: CodeLensProvider                                  │
│ documentLink?: DocumentLinkProvider                          │
│ documentColor?: DocumentColorProvider                        │
│ formatting?: FormattingProvider                              │
│ rangeFormatting?: RangeFormattingProvider                   │
│ onTypeFormatting?: OnTypeFormattingProvider                 │
│ rename?: RenameProvider                                      │
│ foldingRange?: FoldingRangeProvider                         │
│ selectionRange?: SelectionRangeProvider                      │
│ linkedEditingRange?: LinkedEditingRangeProvider             │
│ callHierarchy?: CallHierarchyProvider                       │
│ typeHierarchy?: TypeHierarchyProvider                       │
│ semanticTokens?: SemanticTokensProvider                     │
│ inlayHint?: InlayHintProvider                               │
│ inlineValue?: InlineValueProvider                            │
│ moniker?: MonikerProvider                                    │
│ diagnostics?: DiagnosticsProvider                            │
│ workspaceSymbol?: WorkspaceSymbolProvider                   │
│ commands?: CommandsProvider                                  │
│ fileOperations?: FileOperationsProvider                      │
└─────────────────────────────────────────────────────────────┘
```

**Relationships**:
- Each provider references `LspContext` for document/service access
- Providers return LSP protocol types from `vscode-languageserver`

---

### 4. GlspFeatureProviders

Interface for providing custom GLSP feature implementations.

```
┌─────────────────────────────────────────────────────────────┐
│                   GlspFeatureProviders                       │
├─────────────────────────────────────────────────────────────┤
│ astToGModel?: AstToGModelProvider                           │
│ gmodelToAst?: GModelToAstProvider                           │
│ toolPalette?: ToolPaletteProvider                           │
│ validation?: DiagramValidationProvider                       │
│ layout?: LayoutProvider                                      │
│ contextMenu?: ContextMenuProvider                            │
└─────────────────────────────────────────────────────────────┘

AstToGModelProvider {
    convert?(ast, context): GModelRoot
    createNode?(ast, config, context): GNode | null
    createEdge?(source, target, relationName, context): GEdge | null
    getLabel?(ast): string
    getPosition?(ast): Point | undefined
    getSize?(ast): Dimension | undefined
}

GModelToAstProvider {
    applyPosition?(ast, position): void
    applySize?(ast, size): void
    createNode?(glspType, position, context): AstNode
    createEdge?(glspType, sourceId, targetId, context): void
}
```

**Relationships**:
- References `GlspContext` for manifest/service access
- Works with GLSP types (`GModelRoot`, `GNode`, `GEdge`)
- Transforms between Langium AST and GLSP GModel

---

### 5. LspContext

Runtime context passed to LSP feature providers.

```
┌─────────────────────────────────────────────────────────────┐
│                       LspContext                             │
├─────────────────────────────────────────────────────────────┤
│ document: LangiumDocument (parsed AST + metadata)           │
│ services: LangiumServices (language-specific services)      │
│ shared: LangiumSharedServices (cross-language services)     │
│ token: CancellationToken (request cancellation)             │
└─────────────────────────────────────────────────────────────┘
```

**Relationships**:
- References Langium's document and services types
- Created per-request by the LSP handler

---

### 6. GlspContext

Runtime context passed to GLSP feature providers.

```
┌─────────────────────────────────────────────────────────────┐
│                       GlspContext                            │
├─────────────────────────────────────────────────────────────┤
│ document: LangiumDocument (source document)                 │
│ services: LangiumServices (language-specific services)      │
│ shared: LangiumSharedServices (cross-language services)     │
│ manifest: GrammarManifest (UI/diagram configuration)        │
│ diagramType: DiagramTypeConfig (current diagram config)     │
└─────────────────────────────────────────────────────────────┘
```

**Relationships**:
- Extends LspContext concepts for diagram operations
- Includes manifest for configuration access

---

### 7. LanguageRegistry

Runtime registry that manages all loaded language contributions.

```
┌─────────────────────────────────────────────────────────────┐
│                    LanguageRegistry                          │
├─────────────────────────────────────────────────────────────┤
│ languages: Map<languageId, RegisteredLanguage>              │
│ extensionMap: Map<fileExtension, languageId>                │
│ sharedServices: LangiumSharedServices                       │
├─────────────────────────────────────────────────────────────┤
│ register(contribution): void                                 │
│ getByLanguageId(id): RegisteredLanguage | undefined         │
│ getByExtension(ext): RegisteredLanguage | undefined         │
│ getByUri(uri): RegisteredLanguage | undefined               │
│ getAllLanguageIds(): string[]                               │
└─────────────────────────────────────────────────────────────┘

RegisteredLanguage {
    contribution: LanguageContribution
    services: LangiumServices
    mergedLspProviders: LspFeatureProviders
    mergedGlspProviders: GlspFeatureProviders
}
```

**Validation Rules**:
- No duplicate `languageId` values
- No duplicate file extensions
- All contributions must pass manifest validation

**State Transitions**:
```
[Unregistered] --register()--> [Registered]
                                    │
                              (services created,
                               providers merged)
```

---

### 8. ConversionResult

Result of AST to GModel conversion, maintaining bidirectional mapping.

```
┌─────────────────────────────────────────────────────────────┐
│                    ConversionResult                          │
├─────────────────────────────────────────────────────────────┤
│ root: GModelRoot (the graph model)                          │
│ nodeMap: Map<AstNode, string> (AST node → GModel ID)        │
│ idMap: Map<string, AstNode> (GModel ID → AST node)          │
└─────────────────────────────────────────────────────────────┘
```

**Usage**:
- Created by `AstToGModelProvider.convert()`
- Used by operation handlers to find AST nodes from diagram selections
- Updated incrementally on document changes

---

### 9. ModelSubscription

Subscription for Model API change notifications.

```
┌─────────────────────────────────────────────────────────────┐
│                    ModelSubscription                         │
├─────────────────────────────────────────────────────────────┤
│ id: string (unique subscription identifier)                 │
│ documentUri: string (subscribed document)                   │
│ clientId: string (subscribing client)                       │
│ createdAt: Date                                             │
│ lastNotified: Date                                          │
└─────────────────────────────────────────────────────────────┘
```

**Relationships**:
- Many subscriptions can exist per document
- Managed by `SubscriptionService`

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Grammar Package                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LanguageContribution                          │   │
│  │                           │                                      │   │
│  │      ┌────────────────────┼────────────────────┐                │   │
│  │      │                    │                    │                │   │
│  │      ▼                    ▼                    ▼                │   │
│  │ ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐      │   │
│  │ │GrammarManifest│   │LspProviders │   │GlspProviders     │      │   │
│  │ │             │   │(optional)    │   │(optional)        │      │   │
│  │ └──────┬──────┘   └──────────────┘   └──────────────────┘      │   │
│  │        │                                                        │   │
│  │        ▼                                                        │   │
│  │ ┌──────────────┐                                               │   │
│  │ │DiagramTypes  │                                               │   │
│  │ │ToolPalette   │                                               │   │
│  │ │RootTypes     │                                               │   │
│  │ └──────────────┘                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ registered at build/runtime
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Unified Server                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LanguageRegistry                              │   │
│  │                           │                                      │   │
│  │           ┌───────────────┼───────────────┐                     │   │
│  │           │               │               │                     │   │
│  │           ▼               ▼               ▼                     │   │
│  │   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │   │
│  │   │ LSP Handler   │ │ GLSP Server   │ │ Model API     │        │   │
│  │   │               │ │               │ │               │        │   │
│  │   │  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │        │   │
│  │   │  │LspContext│  │ │  │GlspContext│  │ │  │Subscriptions│     │   │
│  │   │  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │        │   │
│  │   └───────┬───────┘ └───────┬───────┘ └───────┬───────┘        │   │
│  │           │               │               │                     │   │
│  │           └───────────────┼───────────────┘                     │   │
│  │                           ▼                                      │   │
│  │   ┌─────────────────────────────────────────────────────────┐   │   │
│  │   │              Langium Document Store                      │   │   │
│  │   │                (Single Source of Truth)                  │   │   │
│  │   └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### Document Lifecycle

```
                 ┌──────────────┐
                 │   Unknown    │
                 └──────┬───────┘
                        │ open
                        ▼
                 ┌──────────────┐
                 │   Parsing    │
                 └──────┬───────┘
                        │ parse complete
                        ▼
                 ┌──────────────┐
         ┌──────│    Parsed    │──────┐
         │      └──────┬───────┘      │
         │             │              │
         │ validation  │ change       │
         │ complete    │              │
         ▼             ▼              │
  ┌──────────────┐  ┌──────────────┐  │
  │  Validated   │  │   Dirty      │──┘
  │              │  │  (re-parse)  │
  └──────────────┘  └──────────────┘
         │
         │ close
         ▼
  ┌──────────────┐
  │   Closed     │
  └──────────────┘
```

### Diagram Session Lifecycle

```
  ┌──────────────┐
  │   No View    │
  └──────┬───────┘
         │ open diagram
         ▼
  ┌──────────────┐
  │  Converting  │──── AST → GModel
  └──────┬───────┘
         │ conversion complete
         ▼
  ┌──────────────┐      user edit
  │   Active     │◄────────────────┐
  └──────┬───────┘                 │
         │                         │
         │ text change             │
         ▼                         │
  ┌──────────────┐                 │
  │ Synchronizing│─────────────────┘
  └──────┬───────┘   sync complete
         │
         │ close
         ▼
  ┌──────────────┐
  │   Closed     │
  └──────────────┘
```

---

## Validation Rules Summary

| Entity | Rule | Error |
|--------|------|-------|
| LanguageContribution | `languageId` must be unique | "Duplicate language ID: {id}" |
| LanguageContribution | `fileExtensions` must not overlap | "Extension already registered: {ext}" |
| GrammarManifest | Must have at least one `rootType` | "Manifest must define root types" |
| DiagramTypeConfig | `rootAstType` must exist in manifest | "Unknown AST type: {type}" |
| LspFeatureProviders | Provider methods must match LSP signatures | Type error at compile time |
| ModelSubscription | `documentUri` must be valid URI | "Invalid document URI" |
