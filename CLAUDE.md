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
# Browser app at http://localhost:3000
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

theia-extensions/
├── product/           # Branding: about dialog, welcome page, splash
├── updater/           # Auto-update mechanism (electron-updater)
└── launcher/          # AppImage CLI launcher ('theia' command)
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
- **Launch Browser Frontend** - Chrome at localhost:3000
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
docker build -t theia-ide -f browser.Dockerfile .

# Run container
docker run -p=3000:3000 --rm theia-ide
```

## Important Notes

- After updating dependencies or switching commits, run `git clean -xfd` to avoid runtime conflicts
- Extensions in `theia-extensions/` are custom to this product; Theia platform extensions come from `@theia/*` packages
- The `plugins/` directory contains downloaded VS Code extensions (created by `download:plugins`)
- Generated files appear in `src-gen/` and `lib/` directories within applications
