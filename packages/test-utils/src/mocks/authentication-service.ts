/**
 * Mock AuthenticationService for Theia testing.
 *
 * Captures authentication provider registrations for verification.
 */

/**
 * Authentication provider interface compatible with Theia's API.
 */
export interface AuthenticationProvider {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable label */
  readonly label: string;
  /**
   * Create a new authentication session.
   * @param scopes - Requested OAuth scopes
   */
  createSession(scopes: string[]): Promise<AuthenticationSession>;
  /**
   * Remove an existing session.
   * @param sessionId - Session ID to remove
   */
  removeSession(sessionId: string): Promise<void>;
}

/**
 * Authentication session interface compatible with Theia's API.
 */
export interface AuthenticationSession {
  /** Unique session identifier */
  readonly id: string;
  /** Access token for API calls */
  readonly accessToken: string;
  /** Account information */
  readonly account: { id: string; label: string };
  /** Granted OAuth scopes */
  readonly scopes: string[];
}

/**
 * Mock AuthenticationService that captures provider registrations.
 */
export interface MockAuthenticationService {
  /**
   * Register an authentication provider.
   * @param id - Provider identifier
   * @param provider - Provider implementation
   */
  registerAuthenticationProvider(id: string, provider: AuthenticationProvider): void;

  /**
   * Get a registered provider by ID.
   * @param id - Provider identifier
   */
  getProvider(id: string): AuthenticationProvider | undefined;

  /**
   * Access all registered providers for test assertions.
   */
  readonly providers: ReadonlyMap<string, AuthenticationProvider>;
}

/**
 * Creates a mock AuthenticationService that captures provider registrations.
 *
 * @returns Mock authentication service for testing
 *
 * @example
 * ```typescript
 * const authService = createMockAuthenticationService();
 *
 * const myProvider: AuthenticationProvider = {
 *   id: 'my-provider',
 *   label: 'My Auth',
 *   createSession: async (scopes) => ({ ... }),
 *   removeSession: async (sessionId) => { ... },
 * };
 *
 * authService.registerAuthenticationProvider('my-provider', myProvider);
 * expect(authService.providers.has('my-provider')).toBe(true);
 * ```
 */
export function createMockAuthenticationService(): MockAuthenticationService {
  const providers = new Map<string, AuthenticationProvider>();

  return {
    registerAuthenticationProvider(id: string, provider: AuthenticationProvider): void {
      providers.set(id, provider);
    },

    getProvider(id: string): AuthenticationProvider | undefined {
      return providers.get(id);
    },

    get providers(): ReadonlyMap<string, AuthenticationProvider> {
      return providers;
    },
  };
}
