---
title: "Validation"
description: "validateManifest() and the isGrammarManifest() type guard"
layout: layouts/doc.njk
eleventyNavigation:
  key: Validation
  parent: Grammar Manifest
  order: 6
---

The `@sanyam/types` package provides runtime validation functions to check that manifests are well-formed before they're loaded into the platform.

## isGrammarManifest()

Type guard that checks if a value has the required shape of a `GrammarManifest`.

```typescript
function isGrammarManifest(value: unknown): value is GrammarManifest;
```

This performs structural checks on the top-level fields:

- `languageId` is a string
- `displayName` is a string
- `summary` is a string
- `tagline` is a string
- `keyFeatures` is a non-empty array
- `coreConcepts` is a non-empty array
- `quickExample` is a string
- `fileExtension` is a string
- `baseExtension` is a string
- `rootTypes` is a non-empty array
- `diagrammingEnabled` is a boolean

### Usage

```typescript
import { isGrammarManifest } from '@sanyam/types';

const data = JSON.parse(rawConfig);
if (isGrammarManifest(data)) {
  // data is typed as GrammarManifest
  console.log(`Loaded grammar: ${data.languageId}`);
} else {
  console.error('Invalid manifest structure');
}
```

## validateManifest()

Performs detailed validation of a `GrammarManifest` and returns a list of specific errors.

```typescript
function validateManifest(manifest: GrammarManifest): ValidationResult;

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
```

### Validation Rules

The following rules are checked:

**Language ID**
- Must match pattern `^[a-z][a-z0-9-]*$` (lowercase alphanumeric with hyphens, starting with a letter)

**Summary and Tagline**
- Must be non-empty strings

**Key Features**
- Must have at least one entry
- Each entry must have non-empty `feature` and `description` strings

**Core Concepts**
- Must have at least one entry
- Each entry must have non-empty `concept` and `description` strings

**Quick Example**
- Must be a non-empty string

**File Extensions**
- `fileExtension` must start with a dot (`.`)
- `baseExtension` must start with a dot (`.`)

**Root Types**
- Must have at least one entry
- Each `astType` must be PascalCase (match `^[A-Z][a-zA-Z0-9]*$`)
- Each `fileSuffix` must start with a dot (`.`)

**Diagram Configuration**
- If `diagrammingEnabled` is `true`, `diagramTypes` must be a non-empty array

**Logo**
- If provided, must be a string
- Must start with `data:`
- Must be a base64-encoded image data URL matching `^data:image/(svg+xml|png|jpeg|gif|webp);base64,`

### Usage

```typescript
import { validateManifest } from '@sanyam/types';

const result = validateManifest(myManifest);

if (result.valid) {
  console.log('Manifest is valid');
} else {
  console.error('Manifest validation failed:');
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
}
```

### Example Output

For a manifest with issues:

```typescript
const badManifest = {
  languageId: 'My_Lang',           // Invalid: uppercase and underscore
  displayName: 'My Language',
  summary: '',                      // Invalid: empty
  tagline: 'A language',
  keyFeatures: [],                  // Invalid: empty array
  coreConcepts: [{ concept: 'Foo', description: 'Bar' }],
  quickExample: 'example',
  fileExtension: 'mlang',           // Invalid: no dot
  baseExtension: '.mlang',
  rootTypes: [
    {
      astType: 'element',           // Invalid: not PascalCase
      displayName: 'Element',
      fileSuffix: 'elem',           // Invalid: no dot
      folder: 'elements',
      icon: 'symbol-class',
      template: 'element ${name} {}',
    },
  ],
  diagrammingEnabled: true,
  // diagramTypes missing!          // Invalid when diagrammingEnabled is true
};

const result = validateManifest(badManifest as GrammarManifest);
// result.valid === false
// result.errors:
//   - "languageId must be lowercase alphanumeric with hyphens, starting with a letter"
//   - "summary must be a non-empty string"
//   - "keyFeatures must have at least one entry"
//   - "fileExtension must start with a dot"
//   - "rootTypes[0].astType must be PascalCase"
//   - "rootTypes[0].fileSuffix must start with a dot"
//   - "diagramTypes required when diagrammingEnabled is true"
```

## Best Practices

- Run `validateManifest()` in your grammar package's test suite to catch errors early.
- Use `isGrammarManifest()` as a runtime guard when loading manifests from external sources.
- The platform runs validation during grammar registration and logs warnings for any errors found.
