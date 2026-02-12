/**
 * @sanyam/test-utils API Contracts
 *
 * This file defines the public API surface for the test utilities package.
 * Implementation MUST conform to these interfaces.
 */

// ============================================================================
// Core Types
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SupabaseError {
  code: string;
  message: string;
  details?: string;
}

// ============================================================================
// Test User
// ============================================================================

/**
 * Represents an ephemeral test user with Supabase credentials.
 */
export interface TestUser {
  /** Supabase auth user ID (UUID) */
  readonly id: string;
  /** Email in format {uuid}@test.com */
  readonly email: string;
  /** JWT access token from GoTrue */
  readonly accessToken: string;
  /** Refresh token for session renewal */
  readonly refreshToken: string;
  /** User's subscription tier */
  readonly tier: SubscriptionTier;
}

/**
 * Creates an ephemeral test user via Supabase auth admin API.
 * User is registered in module-level Set for cleanup tracking.
 *
 * @param tier - Subscription tier (default: 'free')
 * @returns Promise resolving to TestUser with valid credentials
 */
export function createTestUser(tier?: SubscriptionTier): Promise<TestUser>;

/**
 * Deletes a test user and all owned data via foreign key cascade.
 * Removes user from tracking Set.
 *
 * @param user - TestUser to delete
 */
export function cleanupTestUser(user: TestUser): Promise<void>;

// ============================================================================
// Mock Supabase Client
// ============================================================================

export interface MockSupabaseClientOptions {
  /** Initial data by table name */
  data?: Record<string, unknown[]>;
  /** Error injection by table name */
  errors?: Record<string, SupabaseError>;
}

export interface QueryLogEntry {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters: Array<{ column: string; operator: string; value: unknown }>;
  timestamp: number;
}

/**
 * Creates a mock Supabase client with query builder chain support.
 *
 * @param options - Configuration for initial data and error injection
 * @returns Mock client compatible with Supabase SDK patterns
 */
export function createMockSupabaseClient(
  options?: MockSupabaseClientOptions
): MockSupabaseClient;

/**
 * Creates a mock Supabase client that rejects all operations with network error.
 * Used for testing graceful degradation and offline scenarios.
 *
 * @returns Mock client that always returns network error
 */
export function createMockSupabaseClientOffline(): MockSupabaseClient;

export interface MockSupabaseClient {
  /** Access query log for verification */
  readonly queryLog: readonly QueryLogEntry[];

  /** Start a query on a table */
  from(table: string): MockQueryBuilder;

  /** Clear all data and query log */
  reset(): void;
}

export interface MockQueryBuilder {
  select(columns?: string): MockQueryBuilder;
  insert(data: unknown): MockQueryBuilder;
  update(data: unknown): MockQueryBuilder;
  delete(): MockQueryBuilder;
  upsert(data: unknown): MockQueryBuilder;

  eq(column: string, value: unknown): MockQueryBuilder;
  neq(column: string, value: unknown): MockQueryBuilder;
  gt(column: string, value: unknown): MockQueryBuilder;
  gte(column: string, value: unknown): MockQueryBuilder;
  lt(column: string, value: unknown): MockQueryBuilder;
  lte(column: string, value: unknown): MockQueryBuilder;
  like(column: string, pattern: string): MockQueryBuilder;
  ilike(column: string, pattern: string): MockQueryBuilder;
  is(column: string, value: unknown): MockQueryBuilder;
  in(column: string, values: unknown[]): MockQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): MockQueryBuilder;
  limit(count: number): MockQueryBuilder;
  range(from: number, to: number): MockQueryBuilder;
  single(): MockQueryBuilder;
  maybeSingle(): MockQueryBuilder;

  /** Execute the query */
  then<T>(
    onfulfilled?: (value: { data: unknown; error: SupabaseError | null }) => T
  ): Promise<T>;
}

// ============================================================================
// Theia Mocks
// ============================================================================

/**
 * In-memory implementation of Theia SecretStorage interface.
 */
export interface MockSecretStorage {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;

  /** Access underlying store for test assertions */
  readonly store: ReadonlyMap<string, string>;
}

export function createMockSecretStorage(): MockSecretStorage;

/**
 * Mock AuthenticationService that captures provider registrations.
 */
export interface MockAuthenticationService {
  registerAuthenticationProvider(
    id: string,
    provider: AuthenticationProvider
  ): void;
  getProvider(id: string): AuthenticationProvider | undefined;

  /** Access all registered providers */
  readonly providers: ReadonlyMap<string, AuthenticationProvider>;
}

export interface AuthenticationProvider {
  readonly id: string;
  readonly label: string;
  createSession(scopes: string[]): Promise<AuthenticationSession>;
  removeSession(sessionId: string): Promise<void>;
}

export interface AuthenticationSession {
  readonly id: string;
  readonly accessToken: string;
  readonly account: { id: string; label: string };
  readonly scopes: string[];
}

export function createMockAuthenticationService(): MockAuthenticationService;

/**
 * Mock CommandRegistry that captures command registrations.
 */
export interface MockCommandRegistry {
  registerCommand(
    id: string,
    handler: (...args: unknown[]) => unknown
  ): { dispose(): void };
  executeCommand<T>(id: string, ...args: unknown[]): Promise<T>;

  /** Check if command is registered */
  hasCommand(id: string): boolean;

  /** Access all registered commands */
  readonly commands: ReadonlyMap<string, (...args: unknown[]) => unknown>;
}

export function createMockCommandRegistry(): MockCommandRegistry;

// ============================================================================
// Container Test Harness
// ============================================================================

export interface ContainerTestHarnessOptions {
  modules: ContainerModule[];
}

/**
 * Test harness for verifying inversify DI wiring.
 */
export interface ContainerTestHarness {
  /** The built container */
  readonly container: Container;

  /** Check if a binding exists */
  isBound<T>(serviceIdentifier: ServiceIdentifier<T>): boolean;

  /** Get a bound service (throws if not bound) */
  get<T>(serviceIdentifier: ServiceIdentifier<T>): T;

  /** Get all bound services for multi-injection */
  getAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[];

  /** Dispose the container */
  dispose(): void;
}

// Note: ContainerModule, Container, ServiceIdentifier from inversify
type ContainerModule = import('inversify').ContainerModule;
type Container = import('inversify').Container;
type ServiceIdentifier<T> = import('inversify').ServiceIdentifier<T>;

export function createContainerTestHarness(
  options: ContainerTestHarnessOptions
): ContainerTestHarness;

// ============================================================================
// Logging Mock
// ============================================================================

export interface LogEntry {
  level: LogLevel;
  message: string;
  args: unknown[];
  timestamp: number;
}

export interface LoggingMock {
  /** Captured logs by level */
  readonly logs: Readonly<Record<LogLevel, readonly LogEntry[]>>;

  /** Get all logs at a specific level */
  getByLevel(level: LogLevel): readonly LogEntry[];

  /** Check if any log contains message */
  hasLogContaining(level: LogLevel, substring: string): boolean;

  /** Clear all captured logs */
  clear(): void;

  /** Install spies on console methods */
  install(): void;

  /** Remove spies from console methods */
  uninstall(): void;
}

export function createLoggingMock(): LoggingMock;

// ============================================================================
// Factories
// ============================================================================

export interface CreateDocumentRequest {
  name: string;
  languageId: string;
  content: string;
}

export interface CloudDocument {
  id: string;
  user_id: string;
  name: string;
  language_id: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function buildCreateDocumentRequest(
  overrides?: Partial<CreateDocumentRequest>
): CreateDocumentRequest;

export function buildDocument(
  overrides?: Partial<CloudDocument>
): CloudDocument;

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export function buildCreateApiKeyRequest(
  overrides?: Partial<CreateApiKeyRequest>
): CreateApiKeyRequest;

export function buildApiKey(overrides?: Partial<ApiKey>): ApiKey;

export interface UserProfile {
  user_id: string;
  tier: SubscriptionTier;
  organization_id: string | null;
  total_storage_bytes: number;
  created_at: string;
  updated_at: string;
}

export function buildUserProfile(
  overrides?: Partial<UserProfile>
): UserProfile;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Constructs a valid Stripe webhook signature for testing.
 *
 * @param payload - JSON stringified webhook payload
 * @param secret - Test-only STRIPE_WEBHOOK_SECRET
 * @param timestamp - Unix timestamp (default: current time)
 * @returns Signature header value
 */
export function constructStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string;

/**
 * Polls /health endpoint until gateway is ready.
 *
 * @param baseUrl - Gateway base URL (default: http://127.0.0.1:54321)
 * @param options - Polling configuration
 * @returns Promise that resolves when healthy or rejects on timeout
 */
export function waitForHealthy(
  baseUrl?: string,
  options?: WaitForHealthyOptions
): Promise<HealthResponse>;

export interface WaitForHealthyOptions {
  /** Maximum wait time in ms (default: 30000) */
  timeout?: number;
  /** Initial polling interval in ms (default: 100) */
  initialInterval?: number;
  /** Maximum polling interval in ms (default: 2000) */
  maxInterval?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
}

export interface HealthResponse {
  status: 'ok';
  supabase: boolean;
  auth: boolean;
  version: string;
}
