# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanyam IDE is a grammar-agnostic IDE platform built on Eclipse Theia, supporting multiple domain-specific languages via Langium 4.x with both text (LSP) and diagram (GLSP) editing. It targets desktop (Electron) and web (Browser/Docker) deployment.

## Build & Development Commands

```bash
pnpm build                    # Dev build (all packages, via Turborepo)
pnpm build:prod               # Production build
pnpm build:grammars           # Grammar packages only
pnpm build:extensions         # Theia extensions only
pnpm build:language-server    # Language server only
pnpm build:electron           # Electron app + language server
pnpm build:browser            # Browser app + language server

pnpm test                     # Run all tests
pnpm lint                     # ESLint across workspace
pnpm lint:fix                 # Auto-fix lint issues

pnpm watch                    # Watch all packages
pnpm watch:ide                # Watch @sanyam-ide/* extensions only

pnpm start:browser            # Run browser app (port 3002)
pnpm start:electron           # Run Electron dev version
pnpm download:plugins         # Download Theia plugins (required before first run)

pnpm package:applications     # Build desktop installers
```

Grammar packages build with: `langium generate && tsc -b`

## Monorepo Structure

**Workspace layout** (pnpm + Turborepo):
- `packages/` — Core platform packages
- `packages/theia-extensions/` — Theia extension packages (`glsp`, `product`, `updater`, `launcher`)
- `packages/grammar-definitions/` — Langium grammar packages (`@sanyam-grammar/*`)
- `packages/document-store/` — @sanyam/document-store (cloud document storage via Supabase)
- `packages/supabase-auth/` — @sanyam/supabase-auth (authentication with OAuth support)
- `packages/licensing/` — @sanyam/licensing (subscription tier management and feature gating)
- `applications/` — `sanyam-electron` and `sanyam-browser` apps
- `configs/` — Shared tsconfig and eslint configs
- `docs/` — Eleventy documentation site
- `supabase/` — Supabase migrations and seed data

## Architecture

### Dependency Flow

```
@sanyam/types (interfaces only, no implementations)
  ↓
sanyam-language-server (unified LSP/GLSP server)
  ↓
@sanyam-ide/* extensions (Theia frontend integrations)
  ↓
applications (electron, browser)

@sanyam-grammar/* packages → peerDepend on platform, discovered by grammar-scanner
```

### Grammar System

Each grammar package (`packages/grammar-definitions/*/`) contains:
- `src/{language}.langium` — Grammar definition (Langium-generated code in `src-gen/`, never edit)
- `src/manifest.ts` — `GrammarManifest` export
- `src/contribution.ts` — `LanguageContribution` implementation
- Optional `src/diagram/` — Custom diagram views

Grammar packages declare metadata in `package.json` under `"sanyam"` key:
```json
{ "sanyam": { "grammar": true, "languageId": "example-minimal", "fileExtensions": [".exm"] } }
```

The `grammar-scanner` package discovers grammars at build time and registers them in the unified language server.

### DI Pattern

All services use Inversify 6.x dependency injection bound in singleton scope. Services expose interfaces, not implementations. Grammar packages extend platform behavior through registry registrations and DI bindings.

## Key Constraints (from Project Constitution)

- **Grammar agnosticism**: Platform code must NEVER contain grammar-specific values. Grammar knowledge flows only through `GrammarManifest` and registry lookups.
- **Never overwrite Langium-generated code** (`src-gen/` directories).
- **Mermaid diagrams are generated** — fix generation scripts, not the diagram output.
- **No version downgrades** — always update code to work with current versions rather than reverting.
- **No Python** — TypeScript for all tooling.
- **No `any` without justification** — use `unknown` instead.
- **No circular dependencies** between packages.
- **Explicit return types** on all public methods; JSDoc on all public APIs.
- **Commit format**: `type(scope): description` (feat, fix, refactor, docs, test, chore)

## Tech Stack Versions

| Technology | Version |
|------------|---------|
| TypeScript | ~5.6.3 |
| Langium | 4.1.0 |
| Eclipse GLSP | 2.5.0 |
| Eclipse Theia | 1.67.0 |
| Inversify | 6.x |
| Sprotty | 1.4.0 |
| React | 18.x |
| Node | >=20 |
| pnpm | >=9 |
| Supabase JS SDK | 2.x |
| Hono | 4.x |
| Zod | 3.x |

## Specification System

Feature specs live in `.specify/specs/{feature-id}/` with plan, tasks, and contract files. The project constitution at `.specify/memory/constitution.md` governs all development standards.

## Active Technologies
- TypeScript 5.6.3 + Theia 1.67.0, Supabase JS SDK 2.x, Hono 4.x, Inversify 6.x, Zod 3.x (007-cloud-storage-auth-licensing)
- PostgreSQL via Supabase (documents, versions, shares, api_keys, tier_limits tables) (007-cloud-storage-auth-licensing)
- Open Collaboration Tools (OCT) + Yjs for real-time collaboration (007-cloud-storage-auth-licensing)

## Recent Changes
- 007-cloud-storage-auth-licensing: Complete cloud storage, auth, and licensing implementation
  - @sanyam/document-store: Cloud document CRUD, versioning, sharing
  - @sanyam/supabase-auth: OAuth authentication with GitHub, Google, Azure AD
  - @sanyam/licensing: Subscription tier management and feature gating
  - HTTP Gateway: REST API with rate limiting, pagination, error handling
  - Real-time collaboration framework via OCT
  - AutoSave with version consolidation
  - API key management for Pro+ tiers
