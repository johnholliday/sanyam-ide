---
description: Select and configure grammars for the IDE, updating application metadata and dependencies
---

## User Input

```text
$ARGUMENTS
```

## Overview

This command reconfigures the Theia frontend metadata in both the browser and electron applications to align with the selected grammar(s). It also updates the `@sanyam-grammar/*` dependencies to include only the specified grammars.

**Key Change:** Grammar documentation (summary, tagline, keyFeatures, coreConcepts, quickExample) is now read directly from the GrammarManifest at runtime via the GrammarRegistry, not stored in the package.json config.

## Input Format

- Single grammar: `/grammar.select ecml`
- Multiple grammars: `/grammar.select ecml, spdevkit, nist-csf`

Grammar names should match the package suffix (e.g., `ecml` for `@sanyam-grammar/ecml`).

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS` to extract grammar names:

1. Split by comma and/or whitespace
2. Trim each name
3. Normalize to lowercase with hyphens only
4. Remove empty entries

**Example:**
- Input: `ecml, nist-csf` → `['ecml', 'nist-csf']`
- Input: `spdevkit` → `['spdevkit']`

If no arguments provided, report error:

```
Error: No grammar names specified.

Usage:
  /grammar.select <name>              # Single grammar
  /grammar.select <name>, <name>, ... # Multiple grammars

Examples:
  /grammar.select ecml
  /grammar.select ecml, spdevkit
```

---

## Step 2: Validate Grammar Packages

For each grammar name, verify:

1. **Package directory exists**: `packages/grammar-definitions/{name}/`
2. **Manifest file exists**: `packages/grammar-definitions/{name}/src/manifest.ts`
3. **Manifest can be parsed**: Contains valid `GrammarManifest` export

### 2.1 Check Package Directory

Use Glob to check: `packages/grammar-definitions/{name}/package.json`

If not found:
```
Error: Grammar package '@sanyam-grammar/{name}' not found.

The package directory does not exist at:
  packages/grammar-definitions/{name}/

To create this grammar package, run:
  /grammar.config {name}
```

### 2.2 Check Manifest File

Use Read to check: `packages/grammar-definitions/{name}/src/manifest.ts`

If not found:
```
Error: Grammar manifest not found for '@sanyam-grammar/{name}'.

The manifest file does not exist at:
  packages/grammar-definitions/{name}/src/manifest.ts

To generate the manifest, run:
  /grammar.config {name}

Then optionally generate examples and documentation:
  /grammar.examples {name}
  /grammar.docs {name}
```

### 2.3 Parse and Validate Manifest

Read the manifest file and extract:
- `languageId`: string
- `displayName`: string
- `fileExtension`: string
- `rootTypes`: array (check it has at least one entry)

**Validation regex patterns:**

```
languageId pattern: /languageId:\s*['"]([^'"]+)['"]/
displayName pattern: /displayName:\s*['"]([^'"]+)['"]/
fileExtension pattern: /fileExtension:\s*['"]([^'"]+)['"]/
rootTypes check: Look for "rootTypes:" followed by array content
```

If parsing fails or required fields are missing:
```
Error: Invalid manifest for '@sanyam-grammar/{name}'.

The manifest at packages/grammar-definitions/{name}/src/manifest.ts
could not be parsed or is missing required fields.

Please ensure the manifest exports a valid GrammarManifest with:
- languageId (string)
- displayName (string)
- fileExtension (string)
- rootTypes (non-empty array)

To regenerate the manifest, run:
  /grammar.config {name}
```

### 2.4 Build Manifest List

For each valid grammar, store:
```typescript
interface ParsedManifest {
  name: string;           // Package name suffix (e.g., 'ecml')
  languageId: string;     // From manifest
  displayName: string;    // From manifest
  fileExtension: string;  // From manifest
  rootTypeCount: number;  // Count of rootTypes
  langiumMetadata?: {     // Extracted from .langium file comments
    name?: string;
    tagline?: string;
    description?: string;
  };
}
```

If ANY grammar validation fails, stop and do not proceed with changes.

### 2.5 Extract Langium File Metadata

For each grammar, attempt to extract metadata from specially formatted comments in the `.langium` file:

1. **Read langium-config.json**: `packages/grammar-definitions/{name}/langium-config.json`
2. **Extract grammar path**: Get path from `languages[0].grammar`
3. **Read the .langium file**: `packages/grammar-definitions/{name}/{grammarPath}`
4. **Scan for metadata comments**: Look for lines matching `// @{token} = "{value}"`

**Supported tokens:**
| Token | Field |
|-------|-------|
| `@name` | `langiumMetadata.name` |
| `@tagline` | `langiumMetadata.tagline` |
| `@description` | `langiumMetadata.description` |

**Regex pattern for extraction:**
```
\/\/\s*@(name|tagline|description)\s*=\s*"([^"]+)"
```

**Example .langium file header:**
```langium
// @name = "E C M L"
// @tagline = "Enterprise Content Modeling Language"
// @description = "A development environment for modeling enterprise content"
grammar Ecml
```

**Fallback behavior:** If langium-config.json or the .langium file cannot be read, or no metadata comments are found, continue without error. The `langiumMetadata` field will be undefined, and auto-generated defaults will be used in Step 3.

---

## Step 3: Generate Application Metadata

### 3.1 Single Grammar Mode

If only ONE grammar was specified, derive metadata from its manifest and langiumMetadata (if available).

**Metadata priority:** Values extracted from `.langium` file comments take precedence over auto-generated defaults.

**Application Name:**
```
langiumMetadata.name ?? "{displayName} IDE"
```

**Application Data:**
```typescript
{
  name: langiumMetadata.name ?? "{displayName} IDE",
  description: langiumMetadata.description ?? "Development environment for {displayName} domain-specific language",
  logo: "resources/sanyam-banner.svg",
  tagline: langiumMetadata.tagline ?? "Build and edit {displayName} models with ease",
  text: [
    "{resolvedName} provides a complete development environment for creating and working with {displayName} files.",
    "Features include syntax highlighting, validation, code completion, and diagram generation for your {displayName} models."
  ],
  links: [
    {
      label: "Documentation",
      url: "https://github.com/johnholliday/sanyam-ide#readme",
      icon: "book"
    },
    {
      label: "GitHub",
      url: "https://github.com/johnholliday/sanyam-ide",
      icon: "github"
    },
    {
      label: "Report Issue",
      url: "https://github.com/johnholliday/sanyam-ide/issues",
      icon: "bug"
    }
  ]
}
```

Where `{resolvedName}` is `langiumMetadata.name ?? "{displayName} IDE"`.

**Example with langiumMetadata (ecml):**
```typescript
// From ecml.langium:
// @name = "E C M L"
// @tagline = "Enteprise Content Modeling Language"
// @description = "A development environment for modeling enterprise content"

{
  name: "E C M L",                                        // from @name
  description: "A development environment for modeling enterprise content",  // from @description
  tagline: "Enteprise Content Modeling Language",         // from @tagline
  // ...
}
```

**Example without langiumMetadata (spdevkit):**
```typescript
// No @name/@tagline/@description comments in spdevkit.langium

{
  name: "SPDevKit IDE",                                   // auto-generated
  description: "Development environment for SPDevKit domain-specific language",  // auto-generated
  tagline: "Build and edit SPDevKit models with ease",    // auto-generated
  // ...
}
```

### 3.2 Multiple Grammar Mode

If MULTIPLE grammars were specified, prompt the user for metadata using AskUserQuestion.

**Note:** When the first grammar has `langiumMetadata` values, include them as additional options in the prompts.

**Question 1: Application Name**
```
Question: "What should the application be named?"
Header: "App Name"
Options:
  - "Sanyam IDE" - "Generic multi-grammar IDE name (Recommended)"
  - "{First Grammar displayName} IDE" - "Use first selected grammar name"
  - "{langiumMetadata.name}" - "Use name from .langium comments" (only if langiumMetadata.name exists)
  - "Custom" - "Enter a custom application name"
```

If user selects "Custom" (or "Other"), they will provide text input.

**Question 2: Description Style**
```
Question: "How should the application be described?"
Header: "Description"
Options:
  - "Multi-language" - "Generic description covering multiple grammars (Recommended)"
  - "List grammars" - "Description that lists all selected grammar names"
  - "{langiumMetadata.description}" - "Use description from .langium comments" (only if langiumMetadata.description exists)
```

**Generate description based on choice:**

Multi-language:
```
"Development environment for domain-specific languages including {grammar1}, {grammar2}, and {grammar3}"
```

List grammars:
```
"Development environment supporting {displayName1}, {displayName2}, and {displayName3} languages"
```

From langiumMetadata:
```
"{langiumMetadata.description}"
```

**Question 3: Tagline**
```
Question: "What tagline should be displayed?"
Header: "Tagline"
Options:
  - "Build intelligent language tools with ease" - "Generic Sanyam tagline (Recommended)"
  - "{langiumMetadata.tagline}" - "Use tagline from .langium comments" (only if langiumMetadata.tagline exists)
  - "Custom" - "Enter a custom tagline"
```

**Generated Application Data for multiple grammars:**
```typescript
{
  name: "{applicationName}",
  description: "{generatedDescription}",
  logo: "resources/sanyam-banner.svg",
  tagline: "{tagline}",
  text: [
    "{applicationName} provides a complete development environment for domain-specific languages.",
    "Supported languages: {comma-separated displayNames}."
  ],
  links: [/* same default links */]
}
```

---

## Step 4: Update Package Dependencies

### 4.1 Read Current Dependencies

Read both package.json files:
- `applications/electron/package.json`
- `applications/browser/package.json`

### 4.2 Identify Existing Grammar Dependencies

Find all dependencies starting with `@sanyam-grammar/`:
```typescript
const existingGrammars = Object.keys(dependencies)
  .filter(dep => dep.startsWith('@sanyam-grammar/'));
```

### 4.3 Calculate Changes

Determine which grammars to add and remove:
```typescript
const selectedPackages = grammarNames.map(n => `@sanyam-grammar/${n}`);
const toAdd = selectedPackages.filter(p => !existingGrammars.includes(p));
const toRemove = existingGrammars.filter(p => !selectedPackages.includes(p));
```

### 4.4 Preview Changes

Before making changes, show the user what will be modified:

```
Grammar Selection Summary
=========================

Selected grammars ({count}):
  - {displayName1} (@sanyam-grammar/{name1})
  - {displayName2} (@sanyam-grammar/{name2})

Dependencies to ADD:
  - @sanyam-grammar/{name}: workspace:*

Dependencies to REMOVE:
  - @sanyam-grammar/{oldName}

Application metadata:
  - applicationName: "{applicationName}"  {source attribution}
  - applicationGrammar: "{languageId}"    (primary grammar for branding)
  - name: "{name}"                        {source attribution}
  - description: "{description}"          {source attribution}
  - tagline: "{tagline}"                  {source attribution}

Source attribution legend:
  - (from @name)        = extracted from .langium file comment
  - (from @tagline)     = extracted from .langium file comment
  - (from @description) = extracted from .langium file comment
  - (auto-generated)    = derived from manifest displayName

Note: Grammar documentation (summary, features, concepts, examples) is now
read from the GrammarManifest at runtime via GrammarRegistry.

Files to modify:
  - applications/electron/package.json
  - applications/browser/package.json

Auto-generated by `pnpm build`:
  - applications/*/src/language-server/grammars.ts
  - applications/*/src/frontend/grammar-manifests-module.js
```

**Example preview with langiumMetadata (ecml):**
```
Application metadata:
  - applicationName: "E C M L"                                        (from @name)
  - applicationGrammar: "ecml"                                        (primary grammar for branding)
  - name: "E C M L"                                                   (from @name)
  - description: "A development environment for modeling enterprise content"  (from @description)
  - tagline: "Enteprise Content Modeling Language"                    (from @tagline)
```

**Example preview without langiumMetadata (spdevkit):**
```
Application metadata:
  - applicationName: "SPDevKit IDE"                                   (auto-generated)
  - applicationGrammar: "spdevkit"                                    (primary grammar for branding)
  - name: "SPDevKit IDE"                                              (auto-generated)
  - description: "Development environment for SPDevKit domain-specific language"  (auto-generated)
  - tagline: "Build and edit SPDevKit models with ease"               (auto-generated)
```

**Example preview with partial langiumMetadata:**
```
Application metadata:
  - applicationName: "My Language"                                    (from @name)
  - applicationGrammar: "mylang"                                      (primary grammar for branding)
  - name: "My Language"                                               (from @name)
  - description: "Development environment for My Language domain-specific language"  (auto-generated)
  - tagline: "Build and edit My Language models with ease"            (auto-generated)
```

---

## Step 5: Apply Changes

### 5.1 Update Electron Package

Read `applications/electron/package.json` and modify:

1. **Update theia.frontend.config.applicationName:**
   ```json
   "applicationName": "{applicationName}"
   ```

2. **Update theia.frontend.config.applicationGrammar:**
   ```json
   "applicationGrammar": "{languageId}"
   ```

3. **Update theia.frontend.config.applicationData:**
   ```json
   "applicationData": {
     "name": "{name}",
     "description": "{description}",
     "logo": "resources/sanyam-banner.svg",
     "tagline": "{tagline}",
     "text": [...],
     "links": [...]
   }
   ```

   **Note:** The `applicationData` no longer contains grammar documentation fields.
   Grammar documentation is now read from the GrammarManifest at runtime.

4. **Update dependencies:**
   - Remove all `@sanyam-grammar/*` entries
   - Add selected `@sanyam-grammar/{name}`: "workspace:*" entries

5. **Ensure platform dependencies are present:**
   - `@sanyam/logger`: "workspace:*" must be in `dependencies`
   - `@sanyam/grammar-scanner`: "workspace:*" must be in `devDependencies`

   These are required for the `generate:grammars` build script and structured logging.

Use the Edit tool to make these changes. Update each section individually to avoid large replacements.

### 5.2 Update Browser Package

Read `applications/browser/package.json` and apply the same changes:

1. Update `theia.frontend.config.applicationName`
2. Update `theia.frontend.config.applicationGrammar`
3. Update `theia.frontend.config.applicationData`
4. Update dependencies (same grammar packages)
5. Ensure `@sanyam/logger` in `dependencies` and `@sanyam/grammar-scanner` in `devDependencies`

**Note:** Browser package may have slightly different config (no electron-specific settings).

---

## Step 6: Regenerate Grammar Configuration

After updating package.json files, inform the user to regenerate the grammar configuration:

```
Grammar selection complete!

Modified files:
  - applications/electron/package.json
  - applications/browser/package.json

Next steps:
1. Install updated dependencies:
   pnpm install

2. Build the project:
   pnpm build

   This will automatically:
   - Generate grammars.ts and grammar-manifests-module.js for both apps
   - Wire grammar into language-server dependencies (build-vsix.ts)
   - Build all packages via Turborepo

The application will now use only the selected grammar(s):
{list of selected grammars with displayNames}

Note: Grammar documentation (summary, features, concepts, examples) is
loaded from the GrammarManifest at runtime via GrammarRegistry. No need to
duplicate this information in the package.json config.
```

---

## Error Handling

### No Arguments
```
Error: No grammar names specified.

Usage:
  /grammar.select <name>              # Single grammar
  /grammar.select <name>, <name>, ... # Multiple grammars

Available grammars in this workspace:
{list from packages/grammar-definitions/*/}
```

### Invalid Grammar Name Format
```
Error: Invalid grammar name '{name}'.

Grammar names must:
- Contain only lowercase letters, numbers, and hyphens
- Not contain spaces or special characters

Examples: ecml, spdevkit, nist-csf
```

### Package Read/Write Failure
```
Error: Could not update {file}.

{specific error message}

Please check file permissions and try again.
```

---

## Reference: Package.json Structure

### Electron package.json theia section:
```json
{
  "theia": {
    "target": "electron",
    "frontend": {
      "config": {
        "applicationName": "...",
        "applicationGrammar": "ecml",
        "applicationData": {
          "name": "...",
          "description": "...",
          "logo": "resources/sanyam-banner.svg",
          "tagline": "...",
          "text": [...],
          "links": [...]
        },
        "reloadOnReconnect": true,
        "preferences": {...},
        "electron": {...}
      }
    },
    "backend": {...},
    "generator": {...}
  },
  "dependencies": {
    "@sanyam/logger": "workspace:*",
    "@sanyam-grammar/ecml": "workspace:*",
    ...
  },
  "devDependencies": {
    "@sanyam/grammar-scanner": "workspace:*",
    "@sanyam/types": "workspace:*",
    ...
  }
}
```

**Notes:**
- The `applicationGrammar` field specifies the primary grammar ID for branding.
- The UI components (getting-started widget, about dialog) read grammar documentation
  (logo, tagline, summary, features, concepts, examples) directly from the GrammarManifest
  via GrammarRegistry at runtime.
- The `applicationData` contains only application-level branding, not grammar documentation.

### Browser package.json theia section:
```json
{
  "theia": {
    "frontend": {
      "config": {
        "applicationName": "...",
        "applicationGrammar": "ecml",
        "applicationData": {
          "name": "...",
          "description": "...",
          "logo": "resources/sanyam-banner.svg",
          "tagline": "...",
          "text": [...],
          "links": [...]
        },
        "warnOnPotentiallyInsecureHostPattern": false,
        "preferences": {...},
        "reloadOnReconnect": true
      }
    },
    "backend": {...},
    "generator": {...}
  },
  "dependencies": {
    "@sanyam/logger": "workspace:*",
    "@sanyam-grammar/ecml": "workspace:*",
    ...
  },
  "devDependencies": {
    "@sanyam/grammar-scanner": "workspace:*",
    "@sanyam/types": "workspace:*",
    ...
  }
}
```

---

## Examples

### Example 1: Single Grammar Selection (with langiumMetadata)

**Command:** `/grammar.select ecml`

**ecml.langium contains:**
```langium
// @name = "E C M L"
// @tagline = "Enteprise Content Modeling Language"
// @description = "A development environment for modeling enterprise content"
grammar Ecml
```

**Result:**
- Application name: "E C M L" (from @name)
- applicationGrammar: "ecml"
- Description: "A development environment for modeling enterprise content" (from @description)
- Tagline: "Enteprise Content Modeling Language" (from @tagline)
- Dependencies: Only `@sanyam-grammar/ecml`
- Other grammar packages removed from dependencies

### Example 2: Single Grammar Selection (without langiumMetadata)

**Command:** `/grammar.select spdevkit`

**spdevkit.langium contains:** (no @name/@tagline/@description comments)
```langium
grammar SPDevKit
entry Model:
...
```

**Result:**
- Application name: "SPDevKit IDE" (auto-generated)
- applicationGrammar: "spdevkit"
- Description: "Development environment for SPDevKit domain-specific language" (auto-generated)
- Tagline: "Build and edit SPDevKit models with ease" (auto-generated)
- Dependencies: Only `@sanyam-grammar/spdevkit`
- Other grammar packages removed from dependencies

### Example 3: Multiple Grammar Selection

**Command:** `/grammar.select ecml, spdevkit, nist-csf`

**Result:**
- User prompted for application name, description, tagline
- Prompts include options from ecml's langiumMetadata if present
- applicationGrammar: uses first grammar's languageId ("ecml")
- All three grammar packages added to dependencies
- Other grammar packages removed from dependencies

### Example 4: Invalid Grammar

**Command:** `/grammar.select nonexistent`

**Result:**
```
Error: Grammar package '@sanyam-grammar/nonexistent' not found.

The package directory does not exist at:
  packages/grammar-definitions/nonexistent/

To create this grammar package, run:
  /grammar.config nonexistent
```

---

## Migration Notes

This command now generates a simplified configuration structure:

**Before (deprecated):**
```json
{
  "applicationData": {
    "grammarId": "ecml",
    "grammarLogo": "assets/logos/ecml.svg",
    "grammarSummary": "...",
    "grammarTagline": "...",
    "grammarKeyFeatures": [...],
    "grammarCoreConcepts": [...],
    "grammarQuickExample": "..."
  }
}
```

**After (current):**
```json
{
  "applicationGrammar": "ecml",
  "applicationData": {
    "name": "...",
    "description": "...",
    "logo": "...",
    "tagline": "...",
    "text": [...],
    "links": [...]
  }
}
```

Grammar documentation is now read from the GrammarManifest at runtime:
- Logo: `manifest.logo`
- Tagline: `manifest.tagline`
- Summary: `manifest.summary`
- Key Features: `manifest.keyFeatures`
- Core Concepts: `manifest.coreConcepts`
- Quick Example: `manifest.quickExample`
