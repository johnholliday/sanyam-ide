# Quickstart: Cloud Test Infrastructure

**Feature**: 008-cloud-test-infrastructure
**Date**: 2026-02-12

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Supabase local development)
- Supabase CLI (`npm install -g supabase`)

## Running Tests

### Unit Tests (No External Dependencies)

```bash
# Run all unit tests
pnpm test:unit

# Run unit tests for a specific package
pnpm test:unit --filter=@sanyam/licensing

# Watch mode for development
pnpm test:unit --watch
```

Unit tests complete in under 30 seconds and require no Docker or network access.

### Integration Tests (Requires Supabase)

```bash
# Start local Supabase (first time or after reset)
supabase start

# Run integration tests
pnpm test:integration

# Run with coverage
pnpm test:integration --coverage
```

Integration tests use real PostgreSQL with RLS policies. They complete in under 3 minutes.

### Full Test Suite

```bash
# Run everything (unit + integration)
pnpm test

# With coverage reporting
pnpm test:coverage
```

### Database Tests

```bash
# Run database-level tests (RLS, triggers, functions)
pnpm test:db
```

These tests run serially to avoid interference when modifying shared schema state.

## Writing Tests

### File Naming Conventions

```
{module-name}.test.ts              # Unit tests
{module-name}.integration.test.ts  # Integration tests
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestUser, cleanupTestUser, createMockSupabaseClient } from '@sanyam/test-utils';

describe('CloudDocumentStore', () => {
  // Unit tests use mocks
  describe('getDocument', () => {
    it('should return document when found', async () => {
      // Arrange
      const mockClient = createMockSupabaseClient({
        data: {
          documents: [{ id: '123', name: 'Test' }]
        }
      });
      const store = new CloudDocumentStore(mockClient);

      // Act
      const doc = await store.getDocument('123');

      // Assert
      expect(doc).toEqual({ id: '123', name: 'Test' });
    });

    it('should return null when not found', async () => {
      const mockClient = createMockSupabaseClient({ data: { documents: [] } });
      const store = new CloudDocumentStore(mockClient);

      const doc = await store.getDocument('nonexistent');

      expect(doc).toBeNull();
    });
  });
});

// Integration tests use real Supabase
describe('CloudDocumentStore (integration)', () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser('free');
  });

  afterEach(async () => {
    await cleanupTestUser(user);
  });

  it('should persist document to Supabase', async () => {
    // Uses real Supabase with RLS
    const store = createCloudDocumentStore(user.accessToken);

    const doc = await store.createDocument({
      name: 'Test Doc',
      languageId: 'sanyam',
      content: '# Hello'
    });

    expect(doc.id).toBeDefined();
    expect(doc.user_id).toBe(user.id);
  });
});
```

### Testing Error Paths

```typescript
import { createMockSupabaseClient, createMockSupabaseClientOffline } from '@sanyam/test-utils';

it('should handle database errors gracefully', async () => {
  const mockClient = createMockSupabaseClient({
    errors: {
      documents: { code: 'PGRST301', message: 'Row not found' }
    }
  });
  const store = new CloudDocumentStore(mockClient);

  await expect(store.getDocument('123')).rejects.toThrow('Document not found');
});

it('should handle network failure', async () => {
  const offlineClient = createMockSupabaseClientOffline();
  const store = new CloudDocumentStore(offlineClient);

  await expect(store.getDocument('123')).rejects.toThrow('Network error');
});
```

### Testing DI Wiring

```typescript
import { createContainerTestHarness } from '@sanyam/test-utils';
import { SupabaseStorageBackendModule } from '@sanyam/document-store';
import { LicensingModule } from '@sanyam/licensing';

describe('Container wiring', () => {
  it('should bind CloudDocumentStore when Supabase configured', () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-key';

    const harness = createContainerTestHarness({
      modules: [SupabaseStorageBackendModule, LicensingModule]
    });

    expect(harness.isBound(CloudDocumentStore)).toBe(true);
    expect(harness.isBound(FeatureGate)).toBe(true);

    harness.dispose();
  });

  it('should bind LocalOnlyDocumentStore when Supabase unconfigured', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    const harness = createContainerTestHarness({
      modules: [SupabaseStorageBackendModule]
    });

    expect(harness.isBound(LocalOnlyDocumentStore)).toBe(true);
    expect(harness.isBound(CloudDocumentStore)).toBe(false);

    harness.dispose();
  });
});
```

### Testing Tier-Specific Behavior

```typescript
describe('FeatureGate (pro tier)', () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser('pro');
  });

  afterEach(async () => {
    await cleanupTestUser(user);
  });

  it('should allow document sharing', async () => {
    const gate = createFeatureGate(user.accessToken);

    expect(await gate.isFeatureEnabled('document-sharing')).toBe(true);
  });
});

describe('FeatureGate (free tier)', () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser('free');
  });

  afterEach(async () => {
    await cleanupTestUser(user);
  });

  it('should deny document sharing', async () => {
    const gate = createFeatureGate(user.accessToken);

    expect(await gate.isFeatureEnabled('document-sharing')).toBe(false);
  });
});
```

### Testing Theia Components

```typescript
import { createMockSecretStorage, createMockAuthenticationService, createMockCommandRegistry } from '@sanyam/test-utils';

describe('SupabaseAuthProvider', () => {
  it('should register authentication provider', () => {
    const authService = createMockAuthenticationService();
    const secretStorage = createMockSecretStorage();
    const commandRegistry = createMockCommandRegistry();

    const provider = new SupabaseAuthProvider(
      authService,
      secretStorage,
      commandRegistry
    );

    provider.initialize();

    expect(authService.providers.has('supabase')).toBe(true);
    expect(commandRegistry.hasCommand('sanyam.auth.signIn')).toBe(true);
  });
});
```

## CI Pipeline

The CI pipeline runs in this order:

1. **Type Check** (`tsc --noEmit`) - Catches type errors before tests
2. **Unit Tests** - Fast feedback, no external dependencies
3. **Start Supabase** - Launches local development stack
4. **Apply Migrations** - Runs `supabase db push`
5. **Apply Seed Data** - Runs `psql -f packages/test-utils/src/fixtures/seed.sql`
6. **Integration Tests** - Tests against real database
7. **Stop Supabase** - Cleanup

Coverage thresholds:
- Core packages (types, licensing, document-store): 90% line coverage
- Auth and HTTP packages: 85% line coverage

## Troubleshooting

### "Skipping integration tests — local Supabase not running"

Run `supabase start` before running integration tests.

### Tests fail with "Row not found" or RLS errors

1. Ensure migrations are applied: `supabase db push`
2. Ensure seed data is applied: `psql -f packages/test-utils/src/fixtures/seed.sql`
3. Check that the test user has the correct tier for the test

### Tests interfere with each other

1. Ensure each test uses `createTestUser()` with unique user
2. Ensure `cleanupTestUser()` is called in `afterEach`
3. For shared-state tests, use serial execution: `test.sequential`

### Coverage below threshold

1. Run `pnpm test:coverage` to see uncovered lines
2. Add tests for uncovered branches
3. Check that test files are not excluded in coverage config
