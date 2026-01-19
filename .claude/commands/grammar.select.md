---
description: Select and configure grammars for the IDE, updating application metadata and dependencies
---

## User Input

```text
$ARGUMENTS
```

## Overview

This command reconfigures the Theia frontend metadata in both the browser and electron applications to align with the selected grammar(s). It also updates the `@sanyam-grammar/*` dependencies to include only the specified grammars.

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
- `diagrammingEnabled`: boolean

**Validation regex patterns:**

```
languageId pattern: /languageId:\s*['"]([^'"]+)['"]/
displayName pattern: /displayName:\s*['"]([^'"]+)['"]/
fileExtension pattern: /fileExtension:\s*['"]([^'"]+)['"]/
rootTypes check: Look for "rootTypes:" followed by array content
logo pattern: /logo:\s*['"`]([^'"`]+)['"`]/ or /logo:\s*(\w+)/ (for imported constants)
```

**Logo field handling:**

The logo may be specified in two ways:
1. **Inline data URL**: `logo: 'data:image/svg+xml;base64,...'`
2. **Imported constant**: `logo: LOGO_DATA_URL` (from `./logo.generated.js`)

If the logo references an imported constant (e.g., `LOGO_DATA_URL`), read the generated file:
- Check `packages/grammar-definitions/{name}/src/logo.generated.ts`
- Extract the data URL from: `export const LOGO_DATA_URL = '...'`

If no logo is found, use `undefined` (the field is optional).

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
  logo?: string;          // Optional base64 data URL from manifest
}
```

If ANY grammar validation fails, stop and do not proceed with changes.

---

## Step 3: Generate Application Metadata

### 3.1 Single Grammar Mode

If only ONE grammar was specified, derive all metadata from its manifest:

**Application Name:**
```
{displayName} IDE
```

**Application Data:**
```typescript
{
  name: "{displayName} IDE",
  description: "Development environment for {displayName} domain-specific language",
  logo: "resources/sanyam-banner.svg",
  grammarId: "{languageId}",
  grammarLogo: "{logo}",  // Optional: base64 data URL from manifest, omit if undefined
  tagline: "Build and edit {displayName} models with ease",
  text: [
    "{displayName} IDE provides a complete development environment for creating and working with {displayName} files.",
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

### 3.2 Multiple Grammar Mode

If MULTIPLE grammars were specified, prompt the user for metadata using AskUserQuestion:

**Question 1: Application Name**
```
Question: "What should the application be named?"
Header: "App Name"
Options:
  - "Sanyam IDE" - "Generic multi-grammar IDE name (Recommended)"
  - "{First Grammar displayName} IDE" - "Use first selected grammar name"
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

**Question 3: Tagline**
```
Question: "What tagline should be displayed?"
Header: "Tagline"
Options:
  - "Build intelligent language tools with ease" - "Generic Sanyam tagline (Recommended)"
  - "Custom" - "Enter a custom tagline"
```

**Generated Application Data for multiple grammars:**
```typescript
{
  name: "{applicationName}",
  description: "{generatedDescription}",
  logo: "resources/sanyam-banner.svg",
  grammarId: "{first grammar's languageId}",  // Use first selected grammar
  grammarLogo: "{first grammar's logo}",      // Optional: omit if undefined
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
  - applicationName: "{applicationName}"
  - name: "{name}"
  - description: "{description}"
  - grammarId: "{languageId}"
  - grammarLogo: "{logo}" (if available)
  - tagline: "{tagline}"

Files to modify:
  - applications/electron/package.json
  - applications/browser/package.json
```

---

## Step 5: Apply Changes

### 5.1 Update Electron Package

Read `applications/electron/package.json` and modify:

1. **Update theia.frontend.config.applicationName:**
   ```json
   "applicationName": "{applicationName}"
   ```

2. **Update theia.frontend.config.applicationData:**
   ```json
   "applicationData": {
     "name": "{name}",
     "description": "{description}",
     "logo": "resources/sanyam-banner.svg",
     "grammarId": "{languageId}",
     "grammarLogo": "{logo}",
     "tagline": "{tagline}",
     "text": [...],
     "links": [...]
   }
   ```

   **Note:** Only include `grammarLogo` if the manifest provides a logo. Omit the field entirely if no logo is available.

3. **Update dependencies:**
   - Remove all `@sanyam-grammar/*` entries
   - Add selected `@sanyam-grammar/{name}`: "workspace:*" entries

Use the Edit tool to make these changes. Update each section individually to avoid large replacements.

### 5.2 Update Browser Package

Read `applications/browser/package.json` and apply the same changes:

1. Update `theia.frontend.config.applicationName`
2. Update `theia.frontend.config.applicationData`
3. Update dependencies (same grammar packages)

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

2. Regenerate grammar configuration:
   cd applications/electron && pnpm generate:grammars
   cd applications/browser && pnpm generate:grammars

3. Build the applications:
   pnpm build:dev

The application will now use only the selected grammar(s):
{list of selected grammars with displayNames}
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
        "applicationData": {
          "name": "...",
          "description": "...",
          "logo": "...",
          "grammarId": "...",
          "grammarLogo": "...",
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
    "@sanyam-grammar/ecml": "workspace:*",
    ...
  }
}
```

### Browser package.json theia section:
```json
{
  "theia": {
    "frontend": {
      "config": {
        "applicationName": "...",
        "applicationData": {
          "name": "...",
          "description": "...",
          "logo": "...",
          "grammarId": "...",
          "grammarLogo": "...",
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
    "@sanyam-grammar/ecml": "workspace:*",
    ...
  }
}
```

---

## Examples

### Example 1: Single Grammar Selection

**Command:** `/grammar.select ecml`

**Result:**
- Application name: "Enterprise Content Modeling Language IDE"
- Description: "Development environment for Enterprise Content Modeling Language domain-specific language"
- Dependencies: Only `@sanyam-grammar/ecml`
- Other grammar packages removed from dependencies

### Example 2: Multiple Grammar Selection

**Command:** `/grammar.select ecml, spdevkit, nist-csf`

**Result:**
- User prompted for application name, description, tagline
- All three grammar packages added to dependencies
- Other grammar packages removed from dependencies

### Example 3: Invalid Grammar

**Command:** `/grammar.select nonexistent`

**Result:**
```
Error: Grammar package '@sanyam-grammar/nonexistent' not found.

The package directory does not exist at:
  packages/grammar-definitions/nonexistent/

To create this grammar package, run:
  /grammar.config nonexistent
```
