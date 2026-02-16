---
title: "Root Types"
description: "RootTypeConfig — file types, templates, icons, and diagram nodes"
layout: layouts/doc.njk
eleventyNavigation:
  key: Root Types
  parent: Grammar Manifest
  order: 1
---

Root types define AST types that can exist as standalone files in a workspace. Each root type configures how files are created, organized, and represented in diagrams.

## RootTypeConfig

```typescript
interface RootTypeConfig {
  readonly astType: string;
  readonly displayName: string;
  readonly fileSuffix: string;
  readonly folder: string;
  readonly icon: string;
  readonly iconSvg?: IconSvgData;
  readonly template: string;
  readonly templateInputs?: readonly TemplateInput[];
  readonly diagramNode?: DiagramNodeConfig;
}
```

## Fields

### astType

The AST type name from your Langium grammar, in PascalCase. Must match exactly.

```typescript
astType: 'SecurityGroup'  // Matches grammar rule: SecurityGroup: ...
```

### displayName

Human-readable name shown in menus, dialogs, and the file explorer.

```typescript
displayName: 'Security Group'
```

### fileSuffix

File suffix prepended to the base extension. This creates compound file names like `admin.actor.ecml`.

```typescript
fileSuffix: '.actor'
// With baseExtension '.ecml' → files named: {name}.actor.ecml
```

### folder

Target folder name within the workspace where files of this type are created.

```typescript
folder: 'actors'
// New Actor files go into: workspace/actors/
```

### icon

VS Code Codicon name used in the file explorer, menus, and other UI elements.

```typescript
icon: 'person'    // renders the person codicon
icon: 'shield'    // renders the shield codicon
```

### iconSvg

Optional custom SVG icon data for diagram node rendering. When provided, the diagram node header renders these SVG paths instead of the built-in platform icon.

```typescript
interface IconSvgData {
  readonly viewBox: string;                  // e.g., '0 0 32 32'
  readonly paths: readonly IconSvgPath[];
}

interface IconSvgPath {
  readonly d: string;          // SVG path data
  readonly fill?: string;      // e.g., '#1177D7'
  readonly fillRule?: 'evenodd';
  readonly opacity?: number;   // e.g., 0.5
}
```

Example:

```typescript
iconSvg: {
  viewBox: '0 0 32 32',
  paths: [
    { d: 'M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24z', fill: '#1177D7' },
    { d: 'M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', fill: '#ffffff' },
  ],
}
```

### template

Default content template for new files. Supports the `${name}` placeholder which is replaced with user input from `templateInputs`.

```typescript
template: `Actor \${name} "\${name}" "Description of \${name}"\n`
```

> Note: In TypeScript template literals, use `\${name}` to keep the placeholder as a literal string. At file creation time, the platform replaces `${name}` with the user-provided value.

### templateInputs

Input fields shown in the file creation wizard. Each field collects a value used to populate template placeholders.

```typescript
interface TemplateInput {
  readonly id: string;
  readonly label: string;
  readonly type: InputType;     // 'string' | 'number' | 'boolean' | 'select'
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly default?: string | number | boolean;
}
```

Example:

```typescript
templateInputs: [
  { id: 'name', label: 'Actor Name', type: 'string', required: true },
]
```

### diagramNode

Visual configuration for the diagram node representing this AST type. See [DiagramNodeConfig](#diagramnodeconfig) below.

## DiagramNodeConfig

```typescript
interface DiagramNodeConfig {
  readonly glspType: string;
  readonly shape: NodeShape;
  readonly cssClass: string;
  readonly defaultSize: Size;
  readonly tooltip?: string;
  readonly ports?: readonly PortConfig[];
  readonly isContainer?: boolean;
}
```

### glspType

GLSP node type identifier used for model mapping between server and client. Convention: `node:{lowercase-type}`.

```typescript
glspType: 'node:actor'
glspType: 'node:securitygroup'
```

### shape

Visual shape of the diagram node. Available shapes:

| Shape | Description | Best for |
|---|---|---|
| `rectangle` | Standard rectangular box | General-purpose nodes |
| `rounded` | Rectangle with rounded corners | Soft, approachable elements |
| `ellipse` | Oval/circular shape | Actors, entities |
| `diamond` | Rotated square | Decision points, permissions |
| `hexagon` | Six-sided polygon | Actions, operations |
| `pill` | Rectangle with fully rounded ends | Tags, labels |

```typescript
shape: 'ellipse'   // for Actor nodes
shape: 'hexagon'   // for SecurityGroup nodes
shape: 'diamond'   // for Permission nodes
```

### cssClass

CSS class applied to the diagram node for styling. Uses grammar-qualified naming: `{GrammarName}.{AstType}`.

```typescript
cssClass: 'Ecml.Actor'
cssClass: 'Ecml.SecurityGroup'
```

This enables targeted CSS styling per grammar:

```css
.Ecml\.Actor { fill: #dbeafe; stroke: #3b82f6; }
.Ecml\.Actor.selected { stroke: #2563eb; stroke-width: 2; }
```

### defaultSize

Default dimensions for new nodes in pixels.

```typescript
interface Size {
  readonly width: number;
  readonly height: number;
}

defaultSize: { width: 160, height: 80 }
```

### tooltip

Hover tooltip template. Supports `${name}` for dynamic content.

```typescript
tooltip: 'Actor: ${name}'  // → "Actor: Admin"
```

### ports

Connection port configurations. See [Ports & Connections](/grammar-manifest/ports-and-connections/) for details.

### isContainer

Whether this node type can contain child nodes. Container nodes render children inside a body compartment with an expand/collapse button.

```typescript
isContainer: true   // Actors can contain Activities, etc.
```

## ECML Examples

Here are several root type configurations from the ECML grammar:

```typescript
// Actor — ellipse shape, container node
{
  astType: 'Actor',
  displayName: 'Actor',
  fileSuffix: '.actor',
  folder: 'actors',
  icon: 'person',
  template: `Actor \${name} "\${name}" "Description of \${name}"\n`,
  templateInputs: [
    { id: 'name', label: 'Actor Name', type: 'string', required: true },
  ],
  diagramNode: {
    glspType: 'node:actor',
    shape: 'ellipse',
    cssClass: 'Ecml.Actor',
    defaultSize: { width: 160, height: 80 },
    isContainer: true,
  },
}

// SecurityGroup — hexagon shape, not a container
{
  astType: 'SecurityGroup',
  displayName: 'Security Group',
  fileSuffix: '.secgroup',
  folder: 'security',
  icon: 'shield',
  template: `SecurityGroup \${name} "\${name}" "Description of \${name}"\n`,
  templateInputs: [
    { id: 'name', label: 'Security Group Name', type: 'string', required: true },
  ],
  diagramNode: {
    glspType: 'node:securitygroup',
    shape: 'hexagon',
    cssClass: 'Ecml.SecurityGroup',
    defaultSize: { width: 140, height: 70 },
  },
}

// Permission — diamond shape
{
  astType: 'Permission',
  displayName: 'Permission',
  fileSuffix: '.permission',
  folder: 'permissions',
  icon: 'key',
  template: `Permission \${name} "\${name}" "Description of \${name}"\n`,
  templateInputs: [
    { id: 'name', label: 'Permission Name', type: 'string', required: true },
  ],
  diagramNode: {
    glspType: 'node:permission',
    shape: 'diamond',
    cssClass: 'Ecml.Permission',
    defaultSize: { width: 100, height: 60 },
  },
}
```
