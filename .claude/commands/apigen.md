---
description: Generate AI-powered example files for a Langium grammar (.langium file or grammar package name)
---

## User Input

$ARGUMENTS

## Outline

This command analyzes a Langium grammar and automatically derives contextually appropriate API operations for it. It uses AI to understand the domain semantics from grammar rules, comments, and naming patterns to suggest operations that make sense for the domain.

### Execution Modes

Parse `$ARGUMENTS` to determine execution mode:

- **`--infer-only`**: Suggest operations without generating files
- **`--stubs-only`**: Generate handler stubs for operations already declared in manifest
- **`--extend`**: Add new operations while preserving existing ones
- **`--rebuild`**: Re-analyze grammar and rebuild operations list from scratch
- **No flag or just grammar name**: Full analysis: infer operations + generate handler stubs

The first non-flag argument should be either:
- A grammar name (e.g., `ecml`, `spdevkit`)
- A path to a `.langium` file

### Step 1: Resolve Grammar

Locate the grammar file and manifest:

1. **For grammar name**:
   - Grammar file: `packages/grammar-definitions/{name}/src/{name}.langium`
   - Manifest file: `packages/grammar-definitions/{name}/src/manifest.ts`
   - Contribution file: `packages/grammar-definitions/{name}/src/contribution.ts`

2. **For .langium file path**:
   - Use the specified path
   - Derive package location from directory structure
   - Check if manifest.ts exists in the same src/ directory

**Validation**: If grammar file doesn't exist, report error and exit.

### Step 2: Parse Grammar and Extract Domain Information

Read the grammar file and extract:

#### Parser Rules

For each parser rule, extract:
- Rule name (AST type name)
- Properties (name, type, cardinality: `?`, `*`, `+`)
- Cross-references (`[Type]` or `[Type:feature]`)
- Whether it's the entry rule

#### Comments and Annotations

Extract from both single-line (`//`) and multi-line (`/* */`) comments:

| Annotation | Scope | Purpose |
|------------|-------|---------|
| `@domain` | Grammar-level | Target domain description |
| `@purpose` | Grammar-level | What the DSL accomplishes |
| `@audience` | Grammar-level | Intended users |
| `@operation` | Rule-level | Explicitly request operation |
| `@no-crud` | Rule-level | Exclude from auto CRUD |
| `@async` | Operation hint | Suggest async execution |
| `@tier` | Operation hint | Licensing tier (free/pro/enterprise) |

#### Domain Vocabulary

Analyze rule names and property names to identify domain concepts:
- Entity patterns: Names ending in `Type`, `Definition`, `Spec`, `Config`
- Process patterns: Names containing `Workflow`, `Process`, `Flow`, `Pipeline`
- Policy patterns: Names containing `Policy`, `Rule`, `Constraint`, `Validation`
- Data patterns: Names containing `Model`, `Schema`, `Data`, `Record`

### Step 3: Infer Operations

Apply the following inference rules based on grammar patterns:

| Grammar Pattern | Inferred Operations |
|-----------------|---------------------|
| Entry rule with `statements+=` | CRUD for statement types, bulk import/export |
| Type named `*Workflow` or `*Process` | `execute-{name}`, `validate-{name}` |
| Type named `*Policy` or `*Rule` | `evaluate-{name}`, `ai-review-{name}` |
| Type named `*Template` | `instantiate-{name}`, `export-{name}` |
| Cross-reference (`[OtherType]`) | `resolve-references`, `find-usages` |
| Type with compliance in comments | `ai-compliance-check` |
| Any complex type | `export-json`, `export-markdown` |

#### Standard Operations (always include)

- `export-json`: Export model as JSON
- `export-markdown`: Export model as documentation

#### Domain-Specific Inference

Based on domain vocabulary and comments, infer additional operations:

**For Content Management domains:**
- `generate-powershell`: PnP PowerShell deployment
- `generate-bicep`: Azure infrastructure as code
- `ai-analyze-compliance`: Regulatory compliance analysis

**For Workflow domains:**
- `execute-workflow`: Run workflow simulation
- `validate-workflow`: Check workflow consistency
- `export-bpmn`: Export as BPMN diagram

**For Security/Policy domains:**
- `evaluate-policy`: Policy evaluation
- `ai-security-review`: AI security assessment
- `export-policy-report`: Generate compliance report

### Step 4: Check Existing Operations

Read the existing manifest.ts file:

1. Parse the `operations` array if it exists
2. For each existing operation:
   - Check if it has `// @manual` comment marker
   - Manual operations are preserved without modification
3. Compare inferred operations with existing:
   - New operations not in manifest → add
   - Existing operations with same ID → preserve existing (unless `--rebuild`)
   - Orphaned operations (ID not found in inference) → warn but don't delete

### Step 5: Generate Output

Based on execution mode:

#### `--infer-only` Mode

Output a report showing:
- Grammar domain analysis
- Inferred operations with justification
- Suggested implementation priority

Example output:
```
## Grammar Analysis: ecml

**Domain**: Enterprise Content Management
**Audience**: SharePoint/M365 administrators

## Inferred Operations

1. **generate-powershell** (Generate)
   - Target types: Model, Content, SecurityGroup
   - Justification: Content management grammars typically need deployment scripts
   - Priority: High

2. **ai-analyze-compliance** (Analyze)
   - Target types: Model, RetentionLabel, SensitivityLabel
   - Justification: Detected compliance-related types
   - Priority: Medium
   - Licensing: pro tier (AI feature)
```

#### `--stubs-only` Mode

Generate handler stub files for operations declared in manifest but missing implementations:

1. Read manifest.ts to get declared operations
2. Check `src/operations/` for existing handler files
3. For each missing handler, generate stub file
4. Update `src/operations/index.ts` with exports

#### `--extend` Mode

1. Read existing manifest operations
2. Infer new operations from grammar
3. Merge: add inferred operations that don't exist yet
4. Generate handler stubs for new operations only
5. Preserve all existing operations and handlers

#### Default (Full) Mode

1. Infer operations from grammar
2. Generate/update manifest.ts with operations array
3. Create `src/operations/` directory if needed
4. Generate handler stub for each operation
5. Create/update `src/operations/index.ts`
6. Update contribution.ts to export operationHandlers

### Step 6: Generate Handler Stubs

For each operation, create a handler stub file at:
`src/operations/{operation-id}.ts`

Template:
```typescript
/**
 * {operation.displayName} Operation
 *
 * {operation.description}
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult, ProgressCallback } from '@sanyam/types';

/**
 * Handler for {operation.displayName}.
 *
 * Target types: {operation.targetTypes.join(', ')}
 */
export const {camelCase(operation.id)}Handler: OperationHandler = async (
  context: OperationContext,
  onProgress?: ProgressCallback
): Promise<OperationResult> => {
  const { document, selectedIds, input } = context;
  const ast = document.parseResult.value as any;

  if (!ast) {
    return {
      success: false,
      error: 'Failed to parse document',
    };
  }

  // TODO: Implement {operation.id} operation
  // This is a stub generated by /apigen

  return {
    success: true,
    data: {
      // Add operation-specific result data here
    },
    message: '{operation.displayName} completed successfully',
  };
};
```

For async operations (`execution.async: true`), include progress callback usage:
```typescript
  onProgress?.(0, 'Starting {operation.displayName}...');

  // ... operation logic with progress updates ...

  onProgress?.(100, '{operation.displayName} complete');
```

### Step 7: Update Index and Contribution

Generate/update `src/operations/index.ts`:
```typescript
/**
 * {Grammar} Operation Handlers
 *
 * @packageDocumentation
 */

import type { OperationHandlers } from '@sanyam/types';
{imports for each handler}

export const operationHandlers: OperationHandlers = {
  {entries for each operation}
};

{re-exports for individual handlers}
```

Update `src/contribution.ts` to:
1. Add import: `import { operationHandlers } from './operations/index.js';`
2. Add to contribution object: `operationHandlers,`

### Conflict Resolution

| Scenario | Behavior |
|----------|----------|
| New type added to grammar | Infer operations, add to manifest |
| Type removed from grammar | Flag orphaned ops, don't auto-delete |
| Operation manually modified | Preserve (detect via `// @manual`) |
| Inferred conflicts with manual | Warn, keep manual version |
| Handler file already exists | Skip generation (preserve existing) |

### Error Handling

- Grammar file not found: Error with suggested locations
- Manifest parse error: Warn and continue (create new operations array)
- Handler generation fails: Warn, continue with others
- TypeScript errors in generated code: Report for manual fix

## Summary

Report what was done:
- Operations inferred: X
- Operations added to manifest: Y
- Handler stubs generated: Z
- Existing handlers preserved: W

If `--extend` or default mode:
- List new operations added
- List files created/modified
- Suggest next steps (implement handlers, run tests)
