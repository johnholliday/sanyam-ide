# Sanyam Model → Standalone SPA: Design & Implementation Strategy

## Core Architectural Concept

The key insight is a **three-layer separation**:

| Layer            | IDE (Design-Time)                       | SPA (Runtime)                        |
| ---------------- | --------------------------------------- | ------------------------------------ |
| **Grammar**      | Full Langium parser, validator, scoping | Not needed — already validated       |
| **Model**        | Mutable AST, editor services            | Serialized, read-only semantic model |
| **Presentation** | GLSP diagrams, Monaco editor            | Domain-specific UI components        |

The SPA doesn't need Langium at all. It consumes a **validated, serialized model artifact** — think of it as a "compiled" output.

------

## Design: The Publish Pipeline

### 1. Model Export Format

Define a **Sanyam Model Manifest** (`sanyam.model.json`) that captures:

```typescript
interface SanyamModelManifest {
  meta: {
    grammarId: string;          // which grammar produced this
    version: string;
    publishedAt: string;
    title: string;
    description?: string;
  };
  schema: ModelSchema;          // structural type info derived from grammar
  data: SemanticModel;          // the validated AST, flattened to pure data
  presentation: PresentationSpec; // UI hints, layouts, workflows
  assets?: AssetManifest;       // images, documents, etc.
}
```

The critical move: **strip all Langium-specific AST metadata** (`$type`, `$container`, cross-reference nodes) and emit a clean domain object graph. You already have the Langium AST — write a `ModelExporter` service that walks it and produces portable JSON.

### 2. Presentation Specification

This is where the design gets interesting. The grammar defines *structure*, but the SPA needs *interaction*. Introduce a **presentation layer** that can be authored alongside the model in the IDE:

```typescript
interface PresentationSpec {
  layout: 'wizard' | 'dashboard' | 'form-flow' | 'document';
  theme?: ThemeConfig;              // Tailwind-based token overrides
  pages: PageSpec[];                // ordered views into the model
  workflows?: WorkflowSpec[];       // state machines for onboarding flows
  bindings: UIBinding[];            // map model elements → UI components
}

interface UIBinding {
  modelPath: string;                // JSONPath or dot-notation into model
  component: string;                // registered UI component type
  props?: Record<string, unknown>;  // component-specific config
  validation?: ClientValidation[];  // lightweight client-side rules
}
```

This lets users in the IDE define *how* the model surfaces to end users — a wizard for onboarding, a dashboard for consulting, a form-flow for data collection.

### 3. SPA Runtime Architecture

A **SvelteKit shell app** with a pluggable model renderer:

```
sanyam-spa-runtime/
├── src/
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── ModelLoader.ts        # loads & validates manifest
│   │   │   ├── BindingResolver.ts    # maps model paths → components
│   │   │   ├── WorkflowEngine.ts     # state machine for multi-step flows
│   │   │   └── ExpressionEval.ts     # safe eval for computed bindings
│   │   ├── components/
│   │   │   ├── registry.ts           # component type → Svelte component
│   │   │   ├── FormField.svelte
│   │   │   ├── DataTable.svelte
│   │   │   ├── DiagramView.svelte    # read-only GLSP diagram render
│   │   │   ├── DocumentSection.svelte
│   │   │   └── ...domain-specific/
│   │   └── theme/
│   │       └── tailwind-tokens.ts    # runtime theme from manifest
│   ├── routes/
│   │   ├── +layout.svelte            # shell chrome, nav from manifest
│   │   └── [page]/+page.svelte       # dynamic routing from PageSpec
│   └── app.html
├── static/
│   └── model/                        # published manifest lands here
└── svelte.config.js                  # adapter-static for pure SPA
```

------

## Implementation Strategy

### Phase 1: Model Serialization & Export

**Build in the Sanyam IDE:**

- `ModelExporter` Langium service — walks AST, strips infrastructure, emits `SemanticModel`
- `SchemaDeriver` — generates the `ModelSchema` from the Langium grammar's type system (you already have `AstReflection` to work with)
- IDE command: **"Publish Model"** → produces `sanyam.model.json`
- Validate round-trip: ensure the manifest is self-contained and grammar-independent

### Phase 2: SPA Runtime Shell

**Standalone SvelteKit project (`@sanyam/spa-runtime`):**

- Build the `ModelLoader` and `BindingResolver` engine
- Create a **component registry** pattern — start with 8-10 generic components (form fields, tables, text sections, cards, status indicators)
- Implement the dynamic page router driven by `PresentationSpec.pages`
- Use `adapter-static` for zero-server deployment

### Phase 3: Presentation Authoring in IDE

**Back in the Sanyam IDE:**

- Add a `PresentationSpec` DSL (either as part of the Langium grammar or as a sidecar YAML/JSON with IDE support)
- GLSP could provide a visual layout editor for page composition
- Live preview panel using an embedded SvelteKit dev server or iframe

### Phase 4: Build & Deploy Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Sanyam IDE  │────▶│ Publish CLI   │────▶│  Static SPA    │
│  (model +    │     │ - export model│     │  (deployable)  │
│  presentation)│    │ - inject into │     │                │
│              │     │   SPA runtime │     │  Vercel/       │
│              │     │ - vite build  │     │  Netlify/      │
│              │     │ - optimize    │     │  S3+CF/        │
└─────────────┘     └──────────────┘     │  Docker         │
                                          └────────────────┘
```

The **Publish CLI** (`@sanyam/publish`):

1. Reads the manifest from the IDE workspace
2. Copies it into the SPA runtime's `static/model/` directory
3. Runs `vite build` with `adapter-static`
4. Outputs a deployable `dist/` folder
5. Optionally pushes to a configured deployment target

------

## Key Design Decisions

**Why not generate code per grammar?** You *could* generate a custom SvelteKit app per grammar, but that creates a maintenance nightmare. The runtime-interpreter approach means one SPA codebase serves all grammars — the model manifest is the variable, not the code.

**Where does GLSP fit?** For read-only diagram views in the published SPA, consider exporting GLSP diagrams as SVG snapshots or using a lightweight rendering library (e.g., Sprotty in view-only mode — it's already a dependency). Full GLSP is too heavy for the SPA runtime.

**Client-side data collection?** If the SPA needs to collect data from end users (onboarding forms, assessments), the manifest should define a `ResponseSchema` and the SPA runtime should serialize responses as JSON that can be imported back into the IDE for analysis. Consider optional integration with a lightweight backend (SvelteKit API routes + SQLite via Turso, or a simple REST endpoint).

**Grammar-specific component packs?** Allow grammars to ship with a `@sanyam/components-{domain}` package that registers domain-specific Svelte components into the registry. The ISO 42001 grammar might need audit trail components; a legal grammar might need clause renderers. This keeps the core runtime lean.

------

## Quick Win to Validate the Approach

Start with the simplest possible vertical slice:

1. Pick one existing Sanyam grammar
2. Hand-write the `sanyam.model.json` for one test model
3. Build a minimal SvelteKit app that reads it and renders a form-flow
4. Confirm the model is fully self-describing without any Langium dependency at runtime

That proves the decoupling works before you invest in the full publish pipeline.