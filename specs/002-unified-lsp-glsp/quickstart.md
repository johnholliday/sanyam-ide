# Quickstart: Unified LSP/GLSP Language Server

**Feature**: 002-unified-lsp-glsp
**Date**: 2026-01-16

## Overview

This guide helps you get started with the unified LSP/GLSP language server, whether you're:

1. **Using existing grammar support** - Opening DSL files with IDE features
2. **Creating a new grammar package** - Adding support for a new DSL
3. **Customizing language features** - Overriding defaults for your grammar

---

## Using Existing Grammar Support

### Opening DSL Files

1. Open any supported DSL file (`.ecml`, `.story`, `.spdevkit`, etc.)
2. The language server activates automatically based on file extension
3. IDE features are immediately available:
   - **Syntax highlighting** - Token-based coloring
   - **Code completion** - Press `Ctrl+Space` or type trigger characters
   - **Hover information** - Hover over symbols
   - **Go to Definition** - `F12` or right-click → Go to Definition
   - **Find References** - `Shift+F12`
   - **Rename Symbol** - `F2`
   - **Diagnostics** - Errors/warnings appear in Problems panel

### Opening Diagram View

1. Open a DSL file with diagram support
2. Use the command palette (`Ctrl+Shift+P`)
3. Run "Open Diagram View"
4. The diagram opens in a split panel synchronized with the text editor

### Diagram Interactions

- **Pan**: Click and drag on canvas background
- **Zoom**: Scroll wheel or pinch gesture
- **Select**: Click on element
- **Multi-select**: `Ctrl+Click` or drag selection box
- **Move**: Drag selected elements
- **Create element**: Click tool palette item, then click canvas
- **Create edge**: Click edge tool, drag from source to target
- **Delete**: Select element(s), press `Delete`

---

## Creating a New Grammar Package

### Step 1: Create Package Structure

```bash
mkdir -p grammars/mygrammar/src
cd grammars/mygrammar
```

### Step 2: Create package.json

```json
{
  "name": "@sanyam/grammar-mygrammar",
  "version": "1.0.0",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": {
    ".": {
      "import": "./lib/index.js",
      "types": "./lib/index.d.ts"
    },
    "./contribution": {
      "import": "./lib/contribution.js"
    }
  },
  "sanyam": {
    "grammar": true,
    "languageId": "mygrammar",
    "contribution": "./lib/contribution.js"
  },
  "scripts": {
    "build": "npm run langium:generate && tsc",
    "langium:generate": "langium generate"
  },
  "dependencies": {
    "@sanyam/types": "workspace:*"
  },
  "peerDependencies": {
    "langium": "^4.0.0"
  },
  "devDependencies": {
    "langium": "^4.0.0",
    "langium-cli": "^4.0.0",
    "typescript": "~5.6.3"
  }
}
```

### Step 3: Create langium-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/eclipse-langium/langium/main/packages/langium-cli/langium-config-schema.json",
  "projectName": "MyGrammar",
  "languages": [
    {
      "id": "mygrammar",
      "grammar": "mygrammar.langium",
      "fileExtensions": [".myg"]
    }
  ],
  "out": "src/generated"
}
```

### Step 4: Create Grammar File

```langium
// mygrammar.langium
grammar MyGrammar

entry Model:
    (elements+=Element)*;

Element:
    'element' name=ID '{'
        (properties+=Property)*
    '}';

Property:
    name=ID ':' value=STRING;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
terminal SL_COMMENT: /\/\/[^\n\r]*/;
```

### Step 5: Create Manifest

```typescript
// manifest.ts
import type { GrammarManifest } from '@sanyam/types';

export const MY_GRAMMAR_MANIFEST: GrammarManifest = {
  languageId: 'mygrammar',
  displayName: 'My Grammar',
  fileExtensions: ['.myg'],
  baseExtension: '.myg',
  rootTypes: [
    {
      astType: 'Model',
      fileSuffix: '',
      folder: 'models',
      diagramNode: {
        glspType: 'node:model',
        shape: 'rectangle',
        cssClass: 'model-node',
        defaultSize: { width: 200, height: 100 },
      },
    },
  ],
  diagramTypes: [
    {
      id: 'mygrammar-diagram',
      name: 'My Grammar Diagram',
      rootAstType: 'Model',
      nodeTypes: [
        { astType: 'Element', available: true },
      ],
      edgeTypes: [],
    },
  ],
};
```

### Step 6: Create Contribution

```typescript
// src/contribution.ts
import type {
  LanguageContribution,
  ContributionContext,
  GrammarManifest,
} from '@sanyam/types';
import { MY_GRAMMAR_MANIFEST } from '../manifest.js';

/**
 * Convert manifest to GrammarManifest format for the server.
 */
function convertToGrammarManifest(): GrammarManifest {
  return {
    name: MY_GRAMMAR_MANIFEST.languageId,
    fileExtensions: [MY_GRAMMAR_MANIFEST.fileExtensions[0]],
    diagram: {
      nodeTypes: {},
      edgeTypes: {},
      layout: {
        algorithm: 'elk',
        direction: 'DOWN',
        spacing: { node: 50, edge: 25 },
      },
    },
    toolPalette: { groups: [] },
    disabledFeatures: [],
  };
}

/**
 * Create the language contribution.
 */
export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: 'mygrammar',
    fileExtensions: ['.myg'],
    generatedModule: context.generatedModule,
    manifest: convertToGrammarManifest(),
    lspProviders: {},
    glspProviders: {},
    disabledFeatures: [],
  };
}

export { MY_GRAMMAR_MANIFEST };
export default createContribution;
```

### Step 7: Build and Test

```bash
# From repository root
pnpm install
pnpm build:dev
pnpm electron start

# Open a .myg file to test
```

---

## Customizing Language Features

### Adding Custom Validators

```typescript
// src/mygrammar-validator.ts
import type { ValidationChecks } from 'langium';
import type { MyGrammarAstType } from './generated/ast.js';

export const myGrammarValidationChecks: ValidationChecks<MyGrammarAstType> = {
  Element: (element, accept) => {
    if (!element.name || element.name.length < 2) {
      accept('error', 'Element name must be at least 2 characters', {
        node: element,
        property: 'name',
      });
    }
  },
};
```

### Adding Custom LSP Providers

```typescript
// src/lsp-overrides.ts
import type { LspFeatureProviders, LspContext } from '@sanyam/types';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { isElement } from './generated/ast.js';

export const myLspProviders: LspFeatureProviders = {
  hover: {
    provide: async (ctx: LspContext, params: HoverParams): Promise<Hover | null> => {
      const node = findNodeAtPosition(ctx.document, params.position);
      if (!node) return null;

      if (isElement(node)) {
        return {
          contents: {
            kind: 'markdown',
            value: [
              `### Element: \`${node.name}\``,
              '',
              `Properties: ${node.properties.length}`,
            ].join('\n'),
          },
        };
      }

      return null;
    },
  },
};
```

### Adding Custom GLSP Providers

```typescript
// src/glsp-overrides.ts
import type { GlspFeatureProviders } from '@sanyam/types';
import { isElement } from './generated/ast.js';

export const myGlspProviders: GlspFeatureProviders = {
  astToGModel: {
    getLabel: (ast) => {
      if (isElement(ast)) {
        return `${ast.name} (${ast.properties.length} props)`;
      }
      return ast.name ?? 'Unnamed';
    },
  },
};
```

### Updating the Contribution

```typescript
// src/contribution.ts
import type {
  LanguageContribution,
  ContributionContext,
} from '@sanyam/types';
import { MY_GRAMMAR_MANIFEST } from '../manifest.js';
import { myLspProviders } from './lsp-overrides.js';
import { myGlspProviders } from './glsp-overrides.js';

export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: 'mygrammar',
    fileExtensions: ['.myg'],
    generatedModule: context.generatedModule,
    manifest: convertToGrammarManifest(),
    lspProviders: myLspProviders,      // Custom LSP providers
    glspProviders: myGlspProviders,    // Custom GLSP providers
    disabledFeatures: ['inlineValue'], // Disable features not needed
  };
}

export default createContribution;
```

---

## Troubleshooting

### Language Server Not Starting

1. Check the Output panel → "Sanyam Language Server"
2. Verify the grammar package is listed in workspace dependencies
3. Rebuild: `pnpm build:dev`

### Diagnostics Not Showing

1. Ensure validators are registered in your custom module
2. Check for syntax errors in the grammar file
3. The language server logs validation errors to Output panel

### Diagram Not Rendering

1. Verify `diagramTypes` is defined in your manifest
2. Check that the diagram type's `rootAstType` matches your AST
3. Inspect browser DevTools console for GLSP errors

### Custom Provider Not Called

1. Verify the provider is exported in `contribution.ts`
2. Check that the method signature matches the interface
3. Add console.log statements to verify execution

---

## Next Steps

- See [spec.md](./spec.md) for complete feature specification
- See [data-model.md](./data-model.md) for entity definitions
- See [research.md](./research.md) for technical design decisions
- See `contracts/` for TypeScript interface definitions
