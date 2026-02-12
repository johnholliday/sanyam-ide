# Implementation Plan: Cloud Test Infrastructure

**Branch**: `008-cloud-test-infrastructure` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-cloud-test-infrastructure/spec.md`

## Summary

Implement comprehensive Vitest-based test infrastructure for cloud storage, authentication, and licensing packages. The test framework provides:
- Mock Supabase client with query builder chain simulation and error injection
- Per-user RLS isolation for parallel integration test execution
- Database-level tests for RLS policies, triggers, and functions
- Theia API mocks for browser-side jsdom tests
- ContainerTestHarness for inversify DI wiring verification
- CI pipeline with type checking, coverage thresholds, and proper Supabase lifecycle

## Technical Context

**Language/Version**: TypeScript ~5.6.3
**Primary Dependencies**: Vitest 2.x, @vitest/coverage-v8, Supabase JS SDK 2.x, Hono 4.x, Inversify 6.x, Zod 3.x
**Storage**: PostgreSQL via Supabase CLI (local development stack at ports 54321-54326)
**Testing**: Vitest with workspace configuration (vitest.workspace.ts)
**Target Platform**: Node.js (language server, tests), Browser via jsdom (Theia widget tests)
**Project Type**: Monorepo (pnpm 9.x + Turborepo)
**Performance Goals**: Unit tests < 30s, Integration tests < 3min, Full CI < 5min
**Constraints**: 90% line coverage for core packages (types, licensing, document-store), 85% for auth/HTTP
**Scale/Scope**: Test infrastructure for 5 packages (@sanyam/test-utils, @sanyam/document-store, @sanyam/supabase-auth, @sanyam/licensing, sanyam-language-server)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Grammar Agnosticism | ✅ PASS | Test infrastructure is grammar-agnostic; no grammar-specific values in test utils |
| Backward Compatibility | ✅ PASS | Adding new test infrastructure; no existing functionality regresses |
| Declarative Over Imperative | ✅ PASS | Vitest workspace config is declarative (vitest.workspace.ts) |
| Extension Over Modification | ✅ PASS | Test factories and mocks extend platform via DI patterns |
| TypeScript 5.x | ✅ PASS | All test code in TypeScript with strict: true |
| Inversify 6.x | ✅ PASS | ContainerTestHarness uses real inversify for DI wiring tests |
| No Python | ✅ PASS | All tooling in TypeScript |
| No `any` without justification | ✅ PASS | Mocks use proper type inference; unknown for external data |
| No Circular Dependencies | ✅ PASS | test-utils depends on nothing; packages depend on test-utils for testing only |
| Explicit Return Types | ✅ PASS | All public factory/mock methods have explicit return types |
| JSDoc on Public APIs | ✅ PASS | All test-utils exports documented |

## Project Structure

### Documentation (this feature)

```text
specs/008-cloud-test-infrastructure/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (test entities)
├── quickstart.md        # Phase 1 output (developer guide)
├── contracts/           # Phase 1 output (test helper APIs)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/test-utils/
├── src/
│   ├── index.ts                      # Public exports
│   ├── mocks/
│   │   ├── supabase-client.ts        # Mock Supabase client with query builder chain
│   │   ├── supabase-client-offline.ts # Offline/error simulation variant
│   │   ├── theia-services.ts         # MockSecretStorage, MockAuthenticationService, MockCommandRegistry
│   │   └── logging.ts                # Logging capture mock
│   ├── factories/
│   │   ├── document.ts               # buildCreateDocumentRequest, buildDocument
│   │   ├── user.ts                   # createTestUser, cleanupTestUser
│   │   ├── api-key.ts                # buildCreateApiKeyRequest, buildApiKey
│   │   └── user-profile.ts           # buildUserProfile
│   ├── fixtures/
│   │   └── seed.sql                  # Canonical tier_limits seed data
│   ├── harness/
│   │   ├── container-test-harness.ts # Inversify DI wiring test helper
│   │   └── wait-for-healthy.ts       # Health check polling helper
│   ├── setup/
│   │   ├── global-setup.ts           # Supabase availability detection
│   │   ├── global-teardown.ts        # Failsafe cleanup (*@test.com users)
│   │   └── vitest.setup.ts           # Common test setup (env stubs, mocks)
│   └── helpers/
│       ├── stripe-signature.ts       # Webhook signature construction
│       └── test-user-tracking.ts     # Module-level Set for cleanup tracking
├── package.json
├── tsconfig.json
└── README.md                         # Test categorization and parallelization docs

# Vitest workspace configuration at repo root
vitest.workspace.ts                   # Multi-project workspace config
vitest.config.ts                      # Shared base configuration

# Package-level test directories
packages/document-store/
├── tests/
│   ├── unit/
│   │   ├── cloud-document-store.test.ts
│   │   └── uri-parser.test.ts
│   └── integration/
│       ├── document-crud.integration.test.ts
│       ├── document-versions.integration.test.ts
│       ├── document-shares.integration.test.ts
│       └── optimistic-locking.integration.test.ts

packages/supabase-auth/
├── tests/
│   ├── unit/
│   │   ├── credential-manager.test.ts
│   │   └── supabase-client-factory.test.ts
│   └── integration/
│       └── auth-flow.integration.test.ts
├── vitest.setup.ts                   # Theia mock imports

packages/licensing/
├── tests/
│   ├── unit/
│   │   ├── feature-gate.test.ts
│   │   ├── license-validator.test.ts
│   │   ├── tier-downgrade.test.ts
│   │   └── feature-contribution.test.ts
│   └── integration/
│       ├── billing-webhook.integration.test.ts
│       └── tier-limits.integration.test.ts

packages/language-server/
├── tests/
│   ├── unit/
│   │   ├── routes/
│   │   │   ├── documents.test.ts
│   │   │   ├── api-keys.test.ts
│   │   │   ├── shares.test.ts
│   │   │   └── health.test.ts
│   │   ├── middleware/
│   │   │   ├── cors.test.ts
│   │   │   ├── rate-limit.test.ts
│   │   │   └── api-key-auth.test.ts
│   │   └── schemas/
│   │       └── zod-validation.test.ts
│   └── integration/
│       ├── route-feature-gate.integration.test.ts
│       └── user-scoped-client.integration.test.ts

# Database-level tests (serial execution)
supabase/tests/
├── rls-policies.test.ts              # Per-policy isolation tests
├── triggers/
│   ├── auto-profile.test.ts
│   ├── version-retention.test.ts
│   └── storage-usage.test.ts
└── soft-delete.test.ts

# CI configuration
.github/workflows/
└── test.yml                          # Type-check → Unit → Integration pipeline

# Repository root documentation
TESTING.md                            # Test naming conventions, categorization
```

**Structure Decision**: Monorepo with per-package test directories following `tests/unit/` and `tests/integration/` convention. Shared test utilities in dedicated `@sanyam/test-utils` package. Database tests co-located with Supabase migrations in `supabase/tests/`.

## Complexity Tracking

No constitution violations requiring justification. Test infrastructure follows existing patterns.

## Phase 0: Research Summary

No NEEDS CLARIFICATION markers remain in the specification. All technical decisions are resolved:

1. **Test Framework**: Vitest with workspace configuration (confirmed via CLAUDE.md tech stack)
2. **Mock Strategy**: Chain-able Supabase mock with error simulation mode
3. **Isolation Strategy**: Per-user RLS isolation as default; serial execution for schema-modifying tests
4. **Coverage Provider**: @vitest/coverage-v8 with package-level thresholds
5. **CI Pipeline**: tsc --noEmit → unit tests → integration tests with Supabase lifecycle
6. **Theia Mocks**: Type-safe implementations of SecretStorage, AuthenticationService, CommandRegistry
7. **Health Check**: GET /health endpoint with waitForHealthy() polling helper

## Phase 1: Design Artifacts

The following artifacts will be generated:

1. **data-model.md**: Test entity definitions (TestUser, MockSupabaseClient, ContainerTestHarness)
2. **contracts/test-utils-api.ts**: TypeScript interface definitions for all test-utils exports
3. **quickstart.md**: Developer guide for running tests and adding new test cases
