---
title: "Language Contribution"
description: "The LanguageContribution interface and its fields"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language Contribution
  parent: Grammar Authoring
  order: 2
---

The `LanguageContribution` is the main entry point that the unified language server uses to load your grammar. It bundles together the grammar's Langium modules, manifest, and optional customizations.

## Interface

```typescript
interface LanguageContribution {
  readonly languageId: string;
  readonly fileExtensions: string[];
  readonly generatedSharedModule: Module<LangiumSharedServices>;
  readonly generatedModule: Module<LangiumServices>;
  readonly manifest: GrammarManifest;
  readonly customModule?: Module<LangiumServices>;
  readonly lspProviders?: Partial<LspFeatureProviders>;
  readonly glspProviders?: Partial<GlspFeatureProviders>;
  readonly diagramModule?: ContainerModule;
  readonly operationHandlers?: Record<string, OperationHandler>;
}
```

## Fields

### Required Fields

| Field | Type | Description |
|---|---|---|
| `languageId` | `string` | Must match the manifest's `languageId` |
| `fileExtensions` | `string[]` | File extensions this grammar handles (e.g., `['.ecml']`) |
| `generatedSharedModule` | `Module<LangiumSharedServices>` | From `src/generated/module.ts` |
| `generatedModule` | `Module<LangiumServices>` | From `src/generated/module.ts` |
| `manifest` | `GrammarManifest` | The grammar manifest configuration |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `customModule` | `Module<LangiumServices>` | Overrides for Langium services (see [Custom Modules](/grammar-authoring/custom-modules/)) |
| `lspProviders` | `Partial<LspFeatureProviders>` | Custom LSP feature implementations (see [LSP Providers](/grammar-authoring/lsp-providers/)) |
| `glspProviders` | `Partial<GlspFeatureProviders>` | Custom diagram behavior (see [GLSP Providers](/grammar-authoring/glsp-providers/)) |
| `diagramModule` | `ContainerModule` | Custom Sprotty/Inversify module for diagram views |
| `operationHandlers` | `Record<string, OperationHandler>` | Implementations for declared operations |

## Basic Example

A minimal contribution with no customizations:

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

## Full Example (ECML)

The ECML grammar uses all optional fields:

```typescript
import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { ContainerModule } from 'inversify';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  EcmlGeneratedModule,
  EcmlGeneratedSharedModule,
} from './generated/module.js';
import { ecmlDiagramModule } from './diagram/index.js';
import { EcmlDocumentSymbolProvider } from './document-symbol-provider.js';
import { operationHandlers } from './operations/index.js';

// Custom LSP providers
const lspProviders: Partial<LspFeatureProviders> = {
  // Override default providers here
};

// Custom Langium module — overrides DocumentSymbolProvider
const ecmlCustomModule = {
  lsp: {
    DocumentSymbolProvider: (services: LangiumServices) =>
      new EcmlDocumentSymbolProvider(services),
  },
} as unknown as Module<LangiumServices>;

// Custom GLSP providers
const glspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: {
    getLabel: (ast: unknown) => {
      const node = ast as { name?: string; title?: string };
      return node.title ?? node.name ?? 'Unnamed';
    },
  },
};

export const contribution: LanguageContribution = {
  languageId: 'ecml',
  fileExtensions: ['.ecml'],
  generatedSharedModule: EcmlGeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: EcmlGeneratedModule as Module<LangiumServices>,
  manifest,
  customModule: ecmlCustomModule,
  lspProviders,
  glspProviders,
  diagramModule: ecmlDiagramModule as ContainerModule,
  operationHandlers,
};
```

## How Contributions are Loaded

At startup, the unified language server:

1. Imports all grammar contributions from the generated `grammars.js` file
2. Registers each grammar's Langium modules (shared + language-specific + custom)
3. Registers LSP and GLSP providers
4. Creates language services for each grammar

The browser frontend separately loads manifests via the generated `grammar-manifests-module.js` file. This provides the `GrammarRegistry` with manifest data for UI features like the tool palette, file creation, and getting started widget.

## Type Casts

You may notice type casts like `as Module<LangiumSharedServices>` and `as ContainerModule` in the examples. These are necessary because:

- Langium-generated modules use the specific grammar's service types (e.g., `EcmlServices`)
- The platform expects the generic `Module<LangiumServices>` and `Module<LangiumSharedServices>` types
- Inversify module types differ between Inversify 5 (Langium's peer) and 6 (platform's version)

These casts are safe because the module structures are compatible at runtime.
