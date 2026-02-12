# Implementation Plan: Unified Cloud Storage, Authentication & Licensing

**Branch**: `007-cloud-storage-auth-licensing` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-cloud-storage-auth-licensing/spec.md`

## Summary

This implementation adds cloud document storage, user authentication via Supabase Auth, and tiered subscription licensing to Sanyam IDE. The technical approach uses Supabase (PostgreSQL + Auth) as the backend, with new packages `@sanyam/document-store`, `@sanyam/supabase-auth`, and `@sanyam/licensing` integrating into the existing Theia-based IDE. The HTTP gateway (Hono) already has auth/licensing middleware stubs that will be extended.

## Technical Context

**Language/Version**: TypeScript 5.6.3
**Primary Dependencies**: Theia 1.67.0, Supabase JS SDK 2.x, Hono 4.x, Inversify 6.x, Zod 3.x
**Storage**: PostgreSQL via Supabase (documents, versions, shares, api_keys, tier_limits tables)
**Testing**: Vitest (unit), Playwright (e2e), Supabase local for integration
**Target Platform**: Browser (Theia web), Desktop (Electron), Node.js (language server)
**Project Type**: Monorepo with pnpm workspaces + Turborepo
**Performance Goals**: Sign-in <30s, document save <3s, list <2s, 10k concurrent users (from SC-001 to SC-005)
**Constraints**: 5-min in-memory cache TTL, no offline write queue, no binary assets (Phases 1-4)
**Scale/Scope**: Free tier: 5 docs/10MB, Pro: 100 docs/1GB, Enterprise: unlimited

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Grammar Agnosticism | PASS | Cloud storage is document-agnostic; no grammar-specific code in platform packages |
| Backward Compatibility | PASS | New packages; existing functionality unaffected; local file editing unchanged |
| Declarative Over Imperative | PASS | Tier limits defined in database table; feature flags in tier_limits |
| Extension Over Modification | PASS | New packages extend platform via DI; existing code modified minimally |
| TypeScript 5.x | PASS | Project already uses 5.6.3 |
| No Python | PASS | All tooling in TypeScript |
| No `any` without justification | PASS | Will use `unknown` and proper typing |
| No circular dependencies | PASS | Clear dependency hierarchy: types → store/auth/licensing → theia-extensions |
| Services injectable via Inversify | PASS | All new services will be injectable singletons |
| Explicit return types | PASS | Required by constitution |
| JSDoc on public APIs | PASS | Required by constitution |

**Pre-design Gate**: PASSED - No violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-cloud-storage-auth-licensing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── types/                          # @sanyam/types (existing - extend with TierLimits, FeatureRegistration)
│   └── src/
│       ├── tier-limits.ts          # NEW: TierLimits interface
│       ├── feature-registration.ts # NEW: FeatureRegistration interface
│       └── operation-user.ts       # EXISTING: extend with tier
│
├── document-store/                 # @sanyam/document-store (NEW PACKAGE)
│   ├── src/
│   │   ├── index.ts
│   │   ├── supabase-client-factory.ts
│   │   ├── cloud-document-store.ts
│   │   ├── unified-document-resolver.ts
│   │   ├── document-cache.ts
│   │   └── types.ts
│   └── package.json
│
├── supabase-auth/                  # @sanyam/supabase-auth (NEW PACKAGE)
│   ├── src/
│   │   ├── index.ts
│   │   ├── supabase-auth-provider.ts     # Theia AuthenticationProvider
│   │   ├── auth-session-storage.ts       # SecretStorage wrapper
│   │   ├── oauth-handler.ts              # OAuth flow (desktop vs browser)
│   │   └── auth-state-emitter.ts         # Observable auth state
│   └── package.json
│
├── licensing/                      # @sanyam/licensing (NEW PACKAGE)
│   ├── src/
│   │   ├── index.ts
│   │   ├── feature-gate.ts               # FeatureGate implementation
│   │   ├── license-validator.ts          # Cached tier_limits fetcher
│   │   ├── feature-contribution.ts       # Multi-bind contribution pattern
│   │   └── commands/
│   │       └── refresh-license-command.ts
│   └── package.json
│
├── language-server/                # sanyam-language-server (EXISTING - extend)
│   └── src/
│       └── http/
│           ├── middleware/
│           │   ├── auth.ts               # EXTEND: RLS-aware user-scoped clients
│           │   ├── licensing.ts          # EXTEND: FeatureGate integration
│           │   ├── rate-limit.ts         # NEW: Tier-based rate limiting
│           │   └── cors.ts               # NEW: CORS configuration
│           └── routes/
│               ├── documents.ts          # NEW: /api/v1/documents CRUD
│               ├── versions.ts           # NEW: /api/v1/documents/:id/versions
│               ├── shares.ts             # NEW: /api/v1/documents/:id/shares
│               ├── api-keys.ts           # NEW: /api/v1/api-keys
│               └── webhooks/
│                   └── billing.ts        # NEW: Stripe webhook stub
│
└── theia-extensions/
    └── product/                    # @sanyam-ide/product (EXISTING - extend)
        └── src/
            └── browser/
                ├── cloud/
                │   ├── cloud-status-bar.ts        # NEW: Auth status widget
                │   ├── save-to-cloud-command.ts   # NEW
                │   ├── open-cloud-document.ts     # NEW
                │   └── subscription-panel.ts      # NEW: Tier display
                └── collaboration/
                    └── live-session-command.ts    # NEW: OCT integration

supabase/
├── migrations/
│   └── 001_documents.sql           # Schema: documents, versions, shares, api_keys, tier_limits, user_profiles
└── seed.sql                        # Seed tier_limits with free/pro/enterprise defaults
```

**Structure Decision**: Extends existing monorepo with 3 new packages under `packages/`. Cloud storage features are platform-level (not grammar-specific), so they belong in `packages/` not `packages/grammar-definitions/`. The HTTP API extensions go in the existing `language-server` package since that's where the Hono server lives.

## Complexity Tracking

> No violations require justification. All new packages follow existing patterns.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| 3 new packages | Justified | Clear separation: storage (data), auth (identity), licensing (access control) |
| PostgreSQL over Supabase Storage | Justified | DSL documents are text; PostgreSQL text/JSONB is simpler than blob storage |
| In-memory cache only | Justified | Avoids offline sync complexity; documents are small; acceptable latency |

## Phase 0: Research Topics

The following topics require research before proceeding to Phase 1 design:

1. **Supabase Auth + Theia Integration**: How to implement `AuthenticationProvider` for Theia that works with Supabase OAuth (GitHub, Google, Azure AD) in both browser and Electron contexts
2. **Theia SecretStorage API**: Best practices for persisting access/refresh tokens encrypted per-user
3. **Row-Level Security (RLS) Patterns**: How to create per-request user-scoped Supabase clients for defense-in-depth
4. **OCT Integration**: How to integrate Open Collaboration Tools for real-time collaboration sessions
5. **Hono Rate Limiting**: Best practices for tier-based rate limiting in Hono middleware
6. **Cursor-Based Pagination**: Standard patterns for opaque cursor pagination with PostgreSQL

## Phase 1: Design Deliverables

After research, Phase 1 will produce:

1. **data-model.md**: Complete PostgreSQL schema for documents, versions, shares, api_keys, tier_limits, user_profiles
2. **contracts/documents.yaml**: OpenAPI 3.1 spec for /api/v1/documents endpoints
3. **contracts/auth.yaml**: OpenAPI 3.1 spec for authentication flows
4. **contracts/api-keys.yaml**: OpenAPI 3.1 spec for API key management
5. **quickstart.md**: Developer setup guide for local Supabase and environment configuration

## Dependencies

### New npm Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | ^2.x | Supabase client SDK |
| @supabase/auth-helpers-shared | ^0.x | Auth helper utilities |
| @hono/zod-validator | ^0.x | Request validation |
| zod | ^3.x | Schema validation |
| @open-collaboration-tools/yjs | ^0.x | Real-time collaboration |

### External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Supabase | Auth + PostgreSQL | SUPABASE_URL, SUPABASE_ANON_KEY |
| OCT Server | Real-time collaboration | Open Collaboration Tools public server |
| Stripe | Billing webhooks (stub) | STRIPE_WEBHOOK_SECRET |

## Environment Variables

```bash
# Supabase (required for cloud features)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, never in browser

# Auth providers (optional, discovered dynamically)
SANYAM_AUTH_PROVIDERS=github,google,azure-ad
SANYAM_OAUTH_PROVIDERS=github,google,azure-ad

# CORS (required in production)
SANYAM_CORS_ORIGIN=https://app.sanyam.dev

# Defaults
SANYAM_DEFAULT_TIER=free
SANYAM_AUTH_MODE=supabase

# Billing (stub)
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase SDK breaking changes | Medium | Pin to specific minor version |
| OAuth redirect complexity (desktop vs browser) | Medium | Research Phase 0; well-documented patterns exist |
| OCT server availability | Low | Use public server; fallback to async-only sharing |
| Rate limiting accuracy | Low | Tier fetched per-request at gateway; no caching |

## Next Steps

1. Run Phase 0 research to produce `research.md`
2. Generate `data-model.md` with complete PostgreSQL schema
3. Generate OpenAPI contracts in `contracts/`
4. Generate `quickstart.md` for developer setup
5. Run `/speckit.tasks` to generate implementation tasks
