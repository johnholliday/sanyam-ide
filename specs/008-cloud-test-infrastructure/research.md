# Research: Cloud Test Infrastructure

**Feature**: 008-cloud-test-infrastructure
**Date**: 2026-02-12
**Status**: Complete (no NEEDS CLARIFICATION markers)

## Overview

All technical decisions were resolved during the clarification phase (41 questions). This document summarizes the key decisions and their rationale.

## Decisions

### Test Framework Selection

**Decision**: Vitest with workspace configuration
**Rationale**: ESM-native, TypeScript-first, pnpm workspace support, fast execution via esbuild
**Alternatives Considered**:
- Jest: Slower, ESM support requires configuration
- Mocha: No built-in TypeScript support

### Coverage Provider

**Decision**: @vitest/coverage-v8
**Rationale**: Native V8 coverage without instrumentation overhead; accurate line/branch coverage
**Alternatives Considered**:
- Istanbul/nyc: Requires transpilation step; slower
- c8: Vitest v8 provider is c8 under the hood

### Test Isolation Strategy

**Decision**: Per-user RLS isolation (default) + serial execution for schema tests
**Rationale**:
- RLS isolation avoids 3-second `supabase db reset` penalty per test
- Parallel execution for 95% of tests (unit + RLS-isolated integration)
- Serial execution only for admin/service-role tests modifying shared state
**Alternatives Considered**:
- Full database reset per suite: Too slow (3s × N suites)
- Transactional rollback: Complex with Supabase auth layer

### Mock Supabase Client Design

**Decision**: Fluent query builder chain with error injection mode
**Rationale**:
- Mimics real Supabase client API (`from().select().eq()`)
- Error mode (`{ errors: { tableName: { code, message } } }`) for testing error paths
- Offline variant for graceful degradation tests
**Alternatives Considered**:
- Simple stub returning static data: Doesn't catch API usage errors
- MSW network mocking: Overkill for unit tests; adds complexity

### Theia Mock Strategy

**Decision**: Type-safe interface implementations in test-utils
**Rationale**:
- MockSecretStorage (Map-backed) for credential storage tests
- MockAuthenticationService captures provider registrations
- MockCommandRegistry captures command registrations
- Type safety via Theia interface implementation
**Alternatives Considered**:
- Partial mocks with jest.fn(): Loses type safety
- Real Theia services in jsdom: Not possible (requires Electron context)

### CI Pipeline Structure

**Decision**: Type-check → Unit → Integration (with Supabase lifecycle)
**Rationale**:
- `tsc --noEmit` catches type drift before runtime
- Unit tests run without external dependencies (fast feedback)
- Integration tests start Supabase, apply migrations + seed, run tests, stop Supabase
**Alternatives Considered**:
- Single job with all tests: Slower, no parallel execution
- Always-on Supabase: Flaky due to container state drift

### Health Check Endpoint

**Decision**: GET /health returning `{ status, supabase, auth, version }`
**Rationale**:
- Single readiness check covering entire gateway
- Replaces fragile Supabase ping in global setup
- `waitForHealthy()` helper with exponential backoff
**Alternatives Considered**:
- Multiple health endpoints: Complexity without benefit
- No health endpoint: Integration test startup unreliable

### Billing Webhook Testing

**Decision**: Construct Stripe signatures manually using test-only secret
**Rationale**:
- Tests real signature verification path
- `test-utils/helpers/stripe-signature.ts` constructs valid HMAC
- STRIPE_WEBHOOK_SECRET env var set only in test environment
**Alternatives Considered**:
- Bypass signature verification in tests: Doesn't test security
- Mock entire Stripe SDK: Misses integration bugs

## Open Items

None. All 41 clarification questions have been resolved and encoded into the specification.

## References

- Vitest Documentation: https://vitest.dev/
- Supabase Local Development: https://supabase.com/docs/guides/cli/local-development
- Stripe Webhook Signatures: https://stripe.com/docs/webhooks/signatures
