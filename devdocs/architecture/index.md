---
title: "Architecture"
description: "High-level platform architecture overview"
layout: layouts/doc.njk
eleventyNavigation:
  key: Architecture
  order: 5
---

This section covers the internal architecture of the Sanyam IDE platform for contributors who need to understand or modify the core infrastructure.

## High-Level Overview

Sanyam IDE is a grammar-agnostic IDE platform built on Eclipse Theia. It supports multiple domain-specific languages through a plugin-like grammar package system. The platform provides text editing (via LSP) and diagram editing (via GLSP) for any grammar that exports a `GrammarManifest` and `LanguageContribution`.

<svg viewBox="0 0 720 520" xmlns="http://www.w3.org/2000/svg" style="max-width:720px;width:100%;height:auto;font-family:'Inter',system-ui,sans-serif;">
  <defs>
    <style>
      .layer-fill { fill: var(--color-bg-alt, #f8f9fa); }
      .layer-stroke { stroke: var(--color-border, #dee2e6); fill: none; stroke-width: 1.5; }
      .inner-fill { fill: var(--color-bg, #ffffff); }
      .inner-stroke { stroke: var(--color-border-light, #e9ecef); fill: none; stroke-width: 1; }
      .label-primary { fill: var(--color-text, #212529); font-size: 13px; font-weight: 600; }
      .label-secondary { fill: var(--color-text-muted, #6c757d); font-size: 11px; }
      .label-small { fill: var(--color-text, #212529); font-size: 11px; font-weight: 500; }
      .accent-fill { fill: var(--color-primary, #4263eb); opacity: 0.08; }
      .accent-stroke { stroke: var(--color-primary, #4263eb); fill: none; stroke-width: 1.5; }
      .accent-label { fill: var(--color-primary, #4263eb); font-size: 11px; font-weight: 600; }
    </style>
  </defs>
  <!-- Layer 1: Applications -->
  <rect x="20" y="12" width="680" height="72" rx="8" class="layer-fill"/>
  <rect x="20" y="12" width="680" height="72" rx="8" class="layer-stroke"/>
  <text x="360" y="40" text-anchor="middle" class="label-primary">Applications</text>
  <text x="360" y="58" text-anchor="middle" class="label-secondary">Electron · Browser / Docker</text>
  <!-- Arrow 1→2 -->
  <line x1="360" y1="84" x2="360" y2="100" stroke="var(--color-border, #dee2e6)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Layer 2: Theia Extensions -->
  <rect x="20" y="100" width="680" height="80" rx="8" class="layer-fill"/>
  <rect x="20" y="100" width="680" height="80" rx="8" class="layer-stroke"/>
  <text x="360" y="120" text-anchor="middle" class="label-primary">Theia Extensions</text>
  <!-- Extension boxes -->
  <rect x="80" y="132" width="120" height="36" rx="5" class="inner-fill"/>
  <rect x="80" y="132" width="120" height="36" rx="5" class="inner-stroke"/>
  <text x="140" y="155" text-anchor="middle" class="label-small">Product</text>
  <rect x="220" y="132" width="120" height="36" rx="5" class="inner-fill"/>
  <rect x="220" y="132" width="120" height="36" rx="5" class="inner-stroke"/>
  <text x="280" y="155" text-anchor="middle" class="label-small">GLSP</text>
  <rect x="360" y="132" width="120" height="36" rx="5" class="inner-fill"/>
  <rect x="360" y="132" width="120" height="36" rx="5" class="inner-stroke"/>
  <text x="420" y="155" text-anchor="middle" class="label-small">Updater</text>
  <rect x="500" y="132" width="120" height="36" rx="5" class="inner-fill"/>
  <rect x="500" y="132" width="120" height="36" rx="5" class="inner-stroke"/>
  <text x="560" y="155" text-anchor="middle" class="label-small">Launcher</text>
  <!-- Arrow 2→3 -->
  <line x1="360" y1="180" x2="360" y2="196" stroke="var(--color-border, #dee2e6)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Layer 3: Unified Language Server -->
  <rect x="20" y="196" width="680" height="120" rx="8" class="layer-fill"/>
  <rect x="20" y="196" width="680" height="120" rx="8" class="layer-stroke"/>
  <text x="360" y="218" text-anchor="middle" class="label-primary">Unified Language Server</text>
  <!-- Inner server box -->
  <rect x="52" y="228" width="616" height="76" rx="6" class="accent-fill"/>
  <rect x="52" y="228" width="616" height="76" rx="6" class="accent-stroke" stroke-dasharray="4 3"/>
  <text x="360" y="248" text-anchor="middle" class="accent-label">Langium 4.x + GLSP Server</text>
  <!-- Server feature boxes -->
  <rect x="80" y="258" width="160" height="36" rx="5" class="inner-fill"/>
  <rect x="80" y="258" width="160" height="36" rx="5" class="inner-stroke"/>
  <text x="160" y="281" text-anchor="middle" class="label-small">LSP Features</text>
  <rect x="268" y="258" width="160" height="36" rx="5" class="inner-fill"/>
  <rect x="268" y="258" width="160" height="36" rx="5" class="inner-stroke"/>
  <text x="348" y="281" text-anchor="middle" class="label-small">GLSP Features</text>
  <rect x="456" y="258" width="180" height="36" rx="5" class="inner-fill"/>
  <rect x="456" y="258" width="180" height="36" rx="5" class="inner-stroke"/>
  <text x="546" y="281" text-anchor="middle" class="label-small">Operations Engine</text>
  <!-- Arrow 3→4 -->
  <line x1="360" y1="316" x2="360" y2="332" stroke="var(--color-border, #dee2e6)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Layer 4: Grammar Packages -->
  <rect x="20" y="332" width="680" height="80" rx="8" class="layer-fill"/>
  <rect x="20" y="332" width="680" height="80" rx="8" class="layer-stroke"/>
  <text x="360" y="352" text-anchor="middle" class="label-primary">Grammar Packages</text>
  <!-- Grammar boxes -->
  <rect x="100" y="362" width="110" height="36" rx="5" class="inner-fill"/>
  <rect x="100" y="362" width="110" height="36" rx="5" class="inner-stroke"/>
  <text x="155" y="385" text-anchor="middle" class="label-small">ECML</text>
  <rect x="230" y="362" width="110" height="36" rx="5" class="inner-fill"/>
  <rect x="230" y="362" width="110" height="36" rx="5" class="inner-stroke"/>
  <text x="285" y="385" text-anchor="middle" class="label-small">Lang B</text>
  <rect x="360" y="362" width="110" height="36" rx="5" class="inner-fill"/>
  <rect x="360" y="362" width="110" height="36" rx="5" class="inner-stroke"/>
  <text x="415" y="385" text-anchor="middle" class="label-small">Lang C</text>
  <rect x="490" y="362" width="110" height="36" rx="5" class="inner-fill"/>
  <rect x="490" y="362" width="110" height="36" rx="5" class="inner-stroke"/>
  <text x="545" y="385" text-anchor="middle" class="label-small">...</text>
  <!-- Arrow 4→5 -->
  <line x1="360" y1="412" x2="360" y2="428" stroke="var(--color-border, #dee2e6)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- Layer 5: @sanyam/types -->
  <rect x="20" y="428" width="680" height="68" rx="8" class="layer-fill"/>
  <rect x="20" y="428" width="680" height="68" rx="8" class="layer-stroke"/>
  <text x="360" y="456" text-anchor="middle" class="label-primary">@sanyam/types</text>
  <text x="360" y="474" text-anchor="middle" class="label-secondary">Interfaces only, no implementations</text>
  <!-- Arrowhead marker -->
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-border, #dee2e6)"/>
    </marker>
  </defs>
</svg>

## Core Principles

### Grammar Agnosticism

The platform contains zero grammar-specific code. All grammar knowledge flows through:

- **`GrammarManifest`** — Declarative configuration for UI, files, diagrams, operations
- **`LanguageContribution`** — Runtime wiring of grammar modules and providers
- **Registry lookups** — The `GrammarRegistry` maps language IDs and file extensions to manifests

This means adding a new language requires only creating a grammar package — no platform code changes.

### Build-Time Discovery

Grammar packages are discovered at build time by the grammar scanner, which:

1. Scans application dependencies for `@sanyam-grammar/*` packages
2. Reads the `sanyam` key from each package's `package.json`
3. Generates JavaScript loader files that import contributions and manifests
4. These loaders are compiled into the application bundle

### Unified Server

A single language server process handles all grammars. It:

- Registers Langium modules for each grammar's AST, parser, and services
- Routes LSP requests to the correct grammar based on document language ID
- Routes GLSP requests through the diagram pipeline
- Executes grammar operations

## Key Packages

| Package | Purpose |
|---|---|
| `@sanyam/types` | Shared type definitions (interfaces only, no implementations) |
| `sanyam-language-server` | Unified LSP + GLSP server |
| `@sanyam-ide/product` | Theia frontend: grammar registry, getting started, file management |
| `@sanyam-ide/glsp` | Theia frontend: diagram editor, Sprotty integration |
| `@sanyam-ide/updater` | Application auto-update |
| `@sanyam-ide/launcher` | External process launcher |
| `grammar-scanner` | Build-time grammar discovery and code generation |

## Section Contents

- [Build System](/architecture/build-system/) — Turborepo, pnpm workspaces, build pipeline
- [Dependency Flow](/architecture/dependency-flow/) — Package dependency graph
- [DI Patterns](/architecture/di-patterns/) — Inversify 6.x patterns and singleton scope
- [GLSP Pipeline](/architecture/glsp-pipeline/) — The three-layer request/response pipeline
