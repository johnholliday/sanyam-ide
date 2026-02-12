/**
 * Authentication State Emitter
 *
 * Event-driven authentication state management using Theia's Emitter pattern.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { Emitter, Event, Disposable, DisposableCollection } from '@theia/core';
import type { AuthState, AuthSession, AuthStateEvent, UserProfile } from '@sanyam/types';

/**
 * DI token for AuthStateEmitter.
 */
export const AuthStateEmitter = Symbol('AuthStateEmitter');

/**
 * Interface for authentication state event emitter.
 */
export interface AuthStateEmitter extends Disposable {
  /**
   * Event fired when authentication state changes.
   */
  readonly onAuthStateChange: Event<AuthState>;

  /**
   * Current authentication state (null if unknown/loading).
   */
  readonly currentState: AuthState | null;

  /**
   * Current session (convenience accessor).
   */
  readonly currentSession: AuthSession | null;

  /**
   * Current user (convenience accessor).
   */
  readonly currentUser: UserProfile | null;

  /**
   * Whether user is currently authenticated.
   */
  readonly isAuthenticated: boolean;

  /**
   * Emit a new authentication state.
   *
   * @param event - State change event type
   * @param session - Current session (null if signed out)
   */
  emit(event: AuthStateEvent, session: AuthSession | null): void;

  /**
   * Reset to initial state (for testing).
   */
  reset(): void;
}

/**
 * Default implementation of AuthStateEmitter.
 */
@injectable()
export class AuthStateEmitterImpl implements AuthStateEmitter {
  private readonly disposables = new DisposableCollection();
  private readonly emitter = new Emitter<AuthState>();
  private _currentState: AuthState | null = null;

  constructor() {
    this.disposables.push(this.emitter);
  }

  get onAuthStateChange(): Event<AuthState> {
    return this.emitter.event;
  }

  get currentState(): AuthState | null {
    return this._currentState;
  }

  get currentSession(): AuthSession | null {
    return this._currentState?.session ?? null;
  }

  get currentUser(): UserProfile | null {
    return this._currentState?.session?.user ?? null;
  }

  get isAuthenticated(): boolean {
    return this._currentState?.session !== null && this._currentState?.session !== undefined;
  }

  emit(event: AuthStateEvent, session: AuthSession | null): void {
    this._currentState = { event, session };
    this.emitter.fire(this._currentState);
  }

  reset(): void {
    this._currentState = null;
  }

  dispose(): void {
    this.disposables.dispose();
  }
}

/**
 * Create an auth state emitter instance (for non-DI usage).
 *
 * @returns AuthStateEmitter instance
 */
export function createAuthStateEmitter(): AuthStateEmitter {
  return new AuthStateEmitterImpl();
}
