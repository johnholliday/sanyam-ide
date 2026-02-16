---
title: "LSP Providers"
description: "Custom Language Server Protocol features for grammar packages"
layout: layouts/doc.njk
eleventyNavigation:
  key: LSP Providers
  parent: Grammar Authoring
  order: 4
---

Grammar packages can provide custom LSP (Language Server Protocol) features to enhance the editing experience. These are specified via the `lspProviders` field of the `LanguageContribution`.

## LspFeatureProviders

```typescript
interface LspFeatureProviders {
  hover?: LspProvider<HoverParams, Hover>;
  completion?: LspProvider<CompletionParams, CompletionList>;
  codeAction?: LspProvider<CodeActionParams, CodeAction[]>;
  codeLens?: LspProvider<CodeLensParams, CodeLens[]>;
  formatting?: LspProvider<DocumentFormattingParams, TextEdit[]>;
  // ... additional LSP features
}
```

The `lspProviders` field accepts a `Partial<LspFeatureProviders>`, so you only need to specify the features you want to customize. All omitted providers fall through to Langium's built-in defaults.

## Providing Custom LSP Features

### Hover

Provide custom hover information for AST elements:

```typescript
const lspProviders: Partial<LspFeatureProviders> = {
  hover: {
    provide: async (context, params) => {
      const node = context.document.parseResult.value;
      // Custom hover logic
      return {
        contents: {
          kind: 'markdown',
          value: `**${node.$type}**: ${node.name}`,
        },
      };
    },
  },
};
```

### Completion

Add grammar-specific completion items:

```typescript
const lspProviders: Partial<LspFeatureProviders> = {
  completion: {
    provide: async (context, params) => {
      return {
        isIncomplete: false,
        items: [
          {
            label: 'myTemplate',
            kind: CompletionItemKind.Snippet,
            insertText: 'element ${1:name} "${2:title}" {\n\t$0\n}',
            insertTextFormat: InsertTextFormat.Snippet,
          },
        ],
      };
    },
  },
};
```

### Code Actions

Suggest quick fixes and refactorings:

```typescript
const lspProviders: Partial<LspFeatureProviders> = {
  codeAction: {
    provide: async (context, params) => {
      const actions: CodeAction[] = [];
      for (const diagnostic of params.context.diagnostics) {
        if (diagnostic.code === 'missing-description') {
          actions.push({
            title: 'Add default description',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            edit: {
              changes: {
                [params.textDocument.uri]: [
                  TextEdit.insert(diagnostic.range.end, ' "Default description"'),
                ],
              },
            },
          });
        }
      }
      return actions;
    },
  },
};
```

## Passing to the Contribution

```typescript
export const contribution: LanguageContribution = {
  languageId: 'my-lang',
  fileExtensions: ['.mlang'],
  generatedSharedModule: /* ... */,
  generatedModule: /* ... */,
  manifest,
  lspProviders,
};
```

## LSP Providers vs Custom Modules

There are two ways to customize LSP behavior:

| Approach | Use When |
|---|---|
| `lspProviders` | You want to add grammar-specific logic alongside defaults |
| `customModule` | You want to fully replace a Langium service class |

`lspProviders` are lightweight and composable — they receive the context and return results. `customModule` gives you full control by replacing entire service implementations, but requires more boilerplate.

For most grammar customizations, `lspProviders` is the recommended approach. Use `customModule` when you need to deeply modify how a Langium service works (e.g., replacing the DocumentSymbolProvider to change outline tree structure).

## ECML Example

ECML currently defines an empty `lspProviders` object (using Langium defaults for all features) but overrides `DocumentSymbolProvider` via `customModule`:

```typescript
// LSP providers — using Langium defaults
const lspProviders: Partial<LspFeatureProviders> = {
  // Custom providers can be added here
};

// Custom module — overrides DocumentSymbolProvider
const ecmlCustomModule = {
  lsp: {
    DocumentSymbolProvider: (services: LangiumServices) =>
      new EcmlDocumentSymbolProvider(services),
  },
} as unknown as Module<LangiumServices>;
```

This pattern is common: start with the defaults, add `lspProviders` for simple customizations, and use `customModule` only when a full service replacement is needed.
