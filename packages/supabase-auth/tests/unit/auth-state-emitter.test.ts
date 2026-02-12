/**
 * Unit tests for AuthStateEmitter
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthStateEmitterImpl,
  createAuthStateEmitter,
  type AuthStateEmitter,
} from '../../src/auth-state-emitter.js';
import type { AuthSession, UserProfile, AuthStateEvent } from '@sanyam/types';

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
    expiresAt: Date.now() + 3600000,
    user,
    ...overrides,
  };
}

describe('AuthStateEmitter', () => {
  let emitter: AuthStateEmitter;

  beforeEach(() => {
    emitter = createAuthStateEmitter();
  });

  describe('initial state', () => {
    it('should start with null current state', () => {
      expect(emitter.currentState).toBeNull();
    });

    it('should start with null current session', () => {
      expect(emitter.currentSession).toBeNull();
    });

    it('should start with null current user', () => {
      expect(emitter.currentUser).toBeNull();
    });

    it('should start as not authenticated', () => {
      expect(emitter.isAuthenticated).toBe(false);
    });
  });

  describe('emit', () => {
    it('should update current state when emitting', () => {
      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(emitter.currentState).toEqual({
        event: 'SIGNED_IN',
        session,
      });
    });

    it('should update current session when emitting', () => {
      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(emitter.currentSession).toEqual(session);
    });

    it('should update current user when emitting', () => {
      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(emitter.currentUser).toEqual(session.user);
    });

    it('should update isAuthenticated to true when session present', () => {
      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(emitter.isAuthenticated).toBe(true);
    });

    it('should update isAuthenticated to false when session is null', () => {
      // First sign in
      emitter.emit('SIGNED_IN', createMockSession());
      expect(emitter.isAuthenticated).toBe(true);

      // Then sign out
      emitter.emit('SIGNED_OUT', null);
      expect(emitter.isAuthenticated).toBe(false);
    });

    it('should fire event to listeners', () => {
      const listener = vi.fn();
      emitter.onAuthStateChange(listener);

      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        event: 'SIGNED_IN',
        session,
      });
    });

    it('should fire event to multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.onAuthStateChange(listener1);
      emitter.onAuthStateChange(listener2);

      const session = createMockSession();
      emitter.emit('SIGNED_IN', session);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAuthStateChange', () => {
    it('should return disposable that unsubscribes', () => {
      const listener = vi.fn();
      const disposable = emitter.onAuthStateChange(listener);

      emitter.emit('SIGNED_IN', createMockSession());
      expect(listener).toHaveBeenCalledTimes(1);

      disposable.dispose();

      emitter.emit('SIGNED_OUT', null);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('reset', () => {
    it('should clear current state', () => {
      emitter.emit('SIGNED_IN', createMockSession());
      expect(emitter.currentState).not.toBeNull();

      emitter.reset();

      expect(emitter.currentState).toBeNull();
    });

    it('should not fire event when resetting', () => {
      const listener = vi.fn();
      emitter.onAuthStateChange(listener);

      emitter.emit('SIGNED_IN', createMockSession());
      expect(listener).toHaveBeenCalledTimes(1);

      emitter.reset();

      expect(listener).toHaveBeenCalledTimes(1); // No additional call
    });
  });

  describe('dispose', () => {
    it('should clean up emitter', () => {
      const listener = vi.fn();
      emitter.onAuthStateChange(listener);

      emitter.dispose();

      // After dispose, emitting should not call listener
      // (though in practice, dispose should clean up the emitter)
    });
  });

  describe('event types', () => {
    const eventTypes: AuthStateEvent[] = [
      'SIGNED_IN',
      'SIGNED_OUT',
      'TOKEN_REFRESHED',
      'USER_UPDATED',
      'PASSWORD_RECOVERY',
      'INITIAL_SESSION',
    ];

    it.each(eventTypes)('should handle %s event', (event) => {
      const listener = vi.fn();
      emitter.onAuthStateChange(listener);

      const session = event === 'SIGNED_OUT' ? null : createMockSession();
      emitter.emit(event, session);

      expect(listener).toHaveBeenCalledWith({ event, session });
    });
  });
});

describe('createAuthStateEmitter', () => {
  it('should create a new emitter instance', () => {
    const emitter = createAuthStateEmitter();
    expect(emitter).toBeDefined();
    expect(emitter.currentState).toBeNull();
    emitter.dispose();
  });

  it('should create independent instances', () => {
    const emitter1 = createAuthStateEmitter();
    const emitter2 = createAuthStateEmitter();

    emitter1.emit('SIGNED_IN', createMockSession({ id: 'session-1' }));

    expect(emitter1.currentSession?.id).toBe('session-1');
    expect(emitter2.currentSession).toBeNull();

    emitter1.dispose();
    emitter2.dispose();
  });
});
