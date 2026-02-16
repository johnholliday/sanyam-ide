---
title: "Sanyam IDE Developer Documentation"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---

# Sanyam IDE Developer Documentation

Welcome to the developer documentation for the Sanyam IDE platform. This site covers everything you need to know to create grammar packages, extend platform behavior, and understand the internal architecture.

## Who is this for?

- **Grammar Authors** who want to create a new domain-specific language for the platform
- **Platform Contributors** who want to understand or modify the core IDE infrastructure
- **Integration Developers** who want to extend the platform with custom LSP or GLSP providers

## Quick Links

### Grammar Manifest Reference

The `GrammarManifest` is the central configuration object that describes how a grammar integrates with the platform. Every grammar package exports one.

- [Manifest Overview](/grammar-manifest/) — The `GrammarManifest` interface and its top-level fields
- [Root Types](/grammar-manifest/root-types/) — `RootTypeConfig` for file types, templates, icons, and diagram nodes
- [Diagram Types](/grammar-manifest/diagram-types/) — `DiagramTypeConfig` for node types, edge types, and diagram views
- [Tool Palette](/grammar-manifest/tool-palette/) — `ToolPaletteConfig` for diagram tool groups and items
- [Ports & Connections](/grammar-manifest/ports-and-connections/) — `PortConfig` and `ConnectionRule` for node connection points
- [Operations](/grammar-manifest/operations/) — `GrammarOperation` for custom commands and API endpoints
- [Validation](/grammar-manifest/validation/) — `validateManifest()` and the `isGrammarManifest()` type guard

### Grammar Authoring Guide

Step-by-step guidance for creating and configuring grammar packages.

- [Getting Started](/getting-started/) — Create your first grammar package in minutes
- [Package Structure](/grammar-authoring/package-structure/) — Directory layout, `package.json` sanyam key, exports
- [Language Contribution](/grammar-authoring/language-contribution/) — The `LanguageContribution` interface
- [Custom Modules](/grammar-authoring/custom-modules/) — Inversify DI modules for overriding platform services
- [LSP Providers](/grammar-authoring/lsp-providers/) — Custom Language Server Protocol features
- [GLSP Providers](/grammar-authoring/glsp-providers/) — Custom diagram rendering and behavior

### Platform Architecture

Deep dives into the internal architecture for platform contributors.

- [Architecture Overview](/architecture/) — High-level system design
- [Build System](/architecture/build-system/) — Turborepo, pnpm workspaces, build pipeline
- [Dependency Flow](/architecture/dependency-flow/) — Package dependency graph
- [DI Patterns](/architecture/di-patterns/) — Inversify 6.x patterns and singleton scope
- [GLSP Pipeline](/architecture/glsp-pipeline/) — The three-layer request/response pipeline

## Tech Stack

| Technology | Version |
|---|---|
| TypeScript | ~5.6.3 |
| Langium | 4.1.0 |
| Eclipse GLSP | 2.5.0 |
| Eclipse Theia | 1.67.0 |
| Inversify | 6.x |
| Sprotty | 1.4.0 |
| Node.js | >=20 |
| pnpm | >=9 |
