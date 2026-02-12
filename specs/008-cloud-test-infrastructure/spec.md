# Feature Specification: Cloud Test Infrastructure

**Feature Branch**: `008-cloud-test-infrastructure`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "Implement comprehensive Vitest-based test infrastructure for cloud storage, authentication, and licensing packages"

## Clarifications

### Session 2026-02-12

- Q: What database reset strategy should be used for integration tests? → A: Per-user RLS isolation (Option B) as default. Tests modifying shared schema-level objects (tier_limits, RLS policies, triggers, functions) use dedicated serial test files with beforeAll/afterAll state restoration, marked with `test.sequential` or custom pool config to prevent concurrent execution.
- Q: How should snapshot testing be used? → A: Vitest inline snapshots for three structural contracts only: (a) error response envelope (code, message, details), (b) pagination envelope (next_cursor, prev_cursor, total_count), (c) Zod validation error details. No snapshots for data-dependent responses. Snapshots live alongside unit tests, updated via `vitest --update` with PR diff review.
- Q: When should Pact-style contract testing be introduced? → A: Deferred until Phase 3 API key routes are stable and at least one external consumer exists. Interim: use Vitest snapshot tests on OpenAPI-compatible route response shapes. When introduced, contract tests run as separate non-blocking CI job.
- Q: How should integration tests handle missing Supabase? → A: Global setup file pings http://127.0.0.1:54321/rest/v1/ before suite starts. If unreachable, skip integration/database tests with message "Skipping integration tests — local Supabase not running. Run 'supabase start' first." Unit tests never skipped.
- Q: How should tier_limits reference data be managed in tests? → A: Test seed file at packages/test-utils/src/fixtures/seed.sql with canonical free/pro/enterprise rows. Applied after migrations in CI and by global setup locally. Tests MUST NOT modify tier_limits rows; mock at FeatureGate/LicenseValidator level for non-standard limits.
- Q: Which tests are safe to run concurrently? → A: Unit tests (fully mocked) and RLS-isolated integration tests (unique users per describe block) run concurrently. Tests using admin/service-role client to modify shared state (RLS policies, triggers) must be serialized in single file per concern with `{ sequence: { concurrent: false } }` config. Document in test-utils README.
- Q: How should error paths and offline scenarios be tested? → A: Extend createMockSupabaseClient with error simulation via `{ errors: { tableName: { code, message } } }` option. Add createMockSupabaseClientOffline() that rejects all calls with network error for testing graceful degradation and isOnline flag. Required for mid-session degradation integration tests.
- Q: How should Theia browser APIs be mocked for jsdom tests? → A: Create mocks at packages/test-utils/src/mocks/theia-services.ts with MockSecretStorage (in-memory Map), MockAuthenticationService (records provider registrations, exposes provider), MockCommandRegistry (captures commands). Implement Theia interfaces for type safety. Import via vitest.setup.ts in supabase-auth package.
- Q: How should test data cleanup handle crashes and orphaned data? → A: createTestUser registers user ID in module-level Set. cleanupTestUser(user) deletes user's data via foreign key cascade then deletes auth user. Global afterAll hook calls failsafe that deletes all auth users with *@test.com emails, catching stragglers from crashed runs.
- Q: How should inversify container assembly be tested with different module combinations? → A: ContainerTestHarness accepts ContainerModule list, builds real inversify Container, asserts binding availability. Test permutations: (a) no cloud modules → no cloud bindings, (b) unconfigured → CredentialManager.isConfigured()=false, (c) free-tier → FeatureGate bound/sharing gated, (d) pro-tier → all pro features. Uses real inversify + mocked Supabase to verify DI wiring.
- Q: How should concurrent optimistic locking be tested in integration tests? → A: Within a single test, create a document, then issue two parallel PUT requests (via Promise.all) with the same If-Match version. Exactly one returns 200, the other returns 409. Verify the successful write's content is persisted and the failed write's content is not. This tests PostgreSQL's actual row-level locking behavior, not just application-level If-Match checks.
- Q: What distinct failure modes must graceful degradation tests cover? → A: Two modes: (a) Supabase never configured (env vars absent) — cloud commands hidden, no startup errors, local features work; (b) Supabase configured but becomes unreachable mid-session — test by starting with working connection, creating document, simulating network failure, then verifying status bar shows offline, cloud commands disabled, local editing continues, no unhandled promise rejections or error toasts. Mode (b) uses createMockSupabaseClientOffline() helper.
- Q: What timeout values should be configured in Vitest? → A: Unit tests: 5s (Vitest default). Integration tests: 15s (Supabase round-trips, user creation, JWT minting latency). Database tests: 10s. Global suite timeout (--bail): 5 minutes to abort entire run. Set via workspace-level vitest.workspace.ts with project-specific config overrides. Individual tests needing more time (e.g., rate limit window expiry) can override with test.timeout() but MUST include explanatory comment.
- Q: How should coverage thresholds be enforced? → A: Use @vitest/coverage-v8 provider. Configure coverage.thresholds.perFile = false (enforce at package level, not per-file). Set package-specific thresholds matching Success Criteria (90% line for core packages, 85% for auth/HTTP). CI runs `pnpm test:coverage` and fails build if any package drops below threshold. Exclude test-utils and fixture files via coverage.exclude patterns.
- Q: How should the billing webhook stub be tested? → A: POST to /api/v1/webhooks/billing with mock Stripe event payload (type: 'customer.subscription.updated') signed using test-only STRIPE_WEBHOOK_SECRET. Stub handler: (a) verifies signature via Stripe's webhook verification library, (b) extracts customer email and new tier, (c) updates user_profiles.tier, (d) returns 200. Test verifies FeatureGate.isFeatureEnabled() reflects new tier after cache invalidation. Construct signature manually using Stripe's algorithm (timestamp + payload HMAC).
- Q: How should CredentialManager handle partial/malformed env var configurations? → A: Unit tests verify: (a) SUPABASE_URL set but SUPABASE_ANON_KEY missing → isConfigured()=false, (b) SUPABASE_ANON_KEY set but SUPABASE_URL missing → isConfigured()=false, (c) both set but SUPABASE_URL invalid → isConfigured()=false with logged warning, (d) SANYAM_ENTERPRISE_MODE=true but SUPABASE_SERVICE_KEY missing → createAdminClient() throws descriptive error, (e) SANYAM_DEFAULT_TIER invalid value → fallback to 'free' with logged warning. Use vi.stubEnv()/vi.unstubAllEnvs() for per-test isolation.
- Q: How should rate limit integration tests verify sliding window behavior? → A: Add SANYAM_RATE_LIMIT_OVERRIDE env var that overrides tier-based limit with low value (e.g., 3/min) for testing. Test sets override, sends 4 requests, verifies 4th returns 429 with correct X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers. Override only respected when SANYAM_AUTH_REQUIRED=false (dev mode) to prevent production abuse.
- Q: What test naming conventions should be used across all packages? → A: Files: {module-name}.test.ts (unit), {module-name}.integration.test.ts (integration). Describe blocks: class/function name as top-level. Test names: "should {behavior} when {condition}" pattern. Nested describes by method name. Tier-specific integration tests: describe('ClassName (pro tier)', ...). Document in TESTING.md at repo root.
- Q: How should tests verify FeatureGate reads from DB rather than hardcoded mappings? → A: Unit test: mock tier_limits row with has_document_sharing=true for free tier (normally false), verify FeatureGate.isFeatureEnabled('document-sharing') returns true. Integration test: modify tier_limits boolean column via admin client, invalidate cache, verify FeatureGate reflects change without redeployment. This confirms DB is source of truth, not TypeScript code.
- Q: How should getTierLimits() numeric columns be tested? → A: Unit tests verify complete TierLimits object with all numeric columns (max_documents, max_storage_bytes, max_document_size_bytes, max_versions_per_document, version_retention_days, trash_retention_days, api_rate_limit_per_hour). Test free-tier limits match seed values. Test getTierLimits() returns free-tier defaults when unauthenticated. Integration test confirms returned values match tier_limits seed data exactly to catch seed drift.
- Q: What happens when Supabase is configured but licensing module is absent? → A: Cloud features available with free-tier limits enforced at HTTP gateway. ContainerTestHarness tests: (a) build container without licensing module → FeatureGate not bound, (b) verify Hono middleware still enforces free-tier limits by reading tier_limits directly, (c) verify SupabaseStorageBackendModule binds CloudDocumentStore (not LocalOnlyDocumentStore) when Supabase configured regardless of licensing, (d) LocalOnlyDocumentStore only activates when Supabase itself is unconfigured.
- Q: How should tier downgrade policies be tested? → A: Unit tests on FeatureGate or TierDowngradeHandler verify: (a) user with 15 documents downgrades pro → free (limit lower) → existing docs remain readable but new creation blocked with descriptive error, (b) existing document_shares remain active but shareDocument() rejects new shares, (c) document versioning trigger skips snapshot creation when user lacks DOCUMENT_VERSIONING but existing versions remain queryable, (d) API keys have revoked_at set when user drops below tier granting API_KEYS. Integration test: create pro-tier user with documents + shares + API key, downgrade tier via admin client to free, verify all four degradation behaviors against real Supabase.
- Q: How should LicenseValidator cache timing be tested? → A: Use vi.useFakeTimers() for cache timing tests: (a) call isFeatureEnabled() twice within 15 minutes → assert mock called exactly once (cache hit), (b) advance timers by 15 minutes then call again → assert mock called twice (cache expired), (c) call invalidateCache() then isFeatureEnabled() → assert immediate re-fetch regardless of TTL. HTTP gateway must NOT cache tier resolution — each request calls Supabase per-user client; test by changing DB tier between two sequential requests and verifying different feature availability returned.
- Q: How should FeatureContribution extensibility be tested? → A: Unit tests verify: (a) @sanyam/licensing registers base features (CLOUD_STORAGE, CLOUD_AUTH, DOCUMENT_SHARING, DOCUMENT_VERSIONING, API_KEYS) at minimum tiers, (b) downstream package (simulated as @sanyam/projects-core) registers additional features (MULTI_PROJECT at pro, TEAM_SHARING at enterprise) via registerFeature() or multi-bound FeatureContribution, (c) FeatureGate.isFeatureEnabled('multi-project') returns false for free-tier and true for pro-tier after registration, (d) duplicate featureId with conflicting tier throws error (fail-fast), (e) late registration (after first isFeatureEnabled() call) still works. Tests verify extensibility without modifying @sanyam/licensing source.
- Q: How should the complete billing-to-FeatureGate chain be tested? → A: Integration test steps: (a) create free-tier user, (b) verify FeatureGate.isFeatureEnabled('document-sharing') returns false, (c) POST to /api/v1/webhooks/billing with signed Stripe event payload (user's email + 'pro' tier), (d) verify webhook returns 200, (e) call LicenseValidator.invalidateCache() (simulating webhook handler's post-update hook), (f) verify FeatureGate.isFeatureEnabled('document-sharing') now returns true. This tests the full chain: webhook → DB update → cache invalidation → gate resolution. Separately, signature verification test: send unsigned or incorrectly signed payload and verify 401 Unauthorized.
- Q: How should trial tier and unknown tier values be handled? → A: If trials deferred: test FeatureGate handles unknown tier string (e.g., 'trial') gracefully by defaulting to free-tier limits and logging a warning — do not throw. Mock LicenseValidator.getCurrentTier() to return 'trial', verify free-tier behavior. If trials implemented: test (a) trial grants same features as pro, (b) FeatureGate checks trial_expires_at from user_profiles, (c) unexpired trial → pro access, (d) expired trial → free access, (e) downgrade degradation policies apply on expiry. Either way: subscription_tier enum MUST be handled defensively — any unknown value defaults to free without crashing.
- Q: How should the Hono route-to-FeatureGate wiring be tested? → A: Route-level unit tests inject mocked FeatureGate into Hono app context and verify: (a) POST /api/v1/documents/:id/shares with free-tier gate → 403 with code FEATURE_NOT_AVAILABLE and message naming required tier, (b) same request with pro-tier gate → 200, (c) POST /api/v1/api-keys with free-tier gate → 403, (d) 403 response body includes upgrade_url field pointing to `https://sanyam.dev/pricing`. Tests verify HTTP-to-licensing wiring, not just each layer independently.
- Q: How should routes be tested to verify they use per-request user-scoped clients? → A: Defense-in-depth integration tests: create Alice and Bob users. Alice creates a document. Issue GET /api/v1/documents/:id with Bob's JWT. If route correctly uses user-scoped client with RLS: Bob gets 404 (RLS filters). If route incorrectly uses admin client: Bob gets 200 — test fails. Repeat for PUT (expect 404) and DELETE (expect 404). Distinct from database-level RLS tests (policy isolation). These verify the application layer passes user context to Supabase client so RLS engages.
- Q: How should the version retention trigger be tested? → A: Database-level tests: (a) create free-tier user (max_versions=10), create document, update 12 times, count document_versions rows → expect exactly 10 with oldest 2 deleted, (b) create pro-tier user (max_versions=100), update 12 times → all 12 remain. Critical: verify trigger looks up document OWNER's tier, not session user — test by having a shared user with edit permission trigger an update on owner's document; version limit must follow owner's tier, not editor's.
- Q: How should the soft delete lifecycle be tested? → A: Integration tests: (a) DELETE document → deleted_at set, excluded from GET /api/v1/documents list, (b) GET /api/v1/documents/:id still returns document with deleted_at field (owner only, for restore), (c) POST /api/v1/documents/:id/restore clears deleted_at → document reappears in list, (d) restore rejects free-tier users if pro+ feature, (e) shared user cannot restore document they did not own. Database test: verify document_shares and document_versions rows NOT cascade-deleted on soft delete (must survive for restore). Hard deletion out of scope for Phases 1-4: add placeholder test file with skipped test describing expected cleanup behavior.
- Q: How should the auto-create profile trigger be tested? → A: Database test: when supabase.auth.admin.createUser() called, verify user_profiles row exists with tier=SANYAM_DEFAULT_TIER (default: 'free'), organization_id=null, total_storage_bytes=0. Test both default case and override case (set SANYAM_DEFAULT_TIER='pro', verify new users get pro). This trigger is foundational — if it fails silently, user_profiles queries return null and licensing layer breaks with opaque errors.
- Q: How should storage usage tracking triggers be tested? → A: Integration tests: (a) create document with known content size → total_storage_bytes equals byte length, (b) update with longer content → total_storage_bytes reflects new size (replaces, not additive), (c) create second document → total_storage_bytes is sum of both, (d) soft-delete one → total_storage_bytes decrements, (e) restore deleted → total_storage_bytes re-increments. Edge case: if calculation would produce negative value, trigger must clamp to 0 rather than storing negative.
- Q: What URI edge cases should extractDocumentId() and UnifiedDocumentResolver tests cover? → A: Unit tests: (a) `sanyam://UPPERCASE-UUID` → normalize to lowercase, (b) `?version=0` → reject (versions 1-indexed), (c) `?version=-1` → reject, (d) `?version=abc` → reject non-integer, (e) `#fragment` → ignore fragment, extract UUID, (f) `/{uuid}/assets/diagram.svg` → "not yet supported" error (reserved path), (g) `sanyam://` with no UUID → reject with descriptive error, (h) `?version=3&extra=param` → ignore unknown params, extract version, (i) `{not-a-uuid}` → reject with invalid UUID error. Protects URI contract as surface area grows.
- Q: What API key edge cases need dedicated tests? → A: (a) revoked key → 401 API_KEY_REVOKED (not generic auth failure), (b) expired key → 401 API_KEY_EXPIRED, (c) empty scopes array → rejected (at least one scope required), (d) invalid scope string → Zod validation reject, (e) key secret returned only by POST, never by GET (only prefix visible), (f) verify bcrypt hash stored (not plaintext) — raw key must not match stored value, (g) API keys cannot create other API keys → POST /api/v1/api-keys with ApiKey auth returns 403.
- Q: What CORS middleware tests are needed? → A: (a) OPTIONS request → 204 with Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers, (b) Access-Control-Expose-Headers includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag, (c) SANYAM_CORS_ORIGIN set to specific domain → reject other origins, (d) SANYAM_CORS_ORIGIN unset: defaults to '*' in dev (SANYAM_AUTH_REQUIRED=false), rejects all origins in prod (SANYAM_AUTH_REQUIRED=true). Critical: prod default MUST NOT be '*' — wildcard in production is a security vulnerability.
- Q: What Zod schema validation tests are needed? → A: For each schema (CreateDocumentRequest, UpdateDocumentRequest, ListDocumentsQuery, CreateApiKeyRequest): (a) valid payload passes, (b) each required field missing individually → 400 with field name in error, (c) wrong type → 400, (d) extra/unknown fields stripped (not rejected) for forward compatibility, (e) max length constraints reject oversized input, (f) languageId accepts only valid Langium identifiers (alphanumeric + hyphens). These tests serve as schema contract — catch breaking changes before reaching consumers.
- Q: How should the "Sanyam: Save to Cloud" command be tested? → A: Unit tests with mocked Theia editor/workspace services: (a) reads current editor's file:// URI content, (b) calls CloudDocumentStore.createDocument() with content + languageId inferred from file extension, (c) on success, updates editor tab URI from file:// to sanyam://{new-id}, (d) original local file NOT deleted (user may want both), (e) command hidden (not disabled) when unauthenticated or Supabase unconfigured, (f) rejects with descriptive message when document exceeds max_document_size_bytes tier limit.
- Q: How should logging assertions be handled across tests? → A: Add shared logging mock to @sanyam/test-utils capturing calls by level (debug, info, warn, error). Use vi.spyOn(console, 'warn') or inject structured logger via DI. Assert: (a) CredentialManager logs warning for invalid SUPABASE_URL, (b) FeatureGate logs warning for unknown tier value, (c) version retention trigger logs when deleting old versions (not silent), (d) no error-level logs during normal startup with valid config. Logging assertions prevent silent failures going undetected in production.
- Q: Should CI run type checking before Vitest tests? → A: Yes, add pre-test CI step running `tsc --noEmit` across all packages before any Vitest tests. Runs as separate job gating unit + integration jobs. Required because Vitest's esbuild strips types without checking — this catches: (a) union type updates (FeatureGate consuming LicenseFeature | ProjectFeature), (b) TierLimits interface drift vs tier_limits columns, (c) incorrect inversify @inject() token types that fail at runtime. All package tsconfig.json files must include strict: true.
- Q: Should the Hono gateway have a health check endpoint? → A: Yes, add GET /health (no auth) returning `{ status: 'ok', supabase: boolean, auth: boolean, version: string }`. supabase = SupabaseCredentialManager.isConfigured(), auth = at least one auth provider available, version from package.json. Add unit test for response shape. Add waitForHealthy() helper in test-utils that polls /health with exponential backoff. Replaces fragile Supabase ping check in global setup with single readiness endpoint covering entire gateway.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Unit Tests Locally (Priority: P1)

A developer working on cloud infrastructure packages needs to run fast, reliable unit tests that execute without external dependencies. They run `pnpm test:unit` and receive immediate feedback on whether their changes break existing functionality.

**Why this priority**: Unit tests are the foundation of developer productivity. Without fast local feedback, development velocity drops significantly. This must work before any other testing capability.

**Independent Test**: Can be fully tested by running `pnpm test:unit` on a fresh clone with no Docker or external services, and delivers immediate pass/fail feedback for all unit-testable code.

**Acceptance Scenarios**:

1. **Given** a developer has cloned the repository, **When** they run `pnpm test:unit`, **Then** all unit tests execute without requiring Docker, Supabase, or network access
2. **Given** a developer modifies a function in `@sanyam/licensing`, **When** they run unit tests, **Then** they see pass/fail results in under 30 seconds
3. **Given** a test file uses the mock Supabase client, **When** the test runs, **Then** the mock accurately simulates the Supabase query builder chain pattern

---

### User Story 2 - Run Integration Tests Against Local Supabase (Priority: P2)

A developer needs to verify that their code works correctly against a real database with RLS policies, triggers, and functions. They start local Supabase, run `pnpm test:integration`, and see results that reflect production-like behavior.

**Why this priority**: Integration tests catch issues that unit tests miss - RLS policy bugs, trigger failures, and real database interactions. Essential before any deployment.

**Independent Test**: Can be tested by running `supabase start && pnpm test:integration && supabase stop` and verifies real database round-trips.

**Acceptance Scenarios**:

1. **Given** local Supabase is running, **When** a developer runs integration tests, **Then** tests execute against real PostgreSQL with RLS policies enforced
2. **Given** multiple test suites run in parallel, **When** they create test users and documents, **Then** tests do not interfere with each other due to RLS isolation
3. **Given** a test creates data, **When** the test suite completes, **Then** all test data is cleaned up without affecting other suites

---

### User Story 3 - Validate Database Schema Correctness (Priority: P2)

A developer modifying database migrations, RLS policies, or triggers needs to verify their changes work correctly. They run database-specific tests that directly execute SQL against local PostgreSQL.

**Why this priority**: Database bugs (RLS bypasses, broken triggers) cause data leaks and corruption. Database tests are critical for security and data integrity.

**Independent Test**: Can be tested by running database tests against local Supabase and verifies RLS policies, triggers, and functions independently of application code.

**Acceptance Scenarios**:

1. **Given** a RLS policy restricts document access to owners, **When** User A queries User B's documents, **Then** the query returns zero rows
2. **Given** a document is updated, **When** the update commits, **Then** the version snapshot trigger creates a new version row
3. **Given** a new user signs up, **When** authentication completes, **Then** the auto-profile trigger creates a user_profiles row with free tier

---

### User Story 4 - Use Test Factories for Consistent Test Data (Priority: P3)

A developer writing tests needs to create test documents, users, and API keys without writing boilerplate. They import factories from `@sanyam/test-utils` and generate valid test entities with sensible defaults.

**Why this priority**: Test factories reduce boilerplate and ensure consistent test data. Improves test maintainability and readability.

**Independent Test**: Can be tested by importing factories and generating entities, verifying they produce valid data structures.

**Acceptance Scenarios**:

1. **Given** a test needs a document, **When** calling `buildCreateDocumentRequest()`, **Then** it returns a valid request object with unique identifiers
2. **Given** a test needs multiple users, **When** calling `createTestUser()` twice, **Then** each user has unique credentials and isolated data access
3. **Given** a test overrides a factory default, **When** the entity is created, **Then** the override is applied while other defaults remain

---

### User Story 5 - Run Full Test Suite in CI (Priority: P3)

The CI pipeline needs to run all tests (unit, integration, database) in sequence with proper setup and teardown. A PR cannot merge unless all tests pass.

**Why this priority**: CI enforcement ensures no regressions reach main. Without automated gates, quality degrades over time.

**Independent Test**: Can be tested by triggering a CI run and verifying all test stages execute in order with proper Supabase lifecycle management.

**Acceptance Scenarios**:

1. **Given** a PR is opened, **When** CI runs, **Then** unit tests run first without Supabase
2. **Given** unit tests pass, **When** integration tests start, **Then** Supabase is started and migrations are applied
3. **Given** all tests pass, **When** CI completes, **Then** Supabase is stopped and the pipeline reports success
4. **Given** any test fails, **When** CI completes, **Then** the pipeline reports failure and blocks merge

---

### Edge Cases

- What happens when Supabase local is not running but integration tests are invoked? Global setup pings Supabase endpoint; if unreachable, integration/database tests are skipped (not failed) with actionable console message. Unit tests always run.
- What happens when test cleanup fails mid-suite or test crashes? Global afterAll failsafe deletes all `*@test.com` auth users, catching orphaned data. RLS isolation prevents interference during the run; failsafe prevents pollution across runs.
- What happens when a test needs non-standard tier limits? Tests MUST NOT modify tier_limits rows. Instead, mock at FeatureGate/LicenseValidator level. Shared reference data remains immutable during test runs.
- What happens when the CI Supabase container fails to start? CI should fail fast with actionable error rather than timing out.
- What happens when Supabase was never configured (env vars absent)? Mode A graceful degradation: cloud commands hidden, no errors on startup, all local features work normally. Test via ContainerTestHarness with unconfigured modules.
- What happens when Supabase becomes unreachable mid-session (after successful authentication)? Mode B graceful degradation: SupabaseClientFactory detects failed connection, sets isOnline flag to false, status bar reflects offline state, cloud commands disabled while local editing continues. Test by simulating network failure mid-test; verify no unhandled promise rejections or error toasts. Uses createMockSupabaseClientOffline() helper.
- What happens when two clients attempt to update the same document simultaneously? Test via parallel PUT requests with identical If-Match versions; PostgreSQL row-level locking ensures exactly one succeeds (200) while the other fails (409 Conflict). The failed client must retry with the fresh version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Vitest workspace configuration that discovers tests across all cloud packages
- **FR-002**: System MUST provide a `@sanyam/test-utils` package with mock Supabase client, test factories, and helper functions
- **FR-003**: System MUST support running unit tests without any external dependencies (Docker, network, databases)
- **FR-004**: System MUST support running integration tests against local Supabase CLI development stack
- **FR-005**: System MUST provide database-level tests for RLS policies, triggers, and functions
- **FR-006**: System MUST provide npm scripts for common test operations (`test:unit`, `test:integration`, `test:coverage`)
- **FR-007**: System MUST use per-user RLS isolation as the default test isolation strategy for all integration tests
- **FR-008**: System MUST provide test factories for documents, users, API keys, and user profiles
- **FR-009**: System MUST provide helper functions for creating authenticated test users with specific tiers
- **FR-010**: System MUST provide per-user cleanup via `cleanupTestUser(user)` that deletes all user-owned data via foreign key cascade then deletes the auth user
- **FR-011**: System MUST support jsdom environment for browser-side Theia service tests
- **FR-012**: System MUST support parallel test execution for independent test suites
- **FR-013**: System MUST provide Theia API mocks at packages/test-utils/src/mocks/theia-services.ts implementing Theia interfaces for type-safe compilation
- **FR-014**: System MUST provide a CI workflow that runs unit tests, then integration tests with Supabase lifecycle management
- **FR-015**: Database tests that verify RLS policies, triggers, and functions MUST run in dedicated serial test files with beforeAll/afterAll state restoration where needed
- **FR-016**: Tests using admin/service-role client to modify shared state MUST be placed in single file per concern (e.g., database/rls-policies.test.ts) with `{ sequence: { concurrent: false } }` Vitest config or `test.sequential` API
- **FR-017**: System MUST use Vitest inline snapshots to verify structural contracts for: error response envelope (code, message, details fields), pagination envelope (next_cursor, prev_cursor, total_count fields), and Zod validation error details
- **FR-018**: System MUST NOT use snapshot testing for data-dependent responses (document content, user profiles, dynamic timestamps)
- **FR-019**: Snapshot tests MUST be co-located with unit tests for the relevant module, not in separate snapshot directories
- **FR-020**: System MUST use Vitest snapshot tests on OpenAPI-compatible route response shapes as lightweight contract verification until external consumers exist
- **FR-021**: When Pact-style contract tests are introduced (post-Phase 3), they MUST run as a separate CI job that does not block the main test pipeline
- **FR-022**: System MUST provide a global setup file that detects local Supabase availability by pinging `http://127.0.0.1:54321/rest/v1/` before integration tests start
- **FR-023**: When local Supabase is unreachable, system MUST skip all integration and database tests with console message: "Skipping integration tests — local Supabase not running. Run 'supabase start' first."
- **FR-024**: Unit tests MUST never be skipped regardless of Supabase availability
- **FR-025**: System MUST provide a test seed file (packages/test-utils/src/fixtures/seed.sql) with canonical free/pro/enterprise tier_limits rows
- **FR-026**: Test seed file MUST be applied after migrations in CI (supabase db push && psql -f seed.sql) and by global setup locally
- **FR-027**: Tests MUST NOT modify tier_limits rows; tests requiring non-standard limits MUST mock at FeatureGate or LicenseValidator level
- **FR-028**: Test-utils README MUST document which test categories are safe to parallelize (unit, RLS-isolated integration) vs. must be serialized (admin/service-role shared-state tests)
- **FR-029**: Mock Supabase client MUST support error simulation mode via `createMockSupabaseClient({ errors: { tableName: { code, message } } })` returning `{ data: null, error: { code, message } }` for specified tables
- **FR-030**: System MUST provide `createMockSupabaseClientOffline()` factory that rejects all calls with network error for testing graceful degradation
- **FR-031**: Offline mock MUST support testing mid-session degradation scenarios where Supabase becomes unreachable after successful connection
- **FR-032**: System MUST provide MockSecretStorage backed by in-memory Map with get/set/delete methods matching Theia SecretStorage interface
- **FR-033**: System MUST provide MockAuthenticationService that records registerAuthenticationProvider calls and exposes registered provider for direct test invocation
- **FR-034**: System MUST provide MockCommandRegistry that captures registered commands for verification in tests
- **FR-035**: Supabase-auth package MUST use vitest.setup.ts to import and configure Theia mocks before test execution
- **FR-036**: `createTestUser()` MUST register created user ID in module-level Set for tracking
- **FR-037**: System MUST provide global afterAll hook with failsafe cleanup that deletes all auth users with emails matching `*@test.com` pattern to catch stragglers from crashed test runs
- **FR-038**: Test users MUST use `@test.com` email domain to enable failsafe pattern-based cleanup
- **FR-039**: System MUST provide ContainerTestHarness in test-utils that accepts ContainerModule list, builds real inversify Container, and asserts on binding availability
- **FR-040**: ContainerTestHarness tests MUST verify: (a) no cloud modules → CloudDocumentStore/FeatureGate not bound, (b) supabase-core unconfigured → CredentialManager.isConfigured() returns false, (c) full stack + free-tier → FeatureGate bound + document-sharing gated, (d) full stack + pro-tier → all pro features available
- **FR-041**: Container wiring tests MUST use real inversify with mocked Supabase to verify DI assembly logic, not service behavior
- **FR-042**: System MUST provide integration tests for concurrent optimistic locking that issue parallel PUT requests (via Promise.all) with identical If-Match versions against a single document
- **FR-043**: Concurrent optimistic locking tests MUST verify exactly one request returns 200 and the other returns 409 Conflict
- **FR-044**: Concurrent optimistic locking tests MUST verify the successful write's content is persisted and the failed write's content is not, confirming PostgreSQL row-level locking behavior
- **FR-045**: Graceful degradation tests MUST cover Mode A (unconfigured): when Supabase env vars are absent, cloud commands are hidden, no errors on startup, and all local features work normally
- **FR-046**: Graceful degradation tests MUST cover Mode B (mid-session failure): tests start with working Supabase connection, create a document successfully, then simulate network failure
- **FR-047**: Mode B tests MUST simulate network failure by pointing client at invalid URL or stopping local Supabase mid-test
- **FR-048**: Mode B tests MUST verify: (a) status bar reflects offline state, (b) cloud commands are disabled, (c) local file editing continues working, (d) no unhandled promise rejections emitted, (e) no error toasts displayed
- **FR-049**: Mode B mid-session degradation tests MUST use the createMockSupabaseClientOffline() helper for unit-level verification
- **FR-050**: Vitest workspace configuration MUST set per-project timeout values: unit tests 5 seconds, integration tests 15 seconds, database tests 10 seconds
- **FR-051**: Global test suite MUST abort after 5 minutes total runtime via --bail or equivalent configuration
- **FR-052**: Timeout values MUST be configured in workspace-level vitest.workspace.ts via project-specific config overrides
- **FR-053**: Individual tests requiring extended timeout (e.g., rate limit window expiry tests) MAY override with test.timeout() but MUST include a comment explaining why the extended timeout is necessary
- **FR-054**: System MUST use @vitest/coverage-v8 as the coverage provider
- **FR-055**: Coverage configuration MUST set thresholds.perFile = false to enforce at package level, not per-file
- **FR-056**: Coverage thresholds MUST match Success Criteria: 90% line coverage for core packages (types, licensing, document-store), 85% for auth and HTTP packages
- **FR-057**: CI pipeline MUST run `pnpm test:coverage` and fail the build if any package drops below its configured threshold
- **FR-058**: Coverage configuration MUST exclude test-utils package and fixture files via coverage.exclude patterns
- **FR-059**: Billing webhook integration tests MUST POST to /api/v1/webhooks/billing with mock Stripe event payload (type: 'customer.subscription.updated')
- **FR-060**: Billing webhook test payloads MUST be signed using test-only STRIPE_WEBHOOK_SECRET env var with Stripe's signing algorithm (timestamp + payload HMAC)
- **FR-061**: Billing webhook stub handler MUST: (a) verify signature via Stripe's webhook verification library, (b) extract customer email and new tier from event, (c) update user_profiles.tier, (d) return 200
- **FR-062**: Billing webhook tests MUST verify that FeatureGate.isFeatureEnabled() reflects the new tier after cache invalidation
- **FR-063**: Test-utils MUST provide a helper function to construct valid Stripe webhook signatures for testing
- **FR-064**: CredentialManager unit tests MUST verify: SUPABASE_URL set but SUPABASE_ANON_KEY missing → isConfigured() returns false
- **FR-065**: CredentialManager unit tests MUST verify: SUPABASE_ANON_KEY set but SUPABASE_URL missing → isConfigured() returns false
- **FR-066**: CredentialManager unit tests MUST verify: both env vars set but SUPABASE_URL is not a valid URL → isConfigured() returns false with logged warning
- **FR-067**: CredentialManager unit tests MUST verify: SANYAM_ENTERPRISE_MODE=true but SUPABASE_SERVICE_KEY missing → createAdminClient() throws descriptive error
- **FR-068**: CredentialManager unit tests MUST verify: SANYAM_DEFAULT_TIER set to invalid value → falls back to 'free' with logged warning
- **FR-069**: CredentialManager env var tests MUST use vi.stubEnv() to set environment variables per test and vi.unstubAllEnvs() in afterEach for isolation
- **FR-070**: System MUST support SANYAM_RATE_LIMIT_OVERRIDE env var that overrides tier-based rate limits with a configurable low value (e.g., 3 requests per minute) for testing
- **FR-071**: SANYAM_RATE_LIMIT_OVERRIDE MUST only be respected when SANYAM_AUTH_REQUIRED=false (development mode) to prevent abuse in production
- **FR-072**: Rate limit integration tests MUST set the override, send requests exceeding the limit, and verify the final request returns 429
- **FR-073**: Rate limit integration tests MUST verify correct X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset response headers
- **FR-074**: Rate limit tests MUST verify actual sliding window behavior against the middleware, not mocked responses
- **FR-075**: Test file naming MUST follow pattern: {module-name}.test.ts for unit tests, {module-name}.integration.test.ts for integration tests
- **FR-076**: Top-level describe blocks MUST use the class or function name being tested
- **FR-077**: Test names MUST follow pattern: "should {expected behavior} when {condition}" (e.g., "should return 409 when If-Match version is stale")
- **FR-078**: Related tests MUST be grouped with nested describe blocks by method name
- **FR-079**: Integration tests requiring specific tier setup MUST include tier in describe block: describe('ClassName (pro tier)', ...)
- **FR-080**: A TESTING.md file MUST be created at repository root documenting all test naming conventions for contributors
- **FR-081**: FeatureGate unit tests MUST verify that feature flags (has_cloud_storage, has_document_sharing, has_document_versioning, has_api_keys) are read from tier_limits DB rows, not hardcoded TypeScript mappings
- **FR-082**: FeatureGate unit tests MUST mock a tier_limits row with atypical values (e.g., has_document_sharing=true for free tier) and verify isFeatureEnabled() returns the mocked value
- **FR-083**: FeatureGate integration tests MUST modify a tier_limits boolean column via admin client, invalidate cache, and verify the FeatureGate reflects the change without redeployment
- **FR-084**: These tests confirm the database is the single source of truth for feature availability, enabling runtime feature flag changes
- **FR-085**: getTierLimits() unit tests MUST verify the complete TierLimits object is returned with all numeric columns: max_documents, max_storage_bytes, max_document_size_bytes, max_versions_per_document, version_retention_days, trash_retention_days, api_rate_limit_per_hour
- **FR-086**: getTierLimits() unit tests MUST verify free-tier limits match seed values (e.g., max_document_size_bytes = 262144, max_documents = 5)
- **FR-087**: getTierLimits() unit tests MUST verify free-tier defaults are returned when user is unauthenticated
- **FR-088**: getTierLimits() integration tests MUST confirm returned values match tier_limits table seed data exactly to catch any seed data drift
- **FR-089**: ContainerTestHarness tests MUST verify: when licensing module is absent but Supabase is configured, FeatureGate is not bound but cloud features remain available
- **FR-090**: Conditional loading tests MUST verify Hono middleware enforces free-tier limits by reading tier_limits directly when licensing module is absent
- **FR-091**: Conditional loading tests MUST verify SupabaseStorageBackendModule binds CloudDocumentStore (not LocalOnlyDocumentStore) when Supabase is configured, regardless of licensing module presence
- **FR-092**: Conditional loading tests MUST verify LocalOnlyDocumentStore is bound ONLY when Supabase itself is unconfigured (env vars absent)
- **FR-093**: Tier downgrade unit tests MUST verify: when a user with 15 documents (exceeds free-tier limit) downgrades from pro to free, existing documents remain readable via getDocument() but createDocument() fails with descriptive error indicating the document limit is exceeded
- **FR-094**: Tier downgrade unit tests MUST verify: when a user downgrades from pro to free, existing document_shares remain active and queryable but shareDocument() rejects new share creation with error indicating the feature is not available for the user's tier
- **FR-095**: Tier downgrade unit tests MUST verify: when a user lacks DOCUMENT_VERSIONING feature (e.g., free tier), the document versioning trigger skips snapshot creation on document updates but existing version rows remain queryable via getDocumentVersions()
- **FR-096**: Tier downgrade unit tests MUST verify: when a user downgrades to a tier that does not grant API_KEYS feature, all active api_keys for that user have revoked_at set to current timestamp
- **FR-097**: Tier downgrade integration tests MUST: (a) create a pro-tier user, (b) create multiple documents, document_shares, and an API key, (c) downgrade user's tier to free via admin client, (d) verify all four degradation behaviors (documents over-limit readable, new shares blocked, versioning skipped, API keys revoked) against real Supabase
- **FR-098**: LicenseValidator cache timing unit tests MUST use Vitest vi.useFakeTimers() to control time progression for deterministic cache behavior testing
- **FR-099**: Cache timing tests MUST verify: calling isFeatureEnabled() twice within 15 minutes results in the mock Supabase client being called exactly once (second call is a cache hit)
- **FR-100**: Cache timing tests MUST verify: advancing timers by 15 minutes with `vi.advanceTimersByTime(15 * 60 * 1000)` then calling isFeatureEnabled() results in the mock being called twice total (cache expired, re-fetch triggered)
- **FR-101**: Cache timing tests MUST verify: calling invalidateCache() followed by isFeatureEnabled() triggers an immediate re-fetch regardless of TTL (mock called even if within 15-minute window)
- **FR-102**: HTTP gateway tier resolution tests MUST verify that each HTTP request calls Supabase for per-user tier lookup (no server-side caching); test by changing user's tier in DB between two sequential requests and verifying different feature availability is returned
- **FR-103**: FeatureContribution unit tests MUST verify that @sanyam/licensing registers base features (CLOUD_STORAGE, CLOUD_AUTH, DOCUMENT_SHARING, DOCUMENT_VERSIONING, API_KEYS) at their respective minimum tiers during module initialization
- **FR-104**: FeatureContribution unit tests MUST verify that downstream packages can register additional features (e.g., MULTI_PROJECT at pro tier, TEAM_SHARING at enterprise tier) via registerFeature() or multi-bound FeatureContribution without modifying @sanyam/licensing source
- **FR-105**: FeatureContribution unit tests MUST verify that FeatureGate.isFeatureEnabled('multi-project') returns false for free-tier users and true for pro-tier users after the downstream package registers the feature
- **FR-106**: FeatureContribution unit tests MUST verify that registering a duplicate featureId with a conflicting tier throws an error (fail-fast behavior to catch configuration mistakes early)
- **FR-107**: FeatureContribution unit tests MUST verify that late registration (registering a feature after the first isFeatureEnabled() call) still works correctly for subsequent feature checks
- **FR-108**: Billing-to-FeatureGate integration tests MUST verify the complete propagation chain: (a) create free-tier user, (b) verify FeatureGate.isFeatureEnabled('document-sharing') returns false, (c) POST signed Stripe webhook with user's email and 'pro' tier, (d) verify 200 response, (e) call LicenseValidator.invalidateCache(), (f) verify FeatureGate.isFeatureEnabled('document-sharing') now returns true
- **FR-109**: Billing webhook integration tests MUST verify the full chain: webhook receipt → user_profiles.tier DB update → cache invalidation → correct FeatureGate resolution, all in a single test without mocking intermediate steps
- **FR-110**: Billing webhook signature verification tests MUST verify that unsigned or incorrectly signed Stripe payloads return 401 Unauthorized and do not modify user_profiles
- **FR-111**: Unknown tier handling unit tests MUST verify that FeatureGate handles an unrecognized tier string (e.g., 'trial' when trials are deferred) by defaulting to free-tier limits and logging a warning — MUST NOT throw an exception
- **FR-112**: Unknown tier handling unit tests MUST mock LicenseValidator.getCurrentTier() to return an unknown value and verify all feature checks resolve to free-tier behavior
- **FR-113**: If trials are implemented: unit tests MUST verify (a) trial tier grants same features as pro, (b) FeatureGate reads trial_expires_at from user_profiles, (c) unexpired trial returns pro-level access, (d) expired trial returns free-level access, (e) tier downgrade degradation policies apply when trial expires
- **FR-114**: Subscription tier enum handling MUST be tested defensively: any tier value not in the known set (free, pro, enterprise, trial if implemented) MUST default to free without crashing, with a logged warning
- **FR-115**: Route-level unit tests MUST inject a mocked FeatureGate into the Hono app context to test HTTP-to-licensing layer wiring
- **FR-116**: Route-level tests MUST verify: POST /api/v1/documents/:id/shares with free-tier FeatureGate returns 403 with error code FEATURE_NOT_AVAILABLE and message naming the required tier (e.g., "Document sharing requires Pro tier")
- **FR-117**: Route-level tests MUST verify: POST /api/v1/documents/:id/shares with pro-tier FeatureGate returns 200 (feature available)
- **FR-118**: Route-level tests MUST verify: POST /api/v1/api-keys with free-tier FeatureGate returns 403 FEATURE_NOT_AVAILABLE
- **FR-119**: Tier-gated 403 responses MUST include an upgrade_url field in the response body pointing to the pricing page (`https://sanyam.dev/pricing`)
- **FR-120**: Defense-in-depth integration tests MUST verify Hono routes use per-request user-scoped Supabase clients (not admin/service-role client) by testing cross-user document access
- **FR-121**: User-scoped client tests MUST: create two users (Alice and Bob), have Alice create a document, then issue GET /api/v1/documents/:id with Bob's JWT and verify 404 response (RLS filters out Alice's document)
- **FR-122**: User-scoped client tests MUST verify PUT and DELETE requests from Bob to Alice's document also return 404 (not 403 or 200)
- **FR-123**: If any route incorrectly uses the admin client (bypassing RLS), Bob would receive 200 for Alice's document — this test failure indicates a critical security bug in request handling
- **FR-124**: Version retention trigger database tests MUST verify: create free-tier user (max_versions_per_document=10), create document, update 12 times, then count document_versions rows → expect exactly 10 rows with the two oldest versions deleted
- **FR-125**: Version retention trigger database tests MUST verify: create pro-tier user (max_versions_per_document=100), create document, update 12 times → all 12 version rows remain (under limit)
- **FR-126**: Version retention trigger tests MUST verify the trigger looks up the document OWNER's tier, not the session user's tier, when enforcing max_versions_per_document limit
- **FR-127**: Owner-tier lookup test: create free-tier owner (max_versions=10), share document with pro-tier editor, have editor make 12 updates → version count must be capped at 10 (owner's limit), not 100 (editor's limit)
- **FR-128**: Soft delete integration tests MUST verify: DELETE /api/v1/documents/:id sets deleted_at timestamp and excludes document from GET /api/v1/documents list response
- **FR-129**: Soft delete integration tests MUST verify: GET /api/v1/documents/:id for a soft-deleted document returns the document with deleted_at field present (for owner only, enabling restore)
- **FR-130**: Soft delete integration tests MUST verify: POST /api/v1/documents/:id/restore clears deleted_at and the document reappears in the GET /api/v1/documents list
- **FR-131**: Soft delete integration tests MUST verify: restore endpoint rejects free-tier users with 403 if document restore is a pro+ feature
- **FR-132**: Soft delete integration tests MUST verify: a shared user (non-owner) cannot restore a document they did not own (returns 403 or 404)
- **FR-133**: Database-level soft delete tests MUST verify: document_shares rows are NOT cascade-deleted when a document is soft-deleted (must survive for restore)
- **FR-134**: Database-level soft delete tests MUST verify: document_versions rows are NOT cascade-deleted when a document is soft-deleted (must survive for restore)
- **FR-135**: Hard deletion tests MUST be added as a placeholder test file with skipped test(s) describing expected scheduled cleanup behavior (out of scope for Phases 1-4)
- **FR-136**: Auto-create profile trigger database tests MUST verify: when supabase.auth.admin.createUser() is called, a corresponding user_profiles row exists immediately after
- **FR-137**: Auto-create profile trigger tests MUST verify default profile values: tier=SANYAM_DEFAULT_TIER (default 'free'), organization_id=null, total_storage_bytes=0
- **FR-138**: Auto-create profile trigger tests MUST verify the override case: set SANYAM_DEFAULT_TIER='pro' and verify new users receive 'pro' tier in their profile
- **FR-139**: Auto-create profile trigger tests are foundational — trigger failure causes user_profiles queries to return null, breaking the entire licensing layer with opaque errors
- **FR-140**: Storage usage trigger tests MUST verify: create document with known content size → user_profiles.total_storage_bytes equals content byte length
- **FR-141**: Storage usage trigger tests MUST verify: update document with longer content → total_storage_bytes reflects new size (replacement, not additive)
- **FR-142**: Storage usage trigger tests MUST verify: create second document → total_storage_bytes equals sum of both documents' byte lengths
- **FR-143**: Storage usage trigger tests MUST verify: soft-delete one document → total_storage_bytes decrements by deleted document's size
- **FR-144**: Storage usage trigger tests MUST verify: restore soft-deleted document → total_storage_bytes re-increments by restored document's size
- **FR-145**: Storage usage trigger tests MUST verify edge case: if calculation would produce negative total_storage_bytes (due to bug or race), trigger clamps to 0 rather than storing negative value
- **FR-146**: URI parsing unit tests MUST verify: `sanyam://UPPERCASE-UUID` normalizes to lowercase before document lookup
- **FR-147**: URI parsing unit tests MUST verify: `sanyam://{uuid}?version=0` is rejected (versions are 1-indexed)
- **FR-148**: URI parsing unit tests MUST verify: `sanyam://{uuid}?version=-1` and `?version=abc` are rejected (negative and non-integer values)
- **FR-149**: URI parsing unit tests MUST verify: `sanyam://{uuid}#fragment` ignores the fragment and extracts UUID only
- **FR-150**: URI parsing unit tests MUST verify: `sanyam://{uuid}/assets/diagram.svg` returns "not yet supported" error per reserved path convention
- **FR-151**: URI parsing unit tests MUST verify: `sanyam://` with no UUID is rejected with descriptive error message
- **FR-152**: URI parsing unit tests MUST verify: `sanyam://{uuid}?version=3&extra=param` ignores unknown query params and extracts version only
- **FR-153**: URI parsing unit tests MUST verify: `sanyam://{not-a-uuid}` (malformed UUID) is rejected with invalid UUID error
- **FR-154**: API key tests MUST verify: using a revoked API key returns 401 with error code API_KEY_REVOKED (not generic auth failure)
- **FR-155**: API key tests MUST verify: using an expired API key (past expiration date) returns 401 with error code API_KEY_EXPIRED
- **FR-156**: API key tests MUST verify: creating an API key with empty scopes array is rejected (at least one scope required)
- **FR-157**: API key tests MUST verify: creating an API key with invalid scope string (e.g., 'not:a:valid:scope') is rejected by Zod validation
- **FR-158**: API key tests MUST verify: key secret is returned only by POST /api/v1/api-keys; subsequent GET requests return only the prefix, never the full secret
- **FR-159**: API key tests MUST verify: the stored key_hash is actually a bcrypt hash — raw key value MUST NOT match the stored hash value (confirms hashing, not plaintext storage)
- **FR-160**: API key tests MUST verify: API keys cannot create other API keys — POST /api/v1/api-keys with ApiKey authentication returns 403 Forbidden
- **FR-161**: CORS middleware tests MUST verify: OPTIONS request to any route returns 204 with Access-Control-Allow-Origin, Access-Control-Allow-Methods, and Access-Control-Allow-Headers headers
- **FR-162**: CORS middleware tests MUST verify: Access-Control-Expose-Headers header includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and ETag
- **FR-163**: CORS middleware tests MUST verify: when SANYAM_CORS_ORIGIN is set to a specific domain (e.g., `https://sanyam.dev`), requests from other origins are rejected
- **FR-164**: CORS middleware tests MUST verify: when SANYAM_CORS_ORIGIN is unset, it defaults to '*' in development mode (SANYAM_AUTH_REQUIRED=false)
- **FR-165**: CORS middleware tests MUST verify: when SANYAM_CORS_ORIGIN is unset in production mode (SANYAM_AUTH_REQUIRED=true), all origins are rejected — production default MUST NOT be '*' as wildcard CORS in production is a security vulnerability
- **FR-166**: Zod schema unit tests MUST exist for every route input schema: CreateDocumentRequest, UpdateDocumentRequest, ListDocumentsQuery, CreateApiKeyRequest
- **FR-167**: Zod schema tests MUST verify: valid payload passes validation without errors
- **FR-168**: Zod schema tests MUST verify: each required field missing individually produces 400 with the field name in error details
- **FR-169**: Zod schema tests MUST verify: each field with wrong type produces 400 validation error
- **FR-170**: Zod schema tests MUST verify: extra/unknown fields are stripped (not rejected) to allow forward compatibility
- **FR-171**: Zod schema tests MUST verify: string fields with maximum length constraints reject oversized input
- **FR-172**: Zod schema tests MUST verify: languageId field accepts only valid Langium language identifiers (alphanumeric characters and hyphens)
- **FR-173**: "Sanyam: Save to Cloud" command unit tests MUST verify: command reads current editor's file:// URI content
- **FR-174**: "Sanyam: Save to Cloud" command unit tests MUST verify: command calls CloudDocumentStore.createDocument() with content and languageId inferred from file extension
- **FR-175**: "Sanyam: Save to Cloud" command unit tests MUST verify: on success, editor tab URI is updated from file:// to sanyam://{new-document-id}
- **FR-176**: "Sanyam: Save to Cloud" command unit tests MUST verify: original local file is NOT deleted (user may want both copies)
- **FR-177**: "Sanyam: Save to Cloud" command unit tests MUST verify: command is hidden (not disabled) when user is unauthenticated or Supabase is unconfigured
- **FR-178**: "Sanyam: Save to Cloud" command unit tests MUST verify: command rejects with descriptive message when document exceeds user's max_document_size_bytes tier limit
- **FR-179**: System MUST provide a shared logging mock in @sanyam/test-utils that captures log calls by level (debug, info, warn, error) using vi.spyOn(console, 'warn') or DI-injected structured logger
- **FR-180**: Logging assertion tests MUST verify: CredentialManager logs a warning when SUPABASE_URL is set but is not a valid URL
- **FR-181**: Logging assertion tests MUST verify: FeatureGate logs a warning when an unknown tier value is encountered
- **FR-182**: Logging assertion tests MUST verify: version retention trigger logs when it deletes old versions (not silent deletion)
- **FR-183**: Logging assertion tests MUST verify: no error-level logs are emitted during normal application startup with valid configuration
- **FR-184**: CI pipeline MUST include a pre-test step running `tsc --noEmit` across all packages before any Vitest tests execute
- **FR-185**: The type-check CI job MUST run as a separate job that gates both unit and integration test jobs (tests do not start if type-check fails)
- **FR-186**: All package tsconfig.json files MUST include `strict: true` to enable comprehensive type checking
- **FR-187**: Pre-test type checking specifically catches: (a) FeatureGate union type updates (LicenseFeature | ProjectFeature not updated after new features), (b) TierLimits interface drift vs actual tier_limits table columns, (c) incorrect inversify @inject() token types that would fail at runtime
- **FR-188**: HTTP gateway MUST provide a GET /health endpoint that requires no authentication
- **FR-189**: Health endpoint MUST return JSON: `{ status: 'ok', supabase: boolean, auth: boolean, version: string }` where supabase reflects SupabaseCredentialManager.isConfigured(), auth reflects whether at least one auth provider is available, and version is read from package.json
- **FR-190**: Health endpoint unit tests MUST verify the response shape matches the documented contract
- **FR-191**: Test-utils MUST provide a waitForHealthy() helper function that polls /health with exponential backoff before integration tests begin
- **FR-192**: The waitForHealthy() helper replaces the fragile Supabase ping check in global setup with a single readiness endpoint covering the entire gateway

### Key Entities

- **Test Suite**: A collection of related tests for a specific package or capability
- **Test User**: An ephemeral user created via Supabase auth admin API for test isolation
- **Mock Client**: A simulated Supabase client that mimics query builder patterns without network calls; supports error simulation mode and offline rejection for testing error paths and graceful degradation
- **Test Factory**: A function that generates valid test entities with sensible defaults and optional overrides
- **Coverage Report**: Aggregated code coverage metrics across all packages
- **Inline Snapshot**: A Vitest snapshot embedded in the test file source code, verifying structural contracts without external snapshot files
- **Global Setup**: A Vitest globalSetup file that runs before all tests to detect environment availability and conditionally skip test categories
- **Test Seed File**: SQL file containing canonical tier_limits reference data (free/pro/enterprise rows) applied after migrations to ensure deterministic test conditions
- **Theia Mocks**: Type-safe mock implementations of Theia browser APIs (SecretStorage, AuthenticationService, CommandRegistry) for jsdom-based unit tests

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All unit tests complete in under 30 seconds on developer machines
- **SC-002**: All integration tests complete in under 3 minutes with local Supabase
- **SC-003**: Full CI pipeline (unit + integration) completes in under 5 minutes
- **SC-004**: Achieve minimum 90% line coverage for core packages (`types`, `licensing`, `document-store`)
- **SC-005**: Achieve minimum 85% line coverage for auth and HTTP packages
- **SC-006**: Zero test flakiness - all tests pass consistently across 10 consecutive runs
- **SC-007**: Test isolation verified - parallel test suites do not interfere with each other's data
- **SC-008**: All RLS policies have explicit test coverage (one test per policy rule minimum)
- **SC-009**: All database triggers have explicit test coverage verifying expected side effects
- **SC-010**: Developers can run any test suite with a single command without manual setup beyond `pnpm install`

## Assumptions

- Vitest is the test framework (aligns with ESM, TypeScript, and pnpm workspace)
- Local Supabase CLI is available for integration tests (`supabase start`)
- Tests use real JWTs from local GoTrue for integration tests (not mocked tokens)
- Per-user isolation via RLS is the primary test isolation mechanism (avoids 3-second-per-reset penalty)
- `supabase db reset` is NOT used; shared-state tests use beforeAll/afterAll state restoration instead
- Test coverage thresholds are enforced in CI via @vitest/coverage-v8 (builds fail if below threshold)
- Pact-style contract testing is deferred until Phase 3 API stability and external consumer existence
