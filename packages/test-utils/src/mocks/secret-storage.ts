/**
 * Mock SecretStorage implementation for Theia testing.
 *
 * Provides an in-memory key-value store that mimics the Theia SecretStorage interface.
 */

/**
 * Mock SecretStorage interface compatible with Theia's API.
 */
export interface MockSecretStorage {
  /**
   * Retrieve a secret by key.
   * @param key - The secret key
   * @returns The secret value or undefined if not found
   */
  get(key: string): Promise<string | undefined>;

  /**
   * Store a secret.
   * @param key - The secret key
   * @param value - The secret value
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Delete a secret.
   * @param key - The secret key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Access underlying store for test assertions.
   */
  readonly store: ReadonlyMap<string, string>;
}

/**
 * Creates an in-memory implementation of Theia SecretStorage interface.
 *
 * @returns Mock secret storage for testing
 *
 * @example
 * ```typescript
 * const secretStorage = createMockSecretStorage();
 *
 * await secretStorage.set('api-key', 'secret123');
 * const value = await secretStorage.get('api-key');
 * expect(value).toBe('secret123');
 * expect(secretStorage.store.has('api-key')).toBe(true);
 * ```
 */
export function createMockSecretStorage(): MockSecretStorage {
  const store = new Map<string, string>();

  return {
    async get(key: string): Promise<string | undefined> {
      return store.get(key);
    },

    async set(key: string, value: string): Promise<void> {
      store.set(key, value);
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },

    get store(): ReadonlyMap<string, string> {
      return store;
    },
  };
}
