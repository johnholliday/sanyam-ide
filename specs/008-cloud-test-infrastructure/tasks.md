# Tasks: Cloud Test Infrastructure

**Input**: Design documents from `/specs/008-cloud-test-infrastructure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature IS about test infrastructure, so test files are the primary deliverables.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/test-utils/`, per-package `tests/` directories
- **Database tests**: `supabase/tests/`
- **CI**: `.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create @sanyam/test-utils package and configure Vitest workspace

- [X] T001 Create @sanyam/test-utils package structure with package.json, tsconfig.json in packages/test-utils/
- [X] T002 Create Vitest workspace configuration in vitest.workspace.ts at repo root
- [X] T003 [P] Create shared Vitest base configuration in vitest.config.ts at repo root
- [X] T004 [P] Add npm scripts to root package.json: test:unit, test:integration, test:coverage, test:db
- [X] T005 [P] Create packages/test-utils/src/index.ts with placeholder exports
- [X] T006 [P] Add @vitest/coverage-v8 dependency to root package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Mock Supabase Client

- [X] T007 Implement MockQueryBuilder class with fluent chain API (select, eq, insert, etc.) in packages/test-utils/src/mocks/supabase-client.ts
- [X] T008 Implement createMockSupabaseClient() factory with data store and error injection in packages/test-utils/src/mocks/supabase-client.ts
- [X] T009 [P] Implement createMockSupabaseClientOffline() factory in packages/test-utils/src/mocks/supabase-client.ts (combined with T007-T008)
- [X] T010 [P] Add QueryLogEntry tracking to MockSupabaseClient for verification in packages/test-utils/src/mocks/supabase-client.ts

### Test User Management

- [X] T011 Implement test-user-tracking.ts with module-level Set for user ID tracking in packages/test-utils/src/setup/test-user.ts
- [X] T012 Implement createTestUser() factory that creates auth user and sets tier in packages/test-utils/src/setup/test-user.ts
- [X] T013 Implement cleanupTestUser() that deletes user data via cascade in packages/test-utils/src/setup/test-user.ts

### Theia Mocks

- [X] T014 [P] Implement MockSecretStorage with in-memory Map in packages/test-utils/src/mocks/secret-storage.ts
- [X] T015 [P] Implement MockAuthenticationService capturing provider registrations in packages/test-utils/src/mocks/authentication-service.ts
- [X] T016 [P] Implement MockCommandRegistry capturing command registrations in packages/test-utils/src/mocks/command-registry.ts

### Logging Mock

- [X] T017 Implement LoggingMock with console spy methods in packages/test-utils/src/mocks/logging-mock.ts

### Container Test Harness

- [X] T018 Implement ContainerTestHarness with inversify Container builder in packages/test-utils/src/harness/container-harness.ts

### Seed Data

- [X] T019 Create seed.sql with canonical tier_limits rows (free/pro/enterprise) in packages/test-utils/src/fixtures/seed.sql

### Health Endpoint (Required for Global Setup)

- [X] T020 Implement GET /health endpoint in language server (FR-188-189) in packages/language-server/src/http/routes/health.ts
- [X] T021 Add health route registration in Hono app in packages/language-server/src/http/server.ts (already registered)

### Global Setup/Teardown

- [X] T022 Implement global-setup.ts with Supabase availability detection via /health endpoint (depends on T020-T021) in packages/test-utils/src/setup/global-setup.ts
- [X] T023 Implement global-teardown.ts with failsafe cleanup of *@test.com users in packages/test-utils/src/setup/global-setup.ts (combined into global-setup via teardown return)
- [ ] T024 [P] Create vitest.setup.ts with common test utilities in packages/test-utils/src/setup/vitest.setup.ts

### Health Check Helper

- [X] T025 Implement waitForHealthy() with exponential backoff polling in packages/test-utils/src/helpers/health-check.ts

### Export All Utilities

- [X] T026 Update packages/test-utils/src/index.ts to export all mocks, factories, harnesses, and helpers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run Unit Tests Locally (Priority: P1) 🎯 MVP

**Goal**: Developers can run `pnpm test:unit` on a fresh clone with no external dependencies

**Independent Test**: Run `pnpm test:unit` without Docker, Supabase, or network access

### Test Factories for US1

- [X] T027 [P] [US1] Implement buildCreateDocumentRequest() factory in packages/test-utils/src/factories/document-factory.ts
- [X] T028 [P] [US1] Implement buildDocument() factory in packages/test-utils/src/factories/document-factory.ts
- [X] T029 [P] [US1] Implement buildCreateApiKeyRequest() factory in packages/test-utils/src/factories/api-key-factory.ts
- [X] T030 [P] [US1] Implement buildApiKey() factory in packages/test-utils/src/factories/api-key-factory.ts
- [X] T031 [P] [US1] Implement buildUserProfile() factory in packages/test-utils/src/factories/user-profile-factory.ts

### Unit Tests: @sanyam/licensing

- [ ] T032 [P] [US1] Create feature-gate.test.ts with DB-sourced feature flag tests (FR-081, FR-082) in packages/licensing/tests/unit/feature-gate.test.ts
- [ ] T033 [P] [US1] Create license-validator.test.ts with cache timing tests using vi.useFakeTimers() (FR-098-101) in packages/licensing/tests/unit/license-validator.test.ts
- [ ] T034 [P] [US1] Create tier-downgrade.test.ts with degradation policy tests (FR-093-096) in packages/licensing/tests/unit/tier-downgrade.test.ts
- [ ] T035 [P] [US1] Create feature-contribution.test.ts with extensibility tests (FR-103-107) in packages/licensing/tests/unit/feature-contribution.test.ts
- [ ] T036 [P] [US1] Create tier-limits.test.ts with getTierLimits() numeric column tests (FR-085-087) in packages/licensing/tests/unit/tier-limits.test.ts
- [ ] T037 [P] [US1] Create unknown-tier.test.ts with defensive tier handling tests (FR-111-114) in packages/licensing/tests/unit/unknown-tier.test.ts

### Unit Tests: @sanyam/supabase-auth

- [ ] T038 [P] [US1] Create credential-manager.test.ts with env var validation tests (FR-064-069) in packages/supabase-auth/tests/unit/credential-manager.test.ts
- [ ] T039 [P] [US1] Create supabase-client-factory.test.ts with client creation tests in packages/supabase-auth/tests/unit/supabase-client-factory.test.ts
- [ ] T040 [P] [US1] Create vitest.setup.ts importing Theia mocks for supabase-auth package in packages/supabase-auth/vitest.setup.ts

### Unit Tests: @sanyam/document-store

- [ ] T041 [P] [US1] Create cloud-document-store.test.ts with CRUD operation tests in packages/document-store/tests/unit/cloud-document-store.test.ts
- [ ] T042 [P] [US1] Create uri-parser.test.ts with edge case tests (FR-146-153) in packages/document-store/tests/unit/uri-parser.test.ts

### Unit Tests: sanyam-language-server Routes

- [ ] T043 [P] [US1] Create documents.test.ts with route tests in packages/language-server/tests/unit/routes/documents.test.ts
- [ ] T044 [P] [US1] Create api-keys.test.ts with API key edge case tests (FR-154-160) in packages/language-server/tests/unit/routes/api-keys.test.ts
- [ ] T045 [P] [US1] Create shares.test.ts with feature-gate wiring tests (FR-115-119) in packages/language-server/tests/unit/routes/shares.test.ts
- [ ] T046 [P] [US1] Create health.test.ts with health endpoint tests (FR-188-190) in packages/language-server/tests/unit/routes/health.test.ts

### Unit Tests: sanyam-language-server Middleware

- [ ] T047 [P] [US1] Create cors.test.ts with CORS tests including prod security (FR-161-165) in packages/language-server/tests/unit/middleware/cors.test.ts
- [ ] T048 [P] [US1] Create rate-limit.test.ts with sliding window tests in packages/language-server/tests/unit/middleware/rate-limit.test.ts
- [ ] T049 [P] [US1] Create api-key-auth.test.ts with auth middleware tests in packages/language-server/tests/unit/middleware/api-key-auth.test.ts

### Unit Tests: Zod Schemas

- [ ] T050 [US1] Create zod-validation.test.ts with schema contract tests (FR-166-172) in packages/language-server/tests/unit/schemas/zod-validation.test.ts

### Unit Tests: Theia Commands

- [ ] T051 [US1] Create save-to-cloud-command.test.ts with Theia mock tests (FR-173-178) in packages/theia-extensions/product/tests/unit/save-to-cloud-command.test.ts

### Logging Assertion Tests

- [ ] T052 [US1] Create logging-assertions.test.ts with warning/error log tests (FR-179-183) in packages/test-utils/tests/unit/logging-assertions.test.ts

### Snapshot Tests

- [ ] T053 [US1] Create response-snapshots.test.ts with inline snapshots for error/pagination envelopes (FR-017-020) in packages/language-server/tests/unit/response-snapshots.test.ts

### Container Wiring Tests

- [ ] T054 [US1] Create container-wiring.test.ts with DI permutation tests (FR-039-041, FR-089-092) in packages/test-utils/tests/unit/container-wiring.test.ts

**Checkpoint**: User Story 1 complete - `pnpm test:unit` works on fresh clone

---

## Phase 4: User Story 2 - Run Integration Tests Against Local Supabase (Priority: P2)

**Goal**: Developers can run `supabase start && pnpm test:integration` for real database testing

**Independent Test**: Run `supabase start && pnpm test:integration && supabase stop`

### Integration Test Infrastructure

- [ ] T055 [US2] Configure workspace integration test project with 15s timeout in vitest.workspace.ts
- [ ] T056 [US2] Create Supabase availability skip logic in global-setup.ts (FR-022-024)

### Integration Tests: @sanyam/document-store

- [ ] T057 [P] [US2] Create document-crud.integration.test.ts with real Supabase CRUD tests in packages/document-store/tests/integration/document-crud.integration.test.ts
- [ ] T058 [P] [US2] Create document-versions.integration.test.ts with versioning tests in packages/document-store/tests/integration/document-versions.integration.test.ts
- [ ] T059 [P] [US2] Create document-shares.integration.test.ts with sharing tests in packages/document-store/tests/integration/document-shares.integration.test.ts
- [ ] T060 [P] [US2] Create optimistic-locking.integration.test.ts with concurrent PUT tests (FR-042-044) in packages/document-store/tests/integration/optimistic-locking.integration.test.ts

### Integration Tests: @sanyam/licensing

- [ ] T061 [P] [US2] Create billing-webhook.integration.test.ts with full chain tests (FR-108-110) in packages/licensing/tests/integration/billing-webhook.integration.test.ts
- [ ] T062 [P] [US2] Create tier-limits.integration.test.ts with seed data verification (FR-088) in packages/licensing/tests/integration/tier-limits.integration.test.ts
- [ ] T063 [P] [US2] Create tier-downgrade.integration.test.ts with real degradation tests (FR-097) in packages/licensing/tests/integration/tier-downgrade.integration.test.ts
- [ ] T064 [P] [US2] Create feature-gate-db.integration.test.ts with DB source-of-truth tests (FR-083-084) in packages/licensing/tests/integration/feature-gate-db.integration.test.ts

### Integration Tests: sanyam-language-server

- [ ] T065 [P] [US2] Create route-feature-gate.integration.test.ts with HTTP-to-licensing wiring (FR-115-119) in packages/language-server/tests/integration/route-feature-gate.integration.test.ts
- [ ] T066 [P] [US2] Create user-scoped-client.integration.test.ts with RLS defense-in-depth tests (FR-120-123) in packages/language-server/tests/integration/user-scoped-client.integration.test.ts
- [ ] T067 [P] [US2] Create rate-limit.integration.test.ts with sliding window tests (FR-070-074) in packages/language-server/tests/integration/rate-limit.integration.test.ts
- [ ] T068 [P] [US2] Create soft-delete.integration.test.ts with lifecycle tests (FR-128-132) in packages/language-server/tests/integration/soft-delete.integration.test.ts

### Graceful Degradation Tests

- [ ] T069 [P] [US2] Create graceful-degradation.integration.test.ts with Mode A/B tests (FR-045-049) in packages/supabase-auth/tests/integration/graceful-degradation.integration.test.ts

### Stripe Webhook Signature Helper

- [X] T070 [US2] Implement constructStripeSignature() helper (FR-063) in packages/test-utils/src/helpers/stripe-signature.ts

### HTTP Gateway Tier Resolution Tests

- [ ] T071 [US2] Create gateway-tier-resolution.integration.test.ts with per-request lookup tests (FR-102) in packages/language-server/tests/integration/gateway-tier-resolution.integration.test.ts

**Checkpoint**: User Story 2 complete - `pnpm test:integration` works with local Supabase

---

## Phase 5: User Story 3 - Validate Database Schema Correctness (Priority: P2)

**Goal**: Database tests verify RLS policies, triggers, and functions work correctly

**Independent Test**: Run database tests against local Supabase independently of application code

### Database Test Directory

- [ ] T072 [US3] Create supabase/tests/ directory structure with triggers/ subdirectory

### RLS Policy Tests

- [ ] T073 [US3] Create rls-policies.test.ts with per-policy isolation tests (FR-015-016) in supabase/tests/rls-policies.test.ts

### Trigger Tests

- [ ] T074 [P] [US3] Create auto-profile.test.ts with user_profiles trigger tests (FR-136-139) in supabase/tests/triggers/auto-profile.test.ts
- [ ] T075 [P] [US3] Create version-retention.test.ts with max_versions trigger tests (FR-124-127) in supabase/tests/triggers/version-retention.test.ts
- [ ] T076 [P] [US3] Create storage-usage.test.ts with total_storage_bytes trigger tests (FR-140-145) in supabase/tests/triggers/storage-usage.test.ts

### Soft Delete Database Tests

- [ ] T077 [US3] Create soft-delete.test.ts with cascade-preservation tests (FR-133-135) in supabase/tests/soft-delete.test.ts

### Configure Serial Execution

- [ ] T078 [US3] Configure database tests for serial execution with `{ sequence: { concurrent: false } }` in vitest.workspace.ts

**Checkpoint**: User Story 3 complete - database schema correctness verified

---

## Phase 6: User Story 4 - Use Test Factories for Consistent Test Data (Priority: P3)

**Goal**: Test factories reduce boilerplate and ensure consistent test data

**Independent Test**: Import factories and verify they produce valid data structures

### Factory Tests

- [X] T079 [P] [US4] Create document-factory.test.ts with factory validation tests in packages/test-utils/tests/unit/factories/document-factory.test.ts
- [ ] T080 [P] [US4] Create user-factory.test.ts with createTestUser/cleanupTestUser tests in packages/test-utils/tests/unit/factories/user-factory.test.ts
- [ ] T081 [P] [US4] Create api-key-factory.test.ts with factory validation tests in packages/test-utils/tests/unit/factories/api-key-factory.test.ts
- [ ] T082 [P] [US4] Create user-profile-factory.test.ts with factory validation tests in packages/test-utils/tests/unit/factories/user-profile-factory.test.ts

### Mock Supabase Client Tests

- [X] T083 [US4] Create supabase-client-mock.test.ts with query builder chain tests in packages/test-utils/tests/unit/mocks/supabase-client.test.ts

### Theia Mock Tests

- [X] T084 [US4] Create theia-mocks.test.ts with interface compliance tests in packages/test-utils/tests/unit/mocks/theia-mocks.test.ts

### Container Harness Tests

- [X] T085 [US4] Create container-harness.test.ts with DI wiring verification tests in packages/test-utils/tests/unit/harness/container-harness.test.ts

**Checkpoint**: User Story 4 complete - test factories are fully tested

---

## Phase 7: User Story 5 - Run Full Test Suite in CI (Priority: P3)

**Goal**: CI pipeline runs all tests with proper lifecycle management

**Independent Test**: Trigger CI run and verify all stages execute correctly

### CI Workflow

- [ ] T086 [US5] Create test.yml GitHub workflow with type-check → unit → integration jobs in .github/workflows/test.yml
- [ ] T087 [US5] Configure type-check job with `tsc --noEmit` gating test jobs (FR-184-187) in .github/workflows/test.yml
- [ ] T088 [US5] Configure Supabase lifecycle in CI (start, migrations, seed, tests, stop) in .github/workflows/test.yml
- [ ] T089 [US5] Configure coverage thresholds per package (90% core, 85% auth/HTTP) in vitest.workspace.ts (FR-054-058)

### Timeout Configuration

- [ ] T090 [US5] Configure per-project timeouts (5s unit, 15s integration, 10s db) in vitest.workspace.ts (FR-050-053)
- [ ] T091 [US5] Configure global 5-minute suite timeout via --bail in vitest.workspace.ts (FR-051)

### Ensure Strict TypeScript

- [ ] T092 [US5] Verify all package tsconfig.json files include strict: true (FR-186)

**Checkpoint**: User Story 5 complete - CI pipeline fully functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and improvements that affect multiple user stories

### Documentation

- [ ] T093 [P] Create TESTING.md at repository root documenting naming conventions (FR-075-080)
- [ ] T094 [P] Create README.md for @sanyam/test-utils with parallelization docs (FR-028) in packages/test-utils/README.md

### Hard Deletion Placeholder

- [ ] T095 Create hard-deletion.test.ts placeholder with skipped tests (FR-135) in supabase/tests/hard-deletion.test.ts

### Final Validation

- [ ] T096 Run full test suite locally and verify all tests pass
- [ ] T097 Verify coverage thresholds are met for all packages
- [ ] T098 Run quickstart.md validation to confirm developer experience

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - **Note**: T020-T021 (health endpoint) must complete before T022 (global-setup.ts)
- **US1 (Phase 3)**: Depends on Foundational - can start immediately after Phase 2
- **US2 (Phase 4)**: Depends on Foundational - can run in parallel with US1 if staffed
- **US3 (Phase 5)**: Depends on Foundational - can run in parallel with US1/US2 if staffed
- **US4 (Phase 6)**: Depends on US1 factories being implemented
- **US5 (Phase 7)**: Depends on US1, US2, US3 for complete test coverage
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational - No dependencies on other stories
- **US2 (P2)**: Can start after Foundational - Uses factories from US1
- **US3 (P2)**: Can start after Foundational - Independent of US1/US2
- **US4 (P3)**: Tests the factories implemented in US1/US2
- **US5 (P3)**: Integrates all test types from US1/US2/US3

### Within Each User Story

- Test factories before test files that use them
- Mock implementations before tests that use them
- Configuration before tests that depend on it

### Parallel Opportunities

- All tasks marked [P] within a phase can run in parallel
- Once Foundational completes, US1/US2/US3 can start in parallel
- Different test files for different packages can be developed in parallel

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all mock implementations together:
Task T007: "Implement MockQueryBuilder class"
Task T014: "Implement MockSecretStorage"
Task T015: "Implement MockAuthenticationService"
Task T016: "Implement MockCommandRegistry"
Task T017: "Implement LoggingMock"

# Then launch health endpoint (required for global-setup):
Task T020: "Implement GET /health endpoint"
Task T021: "Add health route registration"

# Then launch global setup/teardown:
Task T022: "Implement global-setup.ts"
Task T023: "Implement global-teardown.ts"
Task T024: "Create vitest.setup.ts"
```

---

## Parallel Example: User Story 1 Unit Tests

```bash
# Launch all licensing unit tests together:
Task T032: "Create feature-gate.test.ts"
Task T033: "Create license-validator.test.ts"
Task T034: "Create tier-downgrade.test.ts"
Task T035: "Create feature-contribution.test.ts"
Task T036: "Create tier-limits.test.ts"
Task T037: "Create unknown-tier.test.ts"

# Launch all route unit tests together:
Task T043: "Create documents.test.ts"
Task T044: "Create api-keys.test.ts"
Task T045: "Create shares.test.ts"
Task T046: "Create health.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `pnpm test:unit` on fresh clone
5. Developers can now get fast feedback on changes

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Unit tests work (MVP!)
3. Add User Story 2 → Test independently → Integration tests work
4. Add User Story 3 → Test independently → Database tests work
5. Add User Story 4 → Test independently → Factories verified
6. Add User Story 5 → Test independently → CI pipeline works
7. Each story adds capability without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (unit tests)
   - Developer B: User Story 2 (integration tests)
   - Developer C: User Story 3 (database tests)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- FR-XXX references map to spec.md Functional Requirements
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests targeting the same package/module should NOT have [P] if they share test state
