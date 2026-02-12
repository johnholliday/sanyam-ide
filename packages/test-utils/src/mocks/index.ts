/**
 * Mock implementations for testing
 */

export {
  createMockSupabaseClient,
  createMockSupabaseClientOffline,
} from './supabase-client.js';
export type {
  MockSupabaseClient,
  MockSupabaseClientOptions,
  MockQueryBuilder,
  QueryLogEntry,
} from './supabase-client.js';

export { createMockSecretStorage } from './secret-storage.js';
export type { MockSecretStorage } from './secret-storage.js';

export { createMockAuthenticationService } from './authentication-service.js';
export type {
  MockAuthenticationService,
  AuthenticationProvider,
  AuthenticationSession,
} from './authentication-service.js';

export { createMockCommandRegistry } from './command-registry.js';
export type { MockCommandRegistry } from './command-registry.js';

export { createLoggingMock } from './logging-mock.js';
export type { LoggingMock, LogEntry } from './logging-mock.js';
