# @sanyam/test-utils

Shared testing utilities for Sanyam IDE packages.

## Installation

This package is part of the Sanyam IDE monorepo and is automatically available to other packages.

```json
{
  "devDependencies": {
    "@sanyam/test-utils": "workspace:*"
  }
}
```

## Features

- Mock Supabase client with fluent query builder API
- Mock Theia services (SecretStorage, AuthenticationService, CommandRegistry)
- Container test harness for Inversify DI testing
- Test user management for integration tests
- Test data factories for documents, API keys, user profiles

## Quick Start

```typescript
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { createMockSupabaseClient } from '@sanyam/test-utils/mocks/supabase-client';
import { buildDocument } from '@sanyam/test-utils/factories/document-factory';

describe('MyService', () => {
  it('should fetch documents', async () => {
    const { client, store } = createMockSupabaseClient();
    store.set('documents', [buildDocument({ name: 'Test' })]);

    const { data } = await client.from('documents').select().single();

    expect(data?.name).toBe('Test');
  });
});
```

## Mock Supabase Client

### Basic Usage

```typescript
import { createMockSupabaseClient } from '@sanyam/test-utils/mocks/supabase-client';

const { client, store, queryLog } = createMockSupabaseClient();

// Pre-populate data
store.set('documents', [
  { id: '1', name: 'Doc 1' },
  { id: '2', name: 'Doc 2' },
]);

// Execute queries
const { data } = await client.from('documents').select().eq('id', '1').single();

// Verify query execution
expect(queryLog).toContainEqual({
  table: 'documents',
  method: 'select',
  filters: [{ column: 'id', operator: 'eq', value: '1' }],
});
```

### Error Injection

```typescript
const { client } = createMockSupabaseClient({
  errorOn: { table: 'documents', method: 'insert' },
  errorMessage: 'Storage quota exceeded',
});

const { error } = await client.from('documents').insert({ name: 'Test' });
expect(error?.message).toBe('Storage quota exceeded');
```

### Offline Mode

```typescript
import { createMockSupabaseClientOffline } from '@sanyam/test-utils/mocks/supabase-client';

const { client } = createMockSupabaseClientOffline();

// All operations fail with network error
const { error } = await client.from('documents').select();
expect(error?.message).toContain('network');
```

## Test Data Factories

### Document Factory

```typescript
import {
  buildDocument,
  buildCreateDocumentRequest
} from '@sanyam/test-utils/factories/document-factory';

// Full document with defaults
const doc = buildDocument();
// { id: 'uuid', name: 'Test Document', language_id: 'sanyam', ... }

// Override specific fields
const customDoc = buildDocument({
  name: 'Custom Name',
  version: 5,
});

// Request payload
const request = buildCreateDocumentRequest({ languageId: 'json' });
// { name: 'Test Document', languageId: 'json', content: '...' }
```

### API Key Factory

```typescript
import {
  buildApiKey,
  buildCreateApiKeyRequest
} from '@sanyam/test-utils/factories/api-key-factory';

const key = buildApiKey({ scopes: ['admin:*'] });
const request = buildCreateApiKeyRequest({ name: 'CI/CD Key' });
```

### User Profile Factory

```typescript
import { buildUserProfile } from '@sanyam/test-utils/factories/user-profile-factory';

const profile = buildUserProfile({ tier: 'pro' });
```

## Container Test Harness

For testing Inversify DI configurations:

```typescript
import { ContainerTestHarness } from '@sanyam/test-utils/harness/container-harness';

describe('MyService', () => {
  let harness: ContainerTestHarness;

  beforeEach(() => {
    harness = new ContainerTestHarness();
    harness.bindMock('SupabaseClient', mockClient);
    harness.bind(MyService);
  });

  afterEach(() => {
    harness.dispose();
  });

  it('should resolve service', () => {
    const service = harness.get(MyService);
    expect(service).toBeDefined();
  });
});
```

## Theia Mocks

### SecretStorage

```typescript
import { MockSecretStorage } from '@sanyam/test-utils/mocks/secret-storage';

const storage = new MockSecretStorage();
await storage.store('my-key', 'secret-value');
const value = await storage.get('my-key');
expect(value).toBe('secret-value');
```

### AuthenticationService

```typescript
import { MockAuthenticationService } from '@sanyam/test-utils/mocks/authentication-service';

const auth = new MockAuthenticationService();
auth.registerAuthenticationProvider('github', provider);
expect(auth.registeredProviders).toContain('github');
```

### CommandRegistry

```typescript
import { MockCommandRegistry } from '@sanyam/test-utils/mocks/command-registry';

const registry = new MockCommandRegistry();
registry.registerCommand({ id: 'my.command' }, handler);
expect(registry.registeredCommands).toContain('my.command');
```

## Test User Management (Integration Tests)

For integration tests that need real Supabase users:

```typescript
import {
  createTestUser,
  cleanupTestUser
} from '@sanyam/test-utils/setup/test-user';

describe('Integration Tests', () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await createTestUser('pro'); // Creates real Supabase user
  });

  afterEach(async () => {
    await cleanupTestUser(user); // Deletes user and owned data
  });

  it('should authenticate', async () => {
    // Use user.accessToken for authenticated requests
    expect(user.accessToken).toBeDefined();
    expect(user.tier).toBe('pro');
  });
});
```

## Parallelization (FR-028)

Unit tests run in parallel by default. Integration and database tests run sequentially to avoid conflicts.

### Safe for Parallel Execution

- Tests using `createMockSupabaseClient()` (isolated mock per test)
- Tests using factories (`buildDocument()`, etc.)
- Tests using `ContainerTestHarness` (isolated container per test)

### NOT Safe for Parallel Execution

- Tests using `createTestUser()` (shared database state)
- Tests modifying real Supabase data
- Tests that depend on specific database state

The Vitest workspace configuration handles this automatically:
- Unit tests: `pool: 'threads'` (parallel)
- Integration tests: `pool: 'forks', singleFork: true` (sequential)
- Database tests: `pool: 'forks', singleFork: true` (sequential)

## Exports

All utilities are available via subpath exports:

```typescript
// Mocks
import { createMockSupabaseClient } from '@sanyam/test-utils/mocks/supabase-client';
import { MockSecretStorage } from '@sanyam/test-utils/mocks/secret-storage';
import { MockAuthenticationService } from '@sanyam/test-utils/mocks/authentication-service';
import { MockCommandRegistry } from '@sanyam/test-utils/mocks/command-registry';

// Factories
import { buildDocument } from '@sanyam/test-utils/factories/document-factory';
import { buildApiKey } from '@sanyam/test-utils/factories/api-key-factory';
import { buildUserProfile } from '@sanyam/test-utils/factories/user-profile-factory';

// Harness
import { ContainerTestHarness } from '@sanyam/test-utils/harness/container-harness';

// Setup (integration tests)
import { createTestUser, cleanupTestUser } from '@sanyam/test-utils/setup/test-user';

// Helpers
import { waitForHealthy } from '@sanyam/test-utils/helpers/health-check';
import { constructStripeSignature } from '@sanyam/test-utils/helpers/stripe-signature';
```

## License

Apache-2.0
