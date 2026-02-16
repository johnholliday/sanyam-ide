---
title: "Dependency Flow"
description: "Package dependency graph and data flow"
layout: layouts/doc.njk
eleventyNavigation:
  key: Dependency Flow
  parent: Architecture
  order: 2
---

Understanding the dependency flow is essential for knowing which packages to modify and rebuild when making changes.

## Package Dependency Graph

```
@sanyam/types (interfaces only, no implementations)
  ↓
sanyam-language-server (unified LSP/GLSP server)
  ↓
@sanyam-ide/* extensions (Theia frontend integrations)
  ↓
applications (electron, browser)

@sanyam-grammar/* packages → peerDepend on platform, discovered by grammar-scanner
```

### Layer by Layer

**Layer 1: Types**

`@sanyam/types` defines all shared interfaces (`GrammarManifest`, `LanguageContribution`, etc.) with zero implementations. Every other package depends on it.

**Layer 2: Language Server**

`sanyam-language-server` provides the unified LSP + GLSP server. It depends on:
- `@sanyam/types` for interface definitions
- `langium` for language services
- Grammar packages (loaded via generated code)

**Layer 3: Theia Extensions**

Extensions provide the browser-side functionality:
- `@sanyam-ide/product` — Grammar registry, getting started widget, file management
- `@sanyam-ide/glsp` — Diagram editor, Sprotty integration, action handlers
- `@sanyam-ide/updater` — Application auto-update
- `@sanyam-ide/launcher` — External process launcher

These depend on Theia APIs and `@sanyam/types`.

**Layer 4: Applications**

`sanyam-browser` and `sanyam-electron` are thin shells that compose extensions and configure Theia.

### Grammar Packages (Orthogonal)

Grammar packages (`@sanyam-grammar/*`) sit outside the main dependency chain. They:
- Have `@sanyam/types` as a dev dependency (for type definitions)
- Have `langium` as a runtime dependency
- Are discovered by the grammar scanner at build time
- Do not directly depend on the language server or extensions

## Data Flow

### Build-Time Flow

```
Grammar Packages
  ↓ (grammar-scanner reads package.json sanyam key)
grammar-scanner
  ↓ (generates grammars.js for server, grammar-manifests-module.js for frontend)
Language Server        Frontend
  ↓                     ↓
ENABLED_GRAMMARS       GrammarManifestMap
```

The grammar scanner runs during the application build and generates:
1. `grammars.js` — Server-side: exports an `ENABLED_GRAMMARS` array of `LanguageContribution` objects
2. `grammar-manifests-module.js` — Frontend-side: exports a `GrammarManifestMap` for the `GrammarRegistry`

### Runtime Flow (LSP)

```
User types in editor
  ↓
Monaco Editor (Theia frontend)
  ↓ (LSP messages via JSON-RPC)
Language Client
  ↓
Unified Language Server
  ↓ (routes by document languageId)
Grammar's Langium Services
  ↓
Response back to editor
```

### Runtime Flow (GLSP)

```
User opens diagram
  ↓
Sprotty Diagram Widget (GLSP extension)
  ↓ (GLSP actions via JSON-RPC)
SanyamLanguageClientProvider
  ↓
SanyamGlspBackendServiceImpl
  ↓
Language Server GLSP Handler
  ↓ (AST → GModel conversion)
ast-to-gmodel-provider
  ↓ (uses GrammarManifest for node/edge config)
GModel response
  ↓ (back through the three layers)
Sprotty renders diagram
```

## Impact Analysis

When you modify a file, here's what needs to be rebuilt:

| Changed | Rebuild |
|---|---|
| `@sanyam/types` | Everything downstream |
| Grammar `.langium` file | `langium generate`, then the grammar package, then application |
| Grammar `manifest.ts` | Grammar package, then application |
| Grammar `contribution.ts` | Grammar package, then application |
| Language server GLSP providers | Language server, then application (requires IDE restart) |
| Theia extension frontend code | Extension, then application (browser refresh may suffice) |
| Application config | Application only |

## Circular Dependency Prevention

The project forbids circular dependencies between packages. The layered architecture enforces this naturally:

- Types depend on nothing
- Server depends on types (and grammar packages via generated code)
- Extensions depend on types and Theia APIs
- Applications depend on extensions
- Grammar packages depend on types (dev) and langium (runtime)

The grammar scanner breaks what would otherwise be a circular dependency between the server and grammar packages: instead of the server importing grammar packages directly, the scanner generates import code at build time.
