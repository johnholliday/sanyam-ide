# Implementation Plan: Unified LSP/GLSP Language Server

**Branch**: `002-unified-lsp-glsp` | **Date**: 2026-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-unified-lsp-glsp/spec.md`

## Summary

This plan implements a unified language server for Sanyam IDE that runs LSP, GLSP, and Model API in a single Node.js process. The server automatically discovers grammar packages from pnpm workspace dependencies, provides default implementations for all LSP 3.17 features, and enables manifest-driven GLSP diagram support. Grammar packages can selectively override features while relying on sensible defaults.

## Technical Context

**Language/Version**: TypeScript 5.6.3 (ES2017 target, strict mode)
**Primary Dependencies**: Langium 4.x (grammar parsing), @eclipse-glsp/server 2.x (diagrams), Theia 1.67.0 (IDE platform), Inversify 6.x (DI)
**Storage**: File system (grammar packages in workspace), LangiumDocuments (in-memory document store)
**Testing**: Mocha + Chai (unit/integration), WebdriverIO (E2E for Electron)
**Target Platform**: Node.js 20+, Electron 38.4.0 (desktop), Browser (web version)
**Project Type**: Monorepo (Lerna + pnpm workspaces)
**Performance Goals**: Completion <1s, Definition <2s, Diagram render (200 nodes) <3s, Sync <1s
**Constraints**: Single VSIX deployment, single server process, grammar-agnostic platform code
**Scale/Scope**: 4+ grammar packages initially, unlimited via discovery pattern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| Grammar Agnosticism | PASS | All grammar-specific knowledge flows through GrammarManifest and LanguageContribution interfaces. No hard-coded AST types in platform. |
| Backward Compatibility | PASS | New packages (@sanyam/language-server) added; existing packages unchanged. Grammar packages extend, not replace. |
| Declarative Over Imperative | PASS | GrammarManifest drives diagram configuration. LSP/GLSP features configured via provider interfaces. |
| Extension Over Modification | PASS | Grammar packages override via registry registration and DI bindings, not patches. |
| TypeScript 5.x | PASS | Using TypeScript 5.6.3 per constitution. |
| Langium 4.x | PASS | Specification requires Langium 4.x for grammar parsing. |
| Eclipse GLSP 2.x | PASS | GLSP server 2.x for diagram functionality. |
| Inversify 6.x | PASS | Services injectable via Inversify DI container. |
| No Python | PASS | All tooling in TypeScript. |
| No `any` without justification | PASS | Using typed interfaces throughout (LspContext, GlspContext, etc.). |
| No circular dependencies | PASS | Clear package hierarchy: types → language-server → grammar packages. |
| Package boundaries | PASS | @sanyam/types (interfaces), @sanyam/language-server (server), grammars/* (per-language). |

**Gate Result**: PASS - All constitution requirements satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/002-unified-lsp-glsp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── lsp-providers.ts
│   ├── glsp-providers.ts
│   └── language-contribution.ts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── types/                    # @sanyam/types (existing, extended)
│   └── src/
│       ├── grammar-manifest.ts     # Existing manifest types
│       ├── lsp-providers.ts        # NEW: LSP provider interfaces
│       ├── glsp-providers.ts       # NEW: GLSP provider interfaces
│       ├── language-contribution.ts # NEW: Grammar package contract
│       └── index.ts                # Updated exports
│
└── language-server/               # NEW: @sanyam/language-server unified server
    ├── src/
    │   ├── main.ts               # Server entry point
    │   ├── extension.ts          # VS Code client activation
    │   ├── discovery/
    │   │   ├── grammar-scanner.ts       # Build-time package scanner
    │   │   └── contribution-loader.ts   # Runtime contribution loading
    │   ├── lsp/
    │   │   ├── default-providers.ts     # All LSP 3.17 defaults
    │   │   ├── feature-merger.ts        # Custom + default merging
    │   │   ├── lsp-handler.ts           # LSP message routing
    │   │   └── helpers/
    │   │       ├── ast-utils.ts
    │   │       ├── position-utils.ts
    │   │       ├── reference-utils.ts
    │   │       ├── symbol-utils.ts
    │   │       ├── hierarchy-utils.ts
    │   │       ├── formatting-utils.ts
    │   │       └── workspace-utils.ts
    │   ├── glsp/
    │   │   ├── glsp-server-module.ts    # GLSP DI module
    │   │   ├── manifest-converter.ts    # AST ↔ GModel conversion
    │   │   ├── langium-model-state.ts   # Langium-backed model state
    │   │   ├── tool-palette-provider.ts # Manifest-driven palette
    │   │   └── handlers/
    │   │       ├── create-node-handler.ts
    │   │       ├── delete-element-handler.ts
    │   │       ├── change-bounds-handler.ts
    │   │       └── reconnect-edge-handler.ts
    │   ├── model/
    │   │   ├── ast-server.ts            # Model API server
    │   │   ├── model-converter.ts       # AST ↔ JSON conversion
    │   │   └── subscription-service.ts  # Change notifications
    │   └── language-registry.ts         # Runtime language registry
    ├── syntaxes/             # Generated TextMate grammars
    ├── esbuild.mjs           # Build configuration
    ├── package.json
    └── tsconfig.json

grammars/
├── ecml/                     # Example migration
│   ├── ecml.langium
│   ├── langium-config.json   # NEW: Langium CLI config
│   ├── manifest.ts           # Existing (enhanced)
│   ├── src/
│   │   ├── generated/        # langium generate output
│   │   ├── ecml-module.ts    # Custom Langium services
│   │   ├── contribution.ts   # NEW: LanguageContribution export
│   │   ├── lsp-overrides.ts  # NEW: Optional LSP overrides
│   │   └── glsp-overrides.ts # NEW: Optional GLSP overrides
│   └── package.json          # Updated with sanyam field
├── actone/                   # Migration template
├── iso-42001/                # Migration template
└── spdevkit/                 # Migration template

theia-extensions/
└── glsp/                     # NEW: GLSP frontend integration
    ├── src/
    │   ├── browser/
    │   │   ├── glsp-frontend-module.ts
    │   │   └── diagram-widget.ts
    │   └── common/
    │       └── glsp-contribution.ts
    └── package.json

tests/
├── unit/
│   ├── lsp/
│   │   ├── default-providers.spec.ts
│   │   └── feature-merger.spec.ts
│   ├── glsp/
│   │   └── manifest-converter.spec.ts
│   └── discovery/
│       └── grammar-scanner.spec.ts
├── integration/
│   ├── lsp-features.spec.ts
│   └── glsp-operations.spec.ts
└── e2e/
    └── diagram-editing.spec.ts
```

**Structure Decision**: Monorepo with new `packages/language-server` for the unified server and extended `packages/types` for contracts. Grammar packages migrated in-place with new contribution exports.

## Complexity Tracking

No constitution violations requiring justification.

## Phase Dependencies

```
Phase 0 (Research) → Phase 1 (Design) → Phase 2 (Tasks)
     │                    │
     │                    └── data-model.md
     │                    └── contracts/
     │                    └── quickstart.md
     │
     └── research.md (resolves NEEDS CLARIFICATION items)
```
