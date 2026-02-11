# Sanyam Projects: Strategy & Implementation Plan

## Executive Summary

Sanyam IDE currently operates at the **workspace** level — a flat collection of files opened in Theia. This plan introduces a **Project** abstraction: a grammar-anchored container that bundles one or more `.langium` grammar files with their associated artifacts (models, diagrams, validations, transformations, generated output). Projects enable cross-instance analytics, lifecycle tracking, and a natural licensing boundary via `@sanyam/projects`.

The core insight: **a Project is not a folder — it's a grammar definition plus everything derived from it.** This makes cross-project comparison meaningful because two projects sharing the same grammar definition are structurally comparable.

---

## 1. Conceptual Model

### 1.1 Project vs. Workspace

| Concept | Workspace (current) | Project (proposed) |
|---------|---------------------|--------------------|
| **Scope** | Open folder(s) in Theia | Grammar + derived artifacts |
| **Identity** | Filesystem path | Persistent UUID + manifest |
| **Lifecycle** | None — ephemeral session state | Created → Active → Archived → Deleted |
| **Grammar binding** | Implicit (file extension → language) | Explicit (manifest declares grammar) |
| **Cross-instance** | Not possible | Compare, diff, analyze across projects |
| **Persistence** | `.theia/` settings | `sanyam-project.json` manifest |

### 1.2 Project Anatomy

```
my-project/
├── sanyam-project.json          # Project manifest (identity, grammar ref, metadata)
├── grammars/
│   ├── MyLang.langium            # Primary grammar
│   └── MyLangExtension.langium   # Optional grammar extensions
├── models/
│   ├── example.mylang            # Model instances
│   └── another.mylang
├── diagrams/
│   ├── example.glsp              # GLSP diagram state
│   └── layout.json               # Diagram layout metadata
├── validations/
│   └── custom-rules.ts           # Project-specific validation rules
├── generators/
│   └── templates/                # Code generation templates
├── .sanyam/
│   ├── cache/                    # Generated parser, LSP artifacts
│   ├── snapshots/                # Lifecycle snapshots
│   └── analytics.db              # Local SQLite for project metrics
└── output/                       # Generated artifacts
```

### 1.3 Project Manifest (`sanyam-project.json`)

```jsonc
{
  "$schema": "https://sanyam.dev/schemas/project/v1.json",
  "id": "proj_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Order Processing DSL",
  "version": "1.2.0",
  "created": "2025-02-10T14:30:00Z",
  "grammar": {
    "entry": "grammars/OrderProcess.langium",       // Primary grammar file
    "includes": ["grammars/SharedTypes.langium"],    // Additional grammar modules
    "fingerprint": "sha256:abc123..."                // Grammar content hash
  },
  "language": {
    "id": "order-process",
    "extensions": [".op"],
    "configuration": "language-configuration.json"
  },
  "lifecycle": {
    "stage": "active",                               // draft | active | archived
    "snapshots": [
      { "tag": "v1.0.0", "date": "2025-01-15T00:00:00Z", "fingerprint": "sha256:def456..." }
    ]
  },
  "analytics": {
    "enabled": true,
    "track": ["model-complexity", "validation-density", "diagram-coverage"]
  },
  "license": {
    "tier": "professional",                          // community | professional | enterprise
    "features": ["cross-project-analytics", "lifecycle-snapshots", "team-sharing"]
  }
}
```

---

## 2. Architecture

### 2.1 Package Structure

```
packages/
├── @sanyam/projects-core        # Project model, manifest parsing, lifecycle FSM
├── @sanyam/projects-theia        # Theia integration (views, commands, menus)
├── @sanyam/projects-analytics    # Cross-project analysis engine
├── @sanyam/projects-licensing    # License validation, feature gating
└── @sanyam/projects              # Meta-package (re-exports all above)
```

### 2.2 Core Interfaces

```typescript
// @sanyam/projects-core

export interface SanyamProject {
  readonly id: string;                    // UUID v4
  readonly manifest: ProjectManifest;
  readonly grammarFingerprint: string;    // Content-addressable grammar identity
  readonly lifecycle: ProjectLifecycle;
  readonly rootUri: URI;
}

export interface ProjectManifest {
  readonly name: string;
  readonly version: string;
  readonly grammar: GrammarReference;
  readonly language: LanguageConfig;
  readonly analytics: AnalyticsConfig;
  readonly license: LicenseConfig;
}

export interface GrammarReference {
  readonly entry: string;                 // Relative path to primary .langium
  readonly includes: string[];            // Additional grammar modules
  readonly fingerprint: string;           // SHA-256 of normalized grammar content
}

export interface ProjectLifecycle {
  readonly stage: 'draft' | 'active' | 'archived';
  readonly snapshots: ProjectSnapshot[];
  transition(to: LifecycleStage): Promise<void>;
  snapshot(tag: string): Promise<ProjectSnapshot>;
}

export interface ProjectSnapshot {
  readonly tag: string;
  readonly timestamp: Date;
  readonly grammarFingerprint: string;
  readonly metrics: ProjectMetrics;       // Captured at snapshot time
}
```

### 2.3 Grammar Fingerprinting

The fingerprint is the key to cross-project comparability. Two projects with the same grammar fingerprint are structurally comparable regardless of project name, location, or other metadata.

```typescript
// Normalize grammar before hashing to ignore whitespace/comment differences
export function computeGrammarFingerprint(grammarFiles: string[]): string {
  const normalized = grammarFiles
    .map(f => normalizeGrammar(f))        // Strip comments, normalize whitespace
    .sort()                                // Deterministic ordering
    .join('\n---\n');
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}
```

This means:
- Two projects based on the **same grammar version** → same fingerprint → directly comparable
- Grammar evolves → new fingerprint → snapshots preserve historical comparability
- Grammar fingerprints form a **lineage** when combined with version history

### 2.4 Integration with Existing Sanyam Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Theia Shell                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │ Project       │  │ Workspace     │  │ Explorer │ │
│  │ Navigator     │  │ (existing)    │  │ (exists) │ │
│  │ (new view)    │  │               │  │          │ │
│  └──────┬───────┘  └───────┬───────┘  └────┬─────┘ │
│         │                  │                │       │
│  ┌──────▼──────────────────▼────────────────▼─────┐ │
│  │            Project Manager Service              │ │
│  │  ┌─────────────┐  ┌──────────────────────────┐ │ │
│  │  │ Manifest    │  │ Grammar Registry          │ │ │
│  │  │ Resolver    │  │ (fingerprint → projects)  │ │ │
│  │  └─────────────┘  └──────────────────────────┘ │ │
│  └────────────────────────┬───────────────────────┘ │
│                           │                         │
│  ┌────────────────────────▼───────────────────────┐ │
│  │          Langium Language Services               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │ │
│  │  │ LSP      │  │ GLSP     │  │ Generators   │ │ │
│  │  │ Server   │  │ Server   │  │              │ │ │
│  │  └──────────┘  └──────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │          Analytics Engine (licensed)             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │ │
│  │  │ Metrics  │  │ Cross-   │  │ Reporting    │ │ │
│  │  │ Collector│  │ Project  │  │ & Export     │ │ │
│  │  │          │  │ Analyzer │  │              │ │ │
│  │  └──────────┘  └──────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 3. Cross-Project Analytics

### 3.1 Metrics Model

Since all projects sharing a grammar fingerprint use the same AST structure, metrics are structurally consistent and directly comparable.

```typescript
export interface ProjectMetrics {
  // Grammar-level
  grammarFingerprint: string;
  ruleCount: number;
  terminalCount: number;
  crossReferenceCount: number;

  // Model-level (aggregated across all model files in project)
  modelFileCount: number;
  totalASTNodes: number;
  averageTreeDepth: number;
  validationErrorCount: number;
  validationWarningCount: number;

  // Diagram-level
  diagramCount: number;
  diagramCoverage: number;              // % of model elements with diagram representation

  // Lifecycle
  snapshotCount: number;
  daysSinceLastModification: number;
  grammarVersionCount: number;          // How many grammar versions this project has seen
}
```

### 3.2 Comparison Engine

```typescript
export interface CrossProjectAnalysis {
  // Find all projects sharing a grammar fingerprint
  findRelatedProjects(fingerprint: string): Promise<SanyamProject[]>;

  // Compare metrics across projects with same grammar
  compareProjects(projectIds: string[]): Promise<ComparisonReport>;

  // Track metric trends over time for a single project
  projectTimeline(projectId: string): Promise<TimelineReport>;

  // Aggregate statistics across all projects for a grammar
  grammarStatistics(fingerprint: string): Promise<GrammarAggregateStats>;
}
```

### 3.3 Comparison Dimensions

| Dimension | What It Answers |
|-----------|----------------|
| **Structural complexity** | Which project models are more complex? Average depth, node count. |
| **Validation health** | Which projects have fewer errors per node? Trend over time? |
| **Diagram coverage** | Which projects have better visual documentation? |
| **Grammar evolution** | How has the grammar changed across versions? Impact on models? |
| **Lifecycle velocity** | How quickly do projects move through draft → active → archived? |

---

## 4. Licensing Model

### 4.1 Feature Tiers

| Feature | Community (free) | Professional | Enterprise |
|---------|:---:|:---:|:---:|
| Single project | ✓ | ✓ | ✓ |
| Project manifest | ✓ | ✓ | ✓ |
| Grammar fingerprinting | ✓ | ✓ | ✓ |
| Multiple projects | — | ✓ | ✓ |
| Lifecycle snapshots | — | ✓ | ✓ |
| Cross-project analytics | — | ✓ | ✓ |
| Export/reporting | — | ✓ | ✓ |
| Team sharing | — | — | ✓ |
| Custom metrics plugins | — | — | ✓ |
| API access | — | — | ✓ |

### 4.2 License Validation

```typescript
// @sanyam/projects-licensing

export interface LicenseGate {
  // Check if a feature is available for the current license
  isFeatureEnabled(feature: ProjectFeature): boolean;

  // Decorator for gated commands/services
  requireFeature(feature: ProjectFeature): MethodDecorator;
}

export type ProjectFeature =
  | 'multi-project'
  | 'lifecycle-snapshots'
  | 'cross-project-analytics'
  | 'export-reporting'
  | 'team-sharing'
  | 'custom-metrics'
  | 'api-access';
```

License keys are validated locally (offline-capable) with periodic online verification. Licensing uses a signed JWT approach:

```typescript
interface SanyamLicense {
  sub: string;          // Licensee identifier
  tier: LicenseTier;
  features: ProjectFeature[];
  iat: number;          // Issued at
  exp: number;          // Expiration
  sig: string;          // RSA signature
}
```

---

## 5. Implementation Plan

### Phase 1: Foundation (4–6 weeks)

**Goal:** Project manifest, creation wizard, single-project lifecycle.

| Task | Package | Est. |
|------|---------|------|
| Define `ProjectManifest` schema + JSON Schema | `projects-core` | 3d |
| Implement manifest read/write/validate | `projects-core` | 3d |
| Grammar fingerprinting algorithm | `projects-core` | 2d |
| Project lifecycle FSM (draft → active → archived) | `projects-core` | 3d |
| "New Project" wizard (Theia command + dialog) | `projects-theia` | 5d |
| Project Navigator view (tree widget) | `projects-theia` | 5d |
| Auto-detect `sanyam-project.json` on workspace open | `projects-theia` | 2d |
| Wire project context into Langium language services | `projects-core` | 3d |
| Unit + integration tests | all | 4d |

**Deliverable:** Users can create a project, see it in a navigator, and the IDE recognizes the grammar binding.

### Phase 2: Analytics & Snapshots (4–6 weeks)

**Goal:** Single-project metrics, snapshots, basic reporting.

| Task | Package | Est. |
|------|---------|------|
| Metrics collector (AST walking, validation aggregation) | `projects-analytics` | 5d |
| Local SQLite storage for metrics time-series | `projects-analytics` | 3d |
| Snapshot creation (grammar + metrics + model summary) | `projects-core` | 3d |
| Project dashboard view (Theia webview) | `projects-theia` | 5d |
| Timeline visualization (metrics over snapshots) | `projects-theia` | 4d |
| Export to JSON/CSV | `projects-analytics` | 2d |
| Tests | all | 3d |

**Deliverable:** Users can snapshot project state, view metrics dashboards, and export data.

### Phase 3: Cross-Project & Licensing (4–6 weeks)

**Goal:** Multi-project comparison, license gating, release readiness.

| Task | Package | Est. |
|------|---------|------|
| Grammar registry (fingerprint → project index) | `projects-analytics` | 3d |
| Cross-project comparison engine | `projects-analytics` | 5d |
| Comparison views (side-by-side dashboards) | `projects-theia` | 5d |
| License validation module (JWT, offline) | `projects-licensing` | 4d |
| Feature gating decorators + UI indicators | `projects-licensing` | 3d |
| License management UI (activation, status) | `projects-theia` | 3d |
| End-to-end integration testing | all | 3d |
| Documentation | all | 3d |

**Deliverable:** Full `@sanyam/projects` package — licensable, with cross-project analytics.

### Phase 4: Enterprise & Polish (3–4 weeks)

| Task | Package | Est. |
|------|---------|------|
| Team sharing (project export/import bundles) | `projects-core` | 4d |
| Custom metrics plugin API | `projects-analytics` | 4d |
| REST API for external tooling | `projects-core` | 3d |
| Performance optimization (large projects) | all | 3d |
| Accessibility + UX polish | `projects-theia` | 3d |

---

## 6. Key Design Decisions

### 6.1 Project ≠ Workspace

Projects overlay workspaces — they don't replace them. A Theia workspace can contain zero or more projects. The Project Navigator is an additional view alongside the File Explorer. This preserves backward compatibility: existing workspace-only users see no change until they create their first project.

### 6.2 Grammar Fingerprint as Primary Key

Using content-addressable grammar identity (rather than name or path) makes cross-project comparison robust against renaming, reorganization, and forking. Two independently developed projects that happen to use the same grammar are automatically comparable.

### 6.3 Offline-First Analytics

All metrics are computed locally and stored in a per-project SQLite database. This means:
- No cloud dependency for core functionality
- Enterprise users maintain data sovereignty
- Cross-project analytics work by querying multiple local databases

### 6.4 License Boundary at the Package Level

`@sanyam/projects` is the npm distribution unit. Free features are unlocked by default. Professional and Enterprise features check a local license file. This keeps the licensing boundary clean and auditable.

---

## 7. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grammar fingerprint collisions | False comparisons | SHA-256 makes this astronomically unlikely; include grammar file count as secondary check |
| Large projects degrade analytics perf | Poor UX | Incremental metrics computation; cache AST walks; background worker threads |
| Langium 4.x breaking changes | Rework | Pin to Langium 4.x minor; abstract grammar access through adapter layer |
| License bypass (open source codebase) | Revenue loss | License checks in compiled extensions; honor system for community; focus value on enterprise features |
| Workspace → Project migration friction | Adoption barrier | One-click "Convert to Project" command; sensible defaults; minimal mandatory config |

---

## 8. Success Criteria

- **Phase 1:** Create project from grammar, navigate artifacts, grammar fingerprint computed correctly
- **Phase 2:** Metrics dashboard renders for single project, snapshots capture/restore correctly
- **Phase 3:** Two projects with same grammar compare side-by-side; license gates prevent unpaid feature access
- **Phase 4:** Team can export/import project bundles; external tools query project API

---

*Document version: 1.0 | February 2026*
