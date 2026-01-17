---
description: Generate grammar package with LanguageContribution from Langium grammar
handoffs:
  - label: Plan Implementation
    agent: speckit.plan
    prompt: Plan changes for the generated grammar package
    send: false
---

## User Input

$ARGUMENTS

## Outline

This command generates a grammar package with `LanguageContribution` export for the SANYAM platform. The generated package follows the spec from `002-unified-lsp-glsp` and includes:

- `src/manifest.ts` - `GrammarManifest` configuration
- `src/contribution.ts` - `LanguageContribution` factory
- `package.json` - Package with `sanyam` discovery metadata

It supports three input modes:

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

- Expected location: `packages/grammar-definitions/{name}.langium`
- Check if file exists

**For file path:**

- If absolute path, use directly
- If relative path, resolve from workspace root
- Extract grammar name from filename (without `.langium` extension)
- Target directory: `packages/grammar-definitions/{name}/`

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

**DiagramNodeConfig:** (embedded in RootTypeConfig)

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

**NodeTypeConfig:** (for each rootType in diagramTypes)

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

### Step 7: Generate src/manifest.ts

Create `packages/grammar-definitions/{name}/src/manifest.ts` with the complete `GrammarManifest` export:

```typescript
/**
 * {DisplayName} Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * {DisplayName} Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: '{languageId}',
  displayName: '{DisplayName}',
  fileExtension: '.{ext}',
  baseExtension: '.{ext}',
  rootTypes: [
    {
      astType: '{AstType}',
      displayName: '{Display Name}',
      fileSuffix: '.{suffix}',
      folder: '{folder}',
      icon: '{icon}',
      template: `{template content}`,
      templateInputs: [
        { id: 'name', label: '{Display Name} Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:{lowercase}',
        shape: 'rectangle',
        cssClass: '{lowercase}-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    // ... additional rootTypes
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: '{languageId}-overview',
      displayName: '{DisplayName} Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:{lowercase}', creatable: true, showable: true },
        // ... for each rootType
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'elements',
            label: 'Elements',
            items: [
              {
                id: 'create-{lowercase}',
                label: '{Display Name}',
                icon: '{icon}',
                action: { type: 'create-node', glspType: 'node:{lowercase}' },
              },
              // ... for each rootType
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
```

### Step 8: Generate src/contribution.ts

Create `packages/grammar-definitions/{name}/src/contribution.ts` with the `LanguageContribution` factory:

```typescript
/**
 * {DisplayName} Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 *
 * @packageDocumentation
 */

import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';

import { manifest } from './manifest.js';
import {
  {GrammarName}GeneratedModule,
  {GrammarName}GeneratedSharedModule,
} from './generated/module.js';

/**
 * Custom LSP providers for {DisplayName}.
 *
 * Override default LSP behavior here. Omitted providers use Langium defaults.
 */
const lspProviders: Partial<LspFeatureProviders> = {
  // Add custom LSP providers here
  // Example:
  // hover: {
  //   provide: async (ctx, params) => ({
  //     contents: { kind: 'markdown', value: '**Custom hover**' }
  //   })
  // }
};

/**
 * Custom GLSP providers for {DisplayName}.
 *
 * Override default diagram behavior here. Omitted providers use manifest-driven defaults.
 */
const glspProviders: Partial<GlspFeatureProviders> = {
  // Add custom GLSP providers here
  // Example:
  // astToGModel: {
  //   getLabel: (ast) => (ast as any).title ?? (ast as any).name ?? 'Unnamed'
  // }
};

/**
 * {DisplayName} Language Contribution
 *
 * This is the main export that the unified server discovers and loads.
 */
export const contribution: LanguageContribution = {
  languageId: '{languageId}',
  fileExtensions: ['.{ext}'],
  generatedSharedModule: {GrammarName}GeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: {GrammarName}GeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
};

export default contribution;
```

**Notes on Langium modules:**

- `{GrammarName}GeneratedModule` and `{GrammarName}GeneratedSharedModule` are generated by `langium generate`
- These are created when the user runs `pnpm langium:generate` or similar
- The import path `./generated/module.js` is the standard Langium output location

### Step 9: Generate package.json

Create `packages/grammar-definitions/{name}/package.json`:

```json
{
  "name": "@sanyam-grammar/{name}",
  "version": "0.0.1",
  "description": "Grammar package for {DisplayName}",
  "type": "module",
  "main": "./lib/src/contribution.js",
  "types": "./lib/src/contribution.d.ts",
  "exports": {
    ".": {
      "types": "./lib/src/contribution.d.ts",
      "default": "./lib/src/contribution.js"
    },
    "./contribution": {
      "types": "./lib/src/contribution.d.ts",
      "default": "./lib/src/contribution.js"
    },
    "./manifest": {
      "types": "./lib/src/manifest.d.ts",
      "default": "./lib/src/manifest.js"
    }
  },
  "scripts": {
    "build": "tsc -b tsconfig.json",
    "clean": "rimraf lib",
    "langium:generate": "langium generate",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "{languageId}",
    "contribution": "./lib/src/contribution.js"
  },
  "dependencies": {
    "langium": "^4.0.0"
  },
  "peerDependencies": {
    "@sanyam/types": "workspace:*"
  },
  "devDependencies": {
    "langium-cli": "^4.0.0",
    "rimraf": "^5.0.0",
    "typescript": "~5.6.0"
  }
}
```

**Key fields:**

- `sanyam.grammar: true` - Marks package for build-time discovery
- `sanyam.languageId` - Language identifier for registry
- `sanyam.contribution` - Path to LanguageContribution export
- `exports./contribution` - Enables `import from '@sanyam-grammar/{name}/contribution'`

### Step 10: Generate tsconfig.json

Create `packages/grammar-definitions/{name}/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./lib",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "lib"]
}
```

### Step 11: Generate langium-config.json

Create `packages/grammar-definitions/{name}/langium-config.json` for Langium CLI:

```json
{
  "$schema": "https://raw.githubusercontent.com/eclipse-langium/langium/main/packages/langium-cli/langium-config-schema.json",
  "projectName": "{GrammarName}",
  "languages": [
    {
      "id": "{languageId}",
      "grammar": "src/{name}.langium",
      "fileExtensions": [".{ext}"]
    }
  ],
  "out": "src/generated"
}
```

### Step 12: Update ESLint Configuration

Check if the grammar's tsconfig is already included in `.eslintrc.js`. If not, add it to the `parserOptions.project` array.

**Current pattern to find:**

```javascript
project: ['./configs/tsconfig.eslint.json', './packages/theia-extensions/*/tsconfig.json', 'applications/electron/tsconfig.eslint.json']
```

**Updated pattern (if `packages/grammar-definitions/*/tsconfig.json` not present):**

```javascript
project: ['./configs/tsconfig.eslint.json', './packages/theia-extensions/*/tsconfig.json', 'applications/electron/tsconfig.eslint.json', 'packages/grammar-definitions/*/tsconfig.json']
```

Only modify `.eslintrc.js` if the `packages/grammar-definitions/*/tsconfig.json` pattern is not already present.

### Step 13: Report Completion

Output summary of generated files:

```
Grammar package generated successfully!

Files created:
  packages/grammar-definitions/{name}/src/manifest.ts      - GrammarManifest configuration
  packages/grammar-definitions/{name}/src/contribution.ts  - LanguageContribution export
  packages/grammar-definitions/{name}/package.json         - Package with sanyam discovery metadata
  packages/grammar-definitions/{name}/tsconfig.json        - TypeScript configuration
  packages/grammar-definitions/{name}/langium-config.json  - Langium CLI configuration

Grammar: {DisplayName}
Language ID: {languageId}
Root Types: {count} ({list of type names})
Diagramming: Enabled

Next steps:
1. Generate Langium modules:
   cd packages/grammar-definitions/{name} && pnpm langium:generate

2. Build the grammar package:
   pnpm build

3. Install workspace dependencies:
   pnpm install

4. The grammar will be auto-discovered by the unified server via:
   - package.json sanyam.grammar: true
   - sanyam.contribution path

Note: The contribution.ts imports from './generated/module.js' which
is created by 'langium generate'. Run step 1 before building.
```

---

## User Story 2: Create New Grammar from Scratch

**Trigger**: Simple name provided, but `packages/grammar-definitions/{name}/src/{name}.langium` does not exist

### US2 Step 1: Create Grammar Directory Structure

Create the full directory structure:

```
packages/grammar-definitions/{name}/
├── src/
│   └── {name}.langium
├── package.json
├── tsconfig.json
└── langium-config.json
```

### US2 Step 2: Copy Starter Template

Read the starter template from `.claude/templates/starter-grammar.langium` and:

1. Replace `${GrammarName}` placeholder with PascalCase grammar name
   - Convert `my-grammar` → `MyGrammar`
2. Write to `packages/grammar-definitions/{name}/src/{name}.langium`

### US2 Step 3: Continue to Manifest Generation

Proceed with Step 4 (parsing) using the newly created grammar file.

### US2 Step 4: Notify User

After completion, add to the output:

```
Note: A starter grammar was created since no existing grammar was found.
The starter template includes basic Task and Workflow types.

To customize your grammar:
1. Edit packages/grammar-definitions/{name}/src/{name}.langium
2. Re-run /grammar.config {name} to regenerate the manifest
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
Review packages/grammar-definitions/{name}/src/{name}.langium and adjust as needed.
```

**If fallback was used:**

```
Note: AI grammar generation did not produce valid output after 2 attempts.
A starter template was used instead. Your description has been preserved as a comment.
Please edit packages/grammar-definitions/{name}/src/{name}.langium to implement your DSL.
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

To fix: /grammar.config {suggested-normalized-name}
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

If `packages/grammar-definitions/` directory doesn't exist, create it automatically:

```bash
mkdir -p packages/grammar-definitions/{name}/src
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
mkdir -p packages/grammar-definitions/{name}/src
```

---

## Validation (User Story 4)

Before writing the manifest, validate using `validateManifest()` logic from `@sanyam/types`:

1. `languageId` is lowercase alphanumeric with hyphens, starts with letter
2. `fileExtension` and `baseExtension` start with `.`
3. `rootTypes` has at least one entry
4. Each `rootType.astType` is PascalCase
5. Each `rootType.fileSuffix` starts with `.`
6. Each `rootType.displayName` is non-empty
7. Each `rootType.folder` is non-empty
8. Each `rootType.icon` is non-empty
9. Each `rootType.template` is non-empty
10. If `diagrammingEnabled` is true, `diagramTypes` has at least one entry
11. Each `diagramType` has valid `nodeTypes`, `edgeTypes`, and `toolPalette`

If validation fails, report specific errors and do not write the manifest.

---

## Reference: Type Definitions

The generated code must conform to these types from `@sanyam/types`:

### GrammarManifest

```typescript
interface GrammarManifest {
  languageId: string;
  displayName: string;
  fileExtension: string;
  baseExtension: string;
  packageFile?: PackageFileConfig;
  rootTypes: RootTypeConfig[];
  diagrammingEnabled: boolean;
  diagramTypes?: DiagramTypeConfig[];
}
```

### RootTypeConfig

```typescript
interface RootTypeConfig {
  astType: string;           // PascalCase AST type name
  displayName: string;       // Human-readable name
  fileSuffix: string;        // e.g., '.task'
  folder: string;            // e.g., 'tasks'
  icon: string;              // VS Code codicon
  template: string;          // File template with ${name}
  templateInputs?: TemplateInput[];
  diagramNode?: DiagramNodeConfig;
}
```

### DiagramTypeConfig

```typescript
interface DiagramTypeConfig {
  id: string;
  displayName: string;
  fileType: string;
  nodeTypes: NodeTypeConfig[];
  edgeTypes: EdgeTypeConfig[];
  toolPalette: ToolPaletteConfig;
}
```

### LanguageContribution

```typescript
interface LanguageContribution {
  languageId: string;
  fileExtensions: string[];
  generatedSharedModule: Module<LangiumSharedServices>;
  generatedModule: Module<LangiumServices>;
  customModule?: Module<LangiumServices>;
  manifest: GrammarManifest;
  lspProviders?: LspFeatureProviders;
  glspProviders?: GlspFeatureProviders;
  disabledLspFeatures?: LspFeatureName[];
  disabledGlspFeatures?: GlspFeatureName[];
}
```

See `packages/types/src/grammar-manifest.ts` and `packages/types/src/language-contribution.ts` for complete type definitions.
