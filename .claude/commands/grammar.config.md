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

### Step 4.2: Extract Language Tags from Comments

After validation, scan the grammar file for specially formatted single-line comments that provide explicit metadata values. These tags take precedence over AI-derived values.

**Supported tags:**

| Tag | Maps to | Description |
|-----|---------|-------------|
| `@name` | `displayName` | Human-readable name for the language |
| `@tagline` | `tagline` | Short marketing tagline (<10 words) |
| `@description` | `summary` | Brief description (1-2 sentences) |
| `@extension` | `fileExtension` | Primary file extension including dot |

**Comment format:**

```
// @{token} = "{value}"
```

**Extraction regex:**

```
/@(name|tagline|description|extension)\s*=\s*"([^"]+)"/g
```

**Processing:**
1. Scan the entire grammar file for matching patterns
2. Store extracted values in a `languageTags` object:
   ```typescript
   interface LanguageTags {
     name?: string;        // → displayName
     tagline?: string;     // → tagline
     description?: string; // → summary
     extension?: string;   // → fileExtension
   }
   ```
3. Pass `languageTags` to Step 7 for manifest generation

**Validation:**
- If `@extension` is provided, validate it starts with `.`
- If validation fails, report warning and ignore the invalid tag
- Missing tags are acceptable (AI derivation will be used as fallback)

**Example extraction:**

For grammar file:
```langium
// @name = "E C M L"
// @tagline = "Enterprise Content Modeling Language"
// @description = "A development environment for modeling enterprise content"
// @extension = ".ecml"
grammar Ecml
```

Results in:
```typescript
languageTags = {
  name: "E C M L",
  tagline: "Enterprise Content Modeling Language",
  description: "A development environment for modeling enterprise content",
  extension: ".ecml"
}
```

### Step 4.3: Extract Diagram Tags from Comments

Also scan for diagram-specific tags that apply to individual parser rules. These tags customize the visual representation of grammar constructs in diagrams.

**Diagram tags:**

| Tag | Maps to | Description |
|-----|---------|-------------|
| `@shape` | `diagramNode.shape` | Shape type: `rectangle`, `rounded`, `hexagon`, `diamond`, `ellipse`, `pill` |
| `@tooltip` | `diagramNode.tooltip` | Hover tooltip template (supports `${name}` placeholder) |
| `@container` | `diagramNode.isContainer` | Whether this type can contain child nodes |

**Tag placement**: Tags apply to the rule immediately following them.

**Example grammar with diagram tags:**

```langium
// @name = "Workflow DSL"
// @tagline = "Visual workflow automation"
// @extension = ".wf"
grammar Workflow

// @shape = "rounded"
// @tooltip = "Workflow model: ${name}"
entry Model:
    (workflows+=WorkflowDef)*;

// @shape = "hexagon"
// @tooltip = "Workflow definition: ${name}"
// @container
WorkflowDef:
    'workflow' name=ID '{'
        (steps+=Step)*
    '}';

// @shape = "rectangle"
// @tooltip = "Step: ${name}"
Step:
    'step' name=ID (':' description=STRING)?
    ('->' next=[Step:ID])?;

// @shape = "diamond"
// @tooltip = "Decision point"
Decision:
    'if' condition=STRING 'then' thenStep=[Step:ID] ('else' elseStep=[Step:ID])?;
```

**Extraction approach:**

For each parser rule, look for preceding comment lines with diagram tags:

```
// Regex to find tagged rules (simplified - actual implementation scans line by line)
// Note: @container can be bare (no value) or with = "true". The value group is optional.
/\/\/\s*@(shape|tooltip|container)\s*(?:=\s*"([^"]+)")?\s*\n(?:\/\/[^\n]*\n)*\s*(?:entry\s+)?([A-Z][a-zA-Z0-9]*)\s*:/g
```

**Processing:**
1. Scan grammar for tagged rules
2. Build `DiagramMetadata` map: `{ [ruleName]: DiagramRuleMetadata }`
3. For `@shape` and `@tooltip`, use the captured value directly
4. For `@container`: if value is absent or `"true"`, set `container: true`; if `"false"`, set `container: false`
5. Pass to Step 6 for enhanced diagram configuration
6. Pass to Step 15 for Sprotty code generation

```typescript
interface DiagramRuleMetadata {
  shape?: 'rectangle' | 'rounded' | 'hexagon' | 'diamond' | 'ellipse' | 'pill';
  tooltip?: string;  // Template with ${name} placeholder
  container?: boolean;  // Whether this type can contain child nodes
}

type DiagramMetadata = Map<string, DiagramRuleMetadata>;
```

**Example result:**

```typescript
diagramMetadata = new Map([
  ['Model', { shape: 'rounded', tooltip: 'Workflow model: ${name}' }],
  ['WorkflowDef', { shape: 'hexagon', tooltip: 'Workflow definition: ${name}', container: true }],
  ['Step', { shape: 'rectangle', tooltip: 'Step: ${name}' }],
  ['Decision', { shape: 'diamond', tooltip: 'Decision point' }],
]);
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

For each rootType, generate corresponding diagram configuration using metadata from Step 4.3.

**DiagramNodeConfig:** (embedded in RootTypeConfig)

```typescript
{
  glspType: `node:${astType.toLowerCase()}`,
  shape: diagramMetadata.get(astType)?.shape ?? deriveShapeFromName(astType),
  cssClass: `${GrammarName}.${astType}`,  // Grammar-qualified class name
  defaultSize: deriveSizeFromShape(shape, isContainer),
  tooltip: diagramMetadata.get(astType)?.tooltip ?? `${displayName}: \${name}`,
  // Only include isContainer when true (omit when false)
  ...(isContainer ? { isContainer: true } : {}),
}

// where isContainer is derived as:
const isContainer = diagramMetadata.get(astType)?.container ?? deriveIsContainer(astType, ruleText);
```

**Shape derivation heuristics** (when no `@shape` tag):

```typescript
function deriveShapeFromName(astType: string): NodeShape {
  const name = astType.toLowerCase();
  if (/workflow|flow|process|pipeline/i.test(name)) return 'rounded';
  if (/decision|condition|choice|branch/i.test(name)) return 'diamond';
  if (/state|status|phase/i.test(name)) return 'ellipse';
  if (/terminal|keyword|token/i.test(name)) return 'pill';
  if (/action|command|operation/i.test(name)) return 'hexagon';
  if (/group|container|package|module/i.test(name)) return 'rounded';
  return 'rectangle';
}
```

**Container derivation heuristics** (when no `@container` tag):

```typescript
function deriveIsContainer(astType: string, ruleText: string): boolean {
  const name = astType.toLowerCase();

  // Explicit name-based heuristic
  if (/group|container|package|module|namespace/i.test(name)) return true;

  // Structural heuristic: rule has a block with containment arrays
  // Matches patterns like: '{' (elements+=X)* '}' or '{' children+=X* '}'
  if (/\{\s*\(?\s*\w+\s*\+=\s*\w+\s*\)\s*\*/.test(ruleText)) return true;

  return false;
}
```

**Size derivation:**

```typescript
function deriveSizeFromShape(shape: NodeShape, isContainer?: boolean): { width: number; height: number } {
  if (isContainer) return { width: 280, height: 180 };

  switch (shape) {
    case 'diamond': return { width: 100, height: 100 };
    case 'ellipse': return { width: 120, height: 80 };
    case 'hexagon': return { width: 140, height: 80 };
    case 'pill': return { width: 100, height: 40 };
    case 'rounded': return { width: 160, height: 70 };
    default: return { width: 150, height: 60 };
  }
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

**Documentation fields generation:**

Before generating the manifest, derive the documentation properties. **Use language tags from Step 4.2 when available**, otherwise derive automatically:

**displayName:**
- If `languageTags.name` exists → use it directly
- Otherwise → derive from grammar name (convert kebab-case to Title Case)

**summary:**
- If `languageTags.description` exists → use it directly
- Otherwise → generate pattern: "A domain-specific language for {domain} with support for {key features}"
- Derive domain from grammar name/display name
- Include 2-3 main capabilities from rootTypes
- Keep to 1-2 sentences

**tagline:**
- If `languageTags.tagline` exists → use it directly
- Otherwise → generate based on grammar type heuristics:
  - workflow → "Streamline your {domain} workflows"
  - security → "Secure by design"
  - model → "Model {domain} with precision"
  - compliance → "{Domain} compliance made simple"
  - default → "Simplify {domain} development"
- Keep under 10 words
- Focus on the primary value proposition

**fileExtension and baseExtension:**
- If `languageTags.extension` exists → use it directly
- Otherwise → derive as `.{languageId}` (e.g., `.ecml`)

**Key features generation:**
- Format: `{ feature: '{FeatureName}', description: '{FeatureDescription}' }`
- Generate 3-5 features based on rootTypes and grammar capabilities
- Include diagramming if enabled: `{ feature: 'Visual Diagrams', description: 'Create and edit diagrams interactively' }`
- Add standard features: `{ feature: 'Type-safe Syntax', description: 'IDE-supported validation and autocomplete' }`

**Core concepts generation:**
- Extract from rootTypes: `{ concept: astType, description: 'Description based on displayName' }`
- Derive description from context (e.g., Task → "A discrete unit of work in the process")
- Include 4-6 most important concepts from rootTypes

**Quick example generation:**
- Generate 3-5 lines showing basic syntax
- Use placeholder values demonstrating key elements
- Show at least 2 different element types from rootTypes

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
 *
 * Note: Fields populated from @{token} comments in the grammar file are marked with [tag].
 * Logo is handled by webpack asset bundling. The logo.svg file is copied
 * to assets/logos/{languageId}.svg at build time.
 */
export const manifest: GrammarManifest = {
  languageId: '{languageId}',
  displayName: '{DisplayName}',  // [tag] if @name provided
  summary: '{Summary from @description tag or AI-derived}',  // [tag] if @description provided
  tagline: '{Tagline from @tagline tag or AI-derived}',  // [tag] if @tagline provided
  keyFeatures: [
    { feature: '{FeatureName1}', description: '{Description of feature 1}' },
    { feature: '{FeatureName2}', description: '{Description of feature 2}' },
    { feature: '{FeatureName3}', description: '{Description of feature 3}' },
    // ... additional features as appropriate
  ],
  coreConcepts: [
    { concept: '{ConceptName1}', description: '{Description of concept 1}' },
    { concept: '{ConceptName2}', description: '{Description of concept 2}' },
    // ... derived from astType names in rootTypes
  ],
  quickExample: `{Multi-line example showing basic syntax}`,
  fileExtension: '.{ext}',  // [tag] if @extension provided
  baseExtension: '.{ext}',  // [tag] if @extension provided
  // logo field omitted - handled by webpack asset bundling (assets/logos/{languageId}.svg)
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
        // isContainer: true,  ← only present when derived as container
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
import type { ContainerModule } from 'inversify';
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
import { {grammarName}DiagramModule } from './diagram/index.js';

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
  diagramModule: {grammarName}DiagramModule as ContainerModule,
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
    },
    "./diagram": {
      "types": "./lib/diagram/index.d.ts",
      "import": "./lib/diagram/index.js"
    }
  },
  "scripts": {
    "build": "npm run langium:generate && tsc -b tsconfig.json && npm run copy:css",
    "copy:css": "mkdir -p lib/diagram && cp -- src/diagram/styles.css lib/diagram/styles.css",
    "clean": "rimraf lib src/generated tsconfig.tsbuildinfo",
    "langium:generate": "langium generate",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "{languageId}",
    "contribution": "./lib/contribution.js",
    "diagramModule": "./lib/diagram/module.js"
  },
  "dependencies": {
    "langium": "^4.1.0",
    "sprotty": "^1.4.0",
    "inversify": "^6.0.2"
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
- No JSX configuration needed - uses built-in Sprotty views with CSS styling

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

Generate a default SVG logo that will be bundled by webpack.

**Create src/logo.svg**

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

**Note:** No encoding script or generated TypeScript files are needed. Webpack copies `logo.svg` to `assets/logos/{languageId}.svg` at build time, and the frontend loads it as a static asset.

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
  packages/grammar-definitions/{name}/src/{name}.langium       - Grammar copy (synced from .source/)
  packages/grammar-definitions/{name}/src/manifest.ts          - GrammarManifest configuration
  packages/grammar-definitions/{name}/src/contribution.ts      - LanguageContribution export
  packages/grammar-definitions/{name}/src/logo.svg             - Grammar logo (bundled by webpack)

  Diagram module:
  packages/grammar-definitions/{name}/src/diagram/index.ts     - Barrel exports
  packages/grammar-definitions/{name}/src/diagram/model.ts     - Sprotty model elements
  packages/grammar-definitions/{name}/src/diagram/views.ts     - View type constants and re-exports
  packages/grammar-definitions/{name}/src/diagram/module.ts    - InversifyJS DI configuration
  packages/grammar-definitions/{name}/src/diagram/styles.css   - CSS styling (grammar-qualified)

  packages/grammar-definitions/{name}/package.json             - Package with sanyam discovery metadata
  packages/grammar-definitions/{name}/tsconfig.json            - TypeScript configuration
  packages/grammar-definitions/{name}/langium-config.json      - Langium CLI configuration

Grammar: {DisplayName}
Language ID: {languageId}
Root Types: {count} ({list of type names})
Diagramming: Enabled (built-in views with CSS styling)
Logo: Auto-generated (bundled to assets/logos/{languageId}.svg by webpack)

Diagram shapes:
{list of rootType → shape mappings, with (container) annotation where applicable}

Next steps:
1. Select this grammar for the applications:
   /grammar.select {name}

2. Build the full project:
   pnpm build

   This will automatically:
   - Generate Langium modules (langium generate)
   - Compile TypeScript
   - Wire grammar into language-server dependencies (build-vsix.ts)
   - Generate grammars.ts and grammar-manifests-module.js for applications

3. To modify the grammar:
   - Edit packages/grammar-definitions/.source/{name}.langium (master)
   - Re-run /grammar.config {name} to sync changes and regenerate diagram code

4. To customize diagram appearance:
   - Add @shape, @tooltip, @container tags to grammar rules
   - Edit src/diagram/styles.css for color/styling customization
   - CSS uses grammar-qualified selectors: .{GrammarName}.{RuleName}
   - Built-in Sprotty views (RectangularNodeView, PolylineEdgeView) are used
   - Custom SVG shapes require extending ShapeView with snabbdom JSX

Note: The .source/{name}.langium is the master copy. Changes should be made there
and synced to the package via /grammar.config. NEVER delete the .source/ file.
```

### Step 15: Generate Sprotty Diagram Module

After generating the core package files, generate the Sprotty customization files in `src/diagram/`.

#### Step 15.1: Generate src/diagram/model.ts

Create custom Sprotty model element classes for each grammar rule:

```typescript
/**
 * {DisplayName} Diagram Model Elements
 *
 * Custom Sprotty model classes for {DisplayName} grammar constructs.
 * These extend Sprotty's base implementations with grammar-specific properties.
 *
 * @packageDocumentation
 */

import {
  SNodeImpl,
  SEdgeImpl,
  SCompartmentImpl,
} from 'sprotty';
import type { Bounds } from 'sprotty-protocol';

// ═══════════════════════════════════════════════════════════════════
// Type Constants
// ═══════════════════════════════════════════════════════════════════

export const {GrammarName}Types = {
  // Graph root
  GRAPH: 'graph',

  // Nodes
{nodeTypeConstants}

  // Edges
  EDGE_CONTAINMENT: 'edge:containment',
  EDGE_REFERENCE: 'edge:reference',

  // Labels
  LABEL_NAME: 'label:name',
  LABEL_TYPE: 'label:type',
  LABEL_TEXT: 'label:text',

  // Compartments
  COMPARTMENT_HEADER: 'compartment:header',
  COMPARTMENT_BODY: 'compartment:body',
} as const;

// ═══════════════════════════════════════════════════════════════════
// Node Implementations
// ═══════════════════════════════════════════════════════════════════

{nodeImplementations}

// ═══════════════════════════════════════════════════════════════════
// Edge Implementation
// ═══════════════════════════════════════════════════════════════════

export class {GrammarName}Edge extends SEdgeImpl {
  edgeKind: 'containment' | 'reference' = 'containment';
  propertyName?: string;
  optional: boolean = false;
}

// ═══════════════════════════════════════════════════════════════════
// Compartment Implementation
// ═══════════════════════════════════════════════════════════════════

export class {GrammarName}Compartment extends SCompartmentImpl {
  override layout?: string = 'vbox';
}
```

**Node type constants generation** (for each rootType):

```typescript
// Template for nodeTypeConstants
`  NODE_${astType.toUpperCase()}: 'node:${astType.toLowerCase()}',`
```

**Node implementation generation** (for each rootType):

```typescript
// Template for each rootType
`/**
 * ${displayName} node element
 */
export class ${astType}Node extends SNodeImpl {
  /** The name/identifier of this ${displayName.toLowerCase()} */
  name: string = '';

  /** Source location in the grammar file */
  sourceRange?: { start: number; end: number };

  override get bounds(): Bounds {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
}
`
```

#### Step 15.2: Generate src/diagram/views.ts

Create a simple views module that re-exports built-in Sprotty views and defines view type constants:

```typescript
/**
 * {DisplayName} Diagram Views
 *
 * This module provides view type constants and re-exports for {DisplayName} diagrams.
 *
 * The actual rendering uses Sprotty's built-in views (RectangularNodeView,
 * PolylineEdgeView, SLabelView) with customization via CSS classes defined
 * in styles.css.
 *
 * For custom shapes (hexagon, diamond, etc.), extend ShapeView and implement
 * custom rendering using snabbdom JSX when needed.
 *
 * @packageDocumentation
 */

// Re-export built-in views for convenience
export {
  RectangularNodeView,
  PolylineEdgeView,
  SLabelView,
  ShapeView,
  SGraphView,
} from 'sprotty';

/**
 * View type identifiers for {DisplayName} diagram elements.
 */
export const {GrammarName}ViewTypes = {
{viewTypeConstants}
} as const;
```

**View type constants generation** (for each rootType):

```typescript
// Template for viewTypeConstants
`  NODE_${astType.toUpperCase()}: '${GrammarName}${astType}View',`
```

Also include edge and label view types:

```typescript
  EDGE_CONTAINMENT: '{GrammarName}ContainmentEdgeView',
  EDGE_REFERENCE: '{GrammarName}ReferenceEdgeView',
  LABEL_NAME: '{GrammarName}NameLabelView',
  LABEL_TYPE: '{GrammarName}TypeLabelView',
```

**Note:** This approach uses built-in Sprotty views (`RectangularNodeView`, `PolylineEdgeView`, `SLabelView`) instead of custom JSX views. All visual customization is done through CSS classes applied via the model's `cssClasses` property. This avoids JSX/snabbdom type conflicts and simplifies the build.

#### Step 15.3: Generate src/diagram/module.ts

Create the InversifyJS module that registers all model elements with built-in Sprotty views:

```typescript
/**
 * {DisplayName} Diagram Module
 *
 * InversifyJS dependency injection configuration for {DisplayName} Sprotty diagrams.
 * Registers model elements with built-in Sprotty views and CSS-based styling.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import {
  configureModelElement,
  configureViewerOptions,
  SGraphImpl,
  SGraphView,
  SLabelImpl,
  SLabelView,
  RectangularNodeView,
  PolylineEdgeView,
  selectFeature,
  moveFeature,
  hoverFeedbackFeature,
  boundsFeature,
} from 'sprotty';

// Model imports
import {
  {GrammarName}Types,
{modelClassImports}
  {GrammarName}Edge,
} from './model.js';

/**
 * {DisplayName} Diagram Module
 *
 * Configures Sprotty for {DisplayName} grammar visualization.
 * Uses built-in Sprotty views with CSS-based styling.
 */
export const {grammarName}DiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // ═══════════════════════════════════════════════════════════════
  // Viewer Options
  // ═══════════════════════════════════════════════════════════════
  configureViewerOptions(context, {
    needsClientLayout: true,
    needsServerLayout: true,
    baseDiv: '{languageId}-diagram',
    hiddenDiv: '{languageId}-diagram-hidden',
  });

  // ═══════════════════════════════════════════════════════════════
  // Graph Root
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.GRAPH, SGraphImpl, SGraphView);

  // ═══════════════════════════════════════════════════════════════
  // Node Elements
  // Uses RectangularNodeView with CSS styling for customization.
  // CSS classes are applied via the model's cssClasses property.
  // ═══════════════════════════════════════════════════════════════
{nodeRegistrations}

  // ═══════════════════════════════════════════════════════════════
  // Edge Elements
  // Uses PolylineEdgeView with CSS styling for customization.
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.EDGE_CONTAINMENT, {GrammarName}Edge, PolylineEdgeView);
  configureModelElement(context, {GrammarName}Types.EDGE_REFERENCE, {GrammarName}Edge, PolylineEdgeView);

  // ═══════════════════════════════════════════════════════════════
  // Labels
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.LABEL_NAME, SLabelImpl, SLabelView);
  configureModelElement(context, {GrammarName}Types.LABEL_TYPE, SLabelImpl, SLabelView);
  configureModelElement(context, {GrammarName}Types.LABEL_TEXT, SLabelImpl, SLabelView);
});

export default {grammarName}DiagramModule;
```

**Node registration generation** (for each rootType):

```typescript
// Template for node registrations - uses RectangularNodeView (built-in)
`  configureModelElement(
    context,
    ${GrammarName}Types.NODE_${astType.toUpperCase()},
    ${astType}Node,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );`
```

**Note:** All node elements use `RectangularNodeView` and all edges use `PolylineEdgeView`. Visual differentiation (colors, borders, rounded corners) is handled via CSS classes. For truly custom shapes (hexagons, diamonds), users can extend `ShapeView` with snabbdom JSX rendering.

#### Step 15.4: Generate src/diagram/styles.css

Generate CSS with grammar-qualified class names and heuristic-derived colors.

**CSS Loading Integration:**

The generated `styles.css` is copied to `lib/diagram/styles.css` during build (via `copy:css` script).
The GLSP frontend loads grammar-specific CSS dynamically when a diagram is opened:

1. The `diagramModule` export path is in `package.json` → `sanyam.diagramModule`
2. GLSP frontend resolves the grammar package at runtime
3. CSS is imported alongside the diagram module

For manual integration or testing, import the CSS in your application:
```typescript
import '@sanyam-grammar/{name}/lib/diagram/styles.css';
```

**CSS Class Naming Convention:**

Grammar-qualified class names prevent conflicts between multiple grammars:
- Node classes: `.{GrammarName}.{RuleName}` (e.g., `.Workflow.Step`)
- State classes: `.selected`, `.mouseover`, `.highlighted`
- Edge classes: `.{GrammarName}.edge.{kind}` (e.g., `.Workflow.edge.containment`)

This differs from the older `{lowercase}-node` convention. For migration of existing grammars:
1. Update CSS selectors from `.step-node` to `.{GrammarName}.Step`
2. The new pattern supports grammar scoping for multi-grammar diagrams

**Color derivation heuristics:**

```typescript
function deriveColors(astType: string): { fill: string; stroke: string; hover: string } {
  const name = astType.toLowerCase();

  if (/workflow|flow|process|pipeline/i.test(name)) {
    return { fill: '#dbeafe', stroke: '#2563eb', hover: '#bfdbfe' }; // Blue
  }
  if (/task|step|action|activity/i.test(name)) {
    return { fill: '#d1fae5', stroke: '#059669', hover: '#a7f3d0' }; // Green
  }
  if (/decision|condition|choice|branch|gateway/i.test(name)) {
    return { fill: '#fef3c7', stroke: '#d97706', hover: '#fde68a' }; // Amber
  }
  if (/state|status|phase/i.test(name)) {
    return { fill: '#ede9fe', stroke: '#7c3aed', hover: '#ddd6fe' }; // Purple
  }
  if (/error|exception|fault|invalid/i.test(name)) {
    return { fill: '#fee2e2', stroke: '#dc2626', hover: '#fecaca' }; // Red
  }
  if (/event|trigger|signal|message/i.test(name)) {
    return { fill: '#cffafe', stroke: '#0891b2', hover: '#a5f3fc' }; // Cyan
  }
  if (/data|entity|record|model/i.test(name)) {
    return { fill: '#e0e7ff', stroke: '#4f46e5', hover: '#c7d2fe' }; // Indigo
  }
  if (/config|settings|option|param/i.test(name)) {
    return { fill: '#f1f5f9', stroke: '#475569', hover: '#e2e8f0' }; // Slate
  }
  if (/group|container|package|module|namespace/i.test(name)) {
    return { fill: '#f3f4f6', stroke: '#6b7280', hover: '#e5e7eb' }; // Gray
  }
  if (/start|begin|initial/i.test(name)) {
    return { fill: '#dcfce7', stroke: '#16a34a', hover: '#bbf7d0' }; // Bright green
  }
  if (/end|final|terminal|stop/i.test(name)) {
    return { fill: '#fecaca', stroke: '#b91c1c', hover: '#fca5a5' }; // Bright red
  }

  // Default: neutral gray-blue
  return { fill: '#f0f9ff', stroke: '#0369a1', hover: '#e0f2fe' };
}
```

**CSS template:**

```css
/**
 * {DisplayName} Diagram Styles
 *
 * Grammar-qualified CSS classes for {DisplayName} diagram elements.
 *
 * Class naming convention:
 *   Nodes: .{GrammarName}.{RuleName}  (e.g., .Workflow.Step)
 *   Edges: .{GrammarName}.edge.{kind} (e.g., .Workflow.edge.containment)
 *   State: .selected, .mouseover, .highlighted
 *
 * Customize by editing this file or overriding in your application CSS.
 */

/* ═══════════════════════════════════════════════════════════════════
   Base Styles
   ═══════════════════════════════════════════════════════════════════ */

.sprotty-graph.{GrammarName} {
  background-color: #fafafa;
}

.sprotty-node.{GrammarName} {
  cursor: pointer;
  stroke-width: 2px;
  transition: fill 0.15s ease, stroke-width 0.1s ease;
}

.sprotty-node.{GrammarName}.selected {
  stroke-width: 3px;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
}

.sprotty-edge.{GrammarName} {
  cursor: crosshair;
}

/* ═══════════════════════════════════════════════════════════════════
   Node Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

{nodeStyles}

/* ═══════════════════════════════════════════════════════════════════
   Edge Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

.{GrammarName}.edge.containment {
  stroke: #1e40af;
  stroke-width: 2px;
}

.{GrammarName}.edge.containment.optional {
  stroke-dasharray: 4, 2;
}

.{GrammarName}.containment-diamond {
  fill: #1e40af;
}

.{GrammarName}.edge.reference {
  stroke: #6366f1;
  stroke-width: 1.5px;
  stroke-dasharray: 6, 3;
}

.{GrammarName}.edge.reference.optional {
  opacity: 0.7;
}

.{GrammarName}.reference-arrow {
  fill: #6366f1;
}

/* ═══════════════════════════════════════════════════════════════════
   Label Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

.sprotty-label.{GrammarName} {
  fill: #111827;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}

.{GrammarName}.name-label {
  font-weight: 600;
  font-size: 14px;
}

.{GrammarName}.type-label {
  fill: #6b7280;
  font-style: italic;
  font-size: 11px;
}
```

**Node styles generation** (for each rootType):

```css
/* {DisplayName} ({astType}) */
.{GrammarName}.{astType} {
  fill: {derivedFill};
  stroke: {derivedStroke};
}

.{GrammarName}.{astType}.mouseover {
  fill: {derivedHover};
}

.{GrammarName}.{astType}.selected {
  stroke: #2563eb;
}
```

#### Step 15.5: Generate src/diagram/index.ts

Create the barrel export file:

```typescript
/**
 * {DisplayName} Diagram Module
 *
 * Barrel exports for {DisplayName} Sprotty diagram customizations.
 *
 * @packageDocumentation
 */

export * from './model.js';
export * from './views.js';
export { {grammarName}DiagramModule, default as {grammarName}DiagramModuleDefault } from './module.js';
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
2. `summary` is non-empty string
3. `tagline` is non-empty string
4. `keyFeatures` is non-empty array with valid entries:
   - Each entry has non-empty `feature` string
   - Each entry has non-empty `description` string
5. `coreConcepts` is non-empty array with valid entries:
   - Each entry has non-empty `concept` string
   - Each entry has non-empty `description` string
6. `quickExample` is non-empty string
7. `fileExtension` and `baseExtension` start with `.`
8. `rootTypes` has at least one entry
9. Each `rootType.astType` is PascalCase
10. Each `rootType.fileSuffix` starts with `.`
11. Each `rootType.displayName` is non-empty
12. Each `rootType.folder` is non-empty
13. Each `rootType.icon` is non-empty
14. Each `rootType.template` is non-empty
15. If `diagrammingEnabled` is true, `diagramTypes` has at least one entry
16. Each `diagramType` has valid `nodeTypes`, `edgeTypes`, and `toolPalette`

If validation fails, report specific errors and do not write the manifest.

---

## Reference: Type Definitions

The generated code must conform to these types from `@sanyam/types`:

### KeyFeature

```typescript
interface KeyFeature {
  feature: string;       // The feature name
  description: string;   // Description of what this feature provides
}
```

### CoreConcept

```typescript
interface CoreConcept {
  concept: string;       // The concept name
  description: string;   // Description of what this concept represents
}
```

### GrammarManifest

```typescript
interface GrammarManifest {
  languageId: string;
  displayName: string;
  summary: string;                  // Brief description (1-2 sentences)
  tagline: string;                  // Short marketing tagline (<10 words)
  keyFeatures: KeyFeature[];        // List of key features
  coreConcepts: CoreConcept[];      // List of core domain concepts
  quickExample: string;             // Code snippet showing basic usage
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
  diagramModule?: ContainerModule;  // Sprotty diagram module
  disabledLspFeatures?: LspFeatureName[];
  disabledGlspFeatures?: GlspFeatureName[];
}
```

### DiagramRuleMetadata

```typescript
interface DiagramRuleMetadata {
  shape?: 'rectangle' | 'rounded' | 'hexagon' | 'diamond' | 'ellipse' | 'pill';
  tooltip?: string;  // Template with ${name} placeholder
  container?: boolean;  // Whether this type can contain child nodes
}

type DiagramMetadata = Map<string, DiagramRuleMetadata>;
```

See `packages/types/src/grammar-manifest.ts` and `packages/types/src/language-contribution.ts` for complete type definitions.
