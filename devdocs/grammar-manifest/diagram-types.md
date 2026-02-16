---
title: "Diagram Types"
description: "DiagramTypeConfig — node types, edge types, and diagram views"
layout: layouts/doc.njk
eleventyNavigation:
  key: Diagram Types
  parent: Grammar Manifest
  order: 2
---

Diagram types define the available diagram views for a grammar. Each diagram type specifies which node and edge types are available, how they appear in the tool palette, and what connection rules apply.

A grammar can define multiple diagram types to provide different views of the same model — for example, an overview diagram and a focused workflow diagram.

## DiagramTypeConfig

```typescript
interface DiagramTypeConfig {
  readonly id: string;
  readonly displayName: string;
  readonly fileType: string;
  readonly nodeTypes: readonly NodeTypeConfig[];
  readonly edgeTypes: readonly EdgeTypeConfig[];
  readonly toolPalette: ToolPaletteConfig;
  readonly connectionRules?: readonly ConnectionRule[];
  readonly propertyOverrides?: readonly PropertyOverride[];
}
```

## Fields

### id

Unique identifier for this diagram type. Convention: `{languageId}-{view-name}`.

```typescript
id: 'ecml-overview'
id: 'ecml-workflow'
```

### displayName

Human-readable name shown in diagram selection UI.

```typescript
displayName: 'Content Model Overview'
displayName: 'Workflow Diagram'
```

### fileType

The root AST type this diagram represents. Determines which files open this diagram view.

```typescript
fileType: 'Model'      // Opens for model.ecml files
fileType: 'Workflow'   // Opens for *.workflow.ecml files
```

### nodeTypes

Array of node types available in this diagram. Each entry references a `glspType` from a root type's `diagramNode` configuration.

```typescript
interface NodeTypeConfig {
  readonly glspType: string;     // GLSP type identifier
  readonly creatable: boolean;   // Can users create this type?
  readonly showable: boolean;    // Is this type visible?
}
```

Example:

```typescript
nodeTypes: [
  { glspType: 'node:actor', creatable: true, showable: true },
  { glspType: 'node:activity', creatable: true, showable: true },
  { glspType: 'node:task', creatable: true, showable: true },
  { glspType: 'node:content', creatable: true, showable: true },
]
```

Setting `creatable: false` hides the node from the tool palette but still renders existing instances. Setting `showable: false` completely hides nodes of that type.

### edgeTypes

Array of edge types available in this diagram.

```typescript
interface EdgeTypeConfig {
  readonly glspType: string;     // GLSP type identifier
  readonly creatable: boolean;   // Can users create this type?
  readonly showable: boolean;    // Is this type visible?
  readonly dashed?: boolean;     // Render with dashed strokes?
}
```

Example:

```typescript
edgeTypes: [
  { glspType: 'edge:flow', creatable: true, showable: true, dashed: false },
  { glspType: 'edge:assignment', creatable: true, showable: true, dashed: false },
  { glspType: 'edge:reference', creatable: true, showable: true, dashed: false },
  { glspType: 'edge:permissions', creatable: true, showable: true, dashed: true },
]
```

When `dashed` is `true`, the edge renders with a dashed stroke pattern and animates with marching ants when the animated-edges feature is enabled.

### toolPalette

The tool palette configuration for this diagram type. See [Tool Palette](/grammar-manifest/tool-palette/) for details.

### connectionRules

Optional rules governing valid connections between node types. See [Ports & Connections](/grammar-manifest/ports-and-connections/) for details.

### propertyOverrides

Optional overrides for how AST fields are classified in the properties panel.

```typescript
interface PropertyOverride {
  readonly property: string;              // AST property name
  readonly classification: FieldClassification;  // 'property' | 'child'
}
```

By default, scalar types (string, number, boolean, enum) are shown as editable properties, and object/array types are shown hierarchically as children. Use overrides to change this:

```typescript
propertyOverrides: [
  { property: 'metadata', classification: 'property' },  // Show in properties panel
  { property: 'tags', classification: 'child' },          // Show hierarchically
]
```

## Multiple Diagram Types

A grammar can define multiple diagram types to provide different views. ECML defines two:

**Content Model Overview** — Shows all 9 node types and 4 edge types for a full model view:

```typescript
{
  id: 'ecml-overview',
  displayName: 'Content Model Overview',
  fileType: 'Model',
  nodeTypes: [
    { glspType: 'node:actor', creatable: true, showable: true },
    { glspType: 'node:activity', creatable: true, showable: true },
    { glspType: 'node:task', creatable: true, showable: true },
    { glspType: 'node:content', creatable: true, showable: true },
    { glspType: 'node:securitygroup', creatable: true, showable: true },
    { glspType: 'node:permission', creatable: true, showable: true },
    { glspType: 'node:retentionlabel', creatable: true, showable: true },
    { glspType: 'node:sensitivitylabel', creatable: true, showable: true },
    { glspType: 'node:workflow', creatable: true, showable: true },
  ],
  edgeTypes: [
    { glspType: 'edge:flow', creatable: true, showable: true, dashed: false },
    { glspType: 'edge:assignment', creatable: true, showable: true, dashed: false },
    { glspType: 'edge:reference', creatable: true, showable: true, dashed: false },
    { glspType: 'edge:permissions', creatable: true, showable: true, dashed: true },
  ],
  toolPalette: { /* ... */ },
}
```

**Workflow Diagram** — A focused view with only 3 node types and 2 edge types:

```typescript
{
  id: 'ecml-workflow',
  displayName: 'Workflow Diagram',
  fileType: 'Workflow',
  nodeTypes: [
    { glspType: 'node:activity', creatable: true, showable: true },
    { glspType: 'node:task', creatable: true, showable: true },
    { glspType: 'node:content', creatable: true, showable: true },
  ],
  edgeTypes: [
    { glspType: 'edge:flow', creatable: true, showable: true },
    { glspType: 'edge:conditional', creatable: true, showable: true },
  ],
  toolPalette: { /* ... */ },
}
```

The `fileType` field determines which diagram opens for which files. `'Model'` maps to the main model file, while `'Workflow'` maps to `*.workflow.ecml` files.
