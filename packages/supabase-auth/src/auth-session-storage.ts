/**
 * Authentication Session Storage
 *
 * Secure session storage using Theia's SecretStorage for token persistence.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import type { AuthSession } from '@sanyam/types';

/**
 * DI token for SecretStorage service (provided by Theia).
 */
export const SecretStorage = Symbol('SecretStorage');

/**
 * Simplified interface for Theia SecretStorage.
 */
export interface SecretStorage {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  onDidChangeSecret?: (handler: (event: { key: string }) => void) => { dispose(): void };
}

/**
 * DI token for AuthSessionStorage.
 */
export const AuthSessionStorage = Symbol('AuthSessionStorage');

/**
 * Storage key for auth session.
 */
const SESSION_STORAGE_KEY = 'sanyam.auth.session';

/**
 * Interface for authentication session storage.
 */
export interface AuthSessionStorage {
  /**
   * Load stored session from secure storage.
   *
   * @returns Stored session or null if not found/expired
   */
  loadSession(): Promise<AuthSession | null>;

  /**
   * Store session in secure storage.
   *
   * @param session - Session to store
   */
  storeSession(session: AuthSession): Promise<void>;

  /**
   * Clear stored session from secure storage.
   */
  clearSession(): Promise<void>;

  /**
   * Check if a stored session exists (quick check without parsing).
   *
   * @returns True if session data exists
   */
  hasStoredSession(): Promise<boolean>;
}

/**
 * In-memory fallback storage (for environments without SecretStorage).
 */
class InMemorySecretStorage implements SecretStorage {
  private readonly _data = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this._data.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this._data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this._data.delete(key);
  }
}

/**
 * Default implementation of AuthSessionStorage.
 */
@injectable()
export class AuthSessionStorageImpl implements AuthSessionStorage {
  private readonly storage: SecretStorage;

  constructor(
    @inject(SecretStorage) @optional() secretStorage?: SecretStorage
  ) {
    // Fall back to in-memory storage if SecretStorage not available
    this.storage = secretStorage ?? new InMemorySecretStorage();
  }

  async loadSession(): Promise<AuthSession | null> {
    try {
      const stored = await this.storage.get(SESSION_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const session = JSON.parse(stored) as AuthSession;

      // Validate session structure
      if (!this.isValidSession(session)) {
        console.warn('[AuthSessionStorage] Invalid session structure, clearing');
        await this.clearSession();
        return null;
      }

      // Check if session is expired (with 60-second buffer)
      const now = Date.now();
      const expiresAt = session.expiresAt;
      if (expiresAt && now >= expiresAt - 60000) {
        // Session expired or about to expire - don't auto-clear as refresh may be possible
        // Return the session so the auth provider can attempt refresh
        return session;
      }

      return session;
    } catch (error) {
      console.error('[AuthSessionStorage] Failed to load session:', error);
      return null;
    }
  }

  async storeSession(session: AuthSession): Promise<void> {
    try {
      if (!this.isValidSession(session)) {
        throw new Error('Invalid session structure');
      }

      const serialized = JSON.stringify(session);
      await this.storage.store(SESSION_STORAGE_KEY, serialized);
    } catch (error) {
      console.error('[AuthSessionStorage] Failed to store session:', error);
      throw error;
    }
  }

  async clearSession(): Promise<void> {
    try {
      await this.storage.delete(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('[AuthSessionStorage] Failed to clear session:', error);
      throw error;
    }
  }

  async hasStoredSession(): Promise<boolean> {
    try {
      const stored = await this.storage.get(SESSION_STORAGE_KEY);
      return stored !== undefined && stored !== null;
    } catch {
      return false;
    }
  }

  /**
   * Validate session object structure.
   */
  private isValidSession(session: unknown): session is AuthSession {
    if (!session || typeof session !== 'object') {
      return false;
    }

    const s = session as Record<string, unknown>;
    return (
      typeof s['id'] === 'string' &&
      typeof s['accessToken'] === 'string' &&
      typeof s['refreshToken'] === 'string' &&
      typeof s['expiresAt'] === 'number' &&
      s['user'] !== null &&
      typeof s['user'] === 'object'
    );
  }
}

/**
 * Create an auth session storage instance (for non-DI usage).
 *
 * @param secretStorage - Optional SecretStorage implementation
 * @returns AuthSessionStorage instance
 */
export function createAuthSessionStorage(secretStorage?: SecretStorage): AuthSessionStorage {
  const storage = new AuthSessionStorageImpl();
  // Access the private field directly for non-DI usage
  (storage as any).storage = secretStorage ?? new InMemorySecretStorage();
  return storage;
}
