---
title: "GLSP Providers"
description: "Custom diagram rendering and behavior for grammar packages"
layout: layouts/doc.njk
eleventyNavigation:
  key: GLSP Providers
  parent: Grammar Authoring
  order: 5
---

Grammar packages can customize diagram behavior through GLSP providers. These control how AST nodes are converted to diagram elements, how labels are extracted, and how the diagram model is structured.

## GlspFeatureProviders

```typescript
interface GlspFeatureProviders {
  astToGModel?: {
    getLabel?: (ast: unknown) => string;
    // Additional AST-to-GModel customization hooks
  };
}
```

The `glspProviders` field accepts a `Partial<GlspFeatureProviders>`. Omitted providers use the manifest-driven defaults.

## AST-to-GModel Provider

The most common customization is the `getLabel` function, which controls what text is displayed on diagram nodes.

### Default Behavior

By default, the platform extracts labels from AST nodes using the `name` property:

```typescript
// Default: uses node.name
getLabel: (ast) => (ast as { name?: string }).name ?? 'Unnamed'
```

### Custom Label Extraction

Grammar packages can override this to extract labels from different properties. ECML uses a `title` property as the display name:

```typescript
const glspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: {
    getLabel: (ast: unknown) => {
      const node = ast as { name?: string; title?: string };
      // ECML uses title as the display name, name as the identifier
      return node.title ?? node.name ?? 'Unnamed';
    },
  },
};
```

For a grammar where elements have a `label` property:

```typescript
const glspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: {
    getLabel: (ast: unknown) => {
      const node = ast as { name?: string; label?: string; description?: string };
      return node.label ?? node.name ?? 'Unnamed';
    },
  },
};
```

## How Diagrams are Generated

The platform converts AST to diagram models through a three-pass process:

### Pass 1: Create Nodes

For each AST node that has a `diagramNode` configuration in the manifest:
- Creates a GModel node with the configured GLSP type, shape, and CSS classes
- Extracts the label using `getLabel()` (custom or default)
- Creates ports if configured
- Records source ranges for outline mapping

### Pass 2: Determine Nesting and Edges

For each diagrammed node:
- Walks up the `$container` chain to find the nearest diagrammed ancestor
- If the ancestor is a container node, records a parent-child nesting relationship
- If not, creates a containment edge
- Creates cross-reference edges from AST properties marked as references

### Pass 3: Nest Children

Populates container node body compartments with their nested children.

## Container Nodes

Nodes with `isContainer: true` in the manifest render with a header/body structure:

```
┌─────────────────────────────┐
│ [icon] [label]    [▶/▼]    │  ← Header (32px)
├─────────────────────────────┤
│                             │
│   ┌─────┐    ┌─────┐       │  ← Body (nested children)
│   │Child│    │Child│        │
│   └─────┘    └─────┘       │
│                             │
└─────────────────────────────┘
```

- Header shows the icon, label, and expand/collapse button
- Body contains nested child nodes positioned by the ELK layout engine
- When collapsed, only the header is visible (32px height)
- When expanded, the node resizes to fit its children

The platform handles all container rendering automatically based on the manifest. No custom views are needed.

## Custom Diagram Views

For more advanced diagram customization, grammar packages can provide a custom Sprotty `ContainerModule` with custom view registrations:

```typescript
import { ContainerModule } from 'inversify';
import { configureModelElement } from 'sprotty';
import { MySpecialNodeView } from './my-special-node-view.js';

export const myDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // Register a custom view for a specific node type
  configureModelElement(context, 'node:my-special', MySpecialNode, MySpecialNodeView);
});
```

Custom views are authored using Sprotty's JSX/snabbdom rendering system. They receive the model element and return virtual DOM:

```typescript
import { RenderingContext, svg } from 'sprotty';
import { VNode } from 'snabbdom';

export class MySpecialNodeView implements IView {
  render(model: SNode, context: RenderingContext): VNode {
    return svg('g', [
      svg('rect', {
        attrs: {
          width: model.size.width,
          height: model.size.height,
          rx: 8,
          fill: '#e8f4fd',
          stroke: '#0284c7',
        },
      }),
      svg('text', {
        attrs: { x: model.size.width / 2, y: model.size.height / 2 },
      }, model.id),
    ]);
  }
}
```

## Passing to the Contribution

```typescript
export const contribution: LanguageContribution = {
  languageId: 'my-lang',
  fileExtensions: ['.mlang'],
  generatedSharedModule: /* ... */,
  generatedModule: /* ... */,
  manifest,
  glspProviders,
  diagramModule: myDiagramModule as ContainerModule,
};
```

## What the Manifest Handles Automatically

Before writing custom GLSP providers, check if the manifest already supports what you need:

| Feature | Manifest Config | Custom Provider Needed? |
|---|---|---|
| Node shapes | `diagramNode.shape` | No |
| Node colors/styling | `diagramNode.cssClass` | No (use CSS) |
| Node sizes | `diagramNode.defaultSize` | No |
| Node icons | `icon` / `iconSvg` | No |
| Container nodes | `diagramNode.isContainer` | No |
| Ports | `diagramNode.ports` | No |
| Edge types | `edgeTypes` | No |
| Dashed edges | `edgeTypes[].dashed` | No |
| Tool palette | `toolPalette` | No |
| Connection rules | `connectionRules` | No |
| Custom node labels | — | Yes (`getLabel`) |
| Custom node rendering | — | Yes (diagram module) |

The manifest covers the vast majority of diagram customization needs. Custom providers are only needed for behavior that can't be expressed declaratively.
