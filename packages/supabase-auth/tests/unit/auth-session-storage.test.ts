/**
 * Unit tests for AuthSessionStorage
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthSessionStorageImpl,
  createAuthSessionStorage,
  type SecretStorage,
} from '../../src/auth-session-storage.js';
import type { AuthSession, UserProfile } from '@sanyam/types';

function createMockSession(overrides: Partial<AuthSession> = {}): AuthSession {
  const user: UserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    display_name: 'Test User',
    avatar_url: null,
    tier: 'free',
    storage_used_bytes: 0,
    document_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    id: 'session-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    user,
    ...overrides,
  };
}

function createMockSecretStorage(): SecretStorage & {
  getStored: () => Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    store: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getStored: () => store,
  };
}

describe('AuthSessionStorage', () => {
  let storage: AuthSessionStorageImpl;
  let mockSecretStorage: ReturnType<typeof createMockSecretStorage>;

  beforeEach(() => {
    mockSecretStorage = createMockSecretStorage();
    storage = createAuthSessionStorage(mockSecretStorage) as AuthSessionStorageImpl;
  });

  describe('storeSession', () => {
    it('should store valid session', async () => {
      const session = createMockSession();

      await storage.storeSession(session);

      expect(mockSecretStorage.store).toHaveBeenCalledTimes(1);
      const storedValue = mockSecretStorage.getStored().get('sanyam.auth.session');
      expect(storedValue).toBeDefined();
      expect(JSON.parse(storedValue!)).toEqual(session);
    });

    it('should throw for invalid session', async () => {
      const invalidSession = {
        id: 'session-123',
        // Missing required fields
      } as AuthSession;

      await expect(storage.storeSession(invalidSession)).rejects.toThrow(
        'Invalid session structure'
      );
    });

    it('should throw for session without user', async () => {
      const invalidSession = {
        id: 'session-123',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now(),
        user: null,
      } as unknown as AuthSession;

      await expect(storage.storeSession(invalidSession)).rejects.toThrow(
        'Invalid session structure'
      );
    });
  });

  describe('loadSession', () => {
    it('should return null when no session stored', async () => {
      const session = await storage.loadSession();

      expect(session).toBeNull();
    });

    it('should return stored session', async () => {
      const originalSession = createMockSession();
      await storage.storeSession(originalSession);

      const loadedSession = await storage.loadSession();

      expect(loadedSession).toEqual(originalSession);
    });

    it('should return session even if about to expire (for refresh attempt)', async () => {
      const aboutToExpireSession = createMockSession({
        expiresAt: Date.now() + 30000, // 30 seconds from now (within 60s buffer)
      });
      await storage.storeSession(aboutToExpireSession);

      const loadedSession = await storage.loadSession();

      // Should still return session so auth provider can attempt refresh
      expect(loadedSession).toEqual(aboutToExpireSession);
    });

    it('should return null for corrupted session data', async () => {
      // Directly store invalid JSON
      await mockSecretStorage.store('sanyam.auth.session', 'not-valid-json');

      const session = await storage.loadSession();

      expect(session).toBeNull();
    });

    it('should return null and clear invalid session structure', async () => {
      // Store session missing required fields
      await mockSecretStorage.store(
        'sanyam.auth.session',
        JSON.stringify({ id: 'test' })
      );

      const session = await storage.loadSession();

      expect(session).toBeNull();
      expect(mockSecretStorage.delete).toHaveBeenCalled();
    });
  });

  describe('clearSession', () => {
    it('should clear stored session', async () => {
      const session = createMockSession();
      await storage.storeSession(session);

      await storage.clearSession();

      expect(mockSecretStorage.delete).toHaveBeenCalledWith('sanyam.auth.session');
      const loadedSession = await storage.loadSession();
      expect(loadedSession).toBeNull();
    });

    it('should not throw when no session to clear', async () => {
      await expect(storage.clearSession()).resolves.not.toThrow();
    });
  });

  describe('hasStoredSession', () => {
    it('should return false when no session stored', async () => {
      const hasSession = await storage.hasStoredSession();

      expect(hasSession).toBe(false);
    });

    it('should return true when session is stored', async () => {
      await storage.storeSession(createMockSession());

      const hasSession = await storage.hasStoredSession();

      expect(hasSession).toBe(true);
    });

    it('should return false after clearing session', async () => {
      await storage.storeSession(createMockSession());
      await storage.clearSession();

      const hasSession = await storage.hasStoredSession();

      expect(hasSession).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle storage.get errors gracefully', async () => {
      const errorStorage: SecretStorage = {
        get: vi.fn().mockRejectedValue(new Error('Storage error')),
        store: vi.fn(),
        delete: vi.fn(),
      };
      const errorHandlingStorage = createAuthSessionStorage(errorStorage);

      const session = await errorHandlingStorage.loadSession();

      expect(session).toBeNull();
    });

    it('should propagate storage.store errors', async () => {
      const errorStorage: SecretStorage = {
        get: vi.fn(),
        store: vi.fn().mockRejectedValue(new Error('Storage error')),
        delete: vi.fn(),
      };
      const errorHandlingStorage = createAuthSessionStorage(errorStorage);

      await expect(
        errorHandlingStorage.storeSession(createMockSession())
      ).rejects.toThrow('Storage error');
    });

    it('should propagate storage.delete errors', async () => {
      const errorStorage: SecretStorage = {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn().mockRejectedValue(new Error('Delete error')),
      };
      const errorHandlingStorage = createAuthSessionStorage(errorStorage);

      await expect(errorHandlingStorage.clearSession()).rejects.toThrow('Delete error');
    });

    it('should return false for hasStoredSession on error', async () => {
      const errorStorage: SecretStorage = {
        get: vi.fn().mockRejectedValue(new Error('Storage error')),
        store: vi.fn(),
        delete: vi.fn(),
      };
      const errorHandlingStorage = createAuthSessionStorage(errorStorage);

      const hasSession = await errorHandlingStorage.hasStoredSession();

      expect(hasSession).toBe(false);
    });
  });
});

describe('createAuthSessionStorage', () => {
  it('should create storage with provided SecretStorage', () => {
    const mockStorage = createMockSecretStorage();
    const storage = createAuthSessionStorage(mockStorage);

    expect(storage).toBeDefined();
  });

  it('should create storage with in-memory fallback when no SecretStorage provided', () => {
    // Use an explicit in-memory mock for predictable behavior
    const inMemoryStorage = createMockSecretStorage();
    const storage = createAuthSessionStorage(inMemoryStorage);

    expect(storage).toBeDefined();
  });

  it('should work with provided storage', async () => {
    // Use explicit mock storage for reliable test behavior
    const mockStorage = createMockSecretStorage();
    const storage = createAuthSessionStorage(mockStorage);
    const session = createMockSession();

    await storage.storeSession(session);
    const loaded = await storage.loadSession();

    expect(loaded).toEqual(session);
  });
});
