# Data Model: Grammar Config Command

**Feature ID**: 001-grammar-config-command
**Created**: 2026-01-15

---

## Overview

This document defines the data structures used by the `/grammar-config` command and the `@sanyam/types` package.

---

## Core Entities

### GrammarManifest

The primary configuration object that describes how a grammar integrates with the SANYAM platform.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | `string` | Yes | Unique identifier for the language (lowercase, no spaces) |
| `displayName` | `string` | Yes | Human-readable name for the language |
| `fileExtension` | `string` | Yes | Primary file extension including dot (e.g., `.spdk`) |
| `baseExtension` | `string` | Yes | Base extension for file suffix composition |
| `packageFile` | `PackageFileConfig` | No | Configuration for grammar-wide model file |
| `rootTypes` | `RootTypeConfig[]` | Yes | Array of AST types that can be standalone files |
| `diagrammingEnabled` | `boolean` | Yes | Whether diagram features are enabled |
| `diagramTypes` | `DiagramTypeConfig[]` | No | Diagram view configurations (required if diagrammingEnabled) |

**Validation Rules**:
- `languageId` must be lowercase alphanumeric with hyphens only
- `fileExtension` must start with `.`
- `rootTypes` must have at least one entry
- If `diagrammingEnabled` is true, `diagramTypes` must have at least one entry

---

### PackageFileConfig

Configuration for the grammar's main package/model file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileName` | `string` | Yes | Name of the package file (e.g., `model.spdk`) |
| `displayName` | `string` | Yes | Human-readable name shown in UI |
| `icon` | `string` | Yes | VS Code Codicon name |

---

### RootTypeConfig

Configuration for an AST type that can exist as a standalone file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `astType` | `string` | Yes | AST type name from grammar (PascalCase) |
| `displayName` | `string` | Yes | Human-readable name |
| `fileSuffix` | `string` | Yes | File suffix before base extension (e.g., `.application`) |
| `folder` | `string` | Yes | Target folder name in workspace |
| `icon` | `string` | Yes | VS Code Codicon name |
| `template` | `string` | Yes | Default content for new files (supports `${name}` placeholder) |
| `templateInputs` | `TemplateInput[]` | No | Input fields for file creation wizard |
| `diagramNode` | `DiagramNodeConfig` | No | Diagram node appearance (required if diagramming enabled) |

**Validation Rules**:
- `astType` must be PascalCase
- `fileSuffix` must start with `.`
- `template` should contain at least `${name}` placeholder
- If parent manifest has `diagrammingEnabled: true`, `diagramNode` should be provided

---

### TemplateInput

Input field definition for file creation wizard.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the input |
| `label` | `string` | Yes | Display label |
| `type` | `InputType` | Yes | Input type (`string`, `number`, `boolean`, `select`) |
| `required` | `boolean` | Yes | Whether input is mandatory |
| `options` | `string[]` | No | Options for `select` type |
| `default` | `string \| number \| boolean` | No | Default value |

---

### DiagramNodeConfig

Visual configuration for diagram representation of an AST type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `glspType` | `string` | Yes | GLSP node type identifier (e.g., `node:application`) |
| `shape` | `NodeShape` | Yes | Visual shape (`rectangle`, `ellipse`, `diamond`, `hexagon`) |
| `cssClass` | `string` | Yes | CSS class for styling |
| `defaultSize` | `Size` | Yes | Default width and height |

**Size Structure**:
```typescript
{ width: number; height: number }
```

---

### DiagramTypeConfig

Configuration for a diagram view type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique diagram type identifier |
| `displayName` | `string` | Yes | Human-readable name |
| `fileType` | `string` | Yes | Associated file type (e.g., `Model`) |
| `nodeTypes` | `NodeTypeConfig[]` | Yes | Available node types in diagram |
| `edgeTypes` | `EdgeTypeConfig[]` | Yes | Available edge types in diagram |
| `toolPalette` | `ToolPaletteConfig` | Yes | Tool palette configuration |

---

### NodeTypeConfig / EdgeTypeConfig

Availability configuration for nodes/edges in a diagram type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `glspType` | `string` | Yes | GLSP type identifier |
| `creatable` | `boolean` | Yes | Can user create this type |
| `showable` | `boolean` | Yes | Is this type visible in diagram |

---

### ToolPaletteConfig

Tool palette structure.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `groups` | `ToolPaletteGroup[]` | Yes | Tool groups |

---

### ToolPaletteGroup

A group of related tools in the palette.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique group identifier |
| `label` | `string` | Yes | Display label |
| `items` | `ToolPaletteItem[]` | Yes | Tools in this group |

---

### ToolPaletteItem

A single tool in the palette.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique item identifier |
| `label` | `string` | Yes | Display label |
| `icon` | `string` | Yes | VS Code Codicon name |
| `action` | `ToolAction` | Yes | Action to perform when clicked |

---

### ToolAction

Action triggered by a palette tool.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'create-node' \| 'create-edge'` | Yes | Action type |
| `glspType` | `string` | Yes | GLSP type to create |

---

## Enumerations

### NodeShape

```typescript
type NodeShape = 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';
```

### InputType

```typescript
type InputType = 'string' | 'number' | 'boolean' | 'select';
```

### ActionType

```typescript
type ActionType = 'create-node' | 'create-edge';
```

---

## Entity Relationships

```
GrammarManifest
├── PackageFileConfig (0..1)
├── RootTypeConfig[] (1..*)
│   ├── TemplateInput[] (0..*)
│   └── DiagramNodeConfig (0..1)
└── DiagramTypeConfig[] (0..*)
    ├── NodeTypeConfig[] (1..*)
    ├── EdgeTypeConfig[] (1..*)
    └── ToolPaletteConfig (1)
        └── ToolPaletteGroup[] (1..*)
            └── ToolPaletteItem[] (1..*)
                └── ToolAction (1)
```

---

## State Transitions

Not applicable - GrammarManifest is a static configuration object with no state transitions.

---

## Defaults and Conventions

### Naming Conventions

| Entity | Convention | Example |
|--------|------------|---------|
| `languageId` | lowercase-hyphenated | `my-language` |
| `astType` | PascalCase | `MyEntity` |
| `glspType` | category:lowercase | `node:myentity` |
| `cssClass` | kebab-case-node | `myentity-node` |
| `id` fields | kebab-case | `create-myentity` |

### Default Values

| Field | Default | When |
|-------|---------|------|
| `shape` | `rectangle` | All node types |
| `defaultSize.width` | `150` | Standard nodes |
| `defaultSize.height` | `60` | Standard nodes |
| `creatable` | `true` | All node/edge types |
| `showable` | `true` | All node/edge types |
| `required` (templateInput) | `true` | Name field only |

### Auto-Generated Mappings

When generating manifest from grammar:

| Grammar Element | Manifest Field | Derivation |
|-----------------|----------------|------------|
| Entry rule name | First `rootType.astType` | Direct mapping |
| Parser rule name | `rootType.astType` | PascalCase preserved |
| Rule name | `rootType.folder` | Lowercase + pluralize |
| Rule name | `rootType.fileSuffix` | `.` + lowercase |
| Rule name | `diagramNode.cssClass` | lowercase + `-node` |
| Rule name | `diagramNode.glspType` | `node:` + lowercase |
