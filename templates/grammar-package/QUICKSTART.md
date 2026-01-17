# Grammar Package Quickstart

This template provides a starting point for creating a new grammar package for the SANYAM IDE.

## Directory Structure

```
grammars/your-language/
├── package.json           # Package configuration with sanyam field
├── tsconfig.json          # TypeScript configuration
├── langium-config.json    # Langium CLI configuration
├── src/
│   ├── index.ts           # Main exports
│   ├── manifest.ts        # GrammarManifest configuration
│   ├── contribution.ts    # LanguageContribution with custom providers
│   └── your-language.langium  # Grammar definition
└── lib/                   # Compiled output (generated)
```

## Creating a New Grammar Package

### 1. Copy the Template

```bash
cp -r templates/grammar-package grammars/your-language
```

### 2. Update Package Configuration

Edit `package.json`:
- Replace `{{languageId}}` with your language ID (e.g., `ecml`)
- Replace `{{description}}` with a description
- Update `fileExtensions` array with your extensions

### 3. Configure Langium

Edit `langium-config.json`:
- Replace `{{ProjectName}}` with your project name (e.g., `Ecml`)
- Replace `{{languageId}}` with your language ID
- Update file extensions

### 4. Define Your Grammar

Create `src/your-language.langium`:
- Use the template in `src/language.langium.template` as a starting point
- Define your language's syntax rules

### 5. Configure the Manifest

Edit `src/manifest.ts`:
- Define node types for diagram visualization
- Configure edge types for relationships
- Set up the tool palette for diagram editing
- Specify any disabled features

### 6. Build

```bash
pnpm build:langium   # Generate Langium artifacts
pnpm build           # Compile TypeScript
```

## GrammarManifest Configuration

The `manifest.ts` file is the key configuration for your grammar. It defines:

### Node Types

Map AST node types to diagram nodes:

```typescript
nodeTypes: {
  Entity: {
    type: 'node:entity',
    label: (node) => node.name,
    icon: 'entity-icon',
    cssClass: 'entity-node',
  },
}
```

### Edge Types

Map AST references to diagram edges:

```typescript
edgeTypes: {
  Reference: {
    type: 'edge:reference',
    label: (edge) => edge.name,
    sourceAnchor: 'right',
    targetAnchor: 'left',
  },
}
```

### Tool Palette

Configure diagram creation tools:

```typescript
toolPalette: {
  groups: [
    {
      id: 'nodes',
      label: 'Nodes',
      tools: [
        { id: 'entity', label: 'Entity', icon: 'entity-icon' },
      ],
    },
  ],
}
```

## Custom Providers

The `contribution.ts` file allows you to customize LSP and GLSP behavior.

### Custom LSP Providers

```typescript
const customLspProviders: Partial<LspFeatureProviders> = {
  completion: {
    provide: async (document, position, context) => {
      // Return custom completion items
      return [];
    },
  },
};
```

### Custom GLSP Providers

```typescript
const customGlspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: {
    convert: (astNode, context) => {
      // Return custom GModel representation
      return { id: 'custom', type: 'graph', children: [] };
    },
  },
};
```

## Package.json sanyam Field

The `sanyam` field in `package.json` marks the package as a grammar package:

```json
{
  "sanyam": {
    "grammar": true,
    "languageId": "your-language",
    "fileExtensions": [".yl", ".yourlang"]
  }
}
```

This enables:
- Automatic discovery by the unified server
- Registration with the language registry
- Build-time code generation for the registry

## Testing

Create tests in `tests/` directory:

```typescript
import { parseDocument } from './test-utils';

describe('Your Language Parser', () => {
  it('should parse entity declarations', async () => {
    const doc = await parseDocument('entity Foo { name: string }');
    expect(doc.parseResult.parserErrors).toHaveLength(0);
  });
});
```

## Integration with Unified Server

Once your grammar package is built:

1. The grammar scanner discovers it at build time
2. A registry entry is generated in `src-gen/grammar-registry.ts`
3. The unified server loads it at startup
4. LSP and GLSP features are automatically registered

## Common Issues

### Grammar Not Discovered

- Ensure `package.json` has the `sanyam.grammar: true` field
- Check that the package is in the workspace packages list
- Verify `langium-config.json` has valid configuration

### Diagram Not Rendering

- Ensure node types are mapped in `manifest.ts`
- Check that AST nodes have required properties (`id`, `name`)
- Verify edge source/target references are valid

### Custom Provider Not Working

- Ensure provider is exported in `contribution.ts`
- Check that the provider signature matches the expected type
- Verify the feature is not in `disabledFeatures`
