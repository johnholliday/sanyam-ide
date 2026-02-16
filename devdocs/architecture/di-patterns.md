---
title: "DI Patterns"
description: "Inversify 6.x dependency injection patterns used in the platform"
layout: layouts/doc.njk
eleventyNavigation:
  key: DI Patterns
  parent: Architecture
  order: 3
---

The Sanyam IDE platform uses Inversify 6.x for dependency injection. Understanding the DI patterns is important for extending the platform and avoiding common pitfalls.

## Singleton Scope

All services are bound in singleton scope. This means:

- Each service class has exactly one instance per container
- The instance is created lazily on first resolution
- The same instance is returned for all subsequent injections

```typescript
bind(GrammarRegistry).toSelf().inSingletonScope();
bind(SprottyDiagramManager).toSelf().inSingletonScope();
```

## Service Registration Patterns

### Interface-Based Binding

Services expose interfaces, not implementations:

```typescript
// Define the interface
export const GrammarRegistrySymbol = Symbol('GrammarRegistry');

// Bind implementation to interface
bind(GrammarRegistrySymbol).to(GrammarRegistryImpl).inSingletonScope();

// Inject via interface
@inject(GrammarRegistrySymbol) private readonly registry: GrammarRegistry;
```

### Multi-Injection

For extensible registries (e.g., contribution providers), Inversify's multi-injection pattern is used:

```typescript
// Bind multiple implementations
bind(PropertyViewWidgetProvider).to(DiagramPropertyProvider).inSingletonScope();
bind(PropertyViewWidgetProvider).to(TextPropertyProvider).inSingletonScope();

// Inject all implementations
@multiInject(PropertyViewWidgetProvider) providers: PropertyViewWidgetProvider[];
```

### Token-Based Injection

For configuration values and callbacks, named tokens are used:

```typescript
// Define token
export const GrammarManifestMapToken = Symbol('GrammarManifestMap');

// Bind value
bind(GrammarManifestMapToken).toConstantValue(manifestMap);

// Inject
@inject(GrammarManifestMapToken) private readonly manifestMap: Map<string, GrammarManifest>;
```

## Theia-Specific Patterns

### FrontendApplicationContribution

Theia extensions register contributions that run at application lifecycle stages:

```typescript
@injectable()
export class GrammarRegistry implements FrontendApplicationContribution {
  initialize(): void {
    // Called during app startup — prepare manifests
  }
}

// In the module
bind(GrammarRegistry).toSelf().inSingletonScope();
bind(FrontendApplicationContribution).toService(GrammarRegistry);
```

### Widget Factory

Theia widgets are created via factory patterns:

```typescript
bind(DiagramWidget).toSelf();
bind(WidgetFactory).toDynamicValue(context => ({
  id: 'diagram-widget',
  createWidget: () => context.container.get(DiagramWidget),
}));
```

## Sprotty DI Container

The diagram editor uses a separate Sprotty DI container (child of the Theia container). This container is configured per diagram instance:

```typescript
function createSanyamDiagramContainer(widgetId: string): Container {
  const container = new Container();

  // Load standard Sprotty modules
  container.load(defaultModule, modelSourceModule, ...);

  // Load platform diagram module
  container.load(sanyamDiagramModule);

  // Load grammar-specific diagram module (if any)
  if (grammarDiagramModule) {
    container.load(grammarDiagramModule);
  }

  return container;
}
```

## Common Pitfalls

### Singleton Timing Race

Sprotty's `ActionHandlerRegistry` resolves all action handler singletons eagerly during the first `setModel()` dispatch. If a handler uses `@inject(CALLBACK)` and the callback is later `rebind()`-ed, the singleton keeps the old value.

**Solution**: Use imperative setter methods on handler instances instead of container rebinding:

```typescript
// BAD: Rebinding after singleton creation — the old value persists
container.rebind(CALLBACK_TOKEN).toConstantValue(newCallback);

// GOOD: Set the callback imperatively on the resolved instance
const handler = container.get(SelectionChangeActionHandler);
handler.setCallback(newCallback);
```

### Container Hierarchy

The Sprotty container is a child of the Theia container. Services bound in the Theia container are visible to Sprotty, but Sprotty-specific bindings are not visible to Theia services.

```
Theia Container (parent)
  ├── GrammarRegistry
  ├── SelectionService
  └── ...
  │
  └── Sprotty Container (child)
      ├── ActionDispatcher
      ├── ViewRegistry
      └── ...
```

### PostConstruct Timing

`@postConstruct` methods run immediately after construction but before the instance is available to other services. Be careful with circular initialization:

```typescript
@injectable()
class MyService {
  @inject(OtherService) private other: OtherService;

  @postConstruct()
  init(): void {
    // 'other' is available here
    // But 'this' may not be fully initialized from other services' perspective
  }
}
```

## Theia DisposableCollection

Theia's `DisposableCollection.disposed` is based on array length, not an explicit flag. After `dispose()`, the collection is reusable — `push()` still works. This differs from VS Code's implementation where disposed collections reject new entries.

```typescript
const disposables = new DisposableCollection();
disposables.push(subscription1);
disposables.dispose();  // Clears the array
// disposables.disposed === true (array is empty)

disposables.push(subscription2);  // Works! Collection is reusable
// disposables.disposed === false (array has items again)
```

## Grammar Package DI

Grammar packages interact with DI at two levels:

1. **Langium modules** — Follow Langium's module pattern (plain objects with factory functions):

```typescript
const customModule = {
  lsp: {
    DocumentSymbolProvider: (services) => new MyProvider(services),
  },
} as unknown as Module<LangiumServices>;
```

2. **Sprotty modules** — Standard Inversify ContainerModules:

```typescript
const diagramModule = new ContainerModule((bind) => {
  bind(MyCustomView).toSelf();
});
```

Langium modules use a different pattern than standard Inversify because Langium predates Inversify 6 and uses its own DI abstraction. The `as unknown as Module<LangiumServices>` cast bridges the two systems.
