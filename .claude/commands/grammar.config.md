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

It supports four input modes:

1. **Grammar name** (`mygrammar`) - Uses existing grammar or creates starter
2. **Grammar file path** (`mygrammar.langium` or path/to/grammar.langium) - Uses specified grammar file
3. **Natural language description** (`"A language for..."`) - AI-generates grammar
4. **URL** (`https://example.com/spec.html`) - Fetches content from URL for AI generation

### Step 1: Parse Arguments and Detect Input Mode

Parse `$ARGUMENTS` to determine the input mode:

- **URL** (starts with `http://` or `https://`): Fetch content from URL → AI generation mode (User Story 3)
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

Search for the grammar file in the following locations (in order):

1. `packages/grammar-definitions/.source/{name}.langium` (master source - PRIMARY)
2. `packages/grammar-definitions/{name}/src/{name}.langium` (existing package)

Use the first location where the file exists. Set:
- `grammarPath` = the found file path
- `packageDir` = `packages/grammar-definitions/{name}/` (target package directory)
- `sourcePath` = `packages/grammar-definitions/.source/{name}.langium` (master source location)

**For file path:**

- If absolute path, use directly
- If relative path, resolve from workspace root
- Extract grammar name from filename (without `.langium` extension)
- Target directory: `packages/grammar-definitions/{name}/`
- **Copy the file to `.source/` folder** if not already there (preserving original)

### Step 3: Check for Existing Grammar and Setup Package

Check if the grammar file was found in Step 2.

**If grammar exists (found in .source/ or package):**

1. Ensure the `.source/` folder exists: `mkdir -p packages/grammar-definitions/.source`
2. If grammar was found in package but NOT in `.source/`:
   - Copy to `.source/{name}.langium` (create master copy)
   - Log: "Created master copy at packages/grammar-definitions/.source/{name}.langium"
3. Ensure the package directory exists: `mkdir -p packages/grammar-definitions/{name}/src`
4. Copy grammar from `.source/` to package: `packages/grammar-definitions/{name}/src/{name}.langium`
   - Log: "Copied grammar to packages/grammar-definitions/{name}/src/{name}.langium"
   - **IMPORTANT: NEVER delete or move the grammar from `.source/`**
5. Proceed to Step 4 (parse the grammar)

**If grammar does NOT exist:**

- For simple name input → User Story 2: Create starter grammar (creates in `.source/` first)
- For quoted string input → User Story 3: AI-generate grammar (creates in `.source/` first)
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

### Step 4.1: Validate Grammar for Langium 4.x Compatibility

After parsing, check for common issues that cause build failures:

**Check 1: Reserved JavaScript Names**

Scan all parser rule names for JavaScript reserved words:

Reserved names to check:
```
Function, Object, Array, String, Number, Boolean, Symbol, Error,
Map, Set, Promise, Date, RegExp, Math, JSON, Proxy, Reflect,
undefined, null, NaN, Infinity, eval, arguments
```

If a reserved name is found, report a warning:
```
Warning: Grammar rule '{RuleName}' conflicts with JavaScript reserved word.
Recommendation: Rename to '{SuggestedName}' (e.g., Function → CoreFunction)

This will cause build errors. Fix the grammar before continuing.
```

**Check 2: Data Type Rules Without Return Type**

Identify parser rules that appear to be "enum-like" (returning string alternatives):

Pattern: `{RuleName}: 'value1' | 'value2' | ...;` (without `returns string`)

For each such rule, report a warning:
```
Warning: Rule '{RuleName}' appears to be a data type rule but is missing 'returns string'.
Langium 4.x requires: `{RuleName} returns string: 'value1' | 'value2' | ...;`

Add 'returns string' to avoid "cannot infer a type" errors.
```

**Auto-fix option:**

If warnings are found, offer to auto-fix:
- For reserved names: Suggest prefixed alternatives (e.g., Function → CoreFunction, Object → DataObject)
- For data type rules: Automatically add `returns string` annotation

Use AskUserQuestion:
**Question**: "The grammar has issues that will cause build errors. Would you like to auto-fix them?"
**Header**: "Grammar issues"
**Options**:
1. `auto-fix` - "Automatically fix the issues" (Recommended)
2. `continue` - "Continue without fixing (build will fail)"
3. `abort` - "Stop and manually fix the grammar"

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
import { LOGO_DATA_URL } from './logo.generated.js';

/**
 * {DisplayName} Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: '{languageId}',
  displayName: '{DisplayName}',
  fileExtension: '.{ext}',
  baseExtension: '.{ext}',
  logo: LOGO_DATA_URL,
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
- The module names derive from `projectName` in `langium-config.json`, not the grammar name
- **IMPORTANT:** Ensure `langium-config.json` `projectName` exactly matches the PascalCase grammar name to avoid naming mismatches
- Example: grammar `MyGrammar` → projectName `"MyGrammar"` → exports `MyGrammarGeneratedModule`
- These are created when running `pnpm langium:generate` or `pnpm build`
- The import path `./generated/module.js` is the standard Langium output location

### Step 9: Generate package.json

Create `packages/grammar-definitions/{name}/package.json`:

```json
{
  "name": "@sanyam-grammar/{name}",
  "version": "0.0.1",
  "description": "Grammar package for {DisplayName}",
  "type": "module",
  "main": "./lib/contribution.js",
  "types": "./lib/contribution.d.ts",
  "exports": {
    ".": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./contribution": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./manifest": {
      "types": "./lib/manifest.d.ts",
      "import": "./lib/manifest.js"
    }
  },
  "scripts": {
    "build": "npm run generate:logo && npm run langium:generate && tsc -b tsconfig.json",
    "generate:logo": "node scripts/encode-logo.js",
    "clean": "rimraf lib src/generated src/logo.generated.ts",
    "langium:generate": "langium generate",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "{languageId}",
    "contribution": "./lib/contribution.js"
  },
  "dependencies": {
    "langium": "^4.1.0"
  },
  "devDependencies": {
    "@sanyam/types": "workspace:*",
    "langium-cli": "^4.0.0",
    "rimraf": "^5.0.0",
    "typescript": "~5.6.3"
  }
}
```

**Key fields:**

- `sanyam.grammar: true` - Marks package for build-time discovery
- `sanyam.languageId` - Language identifier for registry
- `sanyam.contribution` - Path to LanguageContribution export
- `exports./contribution` - Enables `import from '@sanyam-grammar/{name}/contribution'`
- Build script runs `langium generate` before TypeScript compilation
- `@sanyam/types` is in devDependencies (not peerDependencies)

### Step 10: Generate tsconfig.json

Create `packages/grammar-definitions/{name}/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../configs/base.tsconfig.json",
  "compilerOptions": {
    "outDir": "./lib",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "lib"
  ],
  "references": [
    { "path": "../../types" }
  ]
}
```

**Key changes from standalone config:**

- `extends` inherits from base config (avoids duplication)
- `rootDir: "./src"` ensures output goes to `./lib/` (not `./lib/src/`)
- `composite: true` enables project references
- `references` links to types package for proper build ordering

### Step 11: Generate langium-config.json

Create `packages/grammar-definitions/{name}/langium-config.json` for Langium CLI:

```json
{
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

**Important notes:**

- `$schema` field is omitted (can cause issues with some Langium CLI versions)
- `projectName` **must** be PascalCase matching the grammar name exactly
  - Grammar `grammar MyGrammar` → `"projectName": "MyGrammar"`
  - This determines the generated module names: `MyGrammarGeneratedModule`, `MyGrammarGeneratedSharedModule`
- Mismatched `projectName` causes TypeScript errors when importing generated modules

### Step 12: Generate Logo Infrastructure

Generate a default SVG logo and the build-time encoding infrastructure.

**12.1: Create src/logo.svg**

Generate a default logo SVG using the grammar's display name. Use a gradient background with the grammar name centered:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">
  <defs>
    <linearGradient id="{languageId}Grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{primaryColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{secondaryColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="196" height="76" rx="8" fill="url(#{languageId}Grad)"/>
  <text x="100" y="52" font-family="Arial, sans-serif" font-size="{fontSize}" font-weight="bold" fill="white" text-anchor="middle">{SHORT_NAME}</text>
</svg>
```

**Color selection heuristics** (based on grammar name):
```
if name matches /workflow|flow|process/i → primary: #9b59b6, secondary: #8e44ad (purple)
if name matches /api|rest|http/i → primary: #e74c3c, secondary: #c0392b (red)
if name matches /data|model|entity/i → primary: #3498db, secondary: #2c3e50 (blue)
if name matches /config|settings/i → primary: #95a5a6, secondary: #7f8c8d (gray)
if name matches /security|auth/i → primary: #27ae60, secondary: #1e8449 (green)
if name matches /test|spec/i → primary: #f39c12, secondary: #d68910 (orange)
else → primary: #3498db, secondary: #2c3e50 (default blue)
```

**Short name derivation:**
- Use uppercase acronym if grammar name has multiple words (e.g., "my-grammar" → "MG")
- If single word and ≤6 chars, use uppercase (e.g., "ecml" → "ECML")
- If single word and >6 chars, use first 4 chars uppercase (e.g., "workflow" → "WORK")

**Font size selection:**
- 1-4 chars: 36px
- 5-6 chars: 30px
- 7+ chars: 24px

**12.2: Create scripts/encode-logo.js**

Create `packages/grammar-definitions/{name}/scripts/encode-logo.js`:

```javascript
#!/usr/bin/env node
/**
 * Encodes the logo.svg file as a base64 data URL and generates a TypeScript module.
 * Run this script before TypeScript compilation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svgPath = resolve(__dirname, '../src/logo.svg');
const outputPath = resolve(__dirname, '../src/logo.generated.ts');

const svg = readFileSync(svgPath, 'utf-8');
const base64 = Buffer.from(svg).toString('base64');

// Split base64 into chunks to avoid exceeding max line length
const chunkSize = 80;
const chunks = [];
for (let i = 0; i < base64.length; i += chunkSize) {
  chunks.push(base64.slice(i, i + chunkSize));
}

const base64Lines = chunks.map((chunk) => `  '${chunk}'`).join(' +\n');

const output = `/**
 * Auto-generated file - do not edit directly.
 * Generated from logo.svg by scripts/encode-logo.js
 */
const BASE64_DATA =
${base64Lines};

export const LOGO_DATA_URL = \`data:image/svg+xml;base64,\${BASE64_DATA}\`;
`;

writeFileSync(outputPath, output);
console.log('Generated logo.generated.ts');
```

**12.3: Create .gitignore**

Create `packages/grammar-definitions/{name}/.gitignore`:

```
# Generated files
src/logo.generated.ts
```

### Step 13: Update ESLint Configuration

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

### Step 14: Report Completion

Output summary of generated files:

```
Grammar package generated successfully!

Master grammar:
  packages/grammar-definitions/.source/{name}.langium    - Master source (DO NOT DELETE)

Package files created:
  packages/grammar-definitions/{name}/src/{name}.langium   - Grammar copy (synced from .source/)
  packages/grammar-definitions/{name}/src/manifest.ts      - GrammarManifest configuration
  packages/grammar-definitions/{name}/src/contribution.ts  - LanguageContribution export
  packages/grammar-definitions/{name}/src/logo.svg         - Grammar logo (editable SVG)
  packages/grammar-definitions/{name}/scripts/encode-logo.js - Logo encoding script
  packages/grammar-definitions/{name}/package.json         - Package with sanyam discovery metadata
  packages/grammar-definitions/{name}/tsconfig.json        - TypeScript configuration
  packages/grammar-definitions/{name}/langium-config.json  - Langium CLI configuration
  packages/grammar-definitions/{name}/.gitignore           - Excludes generated logo file

Grammar: {DisplayName}
Language ID: {languageId}
Root Types: {count} ({list of type names})
Diagramming: Enabled
Logo: Auto-generated (edit src/logo.svg to customize)

Next steps:
1. Build the grammar package (generates logo and Langium modules):
   cd packages/grammar-definitions/{name} && pnpm build

2. Install workspace dependencies:
   pnpm install

3. To modify the grammar:
   - Edit packages/grammar-definitions/.source/{name}.langium (master)
   - Re-run /grammar.config {name} to sync changes

4. To customize the logo:
   - Edit packages/grammar-definitions/{name}/src/logo.svg
   - Run pnpm build to regenerate the encoded logo

Note: The .source/{name}.langium is the master copy. Changes should be made there
and synced to the package via /grammar.config. NEVER delete the .source/ file.
```

---

## User Story 2: Create New Grammar from Scratch

**Trigger**: Simple name provided, but no grammar exists in `.source/` or package

### US2 Step 1: Create Grammar Directory Structure

Create the full directory structure:

```
packages/grammar-definitions/.source/
│   └── {name}.langium              <- Master source (created first)
packages/grammar-definitions/{name}/
├── src/
│   └── {name}.langium              <- Synced copy from .source/
├── package.json
├── tsconfig.json
└── langium-config.json
```

### US2 Step 2: Create Grammar in .source Folder

Read the starter template from `.claude/templates/starter-grammar.langium` and:

1. Ensure `.source/` folder exists: `mkdir -p packages/grammar-definitions/.source`
2. Replace `${GrammarName}` placeholder with PascalCase grammar name
   - Convert `my-grammar` → `MyGrammar`
3. Write master copy to `packages/grammar-definitions/.source/{name}.langium`
   - Log: "Created master grammar at packages/grammar-definitions/.source/{name}.langium"
4. Copy to package: `packages/grammar-definitions/{name}/src/{name}.langium`
   - **IMPORTANT: The .source/ copy is the master - NEVER delete it**

### US2 Step 3: Continue to Manifest Generation

Proceed with Step 4 (parsing) using the newly created grammar file.

### US2 Step 4: Notify User

After completion, add to the output:

```
Note: A starter grammar was created since no existing grammar was found.
The starter template includes basic Task and Workflow types.

Master grammar location: packages/grammar-definitions/.source/{name}.langium
Package grammar location: packages/grammar-definitions/{name}/src/{name}.langium

To customize your grammar:
1. Edit packages/grammar-definitions/.source/{name}.langium (master copy)
2. Re-run /grammar.config {name} to regenerate the manifest and sync to package
```

---

## User Story 3: Create Grammar from Natural Language Description

**Trigger**: Argument is a quoted string, text file path, or URL

### US3 Step 1: Extract Description

- **URL**: Use WebFetch to fetch content from the URL. Extract text content for use as the description.
  - Prompt WebFetch: "Extract all text content from this page that describes a domain, specification, or language. Return the main content without navigation, headers, or footers."
  - If fetch fails, report error: "Could not fetch content from URL: {url}"
- **Quoted string**: Remove surrounding quotes
- **Text file**: Read file contents

### US3 Step 2: Derive Grammar Name

From the description, extract a suitable grammar name:

1. Look for key domain nouns (first significant noun phrase)
2. Convert to kebab-case
3. Validate the derived name

Example: "A language for state machines with states and transitions" → "state-machine"

If name derivation fails, use generic name like "custom-dsl".

### US3 Step 2.1: Confirm Grammar Name

After deriving the grammar name, confirm with the user using AskUserQuestion:

**Question**: "What should the grammar be named?"
**Header**: "Grammar name"
**Options**:
1. `{derived-name}` - "Use the derived name based on the description" (Recommended)
2. `custom` - "Enter a custom grammar name"

If the user selects "custom" (or "Other"), prompt for the name and validate it using the same rules as Step 1.

Set `{name}` to the confirmed grammar name (normalized to kebab-case, lowercase).

### US3 Step 2.2: Check for Existing Grammar

After confirming the name, check if a grammar already exists at:
1. `packages/grammar-definitions/.source/{name}.langium`
2. `packages/grammar-definitions/{name}/src/{name}.langium`

**If grammar exists:**

Use AskUserQuestion to confirm:

**Question**: "A grammar named '{name}' already exists. What would you like to do?"
**Header**: "Existing grammar"
**Options**:
1. `overwrite` - "Overwrite the existing grammar with AI-generated content"
2. `use-existing` - "Use the existing grammar instead of generating new one" (Recommended)
3. `rename` - "Choose a different name for the new grammar"

- If `overwrite`: Proceed to US3 Step 3 (AI generation will replace existing)
- If `use-existing`: Skip to main Step 4 (parse existing grammar)
- If `rename`: Return to US3 Step 2.1 to choose a different name

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
- Include common terminal rules (ID, STRING, WS)
- Add comments explaining each rule

IMPORTANT Langium 4.x rules:
1. Data type rules (rules that return string alternatives like 'a' | 'b' | 'c') MUST use `returns string`:
   - CORRECT: `Status returns string: 'active' | 'inactive' | 'pending';`
   - WRONG: `Status: 'active' | 'inactive' | 'pending';`

2. NEVER use JavaScript reserved words as rule names:
   - AVOID: Function, Object, Array, String, Number, Boolean, Symbol, Error, Map, Set, Promise, Date
   - USE: CoreFunction, DataObject, ItemArray, etc.

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

### US3 Step 7: Save Grammar and Continue

1. Ensure `.source/` folder exists: `mkdir -p packages/grammar-definitions/.source`
2. Write master copy to `packages/grammar-definitions/.source/{name}.langium`
   - Log: "Created master grammar at packages/grammar-definitions/.source/{name}.langium"
3. Copy to package: `packages/grammar-definitions/{name}/src/{name}.langium`
   - **IMPORTANT: The .source/ copy is the master - NEVER delete it**
4. Proceed with Step 4 (parsing) using the grammar.

### US3 Step 8: Notify User

After completion, add status to output:

**If AI generation succeeded (from URL):**

```
Note: Grammar was generated from URL content using AI.
Source URL: {url}
Master grammar location: packages/grammar-definitions/.source/{name}.langium

Review and edit the master grammar as needed, then re-run /grammar.config {name} to sync changes.
```

**If AI generation succeeded (from description/file):**

```
Note: Grammar was generated from your description using AI.
Master grammar location: packages/grammar-definitions/.source/{name}.langium

Review and edit the master grammar as needed, then re-run /grammar.config {name} to sync changes.
```

**If fallback was used:**

```
Note: AI grammar generation did not produce valid output after 2 attempts.
A starter template was used instead. Your description has been preserved as a comment.

Master grammar location: packages/grammar-definitions/.source/{name}.langium

Please edit the master grammar to implement your DSL, then re-run /grammar.config {name}.
```

---

## Error Handling

### URL Fetch Failure

```
Error: Could not fetch content from URL: '{url}'

{Specific error message if available}

Please check:
- The URL is accessible and returns valid content
- The URL points to a page with text content (not binary/media)
- Your network connection is working

Alternative: Save the content to a local file and use:
/grammar.config path/to/content.txt
```

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
  logo?: string;                    // Base64 data URL for grammar logo
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
