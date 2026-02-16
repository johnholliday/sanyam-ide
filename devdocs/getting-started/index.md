---
title: "Getting Started"
description: "Create your first grammar package for the Sanyam IDE platform"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---

This guide walks you through creating a minimal grammar package with a working manifest, language contribution, and diagram support. By the end, you'll have a new language registered in the IDE with text editing and visual diagramming.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- The Sanyam IDE monorepo cloned and built (`pnpm install && pnpm build`)

## Step 1: Scaffold the Package

Create a new directory under `packages/grammar-definitions/`:

```
packages/grammar-definitions/my-lang/
├── src/
│   ├── my-lang.langium         # Grammar definition
│   ├── manifest.ts             # GrammarManifest configuration
│   ├── contribution.ts         # LanguageContribution export
│   └── diagram/                # Optional: custom diagram views
│       ├── index.ts
│       ├── module.ts
│       └── styles.css
├── package.json
├── tsconfig.json
└── langium-config.json
```

## Step 2: Configure package.json

Your `package.json` must include the `sanyam` key that the grammar scanner uses to discover your package:

```json
{
  "name": "@sanyam-grammar/my-lang",
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
    }
  },
  "scripts": {
    "build": "npm run build:langium && tsc -b tsconfig.json",
    "build:langium": "langium generate",
    "clean": "rimraf lib src/generated tsconfig.tsbuildinfo",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "my-lang",
    "contribution": "./lib/contribution.js"
  },
  "dependencies": {
    "langium": "^4.1.0"
  },
  "devDependencies": {
    "@sanyam/types": "workspace:*",
    "langium-cli": "^4.0.0",
    "rimraf": "^5.0.0",
    "typescript": "~5.6.3"
  }
}
```

The `sanyam` key fields:

| Field | Description |
|---|---|
| `grammar` | Must be `true` to be discovered |
| `languageId` | Unique language identifier (lowercase, hyphens OK) |
| `contribution` | Path to the compiled `LanguageContribution` module |
| `diagramModule` | Optional path to custom Sprotty diagram module |

## Step 3: Write the Grammar

Create `src/my-lang.langium` with your Langium grammar definition. Langium will generate TypeScript types in `src/generated/` when you run `langium generate`.

```langium
grammar MyLang

entry Model:
    (elements+=Element)*;

Element:
    'element' name=ID title=STRING? '{'
        (children+=Element)*
    '}';

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"/;
```

## Step 4: Create the Manifest

The manifest tells the platform everything it needs to know about your grammar's file organization, diagram appearance, and tool palette. Create `src/manifest.ts`:

```typescript
import type { GrammarManifest } from '@sanyam/types';

export const manifest: GrammarManifest = {
  languageId: 'my-lang',
  displayName: 'My Language',
  summary: 'A domain-specific language for modeling elements.',
  tagline: 'Model elements visually',
  keyFeatures: [
    { feature: 'Visual Modeling', description: 'Drag-and-drop diagram editing' },
  ],
  coreConcepts: [
    { concept: 'Element', description: 'A fundamental building block' },
  ],
  quickExample: 'element MyElement "My First Element" {\n  // children here\n}',
  fileExtension: '.mlang',
  baseExtension: '.mlang',
  rootTypes: [
    {
      astType: 'Element',
      displayName: 'Element',
      fileSuffix: '.element',
      folder: 'elements',
      icon: 'symbol-class',
      template: 'element ${name} "${name}" {\n}\n',
      templateInputs: [
        { id: 'name', label: 'Element Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:element',
        shape: 'rounded',
        cssClass: 'MyLang.Element',
        defaultSize: { width: 160, height: 60 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'my-lang-overview',
      displayName: 'Element Diagram',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:element', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:reference', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'elements',
            label: 'Elements',
            items: [
              {
                id: 'create-element',
                label: 'Element',
                icon: 'symbol-class',
                action: { type: 'create-node', glspType: 'node:element' },
              },
            ],
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-reference',
                label: 'Reference',
                icon: 'references',
                action: { type: 'create-edge', glspType: 'edge:reference' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
```

See the [Grammar Manifest Reference](/grammar-manifest/) for detailed documentation of every field.

## Step 5: Create the Language Contribution

The `LanguageContribution` is the entry point the unified server uses to load your grammar. Create `src/contribution.ts`:

```typescript
import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { LanguageContribution } from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  MyLangGeneratedModule,
  MyLangGeneratedSharedModule,
} from './generated/module.js';

export const contribution: LanguageContribution = {
  languageId: 'my-lang',
  fileExtensions: ['.mlang'],
  generatedSharedModule: MyLangGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: MyLangGeneratedModule as Module<LangiumServices>,
  manifest,
};

export default contribution;
```

## Step 6: Add to the Application

1. Add your grammar package as a dependency of the application:

```bash
# In the application's package.json (e.g., applications/browser/)
pnpm add @sanyam-grammar/my-lang
```

2. Rebuild the grammar scanner and applications:

```bash
pnpm build:grammars
pnpm build:browser
```

The grammar scanner automatically discovers packages with the `sanyam.grammar: true` key and generates the loader code.

## Step 7: Run and Verify

```bash
pnpm start:browser
```

Open the browser IDE. You should see:

- Your language registered for `.mlang` files with syntax highlighting
- A "New File" menu entry for creating Element files
- A diagram view showing nodes for your elements

## Next Steps

- [Grammar Manifest Reference](/grammar-manifest/) — Learn every configuration option
- [Package Structure](/grammar-authoring/package-structure/) — Understand the full package layout
- [Custom LSP Providers](/grammar-authoring/lsp-providers/) — Add hover, completion, and more
- [Custom GLSP Providers](/grammar-authoring/glsp-providers/) — Customize diagram behavior
- [Custom DI Modules](/grammar-authoring/custom-modules/) — Override platform services
