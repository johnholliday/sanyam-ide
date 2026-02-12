# Data Model: Cloud Test Infrastructure

**Feature**: 008-cloud-test-infrastructure
**Date**: 2026-02-12

## Test Entities

### TestUser

Represents an ephemeral user created for test isolation.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Supabase auth user ID |
| email | string | Format: `{uuid}@test.com` (enables failsafe cleanup) |
| accessToken | string | JWT from GoTrue for authenticated requests |
| refreshToken | string | Refresh token for session renewal |
| tier | SubscriptionTier | User's subscription tier (free/pro/enterprise) |

**Lifecycle**:
1. Created via `createTestUser(tier?)` factory
2. Tracked in module-level Set for cleanup
3. Deleted via `cleanupTestUser(user)` (cascade deletes owned data)
4. Failsafe: global afterAll deletes all `*@test.com` users

### MockSupabaseClient

Simulated Supabase client for unit tests.

| Field | Type | Description |
|-------|------|-------------|
| data | Record<string, any[]> | In-memory data store by table |
| errors | Record<string, SupabaseError> | Table-specific error injection |
| queryLog | QueryLogEntry[] | Recorded query operations |

**Query Builder Chain**:
```typescript
mockClient.from('documents')
  .select('*')
  .eq('user_id', userId)
  // Returns: { data: [...], error: null }
```

**Error Injection**:
```typescript
createMockSupabaseClient({
  errors: { documents: { code: 'PGRST301', message: 'Row not found' } }
});
// All documents queries return { data: null, error: { code, message } }
```

### MockSupabaseClientOffline

Variant that rejects all calls for degradation testing.

| Field | Type | Description |
|-------|------|-------------|
| networkError | Error | Standard network error returned by all operations |

**Behavior**: All query builder chains reject with `{ data: null, error: networkError }`.

### ContainerTestHarness

Inversify container builder for DI wiring verification.

| Field | Type | Description |
|-------|------|-------------|
| modules | ContainerModule[] | Modules to load into container |
| container | Container | Built inversify container |

**Test Permutations**:
- No cloud modules → no cloud bindings
- Supabase unconfigured → CredentialManager.isConfigured() = false
- Free tier → FeatureGate bound, sharing gated
- Pro tier → all pro features available

### MockSecretStorage

In-memory implementation of Theia SecretStorage interface.

| Field | Type | Description |
|-------|------|-------------|
| store | Map<string, string> | Key-value storage |

**Methods**: `get(key)`, `set(key, value)`, `delete(key)`

### MockAuthenticationService

Captures authentication provider registrations.

| Field | Type | Description |
|-------|------|-------------|
| providers | Map<string, AuthProvider> | Registered providers by ID |

**Methods**: `registerAuthenticationProvider(id, provider)`, `getProvider(id)`

### MockCommandRegistry

Captures command registrations for verification.

| Field | Type | Description |
|-------|------|-------------|
| commands | Map<string, CommandHandler> | Registered commands by ID |

**Methods**: `registerCommand(id, handler)`, `executeCommand(id, ...args)`

### LoggingMock

Captures log calls by level.

| Field | Type | Description |
|-------|------|-------------|
| logs | Record<LogLevel, LogEntry[]> | Captured logs by level |

**Levels**: debug, info, warn, error

## Factory Functions

### Document Factories

```typescript
buildCreateDocumentRequest(overrides?: Partial<CreateDocumentRequest>): CreateDocumentRequest
buildDocument(overrides?: Partial<CloudDocument>): CloudDocument
```

### User Factories

```typescript
createTestUser(tier?: SubscriptionTier): Promise<TestUser>
cleanupTestUser(user: TestUser): Promise<void>
```

### API Key Factories

```typescript
buildCreateApiKeyRequest(overrides?: Partial<CreateApiKeyRequest>): CreateApiKeyRequest
buildApiKey(overrides?: Partial<ApiKey>): ApiKey
```

### User Profile Factories

```typescript
buildUserProfile(overrides?: Partial<UserProfile>): UserProfile
```

## Relationships

```
TestUser (1) ──creates──> (N) CloudDocument
TestUser (1) ──creates──> (N) ApiKey
CloudDocument (1) ──has──> (N) DocumentVersion
CloudDocument (1) ──has──> (N) DocumentShare

ContainerTestHarness ──builds──> Container
Container ──resolves──> FeatureGate, CredentialManager, CloudDocumentStore, etc.

MockSupabaseClient ──used by──> Unit Tests
TestUser + Real Supabase ──used by──> Integration Tests
```

## State Transitions

### TestUser Lifecycle

```
[Created] → createTestUser()
    ↓
[Active] → used in test assertions
    ↓
[Deleted] → cleanupTestUser() or failsafe
```

### MockSupabaseClient Modes

```
[Normal] → returns data from in-memory store
    ↓ (configure errors)
[Error] → returns specified error for table
    ↓ (createMockSupabaseClientOffline)
[Offline] → rejects all calls with network error
```
