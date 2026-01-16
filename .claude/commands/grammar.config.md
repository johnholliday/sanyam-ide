---
description: Generate grammar package with GrammarManifest from Langium grammar
handoffs:
  - label: Plan Implementation
    agent: speckit.plan
    prompt: Plan changes for the generated grammar package
    send: false
---

## User Input

$ARGUMENTS

## Outline

This command generates a grammar package with `GrammarManifest` export for the SANYAM platform. It supports three input modes:

1. **Grammar name** (`mygrammar`) - Uses existing grammar or creates starter
2. **Grammar file path** (`mygrammar.langium` or path/to/grammar.langium) - Uses specified grammar file
3. **Natural language description** (`"A language for..."`) - AI-generates grammar

### Step 1: Parse Arguments and Detect Input Mode

Parse `$ARGUMENTS` to determine the input mode:

- **Quoted string** (starts and ends with `"` or `'`): Natural language description → AI generation mode (User Story 3)
- **File path ending in `.langium`**: Direct grammar file reference
- **Text file path** (ends with `.txt` or `.md`): Read file for description → AI generation mode (User Story 3)
- **Simple name** (alphanumeric with hyphens): Grammar name

For grammar names, apply normalization:
- Convert to lowercase
- Replace spaces and underscores with hyphens
- Remove special characters except hyphens
- Validate: must start with letter, alphanumeric with hyphens only

If the name is invalid, report error:
```
Error: Invalid grammar name '{name}'
Grammar names must:
- Start with a letter
- Contain only lowercase letters, numbers, and hyphens
- Example: 'my-grammar', 'workflow', 'api-model'
```

### Step 2: Resolve Grammar Location

Based on the detected mode:

**For grammar name:**
- Expected location: `grammars/{name}/{name}.langium`
- Check if file exists

**For file path:**
- If absolute path, use directly
- If relative path, resolve from workspace root
- Extract grammar name from filename (without `.langium` extension)
- Target directory: `grammars/{name}/`

### Step 3: Check for Existing Grammar

Check if the grammar file exists at the resolved location.

**If grammar exists** → Proceed to Step 4 (parse existing grammar)

**If grammar does NOT exist:**
- For simple name input → User Story 2: Create starter grammar (see separate section below)
- For quoted string input → User Story 3: AI-generate grammar (see separate section below)
- For explicit file path → Error: "Grammar file not found at '{path}'"

### Step 4: Read and Parse the Langium Grammar

Read the `.langium` file and extract:

1. **Grammar name**: Look for `grammar {Name}` declaration at start of file
2. **Entry rules**: Look for `entry {RuleName}:` patterns - these become primary root types
3. **Parser rules**: Look for `{RuleName}:` patterns (PascalCase names followed by `:`) - these are AST types
4. **Terminal rules**: Look for `terminal {NAME}:` patterns - used for basic validation

**Extraction patterns:**
```
Grammar declaration: /^grammar\s+([A-Z][a-zA-Z0-9]*)/m
Entry rules: /entry\s+([A-Z][a-zA-Z0-9]*)\s*:/g
Parser rules: /^([A-Z][a-zA-Z0-9]*)\s*:/gm  (exclude entry rules already captured)
Terminal rules: /terminal\s+([A-Z_]+)/g
```

If parsing fails:
```
Error: Failed to parse grammar file '{path}'
{specific error details with line/column if available}

Please ensure the grammar file is valid Langium syntax.
See: https://langium.org/docs/reference/grammar-language/
```

### Step 5: Generate rootTypes from Parser Rules

For each extracted entry rule and significant parser rule, create a `RootTypeConfig`:

**Type to rootType mapping:**

| Field | Derivation |
|-------|------------|
| `astType` | Parser rule name (PascalCase) |
| `displayName` | Rule name with spaces before capitals (e.g., "MyTask" → "My Task") |
| `fileSuffix` | `.` + lowercase rule name (e.g., `.mytask`) |
| `folder` | Lowercase rule name + `s` for plural (e.g., `mytasks`) |
| `icon` | Heuristic mapping based on type name (see icon mapping below) |
| `template` | Generated template with `${name}` placeholder |
| `templateInputs` | Default: `[{ id: 'name', label: '{DisplayName} Name', type: 'string', required: true }]` |

**Icon mapping heuristics:**

```
if name matches /workflow|flow|process/i → 'git-merge'
if name matches /task|step|action/i → 'checklist'
if name matches /entity|class|type/i → 'symbol-class'
if name matches /property|field|attribute/i → 'symbol-field'
if name matches /function|method|operation/i → 'symbol-method'
if name matches /event|trigger|signal/i → 'zap'
if name matches /state|status/i → 'circle-filled'
if name matches /connection|link|edge/i → 'link'
if name matches /group|container|package/i → 'folder'
if name matches /config|settings|options/i → 'gear'
if name matches /user|person|actor/i → 'person'
if name matches /security|permission|role/i → 'shield'
if name matches /data|record|document/i → 'file'
if name matches /list|array|collection/i → 'list-flat'
else → 'symbol-namespace'
```

**Template generation:**
```typescript
// For a type like "Task"
`task \${name} {
  // Add task details here
}
`
```

### Step 6: Generate diagramTypes, nodeTypes, edgeTypes, and toolPalette

For each rootType, generate corresponding diagram configuration:

**DiagramNodeConfig:**
```typescript
{
  glspType: `node:${astType.toLowerCase()}`,
  shape: 'rectangle',  // default
  cssClass: `${astType.toLowerCase()}-node`,
  defaultSize: { width: 150, height: 60 }
}
```

**DiagramTypeConfig:**
Create a single overview diagram type:
```typescript
{
  id: `${languageId}-overview`,
  displayName: `${displayName} Overview`,
  fileType: 'Model',
  nodeTypes: [/* one for each rootType */],
  edgeTypes: [/* basic connection edge */],
  toolPalette: { groups: [/* one group per category */] }
}
```

**NodeTypeConfig:** (for each rootType)
```typescript
{
  glspType: `node:${astType.toLowerCase()}`,
  creatable: true,
  showable: true
}
```

**EdgeTypeConfig:** (default connection edge)
```typescript
{
  glspType: 'edge:connection',
  creatable: true,
  showable: true
}
```

**ToolPaletteConfig:**
Group tools by category. Create one "Elements" group with items for each rootType:
```typescript
{
  groups: [{
    id: 'elements',
    label: 'Elements',
    items: [
      {
        id: `create-${astType.toLowerCase()}`,
        label: displayName,
        icon: icon,
        action: { type: 'create-node', glspType: `node:${astType.toLowerCase()}` }
      }
      // ... for each rootType
    ]
  }]
}
```

### Step 7: Generate manifest.ts

Create `grammars/{name}/manifest.ts` with the complete `GrammarManifest` export:

```typescript
import type { GrammarManifest } from '@sanyam/types';

export const {GRAMMAR_NAME_UPPERCASE}_MANIFEST: GrammarManifest = {
  languageId: '{languageId}',
  displayName: '{DisplayName}',
  fileExtension: '.{ext}',
  baseExtension: '.{ext}',
  rootTypes: [
    // ... generated rootTypes
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    // ... generated diagramTypes
  ]
};
```

The export name follows the pattern: `{GRAMMAR_NAME_UPPERCASE}_MANIFEST`
- Convert grammar name to uppercase
- Replace hyphens with underscores
- Append `_MANIFEST`

Example: `my-grammar` → `MY_GRAMMAR_MANIFEST`

### Step 8: Generate package.json

Create `grammars/{name}/package.json`:

```json
{
  "name": "@sanyam/grammar-{name}",
  "version": "0.0.1",
  "description": "Grammar package for {DisplayName}",
  "type": "module",
  "main": "./manifest.ts",
  "exports": {
    ".": "./manifest.ts"
  },
  "peerDependencies": {
    "@sanyam/types": "workspace:*"
  }
}
```

### Step 9: Generate tsconfig.json

Create `grammars/{name}/tsconfig.json` for TypeScript/ESLint integration:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

### Step 10: Update ESLint Configuration

Check if the grammar's tsconfig is already included in `.eslintrc.js`. If not, add it to the `parserOptions.project` array.

**Current pattern to find:**
```javascript
project: ['./configs/tsconfig.eslint.json', './theia-extensions/*/tsconfig.json', 'applications/electron/tsconfig.eslint.json']
```

**Updated pattern (if `grammars/*/tsconfig.json` not present):**
```javascript
project: ['./configs/tsconfig.eslint.json', './theia-extensions/*/tsconfig.json', 'applications/electron/tsconfig.eslint.json', 'grammars/*/tsconfig.json']
```

Only modify `.eslintrc.js` if the `grammars/*/tsconfig.json` pattern is not already present.

### Step 11: Report Completion

Output summary of generated files:

```
✓ Grammar package generated successfully!

Files created:
  grammars/{name}/manifest.ts    - GrammarManifest export
  grammars/{name}/package.json   - Package configuration
  grammars/{name}/tsconfig.json  - TypeScript configuration

Configuration updated:
  .eslintrc.js                   - Added grammar tsconfig to project references (if not already present)

Grammar: {DisplayName}
Language ID: {languageId}
Root Types: {count} ({list of type names})
Diagramming: Enabled

Next steps:
1. Review and customize the generated manifest.ts
2. Run 'pnpm install' to link the new grammar package
3. Import the manifest in your platform configuration:
   import { {MANIFEST_NAME} } from '@sanyam/grammar-{name}';
```

---

## User Story 2: Create New Grammar from Scratch

**Trigger**: Simple name provided, but `grammars/{name}/{name}.langium` does not exist

### US2 Step 1: Create Grammar Directory

Create `grammars/{name}/` directory if it doesn't exist.

### US2 Step 2: Copy Starter Template

Read the starter template from `.claude/templates/starter-grammar.langium` and:
1. Replace `${GrammarName}` placeholder with PascalCase grammar name
   - Convert `my-grammar` → `MyGrammar`
2. Write to `grammars/{name}/{name}.langium`

### US2 Step 3: Continue to Manifest Generation

Proceed with Step 4 (parsing) using the newly created grammar file.

### US2 Step 4: Notify User

After completion, add to the output:

```
Note: A starter grammar was created since no existing grammar was found.
The starter template includes basic Task and Workflow types.

To customize your grammar:
1. Edit grammars/{name}/{name}.langium
2. Re-run /grammar-config {name} to regenerate the manifest
```

---

## User Story 3: Create Grammar from Natural Language Description

**Trigger**: Argument is a quoted string or text file path

### US3 Step 1: Extract Description

- **Quoted string**: Remove surrounding quotes
- **Text file**: Read file contents

### US3 Step 2: Derive Grammar Name

From the description, extract a suitable grammar name:
1. Look for key domain nouns (first significant noun phrase)
2. Convert to kebab-case
3. Validate the derived name

Example: "A language for state machines with states and transitions" → "state-machine"

If name derivation fails, ask user or use generic name like "custom-dsl".

### US3 Step 3: AI Grammar Generation

Use Claude to generate a Langium grammar based on the description:

**Prompt:**
```
Generate a Langium grammar for the following DSL:

Description: {description}

Requirements:
- Use Langium 4.x syntax
- Include an entry rule named 'Model'
- Define at least 3 AST types based on the domain concepts
- Include common terminal rules (ID, STRING, INT, WS)
- Add comments explaining each rule

Output format:
- Start with `grammar {GrammarName}` (use PascalCase)
- Use proper Langium syntax with entry, parser rules, and terminals
- Output ONLY the grammar code, no explanations
```

### US3 Step 4: Validate Generated Grammar

Check the generated grammar for:
1. Starts with `grammar {Name}` declaration
2. Has at least one `entry` rule
3. Contains terminal rules for ID and STRING
4. Has balanced braces and proper rule structure

### US3 Step 5: Retry on Failure

If validation fails:
1. Retry once with additional guidance:
   ```
   The previous grammar had issues: {specific issues}

   Please regenerate with these fixes:
   - Ensure grammar starts with 'grammar {Name}'
   - Include 'entry Model:' as the first rule
   - Define terminal rules for ID, STRING, INT, WS
   ```

2. Maximum 2 attempts total

### US3 Step 6: Fallback to Starter Template

If both attempts fail:
1. Use the starter template from `.claude/templates/starter-grammar.langium`
2. Add the original description as a comment at the top:
   ```langium
   // Generated from description:
   // {description}
   //
   // Note: AI generation failed. This is a starter template.
   // Please customize to match your requirements.

   grammar {GrammarName}
   // ... rest of starter template
   ```

### US3 Step 7: Continue to Manifest Generation

Proceed with Step 4 (parsing) using the generated/fallback grammar.

### US3 Step 8: Notify User

After completion, add status to output:

**If AI generation succeeded:**
```
Note: Grammar was generated from your description using AI.
Review grammars/{name}/{name}.langium and adjust as needed.
```

**If fallback was used:**
```
Note: AI grammar generation did not produce valid output after 2 attempts.
A starter template was used instead. Your description has been preserved as a comment.
Please edit grammars/{name}/{name}.langium to implement your DSL.
```

---

## Error Handling

### Invalid Grammar Name (FR-010)

```
Error: Invalid grammar name '{name}'

Grammar names must:
- Start with a letter
- Contain only lowercase letters, numbers, and hyphens
- Not contain spaces, underscores, or special characters

Examples of valid names: 'workflow', 'my-dsl', 'api-model'

To fix: /grammar-config {suggested-normalized-name}
```

### Grammar Parse Failure (FR-011)

```
Error: Failed to parse grammar at '{path}'

{Specific error message with line/column if available}

Common issues:
- Missing or malformed grammar declaration
- Unclosed braces or parentheses
- Invalid rule syntax

For help: https://langium.org/docs/reference/grammar-language/
```

### Missing grammars Directory (FR-012)

If `grammars/` directory doesn't exist, create it automatically:
```bash
mkdir -p grammars/{name}
```

No error message needed - handle silently.

### File Write Failures

```
Error: Could not write to '{path}'

Please check:
- Directory permissions
- Disk space availability
- Path validity

If the problem persists, try creating the directory manually:
mkdir -p grammars/{name}
```

---

## Validation (User Story 4)

Before writing the manifest, validate using `validateManifest()` logic:

1. `languageId` is lowercase alphanumeric with hyphens, starts with letter
2. `fileExtension` and `baseExtension` start with `.`
3. `rootTypes` has at least one entry
4. Each `rootType.astType` is PascalCase
5. Each `rootType.fileSuffix` starts with `.`
6. If `diagrammingEnabled` is true, `diagramTypes` has at least one entry

If validation fails, report specific errors and do not write the manifest.
