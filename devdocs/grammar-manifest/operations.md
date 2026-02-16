---
title: "Operations"
description: "GrammarOperation — custom commands and API endpoints"
layout: layouts/doc.njk
eleventyNavigation:
  key: Operations
  parent: Grammar Manifest
  order: 5
---

Operations are custom commands that grammars can declare for code generation, analysis, export, and AI-powered features. Operations are exposed via both LSP (`workspace/executeCommand`) and REST gateway endpoints.

## GrammarOperation

```typescript
interface GrammarOperation {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly targetTypes: readonly string[];
  readonly icon?: string;
  readonly category?: string;
  readonly contexts: OperationContexts;
  readonly endpoint: OperationEndpoint;
  readonly input?: OperationInput;
  readonly licensing?: OperationLicensing;
  readonly execution?: OperationExecution;
}
```

## Fields

### id

Unique operation identifier in kebab-case. Used in command registration and REST endpoint paths.

```typescript
id: 'generate-powershell'
id: 'ai-analyze-compliance'
```

### displayName

Human-readable name for menus and command palette.

```typescript
displayName: 'Generate PowerShell Script'
```

### description

Description for tooltips and help text.

```typescript
description: 'Generate a PnP PowerShell script for deploying this content model'
```

### targetTypes

AST types this operation applies to. The operation appears in context menus only when a matching type is selected. Use `['*']` for operations that apply to any type.

```typescript
targetTypes: ['Model', 'Content', 'SecurityGroup']  // Specific types
targetTypes: ['*']                                    // Any type
```

### icon

VS Code Codicon name for the operation icon.

```typescript
icon: 'terminal-powershell'
icon: 'shield'
icon: 'sparkle'
```

### category

Menu grouping category. Operations with the same category are grouped together.

```typescript
category: 'Generate'
category: 'Analyze'
category: 'Export'
```

## OperationContexts

Controls where the operation appears in the IDE.

```typescript
interface OperationContexts {
  readonly fileExplorer?: boolean;        // File explorer context menu
  readonly diagramElement?: boolean;      // Diagram element context menu
  readonly compositeToolbar?: boolean;    // Composite editor toolbar
  readonly mainMenu?: boolean;            // Main menu
}
```

Example:

```typescript
contexts: {
  fileExplorer: true,
  diagramElement: true,
  compositeToolbar: true,
}
```

## OperationEndpoint

REST endpoint configuration for the HTTP gateway.

```typescript
interface OperationEndpoint {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly requestSchema?: JSONSchema;
  readonly responseSchema?: JSONSchema;
}
```

The `path` is relative to `/api/v1/{languageId}/operations/`.

```typescript
endpoint: {
  method: 'POST',
  path: '/generate/powershell',
}
// → POST /api/v1/ecml/operations/generate/powershell
```

## OperationInput

How input is gathered before execution.

```typescript
interface OperationInput {
  readonly type: 'none' | 'selection' | 'dialog';
  readonly dialogFields?: readonly OperationDialogField[];
}
```

| Type | Description |
|---|---|
| `none` | No input needed — runs immediately |
| `selection` | Uses the current selection (file or diagram element) |
| `dialog` | Shows a dialog with custom fields before executing |

### OperationDialogField

Fields shown in the input dialog.

```typescript
interface OperationDialogField {
  readonly id: string;
  readonly label: string;
  readonly type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
  readonly required?: boolean;
  readonly default?: string | number | boolean;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
  readonly placeholder?: string;
  readonly helpText?: string;
}
```

Example with a select field and a boolean toggle:

```typescript
input: {
  type: 'dialog',
  dialogFields: [
    {
      id: 'regulations',
      label: 'Regulations to Check',
      type: 'select',
      options: [
        { label: 'GDPR', value: 'gdpr' },
        { label: 'HIPAA', value: 'hipaa' },
        { label: 'SOX', value: 'sox' },
        { label: 'All', value: 'all' },
      ],
      default: 'all',
    },
    {
      id: 'includeRecommendations',
      label: 'Include Recommendations',
      type: 'boolean',
      default: true,
    },
  ],
}
```

## OperationLicensing

Controls authentication and licensing requirements.

```typescript
interface OperationLicensing {
  readonly requiresAuth?: boolean;    // Authentication required?
  readonly tier?: string;             // 'free', 'pro', 'enterprise'
  readonly group?: string;            // Feature bundling group
}
```

```typescript
// Free operation, no auth needed
licensing: { requiresAuth: false, tier: 'free', group: 'generators' }

// Pro-tier operation requiring authentication
licensing: { requiresAuth: true, tier: 'pro', group: 'ai-features' }
```

## OperationExecution

Controls how the operation runs.

```typescript
interface OperationExecution {
  readonly async?: boolean;
  readonly durationHint?: 'fast' | 'medium' | 'slow';
  readonly showProgress?: boolean;
}
```

| Field | Description |
|---|---|
| `async` | If `true`, returns a job ID for polling. If `false`, returns result directly. |
| `durationHint` | Expected duration for UI feedback. |
| `showProgress` | Whether to show a progress indicator. |

```typescript
// Fast synchronous operation
execution: { async: false, durationHint: 'fast' }

// Slow async operation with progress bar
execution: { async: true, durationHint: 'slow', showProgress: true }
```

## ECML Examples

### Simple Export Operation

```typescript
{
  id: 'export-markdown',
  displayName: 'Export as Markdown',
  description: 'Export the content model documentation as Markdown',
  targetTypes: ['Model'],
  icon: 'markdown',
  category: 'Export',
  contexts: {
    fileExplorer: true,
    compositeToolbar: true,
  },
  endpoint: {
    method: 'POST',
    path: '/export/markdown',
  },
  input: { type: 'none' },
  licensing: { requiresAuth: false, tier: 'free', group: 'export' },
  execution: { async: false, durationHint: 'fast' },
}
```

### AI-Powered Analysis with Dialog

```typescript
{
  id: 'ai-analyze-compliance',
  displayName: 'AI Compliance Analysis',
  description: 'AI-powered analysis to identify regulatory compliance issues',
  targetTypes: ['Model', 'RetentionLabel', 'SensitivityLabel', 'SecurityGroup'],
  icon: 'shield',
  category: 'Analyze',
  contexts: {
    fileExplorer: true,
    compositeToolbar: true,
  },
  endpoint: {
    method: 'POST',
    path: '/analyze/compliance',
  },
  input: {
    type: 'dialog',
    dialogFields: [
      {
        id: 'regulations',
        label: 'Regulations to Check',
        type: 'select',
        options: [
          { label: 'GDPR', value: 'gdpr' },
          { label: 'HIPAA', value: 'hipaa' },
          { label: 'SOX', value: 'sox' },
          { label: 'All', value: 'all' },
        ],
        default: 'all',
      },
      {
        id: 'includeRecommendations',
        label: 'Include Recommendations',
        type: 'boolean',
        default: true,
      },
    ],
  },
  licensing: { requiresAuth: true, tier: 'pro', group: 'ai-features' },
  execution: { async: true, durationHint: 'slow', showProgress: true },
}
```

### Diagram Context Operation

```typescript
{
  id: 'find-usages',
  displayName: 'Find Usages',
  description: 'Find all references to a selected element',
  targetTypes: ['Actor', 'Activity', 'Task', 'Content', 'SecurityGroup',
                'Permission', 'RetentionLabel', 'SensitivityLabel'],
  icon: 'references',
  category: 'Analyze',
  contexts: {
    diagramElement: true,    // Only in diagram context menu
  },
  endpoint: {
    method: 'POST',
    path: '/analyze/usages',
  },
  input: { type: 'selection' },
  licensing: { requiresAuth: false, tier: 'free', group: 'analyze' },
  execution: { async: false, durationHint: 'fast' },
}
```
