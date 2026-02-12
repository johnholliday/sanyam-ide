# Sanyam Projects: Strategy & Implementation Plan (v2)

## Executive Summary

Sanyam IDE currently operates at the **workspace** level — a flat collection of files opened in Theia. This plan introduces a **Project** abstraction: a grammar-anchored container that bundles one or more `.langium` grammar files with their associated artifacts (models, diagrams, validations, transformations, generated output). Projects enable cross-instance analytics, lifecycle tracking, and a natural feature-gating boundary.

The core insight: **a Project is not a folder — it's a grammar definition plus everything derived from it.** This makes cross-project comparison meaningful because two projects sharing the same grammar definition are structurally comparable.

### Prerequisites

This spec assumes the **Sanyam Unified Cloud Storage, Authentication & Licensing** infrastructure is already deployed. Specifically:

| Dependency | Package | What Projects Consumes |
|------------|---------|----------------------|
| Licensing / feature gating | `@sanyam/licensing` | `FeatureGate`, `LicenseFeature`, tier resolution via Supabase `user_profiles` |
| Document resolution | `@sanyam/supabase-storage` | `UnifiedDocumentResolver` for `file://`, `sanyam://`, and inline URIs |
| Authentication | `@sanyam/supabase-auth` | Session context, `auth.uid()` for cloud-persisted project manifests |
| Shared types | `@sanyam/types` | `DocumentReference`, `CloudDocument`, tier interfaces |
| Supabase client | `@sanyam/supabase-core` | `SupabaseClientFactory` for database access |

Projects introduces **no separate licensing package**. All feature gating flows through `@sanyam/licensing`.

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
| **Storage** | Local filesystem only | Local (`file://`) or cloud (`sanyam://`) — transparent via `UnifiedDocumentResolver` |

### 1.2 Project Anatomy

```
my-project/
├── sanyam-project.json          # Project manifest (identity, grammar ref, metadata)
├── grammars/
│   ├── MyLang.langium            # Primary grammar
│   └── MyLangExtension.langium   # Optional grammar extensions
├── models/
│   ├── example.mylang            # Model instances (file:// or sanyam:// refs)
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
    "entry": "grammars/OrderProcess.langium",
    "includes": ["grammars/SharedTypes.langium"],
    "fingerprint": "sha256:abc123..."
  },
  "language": {
    "id": "order-process",
    "extensions": [".op"],
    "configuration": "language-configuration.json"
  },
  "models": {
    // Model references support both local and cloud URIs.
    // The UnifiedDocumentResolver handles transparent resolution.
    "sources": [
      "models/*.op",                                       // Local glob
      "sanyam://d4e5f6a7-b8c9-0123-4567-890abcdef012"     // Cloud document
    ]
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
  "storage": {
    "mode": "local",                                 // "local" | "cloud" | "hybrid"
    "cloudManifestId": null                           // If non-null, manifest is also persisted to Supabase
  }
}
```

**Key difference from v1:** The manifest no longer contains a `license` block. Feature availability is determined at runtime by querying `@sanyam/licensing` → Supabase `user_profiles.tier`. The manifest declares _what_ the project uses; the licensing layer decides _whether_ it's allowed.

---

## 2. Architecture

### 2.1 Package Structure

```
packages/
├── @sanyam/projects-core        # Project model, manifest parsing, lifecycle FSM
├── @sanyam/projects-theia       # Theia integration (views, commands, menus)
├── @sanyam/projects-analytics   # Cross-project analysis engine
└── @sanyam/projects             # Meta-package (re-exports all above)
```

No `@sanyam/projects-licensing` package. Feature gating is provided by the existing `@sanyam/licensing` package, extended with project-specific feature constants.

### 2.2 Dependency Graph (Unified)

```
@sanyam/types                          ← pure interfaces (no deps)
    ↑
@sanyam/supabase-core                  ← Supabase client, credentials
    ↑
@sanyam/licensing                      ← FeatureGate, tier → feature mapping
    ↑
@sanyam/supabase-auth                  ← Theia AuthenticationProvider (browser)
@sanyam/supabase-storage               ← UnifiedDocumentResolver, CloudDocumentStore
    ↑
┌───────────────────────────────────────────────────────┐
│  @sanyam/projects-core                                │
│    depends on: types, licensing, supabase-storage      │
│    provides: ProjectManifest, lifecycle FSM,            │
│              grammar fingerprinting, document resolver  │
│              integration                                │
├───────────────────────────────────────────────────────┤
│  @sanyam/projects-analytics                            │
│    depends on: projects-core, licensing                 │
│    provides: metrics collector, cross-project engine,   │
│              local SQLite storage                       │
├───────────────────────────────────────────────────────┤
│  @sanyam/projects-theia                                │
│    depends on: projects-core, projects-analytics,       │
│                supabase-auth                            │
│    provides: Project Navigator, dashboards, commands    │
└───────────────────────────────────────────────────────┘
    ↑
language-server                        ← consumes all of the above
```

### 2.3 Core Interfaces

```typescript
// @sanyam/projects-core

import { DocumentReference } from '@sanyam/types';
import { UnifiedDocumentResolver } from '@sanyam/supabase-storage';
import { FeatureGate, LicenseFeature } from '@sanyam/licensing';

export interface SanyamProject {
  readonly id: string;                    // UUID v4
  readonly manifest: ProjectManifest;
  readonly grammarFingerprint: string;    // Content-addressable grammar identity
  readonly lifecycle: ProjectLifecycle;
  readonly rootUri: URI;
  readonly storageMode: 'local' | 'cloud' | 'hybrid';
}

export interface ProjectManifest {
  readonly name: string;
  readonly version: string;
  readonly grammar: GrammarReference;
  readonly language: LanguageConfig;
  readonly models: ModelSourceConfig;
  readonly analytics: AnalyticsConfig;
  readonly storage: StorageConfig;
}

export interface GrammarReference {
  readonly entry: string;                 // Relative path to primary .langium
  readonly includes: string[];            // Additional grammar modules
  readonly fingerprint: string;           // SHA-256 of normalized grammar content
}

export interface ModelSourceConfig {
  /**
   * Model sources can be local globs (resolved against project root)
   * or sanyam:// URIs (resolved via UnifiedDocumentResolver).
   * This enables hybrid projects where some models are local
   * and others are cloud-persisted.
   */
  readonly sources: string[];
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

### 2.4 Extended License Features

`@sanyam/licensing` is extended — not forked — with project-specific feature constants:

```typescript
// Added to @sanyam/licensing/src/common/license-protocol.ts

export const ProjectFeatures = {
  MULTI_PROJECT: 'multi-project',
  LIFECYCLE_SNAPSHOTS: 'lifecycle-snapshots',
  CROSS_PROJECT_ANALYTICS: 'cross-project-analytics',
  EXPORT_REPORTING: 'export-reporting',
  TEAM_SHARING: 'team-sharing',
  CUSTOM_METRICS: 'custom-metrics',
  PROJECT_API: 'project-api',
} as const;

export type ProjectFeature = typeof ProjectFeatures[keyof typeof ProjectFeatures];

// FeatureGate.tierFeatures is extended to include project features:
// free:       (no project features — single project, no gating needed)
// pro:        multi-project, lifecycle-snapshots, cross-project-analytics, export-reporting
// enterprise: + team-sharing, custom-metrics, project-api
```

This keeps a single `FeatureGate` service, a single tier resolution path, and a single source of truth in Supabase.

### 2.5 Document Resolution Integration

Projects delegates all URI resolution to the existing `UnifiedDocumentResolver`:

```typescript
// @sanyam/projects-core

@injectable()
export class ProjectDocumentService {
  @inject(UnifiedDocumentResolver) protected resolver: UnifiedDocumentResolver;

  /**
   * Resolves all model sources declared in the project manifest.
   * Local globs expand to file:// URIs.
   * sanyam:// URIs pass through to the resolver directly.
   */
  async resolveModelSources(project: SanyamProject): Promise<DocumentReference[]> {
    const refs: DocumentReference[] = [];

    for (const source of project.manifest.models.sources) {
      if (source.startsWith('sanyam://')) {
        refs.push({ kind: 'cloud', uri: source });
      } else {
        // Expand glob relative to project root
        const expanded = await glob(source, { cwd: project.rootUri.fsPath });
        for (const path of expanded) {
          refs.push({ kind: 'file', uri: URI.file(resolve(project.rootUri.fsPath, path)).toString() });
        }
      }
    }

    return refs;
  }

  /**
   * Loads a LangiumDocument from any DocumentReference.
   * Cloud documents are fetched, cached, and change-tracked
   * by the UnifiedDocumentResolver.
   */
  async loadDocument(ref: DocumentReference): Promise<LangiumDocument> {
    return this.resolver.resolve(ref);
  }
}
```

### 2.6 Grammar Fingerprinting

The fingerprint is the key to cross-project comparability. Two projects with the same grammar fingerprint are structurally comparable regardless of project name, location, or storage backend.

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

### 2.7 Integration with Theia Shell

```
┌──────────────────────────────────────────────────────────────┐
│                        Theia Shell                            │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ Project       │  │ Workspace     │  │ Explorer         │  │
│  │ Navigator     │  │ (existing)    │  │ (existing)       │  │
│  │ (new view)    │  │               │  │                  │  │
│  └──────┬───────┘  └───────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│  ┌──────▼──────────────────▼────────────────────▼─────────┐  │
│  │              Project Manager Service                    │  │
│  │  ┌─────────────┐  ┌──────────────────────────────────┐ │  │
│  │  │ Manifest    │  │ Grammar Registry                  │ │  │
│  │  │ Resolver    │  │ (fingerprint → projects)          │ │  │
│  │  └─────────────┘  └──────────────────────────────────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │     Cloud / Licensing Layer (pre-existing)              │  │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────────┐ │  │
│  │  │ FeatureGate  │  │ Unified    │  │ Supabase       │ │  │
│  │  │ (@sanyam/    │  │ Document   │  │ Auth           │ │  │
│  │  │  licensing)  │  │ Resolver   │  │ Provider       │ │  │
│  │  └──────────────┘  └────────────┘  └────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Langium Language Services                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ LSP      │  │ GLSP     │  │ Generators           │ │  │
│  │  │ Server   │  │ Server   │  │                      │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Analytics Engine (feature-gated)              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ Metrics  │  │ Cross-   │  │ Reporting            │ │  │
│  │  │ Collector│  │ Project  │  │ & Export             │ │  │
│  │  │          │  │ Analyzer │  │                      │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
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

## 4. Licensing Model (Unified)

### 4.1 Feature Tiers

All gating flows through the existing `@sanyam/licensing` → `FeatureGate` → Supabase `user_profiles.tier` pipeline. No local JWT license files. No separate `@sanyam/projects-licensing` package.

| Feature | Community (free) | Professional | Enterprise |
|---------|:---:|:---:|:---:|
| Single project | ✓ | ✓ | ✓ |
| Project manifest | ✓ | ✓ | ✓ |
| Grammar fingerprinting | ✓ | ✓ | ✓ |
| Cloud model references (`sanyam://` in manifest) | ✓ | ✓ | ✓ |
| Multiple projects | — | ✓ | ✓ |
| Lifecycle snapshots | — | ✓ | ✓ |
| Cross-project analytics | — | ✓ | ✓ |
| Export/reporting | — | ✓ | ✓ |
| Team sharing | — | — | ✓ |
| Custom metrics plugins | — | — | ✓ |
| API access | — | — | ✓ |

### 4.2 Feature Gating Pattern

```typescript
// @sanyam/projects-core — consuming the existing FeatureGate

import { FeatureGate, ProjectFeatures } from '@sanyam/licensing';

@injectable()
export class ProjectManagerService {
  @inject(FeatureGate) protected gate: FeatureGate;

  async createProject(config: CreateProjectConfig): Promise<SanyamProject> {
    const existingProjects = await this.listProjects();

    if (existingProjects.length >= 1) {
      const allowed = await this.gate.isFeatureEnabled(ProjectFeatures.MULTI_PROJECT);
      if (!allowed) {
        throw new Error(
          'Multiple projects require a Professional subscription. '
          + 'Upgrade at https://sanyam.dev/pricing'
        );
      }
    }

    return this.doCreateProject(config);
  }

  async snapshotProject(projectId: string, tag: string): Promise<ProjectSnapshot> {
    const allowed = await this.gate.isFeatureEnabled(ProjectFeatures.LIFECYCLE_SNAPSHOTS);
    if (!allowed) {
      throw new Error('Lifecycle snapshots require a Professional subscription.');
    }
    return this.doSnapshot(projectId, tag);
  }
}
```

### 4.3 Offline / Unauthenticated Behavior

When the user is offline or unauthenticated:

- `FeatureGate.isFeatureEnabled()` returns `false` for all gated features (safe default).
- Single-project creation, manifest editing, grammar fingerprinting, and local analytics all work without authentication.
- Cloud model references (`sanyam://`) in the manifest gracefully degrade — the `UnifiedDocumentResolver` returns a "document unavailable" placeholder, and validation reports the reference as unresolvable rather than crashing.
- The Project Navigator shows a subtle indicator: "Sign in to unlock multi-project and analytics features."

---

## 5. Cloud Manifest Persistence

Projects that opt into cloud storage can persist their manifest to Supabase, enabling cross-device and team access.

### 5.1 Database Schema Extension

```sql
-- supabase/migrations/004_projects.sql
-- Extends the existing document/user schema from the Cloud spec.

CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id),
  name          TEXT NOT NULL,
  version       TEXT NOT NULL DEFAULT '0.1.0',
  manifest      JSONB NOT NULL,                              -- Full sanyam-project.json content
  grammar_fingerprint TEXT NOT NULL,                          -- Indexed for cross-project queries
  lifecycle_stage TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_stage IN ('draft', 'active', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ                                   -- Soft delete
);

CREATE INDEX idx_projects_owner ON projects(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_fingerprint ON projects(grammar_fingerprint) WHERE deleted_at IS NULL;

-- RLS: same pattern as documents table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects FOR SELECT
  USING (owner_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY projects_insert ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update ON projects FOR UPDATE
  USING (owner_id = auth.uid() AND deleted_at IS NULL);

-- Snapshots stored as JSONB rows for queryability
CREATE TABLE IF NOT EXISTS project_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  tag             TEXT NOT NULL,
  grammar_fingerprint TEXT NOT NULL,
  metrics         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, tag)
);

ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_select ON project_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- Team sharing: reuse the document_shares pattern
CREATE TABLE IF NOT EXISTS project_shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  shared_with   UUID NOT NULL REFERENCES auth.users(id),
  permission    TEXT NOT NULL DEFAULT 'view'
    CHECK (permission IN ('view', 'edit', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, shared_with)
);

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_shares_select ON project_shares FOR SELECT
  USING (
    shared_with = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_shares.project_id
        AND projects.owner_id = auth.uid()
    )
  );
```

### 5.2 Manifest Sync

```typescript
// @sanyam/projects-core

@injectable()
export class ProjectCloudSync {
  @inject(SupabaseClientFactory) protected clientFactory: SupabaseClientFactory;
  @inject(FeatureGate) protected gate: FeatureGate;

  /**
   * Pushes the local sanyam-project.json to Supabase.
   * Updates storage.cloudManifestId in the local manifest on first push.
   * Requires authentication.
   */
  async pushManifest(project: SanyamProject): Promise<void> {
    const client = this.clientFactory.createUserClient(await this.getAccessToken());
    if (!client) return; // Not authenticated or Supabase unconfigured

    const payload = {
      name: project.manifest.name,
      version: project.manifest.version,
      manifest: project.manifest,
      grammar_fingerprint: project.grammarFingerprint,
      lifecycle_stage: project.lifecycle.stage,
    };

    if (project.manifest.storage.cloudManifestId) {
      await client.from('projects').update(payload)
        .eq('id', project.manifest.storage.cloudManifestId);
    } else {
      const { data } = await client.from('projects').insert(payload).select('id').single();
      await this.updateLocalManifest(project, { cloudManifestId: data.id });
    }
  }

  /**
   * Pulls the cloud manifest and merges with local.
   * Cloud wins for metadata; local wins for file paths.
   */
  async pullManifest(cloudManifestId: string): Promise<ProjectManifest> {
    const client = this.clientFactory.createUserClient(await this.getAccessToken());
    const { data } = await client.from('projects').select('manifest')
      .eq('id', cloudManifestId).single();
    return data.manifest as ProjectManifest;
  }
}
```

---

## 6. HTTP API Extensions

Project CRUD is exposed through the existing Hono gateway alongside the document routes.

### 6.1 Routes

| Method | Path | Description | Auth | Tier |
|--------|------|-------------|------|------|
| GET | `/api/v1/projects` | List user's projects | Required | free |
| GET | `/api/v1/projects/:id` | Get project manifest | Required | free |
| POST | `/api/v1/projects` | Create project | Required | free (1st), pro (2+) |
| PUT | `/api/v1/projects/:id` | Update manifest | Required | free |
| DELETE | `/api/v1/projects/:id` | Soft delete | Required | free |
| GET | `/api/v1/projects/:id/snapshots` | List snapshots | Required | pro |
| POST | `/api/v1/projects/:id/snapshots` | Create snapshot | Required | pro |
| GET | `/api/v1/projects/compare` | Cross-project comparison | Required | pro |
| POST | `/api/v1/projects/:id/shares` | Share project | Required | enterprise |
| DELETE | `/api/v1/projects/:id/shares/:userId` | Unshare | Required | enterprise |

### 6.2 Scope Extensions for API Keys

API key scopes (from the Cloud spec's `ApiKeyScope` type) are extended:

```typescript
// Added to @sanyam/types/src/api-key.ts

export type ProjectApiKeyScope =
  | 'projects:read'
  | 'projects:write'
  | 'projects:snapshots:read'
  | 'projects:snapshots:write'
  | 'projects:analytics:read';
```

---

## 7. Implementation Plan

All phase estimates assume the Cloud/Auth/Licensing infrastructure is deployed and stable.

### Phase 1: Foundation (4–6 weeks)

**Goal:** Project manifest, creation wizard, single-project lifecycle, document resolver integration.

| Task | Package | Est. |
|------|---------|------|
| Define `ProjectManifest` schema + JSON Schema | `projects-core` | 3d |
| Implement manifest read/write/validate | `projects-core` | 3d |
| Grammar fingerprinting algorithm | `projects-core` | 2d |
| Project lifecycle FSM (draft → active → archived) | `projects-core` | 3d |
| `ModelSourceConfig` with glob + `sanyam://` URI support | `projects-core` | 2d |
| `ProjectDocumentService` wrapping `UnifiedDocumentResolver` | `projects-core` | 2d |
| Extend `@sanyam/licensing` with `ProjectFeatures` constants | `licensing` | 1d |
| Extend `FeatureGate.tierFeatures` to include project features | `licensing` | 1d |
| "New Project" wizard (Theia command + dialog) | `projects-theia` | 5d |
| Project Navigator view (tree widget) | `projects-theia` | 5d |
| Auto-detect `sanyam-project.json` on workspace open | `projects-theia` | 2d |
| Wire project context into Langium language services | `projects-core` | 3d |
| Unit + integration tests | all | 4d |

**Deliverable:** Users can create a project, see it in a navigator, reference both local and cloud models, and the IDE recognizes the grammar binding. Feature gating is wired but only enforced for multi-project (free users get a single project).

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

**Deliverable:** Users can snapshot project state, view metrics dashboards, and export data. Snapshots and analytics are gated to pro tier.

### Phase 3: Cloud Persistence & Cross-Project (4–6 weeks)

**Goal:** Cloud manifest sync, multi-project comparison, cross-project analytics.

| Task | Package | Est. |
|------|---------|------|
| Database migration `004_projects.sql` | supabase | 2d |
| RLS policies for projects, snapshots, shares | supabase | 1d |
| `ProjectCloudSync` — push/pull manifest to Supabase | `projects-core` | 3d |
| Grammar registry (fingerprint → project index) | `projects-analytics` | 3d |
| Cross-project comparison engine | `projects-analytics` | 5d |
| Comparison views (side-by-side dashboards) | `projects-theia` | 5d |
| HTTP routes for project CRUD + snapshots | `language-server` | 3d |
| API key scope extensions for projects | `language-server` | 1d |
| End-to-end integration testing | all | 3d |
| Documentation | all | 3d |

**Deliverable:** Full `@sanyam/projects` package with cloud sync and cross-project analytics. Two projects sharing the same grammar fingerprint compare side-by-side.

### Phase 4: Enterprise & Polish (3–4 weeks)

| Task | Package | Est. |
|------|---------|------|
| Team sharing (project shares via Supabase) | `projects-core` | 3d |
| Project export/import bundles (offline transfer) | `projects-core` | 3d |
| Custom metrics plugin API | `projects-analytics` | 4d |
| REST API for external tooling | `projects-core` | 3d |
| Performance optimization (large projects) | all | 3d |
| Accessibility + UX polish | `projects-theia` | 3d |

---

## 8. Key Design Decisions

### 8.1 Project ≠ Workspace

Projects overlay workspaces — they don't replace them. A Theia workspace can contain zero or more projects. The Project Navigator is an additional view alongside the File Explorer. This preserves backward compatibility: existing workspace-only users see no change until they create their first project.

### 8.2 Grammar Fingerprint as Primary Key

Using content-addressable grammar identity (rather than name or path) makes cross-project comparison robust against renaming, reorganization, and forking. Two independently developed projects that happen to use the same grammar are automatically comparable. The fingerprint is indexed in the Supabase `projects` table for efficient cross-project queries.

### 8.3 Hybrid Storage Model

Projects can reference models from both `file://` and `sanyam://` sources. The `UnifiedDocumentResolver` from `@sanyam/supabase-storage` handles transparent resolution. This means a project can start fully local and incrementally migrate individual models to cloud storage without restructuring.

### 8.4 Offline-First Analytics

All metrics are computed locally and stored in a per-project SQLite database. This means:
- No cloud dependency for core analytics functionality
- Enterprise users maintain data sovereignty
- Cross-project analytics work by querying multiple local databases
- Cloud-persisted snapshots (via `project_snapshots` table) enable cross-device comparison

### 8.5 Single Licensing Authority

There is exactly one licensing package (`@sanyam/licensing`), one `FeatureGate` service, and one source of truth (Supabase `user_profiles.tier`). Projects extends the feature constants but does not introduce a parallel gating mechanism. This eliminates the v1 spec's `@sanyam/projects-licensing` package and the local JWT license file approach.

### 8.6 No License Block in Manifest

The `sanyam-project.json` manifest does not declare what license tier it requires. Feature availability is a runtime concern resolved by querying the authenticated user's tier. This prevents manifests from becoming stale when a user upgrades or downgrades their subscription.

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grammar fingerprint collisions | False comparisons | SHA-256 makes this astronomically unlikely; include grammar file count as secondary check |
| Large projects degrade analytics perf | Poor UX | Incremental metrics computation; cache AST walks; background worker threads |
| Langium 4.x breaking changes | Rework | Pin to Langium 4.x minor; abstract grammar access through adapter layer |
| Cloud spec not stable when Projects starts | Blocked | Projects Phase 1 is local-only and has minimal cloud deps; Phase 3+ requires Cloud Phases 1–2 stable |
| `UnifiedDocumentResolver` doesn't handle `sanyam://` edge cases | Broken hybrid projects | Integration tests with mixed local/cloud model references in Phase 1 |
| Feature constant collisions between Cloud and Project features | Gating errors | Single file (`license-protocol.ts`) owns all feature constants; PR review enforces uniqueness |
| Workspace → Project migration friction | Adoption barrier | One-click "Convert to Project" command; sensible defaults; minimal mandatory config |

---

## 10. Success Criteria

- **Phase 1:** Create project from grammar, navigate artifacts, grammar fingerprint computed correctly, `sanyam://` model references resolve through `UnifiedDocumentResolver`, feature gating blocks second project for free-tier users
- **Phase 2:** Metrics dashboard renders for single project, snapshots capture/restore correctly, pro-tier gating enforced
- **Phase 3:** Cloud manifest push/pull works, two projects with same grammar compare side-by-side, HTTP API returns project data, API key scopes enforce access
- **Phase 4:** Team can share projects via Supabase, external tools query project API, export/import bundles work offline

---

*Document version: 2.0 | February 2026*
*Supersedes: Sanyam Projects v1.0*
*Companion document: Sanyam Unified Cloud Storage, Authentication & Licensing Plan*
