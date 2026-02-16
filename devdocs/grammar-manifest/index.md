---
title: "Grammar Manifest"
description: "The GrammarManifest interface and its top-level fields"
layout: layouts/doc.njk
eleventyNavigation:
  key: Grammar Manifest
  order: 3
---

The `GrammarManifest` is the primary configuration object that describes how a grammar integrates with the Sanyam IDE platform. Every grammar package must export one.

The manifest enables grammar-agnostic platform features by declaring language identification, file organization, diagram support, tool palettes, and custom operations — all without the platform containing any grammar-specific code.

## Import

```typescript
import type { GrammarManifest } from '@sanyam/types';
```

## Interface Overview

```typescript
interface GrammarManifest {
  // Identity
  readonly languageId: string;
  readonly displayName: string;
  readonly summary: string;
  readonly tagline: string;

  // Documentation
  readonly keyFeatures: readonly KeyFeature[];
  readonly coreConcepts: readonly CoreConcept[];
  readonly quickExample: string;

  // File system
  readonly fileExtension: string;
  readonly baseExtension: string;
  readonly packageFile?: PackageFileConfig;
  readonly rootTypes: readonly RootTypeConfig[];

  // Diagram
  readonly diagrammingEnabled: boolean;
  readonly diagramTypes?: readonly DiagramTypeConfig[];

  // Branding
  readonly logo?: string;

  // Operations
  readonly operations?: readonly GrammarOperation[];
}
```

## Top-Level Fields

### Identity Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `languageId` | `string` | Yes | Unique identifier. Lowercase alphanumeric with hyphens, starting with a letter. Example: `'ecml'` |
| `displayName` | `string` | Yes | Human-readable name shown in the IDE. Example: `'Enterprise Content Modeling Language'` |
| `summary` | `string` | Yes | 1-2 sentence description of the grammar's purpose. |
| `tagline` | `string` | Yes | Short marketing tagline, under 10 words. |

### Documentation Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `keyFeatures` | `KeyFeature[]` | Yes | At least one feature with `feature` and `description` strings. |
| `coreConcepts` | `CoreConcept[]` | Yes | At least one concept with `concept` and `description` strings. |
| `quickExample` | `string` | Yes | 3-10 line code example demonstrating core syntax. |

### File System Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `fileExtension` | `string` | Yes | Primary extension including dot. Example: `'.ecml'` |
| `baseExtension` | `string` | Yes | Base extension for composing suffixes. Often same as `fileExtension`. |
| `packageFile` | `PackageFileConfig` | No | Configuration for the main package/model file. |
| `rootTypes` | `RootTypeConfig[]` | Yes | AST types that can be standalone files. At least one required. |

### Diagram Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `diagrammingEnabled` | `boolean` | Yes | Whether diagram features are enabled. |
| `diagramTypes` | `DiagramTypeConfig[]` | Conditional | Required if `diagrammingEnabled` is `true`. |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `logo` | `string` | Base64-encoded data URL for the grammar's logo. Must be `data:image/...;base64,...` |
| `operations` | `GrammarOperation[]` | Custom API operations exposed via LSP and REST gateway. |

## Supporting Types

### KeyFeature

```typescript
interface KeyFeature {
  readonly feature: string;      // Feature name
  readonly description: string;  // What this feature provides
}
```

### CoreConcept

```typescript
interface CoreConcept {
  readonly concept: string;      // Concept name
  readonly description: string;  // What this concept represents
}
```

### PackageFileConfig

```typescript
interface PackageFileConfig {
  readonly fileName: string;      // e.g., 'model.ecml'
  readonly displayName: string;   // e.g., 'Content Model'
  readonly icon: string;          // VS Code Codicon name
}
```

## ECML Example

Here is a condensed example from the ECML grammar manifest:

```typescript
import type { GrammarManifest } from '@sanyam/types';

export const manifest: GrammarManifest = {
  languageId: 'ecml',
  displayName: 'Enterprise Content Modeling Language',
  summary: 'A DSL for modeling enterprise content workflows and security policies.',
  tagline: 'Enterprise Content Modeling Language',
  keyFeatures: [
    { feature: 'Content Lifecycle', description: 'Model complete content lifecycle' },
    { feature: 'Security Policies', description: 'Define security groups and permissions' },
    { feature: 'Visual Workflows', description: 'Drag-and-drop diagram editing' },
  ],
  coreConcepts: [
    { concept: 'Actor', description: 'A user or system interacting with content' },
    { concept: 'Content', description: 'A document or data item being managed' },
    { concept: 'Workflow', description: 'A sequence of activities' },
  ],
  quickExample: `Actor Admin "Administrator" "System administrator"
Content Policy "Security Policy" "Organization security policy"`,
  fileExtension: '.ecml',
  baseExtension: '.ecml',
  packageFile: {
    fileName: 'model.ecml',
    displayName: 'Content Model',
    icon: 'book',
  },
  rootTypes: [/* ... see Root Types */],
  diagrammingEnabled: true,
  diagramTypes: [/* ... see Diagram Types */],
  operations: [/* ... see Operations */],
};
```

## Related Pages

- [Root Types](/grammar-manifest/root-types/) — File types, templates, icons, diagram nodes
- [Diagram Types](/grammar-manifest/diagram-types/) — Node types, edge types, diagram views
- [Tool Palette](/grammar-manifest/tool-palette/) — Tool groups and creation items
- [Ports & Connections](/grammar-manifest/ports-and-connections/) — Connection points and rules
- [Operations](/grammar-manifest/operations/) — Custom commands and API endpoints
- [Validation](/grammar-manifest/validation/) — `validateManifest()` and type guards
