---
title: "Custom Modules"
description: "Inversify DI modules for overriding platform services"
layout: layouts/doc.njk
eleventyNavigation:
  key: Custom Modules
  parent: Grammar Authoring
  order: 3
---

Grammar packages can provide custom Inversify DI modules to override default platform services. This lets you replace or extend specific behaviors without modifying platform code.

## When to Use Custom Modules

Custom modules are appropriate when you need to:

- Replace a default Langium service (e.g., `DocumentSymbolProvider`, `CompletionProvider`)
- Add grammar-specific document processing
- Override how outline symbols are generated from your AST
- Customize validation beyond what Langium's built-in validators provide

## Creating a Custom Module

A custom module is a Langium `Module<LangiumServices>` object that follows Langium's module pattern:

```typescript
import type { Module } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { MyDocumentSymbolProvider } from './my-document-symbol-provider.js';

const myCustomModule = {
  lsp: {
    DocumentSymbolProvider: (services: LangiumServices) =>
      new MyDocumentSymbolProvider(services),
  },
} as unknown as Module<LangiumServices>;
```

The module structure mirrors Langium's service hierarchy. You can override services at any level:

```typescript
const myCustomModule = {
  // LSP service overrides
  lsp: {
    DocumentSymbolProvider: (services) => new MyDocumentSymbolProvider(services),
    CompletionProvider: (services) => new MyCompletionProvider(services),
    HoverProvider: (services) => new MyHoverProvider(services),
  },
  // Workspace service overrides
  workspace: {
    DocumentBuilder: (services) => new MyDocumentBuilder(services),
  },
  // Validation overrides
  validation: {
    Validator: (services) => new MyValidator(services),
  },
} as unknown as Module<LangiumServices>;
```

## ECML Example: Custom DocumentSymbolProvider

The ECML grammar overrides the `DocumentSymbolProvider` to properly traverse its AST and produce meaningful outline symbols:

```typescript
import type { Module } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { EcmlDocumentSymbolProvider } from './document-symbol-provider.js';

const ecmlCustomModule = {
  lsp: {
    DocumentSymbolProvider: (services: LangiumServices) =>
      new EcmlDocumentSymbolProvider(services),
  },
} as unknown as Module<LangiumServices>;
```

This is then passed to the contribution:

```typescript
export const contribution: LanguageContribution = {
  languageId: 'ecml',
  // ... other fields ...
  customModule: ecmlCustomModule,
};
```

## Custom Diagram Module

For diagram customizations, grammar packages can provide a separate Inversify `ContainerModule`. This is a standard Inversify 6.x container module used for Sprotty view registrations:

```typescript
import { ContainerModule } from 'inversify';
import { configureModelElement, SGraph, SGraphView } from 'sprotty';
import { MyCustomNodeView } from './my-custom-node-view.js';

export const myDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  // Register custom views for specific node types
  const context = { bind, unbind, isBound, rebind };
  configureModelElement(context, 'node:my-type', MyCustomNode, MyCustomNodeView);
});
```

Pass it in the contribution:

```typescript
export const contribution: LanguageContribution = {
  languageId: 'my-lang',
  // ... other fields ...
  diagramModule: myDiagramModule as ContainerModule,
};
```

And declare it in `package.json`:

```json
{
  "sanyam": {
    "grammar": true,
    "languageId": "my-lang",
    "contribution": "./lib/contribution.js",
    "diagramModule": "./lib/diagram/module.js"
  }
}
```

## Module Loading Order

The platform loads modules in this order:

1. **Langium defaults** — Built-in Langium service implementations
2. **Generated module** — Grammar-specific generated services (from `langium generate`)
3. **Custom module** — Grammar package overrides (from `contribution.customModule`)

Later modules override earlier ones. This means your custom module takes precedence over both Langium defaults and generated services.

## Important Notes

- The `as unknown as Module<LangiumServices>` cast is necessary due to Langium's strict module typing. The runtime structure is compatible.
- Custom modules are loaded once at server startup and are singletons for the lifetime of the server process.
- Overriding a service replaces it entirely — there's no automatic chaining with the default implementation. If you need the default behavior, you must call it explicitly from your custom service.
- See [DI Patterns](/architecture/di-patterns/) for more details on the platform's dependency injection architecture.
