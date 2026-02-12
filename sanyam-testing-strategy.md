# Sanyam Cloud Infrastructure: Testing Strategy

## Overview

This document defines the testing approach for the Sanyam Unified Cloud Storage, Authentication & Licensing infrastructure using **Vitest**. It covers unit tests, integration tests, and database-level tests across all packages.

### Why Vitest

- Native ESM support — aligns with Theia's ESM migration and Langium's module system
- First-class TypeScript support without transpilation overhead
- Compatible with the pnpm workspace monorepo structure
- Built-in mocking that handles inversify DI patterns cleanly
- Concurrent test execution by default

---

## 1. Architectural Decisions

### 1.1 Test Boundaries

| Layer | Test Type | Execution Environment | External Dependencies |
|-------|-----------|----------------------|----------------------|
| `@sanyam/types` | Unit | Node | None |
| `@sanyam/supabase-core` | Unit | Node | Mocked Supabase client |
| `@sanyam/licensing` | Unit + Integration | Node | Mocked Supabase (unit), real Supabase local (integration) |
| `@sanyam/supabase-auth` | Unit | jsdom | Mocked Supabase Auth, mocked Theia APIs |
| `@sanyam/document-store` | Unit + Integration | Node | Mocked (unit), real Supabase local (integration) |
| `language-server/http` | Unit + Integration | Node | Mocked services (unit), real Hono + Supabase (integration) |
| Database (migrations, RLS, triggers) | Integration | Node → PostgreSQL | Real Supabase local (`supabase start`) |

### 1.2 Supabase Test Strategy

Integration tests requiring Supabase run against the **Supabase CLI local development stack** (`supabase start`), which spins up a local PostgreSQL, GoTrue (auth), and PostgREST instance in Docker. This avoids hitting remote infrastructure and enables:

- Deterministic test data via migration + seed scripts
- Full RLS policy testing with real `auth.uid()` context
- Trigger and function testing against actual PostgreSQL
- Parallel test suites with per-suite database schemas (using PostgreSQL schemas or `supabase db reset` between suites)

### 1.3 Monorepo Configuration

```
vitest.workspace.ts              ← Workspace-level config
packages/
├── types/
│   └── vitest.config.ts         ← Unit only, no external deps
├── supabase-core/
│   └── vitest.config.ts         ← Unit only, mocked Supabase
├── licensing/
│   ├── vitest.config.ts
│   └── __tests__/
│       ├── unit/                ← Mocked, fast
│       └── integration/         ← Requires supabase local
├── supabase-auth/
│   └── vitest.config.ts         ← jsdom environment
├── document-store/
│   ├── vitest.config.ts
│   └── __tests__/
│       ├── unit/
│       └── integration/
├── language-server/
│   ├── vitest.config.ts
│   └── __tests__/
│       ├── unit/
│       │   ├── routes/
│       │   └── middleware/
│       ├── integration/
│       │   ├── routes/
│       │   └── middleware/
│       └── database/            ← RLS, triggers, functions
└── test-utils/                  ← @sanyam/test-utils (shared)
    └── src/
        ├── supabase-helpers.ts  ← Test user creation, JWT minting
        ├── factories.ts         ← Document, profile, API key factories
        ├── mocks/
        │   ├── supabase-client.ts
        │   ├── theia-services.ts
        │   └── feature-gate.ts
        └── fixtures/
            ├── seed.sql         ← Deterministic test data
            └── grammars/        ← Sample .langium files
```

### 1.4 Workspace Config

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types/vitest.config.ts',
  'packages/supabase-core/vitest.config.ts',
  'packages/licensing/vitest.config.ts',
  'packages/supabase-auth/vitest.config.ts',
  'packages/document-store/vitest.config.ts',
  'packages/language-server/vitest.config.ts',
]);
```

```typescript
// Example: packages/licensing/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    // Integration tests are excluded by default — run with --project flag
    // or via a separate CI step
    exclude: ['__tests__/integration/**'],
    mockReset: true,
  },
});
```

### 1.5 npm Scripts

```jsonc
// Root package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --exclude '**/integration/**' --exclude '**/database/**'",
    "test:integration": "vitest run --include '**/integration/**' '**/database/**'",
    "test:coverage": "vitest run --coverage",
    "test:ci": "supabase start && pnpm test:unit && pnpm test:integration && supabase stop"
  }
}
```

---

## 2. Shared Test Utilities (`@sanyam/test-utils`)

This internal package is not published — it's a devDependency for all other packages.

### 2.1 Supabase Helpers

```typescript
// packages/test-utils/src/supabase-helpers.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TEST_SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const TEST_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '...'; // from supabase start output
const TEST_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '...';

/** Admin client — bypasses RLS. For setup/teardown only. */
export function createTestAdminClient(): SupabaseClient {
  return createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);
}

/** Creates a test user via GoTrue and returns a scoped client + JWT. */
export async function createTestUser(
  email: string,
  tier: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<{ client: SupabaseClient; jwt: string; userId: string }> {
  const admin = createTestAdminClient();

  // Create user via admin API
  const { data: authData } = await admin.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  });

  // Set tier (the auto-create-profile trigger sets 'free' by default)
  if (tier !== 'free') {
    await admin.from('user_profiles')
      .update({ tier })
      .eq('id', authData.user!.id);
  }

  // Sign in to get a real JWT
  const anonClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
  const { data: session } = await anonClient.auth.signInWithPassword({
    email,
    password: 'test-password-123',
  });

  return {
    client: createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } },
    }),
    jwt: session.session!.access_token,
    userId: authData.user!.id,
  };
}

/** Wipes all test data. Call in afterAll(). */
export async function cleanupTestData(): Promise<void> {
  const admin = createTestAdminClient();
  // Delete in dependency order
  await admin.from('document_shares').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('api_key_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('api_keys').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // Users cleaned up via auth admin API
  const { data: users } = await admin.auth.admin.listUsers();
  for (const user of users.users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
```

### 2.2 Test Factories

```typescript
// packages/test-utils/src/factories.ts

import { CreateDocumentRequest, ApiKey, UserProfile } from '@sanyam/types';

let counter = 0;
const next = () => ++counter;

export function buildCreateDocumentRequest(
  overrides?: Partial<CreateDocumentRequest>
): CreateDocumentRequest {
  const n = next();
  return {
    languageId: 'test-lang',
    name: `test-doc-${n}.tl`,
    content: `model TestModel${n} {}`,
    ...overrides,
  };
}

export function buildUserProfile(
  overrides?: Partial<UserProfile>
): UserProfile {
  return {
    id: crypto.randomUUID(),
    tier: 'free',
    organization_id: null,
    total_storage_bytes: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Additional factories for ApiKey, DocumentShare, ProjectManifest, etc.
```

### 2.3 Mock Supabase Client

```typescript
// packages/test-utils/src/mocks/supabase-client.ts

import { vi } from 'vitest';

/**
 * Creates a chainable mock that mimics the Supabase query builder pattern:
 * client.from('table').select('*').eq('id', '...').single()
 */
export function createMockSupabaseClient(responses?: Record<string, any>) {
  const mockBuilder = (resolvedData?: any) => {
    const builder: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'upsert',
                     'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in',
                     'single', 'maybeSingle', 'order', 'limit', 'range'];
    for (const method of methods) {
      builder[method] = vi.fn().mockReturnValue(builder);
    }
    // Terminal methods resolve the chain
    builder.then = vi.fn((resolve) => resolve({ data: resolvedData, error: null }));
    builder.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
    return builder;
  };

  return {
    from: vi.fn((table: string) => mockBuilder(responses?.[table])),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        listUsers: vi.fn(),
      },
    },
    rpc: vi.fn(),
  };
}
```

---

## 3. Test Specifications by Package

### 3.1 `@sanyam/types` — Unit Tests

Pure functions and type guards. No mocking needed.

```
__tests__/
├── document-reference.test.ts
├── api-key.test.ts
└── cloud-document.test.ts
```

| Test | What It Verifies |
|------|-----------------|
| `isFileReference()` returns true for `file://` URIs | Type guard correctness |
| `isCloudReference()` returns true for `sanyam://` URIs | Type guard correctness |
| `isInlineReference()` returns true for inline content | Type guard correctness |
| `extractDocumentId()` extracts UUID from `sanyam://` URI | Parsing logic |
| `extractDocumentId()` extracts UUID when `?version=N` present | Query param handling |
| `extractDocumentId()` throws on malformed URI | Error path |
| `scopeMatches('documents:read', 'documents:read')` → true | Exact match |
| `scopeMatches('documents:*', 'documents:read')` → true | Wildcard match |
| `scopeMatches('documents:read', 'documents:write')` → false | Mismatch |
| `scopeMatches('operations:ecml:execute', 'operations:*:execute')` → true | Middle wildcard |

### 3.2 `@sanyam/supabase-core` — Unit Tests

```
__tests__/
├── credential-manager.test.ts
└── client-factory.test.ts
```

| Test | What It Verifies |
|------|-----------------|
| `CredentialManager.isConfigured()` returns true when env vars set | Detection logic |
| `CredentialManager.isConfigured()` returns false when env vars missing | Absence handling |
| `CredentialManager.get()` returns credentials from env vars | Read logic |
| `CredentialManager` detects `SANYAM_ENTERPRISE_MODE=true` → `ConnectionMode.ENTERPRISE` | Mode detection |
| `CredentialManager` defaults to `ConnectionMode.HOSTED` | Default mode |
| `ClientFactory.createAdminClient()` returns client with service key | Admin client construction |
| `ClientFactory.createAdminClient()` throws when service key missing | Error path |
| `ClientFactory.createUserClient()` returns client scoped to access token | Per-user client construction |
| `ClientFactory.createUserClient()` returns undefined when unconfigured | Graceful degradation |
| `ClientFactory` subscribes to auth state changes and updates token | Token refresh (per clarification 3) |

### 3.3 `@sanyam/licensing` — Unit Tests

```
__tests__/
├── unit/
│   ├── feature-gate.test.ts
│   ├── license-validator.test.ts
│   └── feature-registration.test.ts
└── integration/
    └── feature-gate.integration.test.ts
```

#### Unit Tests (mocked Supabase)

| Test | What It Verifies |
|------|-----------------|
| `FeatureGate.isFeatureEnabled('cloud-storage')` → true for free tier | Baseline feature |
| `FeatureGate.isFeatureEnabled('document-sharing')` → false for free tier | Pro-only gate |
| `FeatureGate.isFeatureEnabled('document-sharing')` → true for pro tier | Pro feature unlocked |
| `FeatureGate.isFeatureEnabled('api-keys')` → true for enterprise only | Enterprise gate |
| `FeatureGate.isFeatureEnabled()` → false when unauthenticated | No-auth default |
| `FeatureGate.getTierLimits()` returns numeric limits for user's tier | Limit resolution (clarification 21) |
| `FeatureGate.getTierLimits()` returns free-tier limits when unauthenticated | Safe default |
| `LicenseValidator` caches tier for TTL duration | Cache behavior |
| `LicenseValidator.invalidateCache()` forces re-fetch on next call | Cache invalidation (clarification 23) |
| `FeatureGate.registerFeature()` adds new feature to tier mapping | Extensibility (clarification 24) |
| Downstream package registers `ProjectFeatures.MULTI_PROJECT` at `pro` tier | Cross-package registration |
| `FeatureGate` reads boolean columns from `tier_limits` row | DB-driven mapping (clarification 19) |
| Unknown tier string defaults to free-tier limits | Defensive handling (clarification 26) |

#### Integration Tests (local Supabase)

| Test | What It Verifies |
|------|-----------------|
| Free-tier user → `isFeatureEnabled('document-sharing')` → false against real DB | End-to-end gate |
| Pro-tier user → `isFeatureEnabled('document-sharing')` → true against real DB | Tier upgrade flow |
| Tier change in DB reflected after cache invalidation | Real cache behavior |
| `getTierLimits()` returns values matching `tier_limits` seed data | DB round-trip |

### 3.4 `@sanyam/supabase-auth` — Unit Tests

These run in a **jsdom** environment since the auth provider is a browser-side Theia contribution.

```
__tests__/
├── supabase-auth-provider.test.ts
└── session-persistence.test.ts
```

| Test | What It Verifies |
|------|-----------------|
| `createSession()` calls `supabase.auth.signInWithPassword()` for email/password | Sign-in flow |
| `createSession()` calls `supabase.auth.signInWithOAuth()` for OAuth providers | OAuth flow |
| Session tokens written to `SecretStorage` on successful sign-in | Persistence (clarification 2) |
| `getSessions()` restores session from `SecretStorage` on startup | Restore flow |
| `getSessions()` returns empty when stored refresh token is expired | Expired token handling |
| `removeSession()` clears tokens from `SecretStorage` | Sign-out cleanup |
| `onDidChangeSessions` fires when auth state changes | Event propagation |
| `onAuthStateChange(TOKEN_REFRESHED)` updates `SecretStorage` | Token refresh (clarification 3) |
| `onAuthStateChange(TOKEN_REFRESHED)` calls `LicenseValidator.invalidateCache()` | License refresh (clarification 23) |
| Provider discovers available auth methods dynamically in enterprise mode | Enterprise SSO (clarification 5) |

**Mocking strategy:** Mock Theia's `AuthenticationService`, `SecretStorage`, and `@supabase/supabase-js` auth methods. The auth provider is thin — its job is wiring Supabase events to Theia APIs.

### 3.5 `@sanyam/document-store` — Unit + Integration Tests

```
__tests__/
├── unit/
│   ├── cloud-document-store.test.ts
│   ├── document-resolver.test.ts
│   └── conditional-binding.test.ts
└── integration/
    ├── cloud-document-store.integration.test.ts
    └── document-resolver.integration.test.ts
```

#### Unit Tests

| Test | What It Verifies |
|------|-----------------|
| `createDocument()` inserts with correct owner_id | Ownership assignment |
| `createDocument()` rejects when `max_documents` exceeded | Tier limit enforcement |
| `createDocument()` rejects when content exceeds `max_document_size_bytes` | Size limit (clarification 8) |
| `updateDocument()` with matching `If-Match` succeeds | Optimistic lock pass (clarification 9) |
| `updateDocument()` with stale `If-Match` throws 409 | Optimistic lock conflict |
| `updateDocument()` without `If-Match` succeeds (last-write-wins) | No-lock path |
| `deleteDocument()` sets `deleted_at`, does not hard delete | Soft delete |
| `listDocuments()` excludes soft-deleted documents | Soft delete filtering |
| `listDocuments()` returns cursor-based pagination envelope | Pagination (clarification 12) |
| `shareDocument()` rejects for free-tier user | Feature gate |
| `restoreVersion()` copies version content to current document | Version restore |
| `UnifiedDocumentResolver.resolve()` handles `file://` URI | Local resolution |
| `UnifiedDocumentResolver.resolve()` handles `sanyam://` URI | Cloud resolution |
| `UnifiedDocumentResolver.resolve()` handles `sanyam://{id}?version=3` | Versioned resolution |
| `UnifiedDocumentResolver.resolve()` returns placeholder for `sanyam://` when offline | Degradation (clarification 17) |
| `UnifiedDocumentResolver.resolve()` returns error for `sanyam://{id}/assets/` path | Reserved path (clarification 7) |
| `UnifiedDocumentResolver` cache evicts after 5-minute TTL | Cache behavior (clarification 18) |
| `UnifiedDocumentResolver` cache evicts on write confirmation | Cache invalidation |
| `SupabaseStorageBackendModule` binds `CloudDocumentStore` when `FeatureGate` is bound | Conditional DI |
| `SupabaseStorageBackendModule` binds local-only store when Supabase is unconfigured | Fallback DI |

#### Integration Tests

| Test | What It Verifies |
|------|-----------------|
| Full CRUD cycle: create → read → update → read → delete → confirm gone | Happy path |
| Version auto-snapshot: update document → `document_versions` row exists | Trigger verification |
| Version count capped at `max_versions_per_document` for free tier | Retention policy (clarification 10) |
| Share document → shared user can read → shared user cannot delete | Permission model |
| `sanyam://` URI resolves to correct document content via real Supabase | End-to-end resolution |
| Storage usage tracking increments on create, decrements on delete | Trigger verification |
| Document exceeding `max_document_size_bytes` rejected | Size enforcement |

### 3.6 `language-server/http` — Unit + Integration Tests

```
__tests__/
├── unit/
│   ├── routes/
│   │   ├── documents.test.ts
│   │   └── api-keys.test.ts
│   ├── middleware/
│   │   ├── auth.test.ts
│   │   ├── error-handler.test.ts
│   │   └── usage-logging.test.ts
│   └── services/
│       └── api-key-service.test.ts
├── integration/
│   ├── routes/
│   │   ├── documents.integration.test.ts
│   │   └── api-keys.integration.test.ts
│   └── auth-flow.integration.test.ts
└── database/
    ├── rls-policies.test.ts
    ├── triggers.test.ts
    └── functions.test.ts
```

#### Unit Tests — Middleware

| Test | What It Verifies |
|------|-----------------|
| `auth.ts`: Bearer JWT → sets `c.user`, `c.userToken` | JWT extraction |
| `auth.ts`: ApiKey scheme → sets `c.apiKeyId`, `c.apiKeyScopes` | API key extraction |
| `auth.ts`: Missing `Authorization` header → 401 when auth required | Required auth |
| `auth.ts`: Missing `Authorization` header → passthrough when auth optional | Optional auth |
| `auth.ts`: Malformed JWT → 401 with `INVALID_TOKEN` error code | Error envelope |
| `auth.ts`: Expired JWT → 401 with `TOKEN_EXPIRED` error code | Expiration check |
| `auth.ts`: Unsupported scheme → 401 with `UNSUPPORTED_AUTH_SCHEME` | Scheme validation |
| `error-handler.ts`: `HTTPException` → standard error envelope | Error formatting (clarification 13) |
| `error-handler.ts`: Zod validation error → 400 with field details | Validation error |
| `error-handler.ts`: Unhandled error → 500 with generic message (no stack leak) | Safety |
| `usage-logging.ts`: Logs request when `c.apiKeyId` is set | Telemetry capture |
| `usage-logging.ts`: Skips logging when no API key | Selective logging |

#### Unit Tests — Routes

| Test | What It Verifies |
|------|-----------------|
| `GET /documents` returns paginated list with cursor | Pagination envelope |
| `GET /documents?languageId=ecml` filters by language | Query param filtering |
| `POST /documents` validates body with Zod → 400 on invalid | Input validation |
| `POST /documents` returns 413 when content exceeds tier limit | Size limit |
| `PUT /documents/:id` returns 409 on version mismatch | Optimistic lock |
| `PUT /documents/:id` returns 404 for non-existent document | Missing resource |
| `DELETE /documents/:id` returns 204 on success | Soft delete response |
| `GET /documents/:id/versions` returns version list | Version history |
| `POST /documents/:id/versions/:v/restore` copies version to current | Version restore |
| All routes return 503 when Supabase is unconfigured | Graceful degradation |
| `POST /api-keys` returns key secret exactly once | Key creation |
| `POST /api-keys` rejects for free-tier user | Feature gate |
| `DELETE /api-keys/:id` sets `revoked_at` | Key revocation |
| `GET /documents` with API key checks scope `documents:read` | Scope enforcement |
| `POST /documents` with API key lacking `documents:write` → 403 | Scope rejection |
| Rate limit headers present on API key requests | Rate limit (clarification 14) |
| Rate limit exceeded → 429 with `RATE_LIMIT_EXCEEDED` error | Rate enforcement |

#### Integration Tests — HTTP Routes

These use Hono's `app.request()` test helper against a real Hono app instance with mocked or real Supabase.

| Test | What It Verifies |
|------|-----------------|
| Sign in → create document → read back → update → read versions → delete | Full document lifecycle |
| Create API key → use key to read documents → verify rate limit headers | API key lifecycle |
| User A creates document → shares with User B → User B reads → User B cannot delete | Share permissions via HTTP |
| Free-tier user hits document count limit → 403 with upgrade message | Tier enforcement end-to-end |
| Pro-tier user creates API key → downgrades to free → key returns 403 | Downgrade behavior (clarification 15) |
| CORS preflight request returns correct headers | CORS config (clarification 14) |
| Concurrent PUT with stale version → 409 → retry with fresh version → 200 | Optimistic lock flow |
| Billing webhook stub updates tier → FeatureGate reflects new tier | Billing integration (clarification 25) |

#### Database Tests

These run SQL directly against local Supabase PostgreSQL to verify RLS, triggers, and functions independently of the application layer.

| Test | What It Verifies |
|------|-----------------|
| User A cannot SELECT User B's documents | RLS: owner isolation |
| User A shares doc with User B → User B can SELECT | RLS: share grants read |
| User B with `edit` share can UPDATE → User B with `view` share cannot | RLS: permission levels |
| User B cannot DELETE User A's document even with `admin` share | RLS: owner-only delete |
| INSERT into documents → `document_versions` row auto-created | Trigger: version snapshot |
| UPDATE document content → new `document_versions` row | Trigger: version on change |
| UPDATE document metadata only → no new version row | Trigger: skip on metadata-only |
| New auth.users row → `user_profiles` row auto-created with `free` tier | Trigger: auto-profile |
| `check_rate_limit()` returns `allowed=true` under limit | Function: rate limit pass |
| `check_rate_limit()` returns `allowed=false` at limit | Function: rate limit block |
| `check_rate_limit()` resets after window expires | Function: window expiry |
| Soft-deleted documents excluded from RLS SELECT policies | RLS: soft delete filtering |
| User cannot access `user_profiles` of other users | RLS: profile isolation |
| `document_shares` → user can see own shares but not others' | RLS: share visibility |
| `tier_limits` is readable by all authenticated users (reference data) | RLS: public read |

---

## 4. Test Execution Strategy

### 4.1 CI Pipeline

```yaml
# .github/workflows/test.yml (conceptual)
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm test:unit

  integration:
    runs-on: ubuntu-latest
    needs: unit                          # Only run if unit tests pass
    services:
      supabase:                          # Or use supabase start in a step
        # ...
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: npx supabase start
      - run: npx supabase db push        # Apply migrations
      - run: pnpm test:integration
      - run: npx supabase stop
```

### 4.2 Test Data Isolation

Integration tests that share a Supabase instance must not interfere with each other.

**Strategy: per-suite user isolation.**

Each `describe()` block creates its own test user(s) via `createTestUser()`. RLS ensures each user's data is invisible to other users. `afterAll()` cleans up created users and their cascade-deleted data.

```typescript
// Example pattern
describe('Document CRUD', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser('alice@test.com', 'pro');
    bob = await createTestUser('bob@test.com', 'free');
  });

  afterAll(async () => {
    await cleanupTestUser(alice);
    await cleanupTestUser(bob);
  });

  it('alice can create a document', async () => {
    const res = await app.request('/api/v1/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCreateDocumentRequest()),
    });
    expect(res.status).toBe(201);
  });

  it('bob cannot see alice\'s document', async () => {
    const res = await app.request('/api/v1/documents', {
      headers: { Authorization: `Bearer ${bob.jwt}` },
    });
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});
```

### 4.3 Coverage Targets

| Package | Line Coverage Target | Branch Coverage Target |
|---------|---------------------|----------------------|
| `@sanyam/types` | 100% | 100% |
| `@sanyam/supabase-core` | 90% | 85% |
| `@sanyam/licensing` | 95% | 90% |
| `@sanyam/supabase-auth` | 85% | 80% |
| `@sanyam/document-store` | 90% | 85% |
| `language-server/http` | 90% | 85% |
| Database (RLS/triggers) | N/A (functional coverage via integration tests) | N/A |

### 4.4 Performance Budget

| Test Suite | Max Duration |
|-----------|-------------|
| All unit tests | < 30 seconds |
| All integration tests | < 3 minutes |
| Database tests | < 1 minute |
| Full CI run (unit + integration) | < 5 minutes |

---

## 5. Implementation Order

Tests should be written phase-aligned with the cloud spec implementation:

### Phase 1 Tests
1. `@sanyam/types` unit tests (type guards, scope matching)
2. `@sanyam/supabase-core` unit tests (credential manager, client factory)
3. `@sanyam/test-utils` scaffold (mock client, factories)

### Phase 2 Tests
4. Database tests (RLS policies, triggers, functions) — write these immediately after migrations land
5. `@sanyam/licensing` unit tests (FeatureGate, LicenseValidator, registration)
6. `@sanyam/licensing` integration tests (real tier resolution)
7. `@sanyam/supabase-auth` unit tests (auth provider, session persistence)
8. `@sanyam/document-store` unit tests (CRUD, resolver, conditional binding)
9. `@sanyam/document-store` integration tests (full CRUD cycle, versioning, sharing)
10. `language-server/http` middleware unit tests (auth, error handler)
11. `language-server/http` route unit tests (documents)
12. `language-server/http` route integration tests (document lifecycle)

### Phase 3 Tests
13. `language-server/http` API key service unit tests
14. `language-server/http` API key route unit + integration tests
15. `language-server/http` usage logging + rate limit tests
16. Database tests for `api_keys`, `rate_limits`, `check_rate_limit()`

### Phase 4 Tests
17. Conditional module loading integration tests (startup flow permutations)
18. Graceful degradation tests (no Supabase, no auth, no licensing)
19. End-to-end smoke tests (IDE command → HTTP route → database → response)

---

## 6. Open Decisions

### 6.1 Database Reset Strategy

Two options for integration test isolation:

- **Option A: `supabase db reset` between test files.** Clean but slow (~3 seconds per reset). Safe for parallel-unfriendly tests.
- **Option B: Per-user isolation via RLS** (described in 4.2). Fast but requires disciplined cleanup. Tests that modify `tier_limits` or other shared tables need serialization.

**Recommendation:** Option B by default. Option A only for database tests that modify schema-level objects (triggers, functions, RLS policies).

### 6.2 Snapshot Testing

Consider Vitest snapshot testing for:
- Error response envelopes (ensure format doesn't drift)
- Pagination response structure
- Zod schema validation error output

Snapshots are brittle for data-dependent output but useful for structural contracts.

### 6.3 Contract Tests

If Sanyam's HTTP API is consumed by third-party integrations (Phase 3+), consider adding contract tests using a tool like Pact to verify the API doesn't break consumer expectations when routes change.

---

*Document version: 1.0 | February 2026*
*Companion documents: Sanyam Unified Cloud Storage, Authentication & Licensing Plan; Sanyam Projects v2*
