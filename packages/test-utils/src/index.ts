/**
 * @sanyam/test-utils
 *
 * Test utilities, mocks, factories, and harnesses for Sanyam IDE cloud packages.
 *
 * @example
 * ```typescript
 * import {
 *   createTestUser,
 *   cleanupTestUser,
 *   createMockSupabaseClient,
 *   createContainerTestHarness,
 *   buildDocument,
 * } from '@sanyam/test-utils';
 * ```
 *
 * @packageDocumentation
 */

// Core types
export type { SubscriptionTier, LogLevel, SupabaseError } from './types.js';

// Test user management
export { createTestUser, cleanupTestUser } from './setup/test-user.js';
export type { TestUser } from './setup/test-user.js';

// Mock Supabase client
export {
  createMockSupabaseClient,
  createMockSupabaseClientOffline,
} from './mocks/supabase-client.js';
export type {
  MockSupabaseClient,
  MockSupabaseClientOptions,
  MockQueryBuilder,
  QueryLogEntry,
} from './mocks/supabase-client.js';

// Theia mocks
export { createMockSecretStorage } from './mocks/secret-storage.js';
export type { MockSecretStorage } from './mocks/secret-storage.js';

export { createMockAuthenticationService } from './mocks/authentication-service.js';
export type {
  MockAuthenticationService,
  AuthenticationProvider,
  AuthenticationSession,
} from './mocks/authentication-service.js';

export { createMockCommandRegistry } from './mocks/command-registry.js';
export type { MockCommandRegistry } from './mocks/command-registry.js';

// Container test harness
export { createContainerTestHarness } from './harness/container-harness.js';
export type {
  ContainerTestHarness,
  ContainerTestHarnessOptions,
} from './harness/container-harness.js';

// Logging mock
export { createLoggingMock } from './mocks/logging-mock.js';
export type { LoggingMock, LogEntry } from './mocks/logging-mock.js';

// Factories
export {
  buildCreateDocumentRequest,
  buildDocument,
} from './factories/document-factory.js';
export type { CreateDocumentRequest, CloudDocument } from './factories/document-factory.js';

export {
  buildCreateApiKeyRequest,
  buildApiKey,
} from './factories/api-key-factory.js';
export type { CreateApiKeyRequest, ApiKey } from './factories/api-key-factory.js';

export { buildUserProfile } from './factories/user-profile-factory.js';
export type { UserProfile } from './factories/user-profile-factory.js';

// Helpers
export { constructStripeSignature } from './helpers/stripe-signature.js';
export { waitForHealthy } from './helpers/health-check.js';
export type { WaitForHealthyOptions, HealthResponse } from './helpers/health-check.js';
