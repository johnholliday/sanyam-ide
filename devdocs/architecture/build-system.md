---
title: "Build System"
description: "Turborepo, pnpm workspaces, and the build pipeline"
layout: layouts/doc.njk
eleventyNavigation:
  key: Build System
  parent: Architecture
  order: 1
---

The Sanyam IDE monorepo uses pnpm workspaces for package management and Turborepo for orchestrating builds across the dependency graph.

## Workspace Layout

```
sanyam-ide/
├── packages/                           # Core platform packages
│   ├── types/                          # @sanyam/types (shared interfaces)
│   ├── language-server/                # sanyam-language-server
│   ├── grammar-scanner/                # Build-time grammar discovery
│   ├── document-store/                 # @sanyam/document-store
│   ├── supabase-auth/                  # @sanyam/supabase-auth
│   ├── licensing/                      # @sanyam/licensing
│   ├── theia-extensions/               # Theia extension packages
│   │   ├── glsp/                       # @sanyam-ide/glsp
│   │   ├── product/                    # @sanyam-ide/product
│   │   ├── updater/                    # @sanyam-ide/updater
│   │   └── launcher/                   # @sanyam-ide/launcher
│   └── grammar-definitions/            # Grammar packages
│       └── ecml/                       # @sanyam-grammar/ecml
├── applications/                       # Application shells
│   ├── browser/                        # sanyam-browser (Theia browser app)
│   └── electron/                       # sanyam-electron (Theia desktop app)
├── configs/                            # Shared configs (tsconfig, eslint)
├── tests/                              # End-to-end tests
├── docs/                               # User documentation (Eleventy)
├── devdocs/                            # Developer documentation (Eleventy)
└── supabase/                           # Supabase migrations and seeds
```

Workspaces are defined in the root `package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "packages/theia-extensions/*",
    "packages/grammar-definitions/*",
    "packages/grammar-definitions/*/docs",
    "applications/*",
    "tests/*"
  ]
}
```

## Build Commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages (dev mode) |
| `pnpm build:prod` | Production build |
| `pnpm build:grammars` | Grammar packages only |
| `pnpm build:extensions` | Theia extensions only |
| `pnpm build:language-server` | Language server only |
| `pnpm build:browser` | Browser app + language server |
| `pnpm build:electron` | Electron app + language server |
| `pnpm watch` | Watch all packages |
| `pnpm watch:ide` | Watch extensions only |

## Turborepo Configuration

Turborepo manages task dependencies and caching. The configuration in `turbo.json` defines:

### Build Task

```json
{
  "build": {
    "dependsOn": ["^build"],
    "inputs": [
      "src/**",
      "tsconfig*.json",
      "package.json"
    ],
    "outputs": [
      "lib/**",
      "src/generated/**",
      "*.tsbuildinfo"
    ]
  }
}
```

Key points:
- `"dependsOn": ["^build"]` — Each package builds after its dependencies
- `inputs` — Turbo hashes these files to determine if a rebuild is needed
- `outputs` — Cached artifacts that Turbo restores on cache hit

### Caching Behavior

Turborepo caches build outputs based on file hashes. If no source files, configs, or dependencies have changed, the build uses cached output.

> **Important**: When debugging, always use `pnpm turbo build --filter=PACKAGE --force` to bypass the cache and ensure fresh compilation. Stale Turbo cache is a common source of "my changes have no effect" issues.

### Application Build Dependencies

The Electron app depends on both its own build and the browser app:

```json
{
  "sanyam-electron#build": {
    "dependsOn": ["^build", "sanyam-browser#build"]
  }
}
```

### Watch Mode

Watch tasks are marked as persistent (never complete):

```json
{
  "watch": {
    "cache": false,
    "persistent": true
  }
}
```

## Grammar Build Pipeline

Grammar packages follow a specific build sequence:

```
langium generate          → src/generated/ (AST types, grammar, module)
      ↓
tsc -b tsconfig.json      → lib/ (compiled JavaScript)
      ↓
copy:css                  → lib/diagram/styles.css (if applicable)
```

After building grammar packages, you must rebuild the application to pick up changes:

```bash
pnpm build:grammars       # Build all @sanyam-grammar/* packages
pnpm build:browser        # Rebuild the browser app (includes webpack bundle)
```

## Language Server Deployment

The language server is packaged as a VSIX extension and deployed to the application's `plugins/` directory:

```bash
pnpm deploy:language-server
```

This runs:
1. `build:language-server` — Compiles the language server
2. `build:vsix` — Bundles into a VSIX package with esbuild
3. Extracts the VSIX to `applications/browser/plugins/` (or electron equivalent)

## Filtered Builds

Turborepo supports filtered builds for faster iteration:

```bash
# Build a specific package and its dependencies
pnpm turbo build --filter=@sanyam-grammar/ecml

# Build a package, forcing no cache
pnpm turbo build --filter=@sanyam-grammar/ecml --force

# Build all extensions
pnpm turbo build --filter='@sanyam-ide/*'
```

## Development Workflow

For day-to-day development:

```bash
# Terminal 1: Watch extensions for hot reload
pnpm watch:ide

# Terminal 2: Run the browser app
pnpm start:browser
```

For grammar development:

```bash
# After editing a .langium file
cd packages/grammar-definitions/my-lang
langium generate && pnpm build

# Then rebuild the app
cd ../../..
pnpm build:browser

# Or for faster iteration, use the watch mode
pnpm watch
```
