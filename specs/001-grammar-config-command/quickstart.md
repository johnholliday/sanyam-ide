# Quickstart: Grammar Config Command

**Feature ID**: 001-grammar-config-command
**Created**: 2026-01-15

---

## Overview

The `/grammar-config` command generates grammar packages with `GrammarManifest` exports for the SANYAM platform. This guide covers common usage patterns and integration steps.

---

## Prerequisites

- Claude Code CLI installed and configured
- SANYAM IDE project with `grammars/` workspace configured
- `@sanyam/types` package available (created as part of this feature)

---

## Quick Usage

### Create from Existing Grammar

If you have a Langium grammar file:

```bash
/grammar-config mygrammar
```

This will:
1. Look for `grammars/mygrammar/mygrammar.langium`
2. Parse the grammar to extract AST types
3. Generate `grammars/mygrammar/manifest.ts`

### Create New Grammar from Scratch

If no grammar exists:

```bash
/grammar-config taskflow
```

This will:
1. Create `grammars/taskflow/taskflow.langium` with a starter template
2. Generate `grammars/taskflow/manifest.ts`

### Create from Natural Language

Describe your DSL in plain English:

```bash
/grammar-config "A language for modeling REST API endpoints with resources and methods"
```

This will:
1. Use AI to generate an appropriate Langium grammar
2. Create `grammars/api-model/api-model.langium`
3. Generate the manifest

---

## Generated Files

After running `/grammar-config mygrammar`, you'll have:

```
grammars/mygrammar/
├── mygrammar.langium    # Grammar definition
├── manifest.ts          # GrammarManifest export
└── package.json         # Package configuration
```

### manifest.ts Structure

```typescript
import type { GrammarManifest } from '@sanyam/types';

export const MYGRAMMAR_MANIFEST: GrammarManifest = {
    languageId: 'mygrammar',
    displayName: 'MyGrammar',
    fileExtension: '.mg',
    baseExtension: '.mg',
    rootTypes: [
        {
            astType: 'Model',
            displayName: 'Model',
            // ... complete configuration
        }
    ],
    diagrammingEnabled: true,
    diagramTypes: [/* ... */]
};
```

---

## Integration with SANYAM Platform

### Step 1: Install the Grammar Package

Add the grammar package as a workspace dependency:

```json
// In your application's package.json
{
  "dependencies": {
    "@sanyam/grammar-mygrammar": "workspace:*"
  }
}
```

### Step 2: Register the Grammar

In your platform initialization code:

```typescript
import { MYGRAMMAR_MANIFEST } from '@sanyam/grammar-mygrammar';
import { GrammarRegistry } from '@sanyam/platform-core';

// Register the grammar with the platform
const registry = container.get(GrammarRegistry);
registry.register(MYGRAMMAR_MANIFEST);
```

### Step 3: Configure Language Server

The manifest provides everything needed for language server configuration:

```typescript
import { MYGRAMMAR_MANIFEST } from '@sanyam/grammar-mygrammar';

// Use manifest for VS Code language contribution
const languageContribution = {
    id: MYGRAMMAR_MANIFEST.languageId,
    aliases: [MYGRAMMAR_MANIFEST.displayName],
    extensions: [MYGRAMMAR_MANIFEST.fileExtension]
};
```

---

## Customizing Generated Manifests

### Editing Root Types

After generation, customize root types in `manifest.ts`:

```typescript
rootTypes: [
    {
        astType: 'Task',
        displayName: 'Task',
        fileSuffix: '.task',
        folder: 'tasks',
        icon: 'checklist',  // Change icon
        template: `task \${name} {
    // Custom template content
    priority: medium
    status: pending
}
`,
        // Add custom template inputs
        templateInputs: [
            { id: 'name', label: 'Task Name', type: 'string', required: true },
            { id: 'priority', label: 'Priority', type: 'select', required: false, options: ['low', 'medium', 'high'] }
        ]
    }
]
```

### Configuring Diagrams

Enable and customize diagram support:

```typescript
diagrammingEnabled: true,
diagramTypes: [
    {
        id: 'mygrammar-overview',
        displayName: 'Overview Diagram',
        fileType: 'Model',
        nodeTypes: [
            { glspType: 'node:task', creatable: true, showable: true },
            { glspType: 'node:workflow', creatable: true, showable: true }
        ],
        edgeTypes: [
            { glspType: 'edge:depends-on', creatable: true, showable: true }
        ],
        toolPalette: {
            groups: [
                {
                    id: 'elements',
                    label: 'Elements',
                    items: [
                        {
                            id: 'create-task',
                            label: 'Task',
                            icon: 'checklist',
                            action: { type: 'create-node', glspType: 'node:task' }
                        }
                    ]
                }
            ]
        }
    }
]
```

---

## Troubleshooting

### Grammar Parse Errors

If you see parsing errors:

1. Check your `.langium` file syntax
2. Ensure all rules are properly terminated
3. Verify terminal rules are defined

The command will show specific line/column information for errors.

### AI Generation Failures

If AI grammar generation fails:

1. The command will retry once with refined guidance
2. On second failure, a starter template is used
3. Your description is preserved as a comment in the grammar

### Missing Types Package

If `@sanyam/types` is not found:

1. Ensure `packages/types` exists in your workspace
2. Run `pnpm install` to link workspace packages
3. Check that `@sanyam/types` is in your dependencies

---

## Examples

### Workflow Grammar

```bash
/grammar-config workflow
```

Generates a grammar for workflows with tasks, steps, and triggers.

### API Definition Language

```bash
/grammar-config "A DSL for defining REST APIs with resources, HTTP methods, request/response schemas, and authentication requirements"
```

Generates a grammar suitable for API documentation and code generation.

### State Machine

```bash
/grammar-config "A language for defining finite state machines with states, transitions, guards, and actions"
```

Generates a grammar for state machine modeling with diagram support.

---

## Next Steps

1. **Customize the grammar**: Edit the `.langium` file to match your exact DSL needs
2. **Regenerate manifest**: Run `/grammar-config` again after grammar changes
3. **Add validation**: Implement custom validation rules in your language server
4. **Build the language**: Use Langium CLI to generate language services

For more information:
- [Langium Documentation](https://langium.org/docs/)
- [SANYAM Platform Guide](./PLATFORM.md)
- [GrammarManifest Type Reference](./contracts/grammar-manifest.ts)
