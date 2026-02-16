---
title: "Package Structure"
description: "Directory layout, package.json sanyam key, and exports"
layout: layouts/doc.njk
eleventyNavigation:
  key: Package Structure
  parent: Grammar Authoring
  order: 1
---

Every grammar package follows a standard directory layout and package.json structure that the grammar scanner uses for discovery and loading.

## Directory Layout

```
packages/grammar-definitions/{language-id}/
├── src/
│   ├── {language}.langium           # Grammar definition
│   ├── manifest.ts                  # GrammarManifest configuration
│   ├── contribution.ts              # LanguageContribution export
│   ├── generated/                   # Langium-generated code (never edit!)
│   │   ├── ast.ts
│   │   ├── grammar.ts
│   │   └── module.ts
│   ├── operations/                  # Operation handler implementations
│   │   └── index.ts
│   └── diagram/                     # Optional: custom Sprotty views
│       ├── index.ts
│       ├── module.ts
│       └── styles.css
├── lib/                             # Compiled output (gitignored)
├── package.json
├── tsconfig.json
└── langium-config.json
```

### Key Directories

| Directory | Purpose |
|---|---|
| `src/` | Source TypeScript and Langium files |
| `src/generated/` | Langium-generated types and modules. **Never edit these files.** |
| `src/diagram/` | Custom Sprotty diagram views and DI module |
| `src/operations/` | Operation handler implementations |
| `lib/` | Compiled JavaScript output |

## package.json

The package.json must include the `sanyam` key for the grammar scanner to discover it.

```json
{
  "name": "@sanyam-grammar/ecml",
  "version": "0.1.0",
  "type": "module",
  "main": "./lib/contribution.js",
  "types": "./lib/contribution.d.ts",
  "exports": {
    ".": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./contribution": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./manifest": {
      "types": "./lib/manifest.d.ts",
      "import": "./lib/manifest.js"
    },
    "./diagram": {
      "types": "./lib/diagram/index.d.ts",
      "import": "./lib/diagram/index.js"
    }
  },
  "files": ["lib", "src"],
  "scripts": {
    "build": "npm run build:langium && tsc -b tsconfig.json && npm run copy:css",
    "build:langium": "langium generate",
    "copy:css": "mkdir -p lib/diagram && cp -- src/diagram/styles.css lib/diagram/styles.css",
    "clean": "rimraf lib src/generated tsconfig.tsbuildinfo",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "ecml",
    "contribution": "./lib/contribution.js",
    "diagramModule": "./lib/diagram/module.js"
  },
  "dependencies": {
    "langium": "^4.1.0",
    "sprotty": "^1.4.0",
    "inversify": "^6.0.2"
  },
  "devDependencies": {
    "@sanyam/types": "workspace:*",
    "langium-cli": "^4.0.0",
    "rimraf": "^5.0.0",
    "typescript": "~5.6.3"
  }
}
```

### The sanyam Key

| Field | Required | Description |
|---|---|---|
| `grammar` | Yes | Must be `true` for the scanner to discover this package |
| `languageId` | Yes | Language identifier matching the manifest's `languageId` |
| `contribution` | Yes | Path to compiled `LanguageContribution` module |
| `diagramModule` | No | Path to custom Sprotty `ContainerModule` for diagram views |

### Exports

Three export paths are conventional:

| Export | Purpose |
|---|---|
| `.` / `./contribution` | Main entry — exports the `LanguageContribution` |
| `./manifest` | Manifest-only export for frontend usage |
| `./diagram` | Custom diagram module (if applicable) |

### Dependencies

| Package | Purpose |
|---|---|
| `langium` | Runtime dependency for grammar services |
| `sprotty` | Only needed if providing custom diagram views |
| `inversify` | Only needed if providing custom DI modules |
| `@sanyam/types` | Type definitions (dev dependency via workspace protocol) |
| `langium-cli` | CLI for `langium generate` (dev dependency) |

## Build Scripts

The standard build sequence:

```bash
# 1. Generate TypeScript from Langium grammar
langium generate

# 2. Compile TypeScript
tsc -b tsconfig.json

# 3. Copy non-TS assets (CSS for diagram styles)
mkdir -p lib/diagram && cp src/diagram/styles.css lib/diagram/styles.css
```

The `langium generate` step reads `langium-config.json` and produces:
- `src/generated/ast.ts` — AST type definitions
- `src/generated/grammar.ts` — Grammar descriptor
- `src/generated/module.ts` — Langium DI module with generated services

## Generated Code

The `src/generated/` directory is created by `langium generate` and **must never be manually edited**. It is regenerated on every build. These files are typically gitignored.

The generated module exports two key items used in the contribution:

```typescript
// From src/generated/module.ts (generated — do not edit)
export const MyLangGeneratedModule: Module<LangiumServices>;
export const MyLangGeneratedSharedModule: Module<LangiumSharedServices>;
```

These are passed to the `LanguageContribution` to register the grammar's services with Langium.
