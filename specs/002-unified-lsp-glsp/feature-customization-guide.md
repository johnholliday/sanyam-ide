# Feature Customization Guide

This guide explains how to customize LSP and GLSP features in grammar packages.

## Overview

The unified LSP/GLSP server provides default implementations for all language features. Grammar packages can:

1. **Override specific features** with custom implementations
2. **Extend features** using partial overrides (deep merge)
3. **Disable features** that aren't needed for a language

## Customizing LSP Features

### Overriding an LSP Provider

Create custom providers in your grammar package's `src/lsp-overrides.ts`:

```typescript
import type { HoverProvider, CompletionProvider, LspContext, Position } from '@sanyam/types';

// Custom hover provider
export const customHoverProvider: HoverProvider = {
  async provide(context: LspContext, position: Position) {
    // Your custom implementation
    return {
      contents: {
        kind: 'markdown',
        value: '**Custom Hover**\n\nYour documentation here.',
      },
    };
  },
};

// Custom completion provider
export const customCompletionProvider: CompletionProvider = {
  async provide(context: LspContext, position: Position, completionContext: any) {
    return [
      { label: 'myKeyword', kind: 14, detail: 'A custom keyword' },
    ];
  },
};
```

### Registering LSP Overrides

In your `src/contribution.ts`, register the custom providers:

```typescript
import type { LanguageContribution, LspFeatureProviders } from '@sanyam/types';
import { customHoverProvider, customCompletionProvider } from './lsp-overrides.js';

const customLspProviders: Partial<LspFeatureProviders> = {
  hover: customHoverProvider,
  completion: customCompletionProvider,
};

export function createContribution(context: ContributionContext): LanguageContribution {
  return {
    languageId: 'my-language',
    fileExtensions: ['.ml'],
    generatedModule: context.generatedModule,
    lspProviders: customLspProviders,
    disabledFeatures: [],
  };
}
```

### Available LSP Features to Override

| Feature | Provider Type | Description |
|---------|--------------|-------------|
| `hover` | `HoverProvider` | Mouse hover information |
| `completion` | `CompletionProvider` | Code completion suggestions |
| `definition` | `DefinitionProvider` | Go to definition |
| `references` | `ReferencesProvider` | Find all references |
| `rename` | `RenameProvider` | Rename symbol |
| `formatting` | `FormattingProvider` | Document formatting |
| `diagnostics` | `DiagnosticsProvider` | Error checking |
| `documentSymbol` | `DocumentSymbolProvider` | Document outline |
| `codeAction` | `CodeActionProvider` | Quick fixes and refactoring |
| `semanticTokens` | `SemanticTokensProvider` | Syntax highlighting |

## Customizing GLSP Features

### Overriding GLSP Providers

Create custom providers in your grammar package's `src/glsp-overrides.ts`:

```typescript
import type { AstToGModelProvider, ToolPaletteProvider, GlspContext } from '@sanyam/types';

// Custom label generator
export function getCustomLabel(node: any): string {
  const name = node.name ?? 'Unnamed';
  const type = node.$type ?? 'Unknown';
  return `${type}: ${name}`;
}

// Partial override - only override specific methods
export const customAstToGModelOverrides: Partial<AstToGModelProvider> = {
  getLabel: getCustomLabel,
  // Other methods inherit from defaults
};

// Custom tool palette
export const customToolPalette: Partial<ToolPaletteProvider> = {
  async getTools(context: GlspContext) {
    return {
      groups: [
        {
          id: 'elements',
          label: 'Elements',
          tools: [
            { id: 'create-node', label: 'Node', icon: 'node' },
            { id: 'create-edge', label: 'Edge', icon: 'edge' },
          ],
        },
      ],
    };
  },
};
```

### Registering GLSP Overrides

In your `src/contribution.ts`:

```typescript
import { customAstToGModelOverrides, customToolPalette } from './glsp-overrides.js';

const customGlspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: customAstToGModelOverrides as any,
  toolPalette: customToolPalette as any,
};

export function createContribution(context: ContributionContext): LanguageContribution {
  return {
    // ... other fields
    glspProviders: customGlspProviders,
  };
}
```

### Available GLSP Features to Override

| Feature | Provider Type | Description |
|---------|--------------|-------------|
| `astToGModel` | `AstToGModelProvider` | Convert AST to diagram model |
| `gModelToAst` | `GModelToAstProvider` | Apply diagram changes to AST |
| `toolPalette` | `ToolPaletteProvider` | Diagram tool palette |
| `validation` | `DiagramValidationProvider` | Diagram validation |
| `layout` | `LayoutProvider` | Auto-layout algorithm |
| `contextMenu` | `ContextMenuProvider` | Right-click context menu |

## Deep Merge for Partial Overrides

The GLSP feature merger supports deep merge, allowing you to override specific methods while inheriting others:

```typescript
// Only override getLabel - other methods use defaults
const partialOverride: Partial<AstToGModelProvider> = {
  getLabel: (node) => node.customLabel ?? node.name,
};

// The merger will combine this with default implementations
```

This is especially useful when you only need to customize one aspect of a provider.

## Disabling Features

To disable features that aren't needed for your language:

```typescript
export function createContribution(context: ContributionContext): LanguageContribution {
  return {
    // ... other fields
    disabledFeatures: [
      'formatting',        // No auto-formatting
      'glsp.toolPalette',  // No diagram tools
      'glsp.contextMenu',  // No context menu
    ],
  };
}
```

### Feature Name Formats

Disabled features can be specified in several formats:

- Bare name: `'hover'`, `'completion'`
- With Provider suffix: `'HoverProvider'`, `'CompletionProvider'`
- With glsp. prefix: `'glsp.astToGModel'`, `'glsp.toolPalette'`

## Provider Resolution Order

When a request is received, the server resolves providers in this order:

1. **Check if disabled** - If the feature is in `disabledFeatures`, return `null`
2. **Check for custom provider** - Use the custom provider if provided
3. **Fall back to default** - Use the default implementation

### Conflict Resolution Policies

The merger supports different conflict resolution policies:

- **custom-wins** (default): Custom providers override defaults
- **default-wins**: Default providers are preferred
- **throw**: Throw an error if both custom and default exist

## Best Practices

### 1. Use Partial Overrides When Possible

Instead of replacing entire providers, override only the methods you need:

```typescript
// Good - partial override
const customProvider: Partial<AstToGModelProvider> = {
  getLabel: customGetLabel,
};

// Avoid - full replacement (loses default behavior)
const customProvider: AstToGModelProvider = {
  convert: customConvert,
  getLabel: customGetLabel,
  getPosition: customGetPosition,
  getSize: customGetSize,
  // Must implement all methods
};
```

### 2. Document Custom Behavior

Add JSDoc comments to explain why features are customized:

```typescript
/**
 * Custom hover provider for ECML.
 *
 * Provides rich documentation including:
 * - Element type icons
 * - Related element links
 * - Usage examples
 */
export const ecmlHoverProvider: HoverProvider = { ... };
```

### 3. Test Custom Providers

Write tests for custom provider implementations:

```typescript
describe('Custom Hover Provider', () => {
  it('should return formatted hover content', async () => {
    const result = await customHoverProvider.provide(mockContext, mockPosition);
    expect(result.contents).toContain('Expected content');
  });
});
```

### 4. Use the Manifest for Diagram Configuration

Keep diagram node/edge type mappings in the manifest, not in custom providers:

```typescript
// manifest.ts - Preferred
export const manifest: GrammarManifest = {
  diagram: {
    nodeTypes: {
      Entity: { type: 'node:entity', ... },
    },
  },
};

// glsp-overrides.ts - Use for behavior customization
export const customLayout: Partial<LayoutProvider> = {
  getLayoutOptions: () => ({ algorithm: 'elk-layered' }),
};
```

## Example: Full ECML Customization

See `grammars/ecml/src/` for a complete example:

- `manifest.ts` - Diagram configuration
- `lsp-overrides.ts` - Custom hover and completion
- `glsp-overrides.ts` - Custom labels, sizes, and tools
- `contribution.ts` - Integration of all customizations
