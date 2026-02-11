# Sanyam IDE: Unified Cloud Storage, Authentication & Licensing Plan

## Executive Summary

This document reconciles two complementary architecture strategies into a single implementation plan:

- **Strategy A** ("Architecture Strategy"): Theia IDE integration via inversify DI — focused on `FileSystemProvider`, licensing/feature gating, and conditional module loading within the Theia extension framework.
- **Strategy B** ("Cloud Storage & Auth"): Language server HTTP gateway — focused on Supabase PostgreSQL document storage, Hono REST routes, JWT/API-key auth, and tiered subscriptions.

These are not competing approaches. Strategy A defines the **IDE shell** (how Theia discovers, binds, and presents cloud storage to the user), while Strategy B defines the **backend services** (how documents are persisted, authenticated, and exposed via REST). The reconciled plan layers them together across four implementation phases.

---

## Key Design Decisions

### 1. URI Scheme: `sanyam://`

Both documents propose custom URI schemes. The reconciled plan standardizes on `sanyam://` as the canonical scheme for cloud-stored documents, with the following semantics:

```
sanyam://{document-uuid}                → latest version
sanyam://{document-uuid}?version=3      → specific version
sanyam://{document-uuid}.{languageId}   → Langium-internal (appended during resolution)
```

The `supabase://` scheme from Strategy A is dropped. Supabase is an implementation detail, not a user-facing concept.

### 2. Dual Storage Model

Strategy A assumed Supabase Storage (blob/file storage). Strategy B uses Supabase PostgreSQL (row-based document storage). The reconciled plan uses **PostgreSQL as the primary store** for DSL documents because:

- Documents are text-based grammar files, not binary blobs — PostgreSQL `text` columns are ideal.
- Versioning, RLS, sharing, and metadata queries all benefit from relational storage.
- Supabase Realtime subscriptions on PostgreSQL tables enable live collaboration more naturally than Storage bucket events.

Supabase Storage (blob) may be added later for binary assets (images, generated artifacts) but is out of scope for this plan.

### 3. Licensing vs. Subscription Tiers — Unified Model

Strategy A introduced a `@sanyam/licensing` package with `FeatureGate` and boolean feature flags. Strategy B introduced `subscription_tier` (free/pro/enterprise) with numeric limits in the database. The reconciled plan **unifies these**:

- The `tier_limits` table in Supabase is the **source of truth** for what each tier can do.
- The `@sanyam/licensing` package becomes a **client-side gate** that reads the user's tier from Supabase (via `user_profiles`) and exposes it through the `FeatureGate` interface for Theia module activation.
- Feature flags like `SUPABASE_STORAGE`, `SUPABASE_AUTH`, etc. map directly to tier capabilities. Enterprise tier unlocks everything; free tier has limits.

This eliminates the need for a separate license file or validation server while preserving the clean inversify conditional-binding pattern.

### 4. Credential Management: Merged Approach

Strategy A defined two modes: `ENTERPRISE` (credentials from secure backend config) and `USER_PROJECT` (user provides Supabase URL + anon key). Strategy B assumed server-side env vars. The reconciled approach:

- **Hosted/SaaS deployment**: Sanyam's own Supabase project. Credentials are baked into the backend. Users authenticate via Supabase Auth (email/password, OAuth). This is the default.
- **Self-hosted/Enterprise deployment**: Customer provides their own Supabase project credentials via environment variables. The `SupabaseCredentialManager` detects `SANYAM_ENTERPRISE_MODE=true` and loads from secure config.
- **Local/Offline**: No Supabase configured. The IDE falls back to local `file://` filesystem only. All cloud-dependent modules gracefully deactivate.

### 5. Authentication Layers

| Layer | Mechanism | Source |
|-------|-----------|--------|
| **Theia IDE** (frontend) | Theia `AuthenticationService` integration | Strategy A (`@sanyam/supabase-auth`) |
| **HTTP Gateway** (backend) | Hono middleware — JWT + API key | Strategy B (auth middleware) |
| **Supabase** (database) | RLS policies keyed on `auth.uid()` | Strategy B (migration 002) |

All three layers are needed. The Theia auth contribution handles login/logout UI and session management. The Hono middleware validates tokens on every API request. RLS provides defense-in-depth at the database level.

---

## Package Architecture

```
packages/
├── licensing/                          ← @sanyam/licensing
│   ├── src/
│   │   ├── common/
│   │   │   └── license-protocol.ts     ← FeatureGate interface, LicenseFeatures constants
│   │   └── node/
│   │       ├── license-validator.ts    ← Reads tier from Supabase user_profiles
│   │       ├── feature-gate.ts         ← Maps tier → feature availability
│   │       └── licensing-backend-module.ts
│   └── package.json
│
├── supabase-core/                      ← @sanyam/supabase-core
│   ├── src/
│   │   ├── common/
│   │   │   ├── supabase-types.ts       ← ConnectionMode, credentials interfaces
│   │   │   └── index.ts
│   │   └── node/
│   │       ├── credential-manager.ts   ← Enterprise vs hosted credential loading
│   │       ├── client-factory.ts       ← Creates SupabaseClient (admin + per-user)
│   │       └── supabase-core-backend-module.ts
│   └── package.json
│
├── supabase-auth/                      ← @sanyam/supabase-auth
│   ├── src/
│   │   └── browser/
│   │       ├── supabase-auth-provider.ts    ← Theia AuthenticationProvider impl
│   │       └── supabase-auth-frontend-module.ts
│   └── package.json
│
├── supabase-storage/                   ← @sanyam/supabase-storage
│   ├── src/
│   │   ├── node/
│   │   │   ├── cloud-document-store.ts       ← CRUD against Supabase PostgreSQL
│   │   │   ├── document-resolver.ts          ← UnifiedDocumentResolver (file/sanyam/inline)
│   │   │   └── supabase-storage-backend-module.ts
│   │   └── browser/
│   │       ├── supabase-workspace-contribution.ts  ← "Open Cloud Workspace" command
│   │       └── supabase-storage-frontend-module.ts
│   └── package.json
│
├── types/                              ← @sanyam/types
│   └── src/
│       ├── document-reference.ts       ← DocumentReference union type + type guards
│       ├── cloud-document.ts           ← CloudDocument, UserProfile, TierLimits, etc.
│       ├── api-key.ts                  ← ApiKey, ApiKeyScope, scopeMatches
│       └── index.ts
│
└── language-server/                    ← existing, modified
    ├── src/
    │   ├── services/
    │   │   ├── supabase-client.ts      ← getSupabaseAdmin(), getSupabaseForUser()
    │   │   ├── cloud-document-store.ts ← singleton wrapping @sanyam/supabase-storage
    │   │   ├── document-resolver.ts    ← UnifiedDocumentResolver instance
    │   │   └── api-key-service.ts      ← API key create/validate/revoke/rate-limit
    │   └── http/
    │       ├── server.ts               ← Hono app with all routes
    │       ├── routes/
    │       │   ├── documents.ts        ← /api/v1/documents CRUD
    │       │   └── api-keys.ts         ← /api/v1/api-keys CRUD
    │       └── middleware/
    │           ├── auth.ts             ← JWT + ApiKey dual-auth middleware
    │           └── usage-logging.ts    ← API key usage telemetry
    └── package.json
```

### Dependency Graph

```
@sanyam/types                     ← no dependencies (pure interfaces)
    ↑
@sanyam/licensing                 ← depends on types, supabase-core
    ↑
@sanyam/supabase-core             ← depends on types, @supabase/supabase-js
    ↑
@sanyam/supabase-auth             ← depends on supabase-core (browser only)
@sanyam/supabase-storage          ← depends on supabase-core, licensing (optional peer)
    ↑
language-server                   ← depends on all of the above
```

### `theiaExtensions` Registration

Each package self-registers via `package.json`:

```json
// @sanyam/supabase-storage/package.json
{
  "name": "@sanyam/supabase-storage",
  "theiaExtensions": [
    { "backend": "lib/node/supabase-storage-backend-module" },
    { "frontend": "lib/browser/supabase-storage-frontend-module" }
  ],
  "peerDependencies": {
    "@sanyam/licensing": "^1.0.0",
    "@sanyam/supabase-core": "^1.0.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation — Types, Core Client, Credential Management

**Goal**: Establish the Supabase connectivity layer and shared type definitions. No user-facing features yet.

#### Task 1.1: `@sanyam/types` — Shared Interfaces

Create all type definitions that downstream packages depend on.

**Files to create:**

- `packages/types/src/document-reference.ts` — `DocumentReference` union type (`FileReference | CloudReference | InlineReference`), type guards (`isFileReference`, `isCloudReference`, `isInlineReference`), and `extractDocumentId()` utility.
- `packages/types/src/cloud-document.ts` — `CloudDocument`, `CloudDocumentMetadata`, `DocumentVersion`, `DocumentShare`, `UserProfile`, `TierLimits`, `CreateDocumentRequest`, `UpdateDocumentRequest`, `ListDocumentsQuery`, `ListDocumentsResponse`.
- `packages/types/src/api-key.ts` — `ApiKeyScope` (template literal union), `ApiKey`, `ApiKeyWithSecret`, `CreateApiKeyRequest`, `ApiKeyValidation`, `RateLimitInfo`, `scopeMatches()`.
- `packages/types/src/index.ts` — Re-exports all of the above.

#### Task 1.2: `@sanyam/supabase-core` — Client Factory & Credentials

**Files to create:**

- `packages/supabase-core/src/common/supabase-types.ts`:

```typescript
export enum ConnectionMode {
  HOSTED = 'hosted',         // Sanyam's own Supabase project
  ENTERPRISE = 'enterprise', // Customer's self-hosted Supabase
}

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceKey?: string;       // Only available server-side
}
```

- `packages/supabase-core/src/node/credential-manager.ts` — inversify `@injectable()` singleton. Reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` from env. Detects `SANYAM_ENTERPRISE_MODE` to select `ConnectionMode`. Exposes `get(): SupabaseCredentials | undefined` and `isConfigured(): boolean`.

- `packages/supabase-core/src/node/client-factory.ts` — inversify `@injectable()` singleton. Injects `SupabaseCredentialManager` and optionally `FeatureGate`. Exposes `createAdminClient(): SupabaseClient` and `createUserClient(accessToken: string): SupabaseClient`. If `FeatureGate` is bound and the relevant feature is disabled, returns `undefined`.

- `packages/supabase-core/src/node/supabase-core-backend-module.ts` — `ContainerModule` binding `SupabaseCredentialManager`, `SupabaseClientFactory`, and the `ConnectionMode` constant.

**Standalone client helpers** (for the language server, which doesn't use inversify):

- `packages/language-server/src/services/supabase-client.ts` — `getSupabaseAdmin()`, `getSupabaseForUser(accessToken)`, and `isSupabaseConfigured()`. These are plain functions (no DI) wrapping the same credential logic for use in the Hono HTTP layer.

#### Task 1.3: Supabase Project Setup

- Create `.env.example` with all required environment variables.
- Document the Supabase project creation steps (CLI or dashboard).

---

### Phase 2: Cloud Storage & Authentication

**Goal**: Users can sign in, create/edit/share cloud documents via `sanyam://` URIs, and see them in the IDE.

#### Task 2.1: Database Schema — `supabase/migrations/001_documents.sql`

Creates:

- `subscription_tier` enum (`free`, `pro`, `enterprise`)
- `user_profiles` table (extends `auth.users` with tier, org, storage tracking)
- `tier_limits` table with default limits per tier
- `documents` table (owner, language_id, name, content, version, metadata, soft delete)
- `document_versions` table (auto-snapshot on content change via trigger)
- `document_shares` table (per-user permission: view/edit/admin)
- Triggers: auto-create profile on signup, auto-update `updated_at`, auto-snapshot versions, auto-track storage usage

#### Task 2.2: RLS Policies — `supabase/migrations/002_rls_policies.sql`

Enables RLS on all tables. Policies:

- **user_profiles**: Users can read/update only their own profile.
- **documents**: SELECT for owner + shared users (respecting `deleted_at`). INSERT for authenticated users (owner must match `auth.uid()`). UPDATE for owner + users with edit/admin share. DELETE for owner only.
- **document_versions**: SELECT mirrors parent document access.
- **document_shares**: Owners and admin-shared users can manage. Users can view their own shares.

#### Task 2.3: `@sanyam/licensing` — Tier-Based Feature Gating

**Files to create:**

- `packages/licensing/src/common/license-protocol.ts`:

```typescript
export const LicenseFeatures = {
  CLOUD_STORAGE: 'cloud-storage',
  CLOUD_AUTH: 'cloud-auth',
  DOCUMENT_SHARING: 'document-sharing',
  DOCUMENT_VERSIONING: 'document-versioning',
  API_KEYS: 'api-keys',
} as const;

export type LicenseFeature = typeof LicenseFeatures[keyof typeof LicenseFeatures];
```

- `packages/licensing/src/node/license-validator.ts` — Fetches `user_profiles.tier` from Supabase. Caches for session duration. Returns current `TierLimits`.

- `packages/licensing/src/node/feature-gate.ts`:

```typescript
@injectable()
export class FeatureGate {
  @inject(LicenseValidator) protected validator: LicenseValidator;

  async isFeatureEnabled(featureId: LicenseFeature): Promise<boolean> {
    const tier = await this.validator.getCurrentTier();
    if (!tier) return false; // Not authenticated

    // Free tier: cloud storage + auth only
    // Pro tier: + sharing, versioning
    // Enterprise: everything
    const tierFeatures: Record<string, LicenseFeature[]> = {
      free: [LicenseFeatures.CLOUD_STORAGE, LicenseFeatures.CLOUD_AUTH],
      pro: [
        LicenseFeatures.CLOUD_STORAGE, LicenseFeatures.CLOUD_AUTH,
        LicenseFeatures.DOCUMENT_SHARING, LicenseFeatures.DOCUMENT_VERSIONING,
      ],
      enterprise: Object.values(LicenseFeatures),
    };

    return tierFeatures[tier]?.includes(featureId) ?? false;
  }
}
```

- `packages/licensing/src/node/licensing-backend-module.ts` — Binds `LicenseValidator`, `FeatureGate` as singletons.

#### Task 2.4: `@sanyam/supabase-storage` — Cloud Document Store

**Backend (node/) files:**

- `cloud-document-store.ts` — Full CRUD service class as specified in Strategy B. Methods: `getDocument`, `getDocumentVersion`, `listDocuments`, `createDocument`, `updateDocument`, `deleteDocument` (soft), `getVersionHistory`, `restoreVersion`, `shareDocument`, `unshareDocument`, `getUserProfile`. Includes `checkTierLimits` for enforcing storage/document count limits.

- `document-resolver.ts` — `UnifiedDocumentResolver` that accepts a `DocumentReference` and returns a `LangiumDocument`. Handles `file://` (local fs read), `sanyam://` (Supabase fetch), and inline content. Maintains a content cache for change detection.

- `supabase-storage-backend-module.ts` — Conditional binding:

```typescript
export const SupabaseStorageBackendModule = new ContainerModule((bind, unbind, isBound) => {
  const hasLicensing = isBound(FeatureGate);

  if (hasLicensing) {
    bind(CloudDocumentStore).toSelf().inSingletonScope();
    bind(UnifiedDocumentResolver).toSelf().inSingletonScope();
  } else {
    // No licensing package → bind limited/local-only implementations
    bind(CloudDocumentStore)
      .toDynamicValue(() => new LocalOnlyDocumentStore())
      .inSingletonScope();
  }
});
```

**Frontend (browser/) files:**

- `supabase-workspace-contribution.ts` — Registers commands: "Open Cloud Document", "Save to Cloud", "Configure Supabase Connection" (enterprise mode). Integrates with Theia's `WorkspaceService`.

- `supabase-storage-frontend-module.ts` — Binds the workspace contribution and any frontend-only services.

#### Task 2.5: `@sanyam/supabase-auth` — Theia Authentication

- `supabase-auth-provider.ts` — Implements Theia's `AuthenticationProvider`. Handles Supabase email/password and OAuth sign-in flows. Stores session token. Fires `onDidChangeSessions` events for the IDE.

- `supabase-auth-frontend-module.ts` — Registers the auth provider contribution.

#### Task 2.6: HTTP Gateway — Document CRUD Routes

In `packages/language-server/src/http/`:

- `middleware/auth.ts` — Hono middleware. Extracts `Bearer` JWT from `Authorization` header. Validates via `supabase.auth.getUser()`. Fetches tier from `user_profiles`. Sets `c.user` and `c.userToken` context variables. Supports optional auth (when `SANYAM_AUTH_REQUIRED=false` for local dev).

- `routes/documents.ts` — Full REST API:

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/documents` | List documents (filterable by languageId, paginated) | Optional |
| GET | `/api/v1/documents/:id` | Get single document | Optional |
| POST | `/api/v1/documents` | Create document | Required |
| PUT | `/api/v1/documents/:id` | Update document (with optimistic locking) | Required |
| DELETE | `/api/v1/documents/:id` | Soft delete | Required |
| GET | `/api/v1/documents/:id/versions` | Version history | Optional |
| GET | `/api/v1/documents/:id/versions/:v` | Get specific version | Optional |
| POST | `/api/v1/documents/:id/versions/:v/restore` | Restore version | Required |
| POST | `/api/v1/documents/:id/shares` | Share document | Required |
| DELETE | `/api/v1/documents/:id/shares/:userId` | Unshare | Required |

All routes validate input with Zod schemas. Supabase availability is checked via middleware (returns 503 if unconfigured).

- `server.ts` — Register `documents` routes on the existing Hono app.

#### Task 2.7: Dependencies

Add to `packages/language-server/package.json`:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "zod": "^3.22.0",
    "@hono/zod-validator": "^0.2.0"
  }
}
```

#### Task 2.8: Environment Configuration

```bash
# .env.example additions
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SANYAM_AUTH_REQUIRED=false          # true in production
SANYAM_ENTERPRISE_MODE=false        # true for self-hosted
SANYAM_WORKSPACE_ROOT=/workspace
```

---

### Phase 3: API Keys & External Access

**Goal**: Enable programmatic access for CI/CD, scripts, and third-party integrations.

#### Task 3.1: Database Schema — `supabase/migrations/003_api_keys.sql`

Creates:

- `api_keys` table (user_id, name, key_prefix, key_hash via bcrypt, scopes array, expiration, revocation, usage tracking). Prefix format: `sk_(live|test)_{4chars}`.
- `api_key_usage` table (per-request telemetry: endpoint, method, status, response time, IP, user agent).
- `rate_limits` table (sliding window counters per key).
- `check_rate_limit()` PL/pgSQL function (atomic increment + check).
- RLS: users manage own keys, service role has full access for validation.

#### Task 3.2: API Key Service

`packages/language-server/src/services/api-key-service.ts`:

- `createApiKey(request, userToken)` → generates `sk_{env}_{prefix}_{base64url}`, bcrypt-hashes for storage, returns `ApiKeyWithSecret` (key shown only once).
- `listApiKeys(userToken)` → user's active (non-revoked) keys.
- `getApiKey(keyId, userToken)` → single key details.
- `revokeApiKey(keyId, userToken)` → sets `revoked_at`.
- `validateApiKey(key)` → looks up by prefix, bcrypt-compares, checks expiration. Used by auth middleware. Returns `ApiKeyValidation` with scopes.
- `checkRateLimit(keyId, windowMinutes, maxRequests)` → calls `check_rate_limit()` RPC. Returns `{ allowed, info: RateLimitInfo }`.
- `logUsage(keyId, endpoint, method, status, responseTime, ip, ua)` → fire-and-forget insert into `api_key_usage`.

#### Task 3.3: Auth Middleware Update

Extend `middleware/auth.ts` to support dual authentication:

```typescript
const [scheme, token] = authHeader.split(' ');

if (scheme === 'Bearer') {
  await authenticateJWT(c, token);       // existing path
} else if (scheme === 'ApiKey') {
  await authenticateApiKey(c, token);    // new path
} else {
  throw new HTTPException(401, { message: 'Unsupported authorization scheme' });
}
```

API key auth sets `c.apiKeyId`, `c.apiKeyScopes`, `c.rateLimitInfo` on the Hono context. Add `requireScope(scope)` middleware factory for route-level permission checks.

#### Task 3.4: API Key Routes

`routes/api-keys.ts`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/api-keys` | List user's keys |
| POST | `/api/v1/api-keys` | Create key (returns secret once) |
| GET | `/api/v1/api-keys/:id` | Get key details |
| DELETE | `/api/v1/api-keys/:id` | Revoke key |

All routes require JWT auth (API keys cannot create other API keys).

#### Task 3.5: Usage Logging Middleware

`middleware/usage-logging.ts` — Runs after route handlers. If `c.apiKeyId` is set, fire-and-forget logs the request to `api_key_usage`.

#### Task 3.6: Scope Enforcement on Operations Routes

Update existing `routes/operations.ts` to check API key scopes:

```typescript
app.post('/api/v1/:languageId/operations/:operationId',
  requireScope(`operations:${languageId}:execute`),
  async (c) => { /* ... */ }
);
```

JWT-authenticated users bypass scope checks (they have full access to their own resources via RLS).

#### Task 3.7: Rate Limits by Tier

| Tier | Requests/Hour |
|------|---------------|
| free | 100 |
| pro | 1,000 |
| enterprise | 10,000 |

Rate limit info is returned in response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

#### Task 3.8: Dependencies

Add to `packages/language-server/package.json`:

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

### Phase 4: IDE Integration & Polish

**Goal**: Seamless end-user experience in the Theia IDE.

#### Task 4.1: Conditional Module Loading

The startup flow integrates both strategies:

```
IDE Startup
    │
    ▼
Is @sanyam/supabase-core in node_modules?
    NO → Local filesystem only (file:// URIs)
    YES ↓
    │
    ▼
Is Supabase configured? (env vars present)
    NO → Local filesystem only, cloud commands hidden
    YES ↓
    │
    ▼
Is @sanyam/licensing present?
    NO → All cloud features enabled (free tier defaults)
    YES ↓
    │
    ▼
Is user authenticated?
    NO → Show sign-in prompt, defer cloud features
    YES ↓
    │
    ▼
Load user tier from user_profiles
    │
    ├─ free      → Cloud storage + auth only
    ├─ pro       → + sharing, versioning
    └─ enterprise → + API keys, unlimited everything
    │
    ▼
Connection Mode?
    ├─ HOSTED     → Use Sanyam's Supabase project
    └─ ENTERPRISE → Load customer credentials from secure config
```

#### Task 4.2: Workspace Commands

Register Theia commands:

- **"Sanyam: Sign In"** → Opens Supabase auth flow (email/OAuth).
- **"Sanyam: Open Cloud Document"** → Quick-pick list of user's cloud documents. Opens as `sanyam://{id}` editor tab.
- **"Sanyam: Save to Cloud"** → Saves current local document to Supabase. Converts `file://` → `sanyam://`.
- **"Sanyam: Document History"** → Shows version timeline for current `sanyam://` document.
- **"Sanyam: Share Document"** → Dialog to add collaborators with permission levels.
- **"Sanyam: Manage API Keys"** → Webview panel for key creation/revocation (pro+ tier).
- **"Sanyam: Configure Connection"** → For enterprise mode: enter custom Supabase URL/keys.

#### Task 4.3: Status Bar Integration

- Show auth state (signed in as `user@email.com` / "Sign In").
- Show current document storage backend icon: 💾 local, ☁️ cloud.
- Show tier badge for pro/enterprise users.

#### Task 4.4: Graceful Degradation

When cloud features are unavailable (no config, no auth, no license), the IDE must remain fully functional for local development. Specifically:

- All `sanyam://` commands are hidden (not disabled-and-grayed — hidden).
- `UnifiedDocumentResolver` falls through to `file://` and inline resolvers without errors.
- The HTTP gateway returns 503 for `/api/v1/documents/*` routes with a clear message: "Cloud storage not configured."
- No error toasts or console spam on startup if Supabase is simply unconfigured.

---

## File Summary

### New Files to Create

| Phase | File | Purpose |
|-------|------|---------|
| 1 | `packages/types/src/document-reference.ts` | URI types + guards |
| 1 | `packages/types/src/cloud-document.ts` | Document/user/tier interfaces |
| 1 | `packages/types/src/api-key.ts` | API key types + scope matching |
| 1 | `packages/supabase-core/src/common/supabase-types.ts` | ConnectionMode, credential types |
| 1 | `packages/supabase-core/src/node/credential-manager.ts` | Env-based credential loading |
| 1 | `packages/supabase-core/src/node/client-factory.ts` | Inversify SupabaseClient factory |
| 1 | `packages/supabase-core/src/node/supabase-core-backend-module.ts` | DI bindings |
| 1 | `packages/language-server/src/services/supabase-client.ts` | Standalone client helpers (no DI) |
| 2 | `supabase/migrations/001_documents.sql` | Schema: profiles, documents, versions, shares |
| 2 | `supabase/migrations/002_rls_policies.sql` | Row-level security |
| 2 | `packages/licensing/src/common/license-protocol.ts` | Feature constants |
| 2 | `packages/licensing/src/node/license-validator.ts` | Tier fetcher |
| 2 | `packages/licensing/src/node/feature-gate.ts` | Tier → feature mapper |
| 2 | `packages/licensing/src/node/licensing-backend-module.ts` | DI bindings |
| 2 | `packages/supabase-storage/src/node/cloud-document-store.ts` | Supabase CRUD service |
| 2 | `packages/supabase-storage/src/node/document-resolver.ts` | Unified file/sanyam/inline resolver |
| 2 | `packages/supabase-storage/src/node/supabase-storage-backend-module.ts` | Conditional DI bindings |
| 2 | `packages/supabase-storage/src/browser/supabase-workspace-contribution.ts` | IDE commands |
| 2 | `packages/supabase-storage/src/browser/supabase-storage-frontend-module.ts` | Frontend bindings |
| 2 | `packages/supabase-auth/src/browser/supabase-auth-provider.ts` | Theia auth integration |
| 2 | `packages/supabase-auth/src/browser/supabase-auth-frontend-module.ts` | Frontend bindings |
| 2 | `packages/language-server/src/services/cloud-document-store.ts` | Singleton wrapper |
| 2 | `packages/language-server/src/services/document-resolver.ts` | Singleton wrapper |
| 2 | `packages/language-server/src/http/routes/documents.ts` | REST CRUD routes |
| 2 | `packages/language-server/src/http/middleware/auth.ts` | JWT auth middleware |
| 3 | `supabase/migrations/003_api_keys.sql` | Schema: keys, usage, rate limits |
| 3 | `packages/language-server/src/services/api-key-service.ts` | Key lifecycle + validation |
| 3 | `packages/language-server/src/http/routes/api-keys.ts` | Key management routes |
| 3 | `packages/language-server/src/http/middleware/usage-logging.ts` | Telemetry middleware |
| 3 | `docs/api-keys.md` | Developer documentation |

### Existing Files to Modify

| Phase | File | Change |
|-------|------|--------|
| 1 | `packages/types/src/index.ts` | Add re-exports |
| 2 | `packages/language-server/src/http/server.ts` | Register document routes |
| 2 | `packages/language-server/package.json` | Add @supabase/supabase-js, zod deps |
| 3 | `packages/language-server/src/http/middleware/auth.ts` | Add ApiKey auth path |
| 3 | `packages/language-server/src/http/server.ts` | Register api-keys routes |
| 3 | `packages/language-server/package.json` | Add bcryptjs dep |
| 3 | `packages/types/src/index.ts` | Add api-key re-export |

---

## Verification Procedures

### Phase 1 Verification

```bash
# Verify types compile
cd packages/types && npx tsc --noEmit

# Verify supabase-core builds
cd packages/supabase-core && npx tsc --noEmit

# Verify credential detection
SUPABASE_URL=http://test SUPABASE_ANON_KEY=test node -e \
  "const { isSupabaseConfigured } = require('./packages/language-server/dist/services/supabase-client'); \
   console.log('configured:', isSupabaseConfigured())"
```

### Phase 2 Verification

```bash
# Apply migrations
supabase db push

# Test auth + document CRUD
curl -X POST http://localhost:3002/api/v1/documents \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"languageId": "ecml", "name": "test.ecml", "content": "model Test {}"}'

# Test sanyam:// URI in operations
curl -X POST http://localhost:3002/api/v1/ecml/operations/validate \
  -H "Authorization: Bearer $JWT" \
  -d '{"uri": "sanyam://DOCUMENT_ID"}'

# Test graceful degradation (no Supabase)
unset SUPABASE_URL
curl http://localhost:3002/api/v1/documents
# → 503 "Cloud storage not configured"
```

### Phase 3 Verification

```bash
# Create API key (requires JWT)
curl -X POST http://localhost:3002/api/v1/api-keys \
  -H "Authorization: Bearer $JWT" \
  -d '{"name": "CI Key", "scopes": ["documents:read"]}'

# Use API key
curl http://localhost:3002/api/v1/documents \
  -H "Authorization: ApiKey sk_test_xxxx_..."

# Verify rate limit headers
curl -I http://localhost:3002/api/v1/documents \
  -H "Authorization: ApiKey sk_test_xxxx_..."
# → X-RateLimit-Limit: 100
# → X-RateLimit-Remaining: 99
# → X-RateLimit-Reset: 2025-...
```

---

## Open Questions for Implementation

1. **Supabase Realtime for file watching**: Strategy A mentioned using Supabase Realtime for `FileSystemWatcher` events. This would enable near-real-time collaborative editing indicators. Should this be Phase 2 or deferred to a future collaboration phase?

2. **Offline queuing**: Strategy A proposed queuing writes when disconnected and syncing on reconnect. This adds significant complexity (conflict resolution, queue persistence). Recommend deferring to a future phase and instead showing a clear "offline — changes not saved" indicator.

3. **Local caching layer**: Strategy A recommended a local cache for performance. The `UnifiedDocumentResolver` already maintains an in-memory content cache. A persistent local cache (e.g., SQLite or filesystem) for offline read access could be added later.

4. **Supabase Storage for binary assets**: If grammars need to reference images, generated diagrams, or compiled artifacts, Supabase Storage (blob) can be added alongside the PostgreSQL document store. This would use a separate URI scheme (e.g., `sanyam-asset://bucket/path`) or a sub-path convention (e.g., `sanyam://doc-id/assets/diagram.svg`).

5. **Multi-tenancy / Organizations**: The schema includes `organization_id` on `user_profiles` but no `organizations` table yet. Enterprise deployments will need org-level isolation, shared buckets, and admin roles. This should be a dedicated Phase 5.
