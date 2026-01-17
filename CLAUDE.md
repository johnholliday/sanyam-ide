# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Sanyam IDE** (formerly Theia Blueprint) - a production desktop IDE built on the Eclipse Theia platform. It produces both an Electron desktop application and a browser-based version, packaging 45+ Theia extensions including AI features (Claude, GPT, Ollama, etc.).

## Build Commands

```bash
# Install dependencies
pnpm install

# Development build (faster, unminified frontend)
pnpm build:dev

# Production build
pnpm build

# Download VS Code extensions from Open VSX
pnpm download:plugins

# Full dev setup
pnpm install && pnpm build:dev && pnpm download:plugins
```

## Running the Application

```bash
# Browser app at http://localhost:3002
pnpm browser start

# Electron desktop app
pnpm electron start

# Electron with debug logging
pnpm electron start:debug
```

## Testing and Quality

```bash
# Run all tests
pnpm test

# E2E tests (requires preview package first)
pnpm electron package:preview
pnpm electron test

# Linting
pnpm lint
pnpm lint:fix

# License compliance check
pnpm license:check
```

## Packaging

```bash
# Package Electron app (output in applications/electron/dist)
pnpm package:applications

# Preview package (unpackaged, for testing)
pnpm electron package:preview

# Production package with publishing
pnpm electron package:prod
```

## Architecture

**Monorepo Structure** (Lerna + pnpm workspaces):

```
applications/
├── electron/          # Electron desktop app (main target)
│   ├── scripts/       # Build, signing, main process entry
│   ├── resources/     # Icons, splash screen
│   └── test/          # E2E tests (WebdriverIO)
└── browser/           # Browser/Docker version

packages/
├── types/             # Shared type definitions (@sanyam/types)
├── language-server/   # Unified LSP/GLSP language server
├── ide/               # IDE-specific Theia extensions (@sanyam-ide/*)
│   ├── product/       # Branding: about dialog, welcome page, splash
│   ├── updater/       # Auto-update mechanism (electron-updater)
│   ├── launcher/      # AppImage CLI launcher ('theia' command)
│   └── glsp/          # GLSP diagram frontend integration
└── grammar/           # DSL grammar packages (@sanyam-grammar/*)
    ├── ecml/          # ECML grammar package
    └── example-minimal/ # Reference minimal grammar
```

**Build Flow**:

1. `build:extensions` - TypeScript compilation of custom extensions
2. `build:applications` - Theia generates webpack configs, bundles frontend/backend
3. `download:plugins` - Fetches VS Code extensions from Open VSX
4. `package` - electron-builder creates installers

**Key Configuration**:

- `applications/electron/package.json` - App dependencies, Theia target config
- `applications/electron/electron-builder.yml` - Packaging, signing, installers
- `configs/base.tsconfig.json` - Shared TypeScript settings

## Debugging (VS Code)

Pre-configured launch configurations in `.vscode/launch.json`:

- **Launch Electron Backend** - Debug the Node.js backend
- **Attach to Electron Frontend** - Chrome DevTools (port 9222)
- **Launch Browser Backend** - Debug browser version backend
- **Launch Browser Frontend** - Chrome at localhost:3002
- **Attach to Plugin Host** - Debug VS Code extensions (port 9339)

Compound configurations available for full-stack debugging.

## Updating Theia Version

```bash
# Update to specific Theia version
pnpm update:theia <version>

# Update to next/development branch
pnpm update:next
```

## Docker

```bash
# Build browser app Docker image
docker build -t sanyam-ide -f browser.Dockerfile .

# Run container
docker run -p=3002:3002 --rm sanyam-ide
```

## Unified Language Server

The `@sanyam/language-server` package provides unified LSP and GLSP support for all grammar packages.

### Language Server Build Commands

```bash
# Build the language server
cd packages/language-server
pnpm build

# Generate grammar registry from workspace
pnpm generate:registry

# Build with VSIX packaging (generates TextMate grammars)
pnpm build:vsix

# Package as VS Code extension
pnpm package:vsix
```

### Adding a Grammar

Grammar packages follow this structure:

```
packages/grammar/your-language/
├── your-language.langium    # Langium grammar
├── manifest.ts              # GrammarManifest export
├── package.json             # With sanyam.contribution field
└── src/
    └── contribution.ts      # LanguageContribution implementation
```

Key package.json fields:

```json
{
  "sanyam": {
    "contribution": "./lib/src/contribution.js"
  }
}
```

## Custom Commands

### `/grammar-config <argument>`

Generate grammar packages with `GrammarManifest` exports for the SANYAM platform.

**Usage:**

```bash
# From existing grammar
/grammar-config mygrammar

# Create new grammar (starter template)
/grammar-config newlanguage

# From natural language description
/grammar-config "A language for modeling REST APIs with resources and methods"
```

**Generated files:**

- `packages/grammar/{name}/{name}.langium` - Langium grammar (if creating new)
- `packages/grammar/{name}/manifest.ts` - GrammarManifest export
- `packages/grammar/{name}/package.json` - Package configuration

**Related packages:**

- `@sanyam/types` - Type definitions including `GrammarManifest`

## Important Notes

- After updating dependencies or switching commits, run `git clean -xfd` to avoid runtime conflicts
- Extensions in `packages/theia-extensions/` are custom to this product; Theia platform extensions come from `@theia/*` packages
- Grammar packages in `packages/grammar/` provide language support via the unified server
- The `plugins/` directory contains downloaded VS Code extensions (created by `download:plugins`)
- Generated files appear in `src-gen/` and `lib/` directories within applications

## Active Technologies

- TypeScript 5.6.3 (ES2017 target, strict mode) + Langium 4.x (grammar parsing), @eclipse-glsp/server 2.x (diagrams), Theia 1.67.0 (IDE platform), Inversify 6.x (DI) (002-unified-lsp-glsp)
- File system (grammar packages in workspace), LangiumDocuments (in-memory document store) (002-unified-lsp-glsp)

- TypeScript 5.x (per constitution) + Langium 4.x (grammar parsing), Claude Code (AI generation) (001-grammar-config-command)
- File system (packages/grammar/{name}/ directory structure) (001-grammar-config-command)

## Recent Changes

- 002-unified-lsp-glsp: Added unified LSP/GLSP language server with bidirectional text-diagram sync
- 001-grammar-config-command: Added TypeScript 5.x (per constitution) + Langium 4.x (grammar parsing), Claude Code (AI generation)
