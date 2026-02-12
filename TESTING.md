# Testing Guide

This document describes the testing infrastructure for Sanyam IDE.

## Quick Start

```bash
# Run unit tests (no external dependencies required)
pnpm test:unit

# Run integration tests (requires local Supabase)
supabase start
pnpm test:integration

# Run database tests (requires local Supabase)
pnpm test:db

# Run all tests with coverage
pnpm test:coverage
```

## Test Types

### Unit Tests

- **Location**: `packages/*/tests/unit/**/*.test.ts` and `packages/*/src/**/*.test.ts`
- **Dependencies**: None (all external dependencies are mocked)
- **Timeout**: 5 seconds per test
- **Command**: `pnpm test:unit`

Unit tests verify individual components in isolation using mock implementations:
- Mock Supabase client with fluent query builder
- Mock Theia services (SecretStorage, AuthenticationService, CommandRegistry)
- Container test harness for DI wiring tests

### Integration Tests

- **Location**: `packages/*/tests/integration/**/*.integration.test.ts`
- **Dependencies**: Local Supabase instance
- **Timeout**: 15 seconds per test
- **Command**: `pnpm test:integration`

Integration tests verify real database interactions:
- CRUD operations against Supabase
- RLS policy enforcement
- Optimistic locking behavior
- Feature gating with real tier lookups

### Database Tests

- **Location**: `supabase/tests/**/*.test.ts`
- **Dependencies**: Local Supabase instance
- **Timeout**: 10 seconds per test
- **Command**: `pnpm test:db`

Database tests verify schema correctness:
- RLS policies per table
- Trigger behavior (auto-profile, version retention, storage tracking)
- Soft delete cascade preservation
- Foreign key constraints

## Naming Conventions (FR-075-080)

### File Naming

| Test Type | Pattern | Example |
|-----------|---------|---------|
| Unit | `*.test.ts` | `feature-gate.test.ts` |
| Integration | `*.integration.test.ts` | `document-crud.integration.test.ts` |
| Database | `*.test.ts` (in supabase/tests/) | `rls-policies.test.ts` |

### Test Descriptions

Use descriptive `describe` and `it` blocks:

```typescript
describe('FeatureGate', () => {
  describe('checkFeature', () => {
    it('should return true for enterprise tier with api_keys feature', async () => {
      // ...
    });

    it('should return false for free tier with api_keys feature', async () => {
      // ...
    });
  });
});
```

### Factory Functions

Factory functions follow the `build*` prefix convention:

```typescript
import { buildDocument, buildCreateDocumentRequest } from '@sanyam/test-utils/factories/document-factory';

const doc = buildDocument({ name: 'Custom Name' });
const request = buildCreateDocumentRequest({ languageId: 'json' });
```

## Test Utilities (@sanyam/test-utils)

### Mock Supabase Client

```typescript
import { createMockSupabaseClient } from '@sanyam/test-utils/mocks/supabase-client';

const { client, store } = createMockSupabaseClient();

// Pre-populate data
store.set('documents', [buildDocument()]);

// Or inject errors
const { client } = createMockSupabaseClient({
  errorOn: { table: 'documents', method: 'select' },
  errorMessage: 'Connection failed',
});
```

### Test User Management

```typescript
import { createTestUser, cleanupTestUser } from '@sanyam/test-utils/setup/test-user';

const user = await createTestUser('pro'); // Creates ephemeral Supabase user
// Use user.accessToken for authenticated requests
await cleanupTestUser(user); // Deletes user and all owned data
```

### Container Test Harness

```typescript
import { ContainerTestHarness } from '@sanyam/test-utils/harness/container-harness';

const harness = new ContainerTestHarness();
harness.bindMock('SupabaseClient', mockClient);
harness.bind(FeatureGate);

const featureGate = harness.get(FeatureGate);
```

### Theia Mocks

```typescript
import { MockSecretStorage } from '@sanyam/test-utils/mocks/secret-storage';
import { MockAuthenticationService } from '@sanyam/test-utils/mocks/authentication-service';
import { MockCommandRegistry } from '@sanyam/test-utils/mocks/command-registry';
```

## Coverage Thresholds (FR-054-058)

| Package | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| document-store | 90% | 85% | 90% | 90% |
| licensing | 90% | 85% | 90% | 90% |
| test-utils | 90% | 85% | 90% | 90% |
| supabase-auth | 85% | 80% | 85% | 85% |
| language-server/http | 85% | 80% | 85% | 85% |

## Timeout Configuration (FR-050-053)

| Test Type | Per-Test Timeout | Hook Timeout |
|-----------|-----------------|--------------|
| Unit | 5s | 5s |
| Integration | 15s | 15s |
| Database | 10s | 60s |

Use `--bail 1` in CI to abort after first failure (global 5-minute suite limit).

## Running Tests in CI

The test workflow (`.github/workflows/test.yml`) runs:

1. **Type Check**: `tsc --noEmit` gates all test jobs
2. **Unit Tests**: Parallel, no external dependencies
3. **Integration Tests**: Sequential, with Supabase lifecycle
4. **Database Tests**: Sequential, validates schema correctness

## Local Development

### Prerequisites

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start local Supabase (for integration/database tests)
supabase start
```

### Running Specific Tests

```bash
# Run tests in a specific package
pnpm vitest run --project unit packages/licensing/

# Run tests matching a pattern
pnpm vitest run --project unit -t "FeatureGate"

# Run with watch mode
pnpm vitest --project unit
```

### Debugging Tests

```bash
# Run with verbose output
pnpm vitest run --reporter verbose

# Run with UI
pnpm vitest --ui
```

## Skipping Tests Without Supabase

Integration and database tests automatically skip when Supabase is not configured:

```typescript
const shouldSkip = !process.env['SUPABASE_URL'];

describe.skipIf(shouldSkip)('Integration Tests', () => {
  // These tests only run when Supabase is available
});
```

This allows `pnpm test` to run all tests, with integration tests gracefully skipped in environments without Supabase.
