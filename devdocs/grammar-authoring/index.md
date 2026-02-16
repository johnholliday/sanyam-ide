---
title: "Grammar Authoring"
description: "Guide to creating and configuring grammar packages"
layout: layouts/doc.njk
eleventyNavigation:
  key: Grammar Authoring
  order: 4
---

This section covers the full lifecycle of creating a grammar package for the Sanyam IDE platform, from package structure through custom LSP and GLSP providers.

## Overview

A grammar package is a self-contained npm package that provides:

1. **Grammar definition** — A Langium `.langium` file that defines the language syntax
2. **Grammar manifest** — A `GrammarManifest` that describes file organization, diagram support, and operations
3. **Language contribution** — A `LanguageContribution` that wires the grammar into the unified server
4. **Optional customizations** — Custom LSP providers, GLSP providers, DI modules, and diagram views

## How Grammar Packages are Discovered

The platform uses a build-time scanner to discover grammar packages. The scanner:

1. Finds all packages matching `@sanyam-grammar/*` in the application's dependencies
2. Checks each package's `package.json` for the `sanyam.grammar: true` key
3. Generates loader code that imports contributions and manifests
4. The unified language server loads all contributions at startup
5. The browser frontend loads all manifests for UI configuration

This means adding a new grammar is as simple as:
- Creating the package under `packages/grammar-definitions/`
- Adding it as a dependency of the application
- Rebuilding

No platform code changes are needed.

## Package Lifecycle

```
1. Author grammar definition (.langium)
     ↓
2. Run `langium generate` → TypeScript types in src/generated/
     ↓
3. Create manifest.ts → GrammarManifest configuration
     ↓
4. Create contribution.ts → LanguageContribution export
     ↓
5. Optional: Add custom modules, providers, diagram views
     ↓
6. Build: `langium generate && tsc -b`
     ↓
7. Add to application dependencies
     ↓
8. Rebuild application: `pnpm build:browser` or `pnpm build:electron`
```

## Section Contents

- [Package Structure](/grammar-authoring/package-structure/) — Directory layout, `package.json` configuration, exports
- [Language Contribution](/grammar-authoring/language-contribution/) — The `LanguageContribution` interface and its fields
- [Custom Modules](/grammar-authoring/custom-modules/) — Inversify DI modules for overriding platform services
- [LSP Providers](/grammar-authoring/lsp-providers/) — Custom Language Server Protocol features
- [GLSP Providers](/grammar-authoring/glsp-providers/) — Custom diagram rendering and behavior
