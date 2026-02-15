/**
 * Supabase Authentication Provider
 *
 * Theia AuthenticationProvider implementation for Supabase authentication.
 * Handles session management, token refresh, and auth state events.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from 'inversify';
import { Disposable, DisposableCollection } from '@theia/core';
import type { AuthSession, AuthStateEvent } from '@sanyam/types';
import { AuthStateEmitter, type AuthStateEmitter as AuthStateEmitterType } from './auth-state-emitter.js';
import { AuthSessionStorage, type AuthSessionStorage as AuthSessionStorageType } from './auth-session-storage.js';
import { OAuthHandler, type OAuthHandler as OAuthHandlerType, type OAuthProvider } from './oauth-handler.js';

/**
 * DI token for SupabaseAuthProvider.
 */
export const SupabaseAuthProvider = Symbol('SupabaseAuthProvider');

/**
 * Token refresh configuration.
 */
export interface TokenRefreshConfig {
  /** Refresh token this many ms before expiry. Default: 5 minutes */
  readonly refreshBufferMs: number;

  /** Minimum interval between refresh attempts. Default: 30 seconds */
  readonly minRefreshIntervalMs: number;

  /** Maximum retry attempts on refresh failure. Default: 3 */
  readonly maxRetryAttempts: number;
}

/**
 * Default token refresh configuration.
 */
export const DEFAULT_TOKEN_REFRESH_CONFIG: TokenRefreshConfig = {
  refreshBufferMs: 5 * 60 * 1000, // 5 minutes
  minRefreshIntervalMs: 30 * 1000, // 30 seconds
  maxRetryAttempts: 3,
};

/**
 * Authentication provider info (for UI).
 */
export interface AuthProviderInfo {
  readonly id: OAuthProvider;
  readonly label: string;
  readonly icon?: string;
}

/**
 * Interface for Supabase authentication provider.
 */
export interface SupabaseAuthProvider extends Disposable {
  /**
   * Provider ID for Theia AuthenticationService.
   */
  readonly id: string;

  /**
   * Provider label for UI.
   */
  readonly label: string;

  /**
   * Whether authentication is configured and available.
   */
  readonly isConfigured: boolean;

  /**
   * Get available authentication providers.
   */
  readonly availableProviders: AuthProviderInfo[];

  /**
   * Current authentication session.
   */
  readonly session: AuthSession | null;

  /**
   * Whether user is currently authenticated.
   */
  readonly isAuthenticated: boolean;

  /**
   * Initialize the provider (restore session, start refresh).
   */
  initialize(): Promise<void>;

  /**
   * Sign in with email/password.
   *
   * @param email - User email
   * @param password - User password
   * @returns True if successful
   */
  signInWithPassword(email: string, password: string): Promise<boolean>;

  /**
   * Sign in with magic link.
   *
   * @param email - User email
   * @returns True if email sent
   */
  signInWithMagicLink(email: string): Promise<boolean>;

  /**
   * Sign in with OAuth provider.
   *
   * @param provider - OAuth provider ID
   * @returns True if successful (or redirect initiated)
   */
  signInWithOAuth(provider: OAuthProvider): Promise<boolean>;

  /**
   * Sign up with email/password.
   *
   * @param email - User email
   * @param password - User password
   * @returns True if successful
   */
  signUp(email: string, password: string): Promise<boolean>;

  /**
   * Sign out current user.
   */
  signOut(): Promise<void>;

  /**
   * Manually refresh the current session token.
   *
   * @returns True if refresh successful
   */
  refreshToken(): Promise<boolean>;

  /**
   * Handle OAuth callback (exchange code for session).
   *
   * @param code - Authorization code
   * @returns True if successful
   */
  handleOAuthCallback(code: string): Promise<boolean>;

  /**
   * Get the current access token (for API calls).
   *
   * @returns Access token or null if not authenticated
   */
  getAccessToken(): Promise<string | null>;
}

/**
 * Provider display information.
 */
const PROVIDER_INFO: Record<OAuthProvider, Omit<AuthProviderInfo, 'id'>> = {
  email: { label: 'Email', icon: 'codicon-mail' },
  github: { label: 'GitHub', icon: 'codicon-github' },
  google: { label: 'Google', icon: 'codicon-account' },
  azure: { label: 'Microsoft', icon: 'codicon-azure' },
};

/**
 * Default implementation of SupabaseAuthProvider.
 */
@injectable()
export class SupabaseAuthProviderImpl implements SupabaseAuthProvider {
  readonly id = 'supabase';
  readonly label = 'Sanyam Cloud';

  private readonly disposables = new DisposableCollection();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRefreshAttempt = 0;
  private refreshRetryCount = 0;
  private _isConfigured = false;

  @inject(AuthStateEmitter)
  private readonly authStateEmitter!: AuthStateEmitterType;

  @inject(AuthSessionStorage)
  private readonly sessionStorage!: AuthSessionStorageType;

  @inject(OAuthHandler) @optional()
  private readonly oauthHandler?: OAuthHandlerType;

  private refreshConfig: TokenRefreshConfig = DEFAULT_TOKEN_REFRESH_CONFIG;

  @postConstruct()
  protected init(): void {
    this._isConfigured = this.oauthHandler !== undefined;
  }

  get isConfigured(): boolean {
    return this._isConfigured;
  }

  get availableProviders(): AuthProviderInfo[] {
    if (!this.oauthHandler) {
      return [];
    }

    return this.oauthHandler.availableProviders.map((id) => ({
      id,
      ...PROVIDER_INFO[id],
    }));
  }

  get session(): AuthSession | null {
    return this.authStateEmitter.currentSession;
  }

  get isAuthenticated(): boolean {
    return this.authStateEmitter.isAuthenticated;
  }

  async initialize(): Promise<void> {
    if (!this.isConfigured) {
      console.log('[SupabaseAuthProvider] Not configured, skipping initialization');
      return;
    }

    // Check for implicit-flow tokens in the URL hash fragment.
    // After a magic-link or OAuth redirect, the server sends
    // /auth/callback#access_token=…&refresh_token=… → 302 → /
    // Browsers preserve the hash through 302 redirects, so the
    // tokens arrive here on the initial page load.
    if (typeof window !== 'undefined' && this.oauthHandler) {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('[SupabaseAuthProvider] Found auth tokens in URL hash, establishing session…');
          const result = await this.oauthHandler.setSessionFromTokens(accessToken, refreshToken);
          // Clean up the hash regardless of outcome
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
          if (result.success && result.session) {
            await this.handleSuccessfulAuth(result.session);
            return;
          }
          console.warn('[SupabaseAuthProvider] Token session failed:', result.error);
        }
      }
    }

    // Try to restore session from storage
    const storedSession = await this.sessionStorage.loadSession();
    if (storedSession) {
      // Check if session is still valid
      const now = Date.now();
      if (storedSession.expiresAt > now) {
        // Session still valid - emit state and schedule refresh
        this.emitAuthState('SIGNED_IN', storedSession);
        this.scheduleTokenRefresh(storedSession);
      } else {
        // Session expired - try to refresh
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          // Refresh failed - clear session
          await this.sessionStorage.clearSession();
          this.emitAuthState('SIGNED_OUT', null);
        }
      }
    } else {
      // No stored session
      this.emitAuthState('SIGNED_OUT', null);
    }
  }

  async signInWithPassword(email: string, password: string): Promise<boolean> {
    if (!this.oauthHandler) {
      console.error('[SupabaseAuthProvider] Not configured');
      return false;
    }

    const result = await this.oauthHandler.signInWithPassword(email, password);
    if (result.success && result.session) {
      await this.handleSuccessfulAuth(result.session);
      return true;
    }

    console.error('[SupabaseAuthProvider] Sign in failed:', result.error);
    return false;
  }

  async signInWithMagicLink(email: string): Promise<boolean> {
    if (!this.oauthHandler) {
      console.error('[SupabaseAuthProvider] Not configured');
      return false;
    }

    const result = await this.oauthHandler.signInWithMagicLink(email);
    if (result.success) {
      // Magic link sent - user needs to click the link
      return true;
    }

    console.error('[SupabaseAuthProvider] Magic link failed:', result.error);
    return false;
  }

  async signInWithOAuth(provider: OAuthProvider): Promise<boolean> {
    if (!this.oauthHandler) {
      console.error('[SupabaseAuthProvider] Not configured');
      return false;
    }

    const result = await this.oauthHandler.signInWithOAuth(provider);
    if (result.success) {
      if (result.session) {
        // Direct auth (desktop with code exchange)
        await this.handleSuccessfulAuth(result.session);
      }
      // For browser, redirect has been initiated
      return true;
    }

    // Check if this is a desktop OAuth URL
    if (result.error?.startsWith('OAUTH_URL:')) {
      const url = result.error.slice('OAUTH_URL:'.length);
      // Caller should handle opening this URL
      console.log('[SupabaseAuthProvider] Desktop OAuth URL:', url);
      // In a real implementation, we'd emit an event for the UI to handle
      return true;
    }

    console.error('[SupabaseAuthProvider] OAuth failed:', result.error);
    return false;
  }

  async signUp(email: string, password: string): Promise<boolean> {
    if (!this.oauthHandler) {
      console.error('[SupabaseAuthProvider] Not configured');
      return false;
    }

    const result = await this.oauthHandler.signUp(email, password);
    if (result.success) {
      if (result.session) {
        await this.handleSuccessfulAuth(result.session);
      }
      // If no session, email confirmation may be required
      return true;
    }

    console.error('[SupabaseAuthProvider] Sign up failed:', result.error);
    return false;
  }

  async signOut(): Promise<void> {
    this.cancelTokenRefresh();

    if (this.oauthHandler) {
      await this.oauthHandler.signOut();
    }

    await this.sessionStorage.clearSession();
    this.emitAuthState('SIGNED_OUT', null);
  }

  async refreshToken(): Promise<boolean> {
    if (!this.oauthHandler) {
      return false;
    }

    const currentSession = this.authStateEmitter.currentSession;
    if (!currentSession) {
      return false;
    }

    // Enforce minimum refresh interval
    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.refreshConfig.minRefreshIntervalMs) {
      console.log('[SupabaseAuthProvider] Refresh throttled');
      return false;
    }

    this.lastRefreshAttempt = now;

    const result = await this.oauthHandler.refreshSession(currentSession.refreshToken);
    if (result.success && result.session) {
      this.refreshRetryCount = 0;
      await this.sessionStorage.storeSession(result.session);
      this.emitAuthState('TOKEN_REFRESHED', result.session);
      this.scheduleTokenRefresh(result.session);
      return true;
    }

    this.refreshRetryCount++;
    console.error('[SupabaseAuthProvider] Token refresh failed:', result.error);

    if (this.refreshRetryCount >= this.refreshConfig.maxRetryAttempts) {
      // Max retries exceeded - sign out
      console.error('[SupabaseAuthProvider] Max refresh retries exceeded, signing out');
      await this.signOut();
    }

    return false;
  }

  async handleOAuthCallback(code: string): Promise<boolean> {
    if (!this.oauthHandler) {
      console.error('[SupabaseAuthProvider] Not configured');
      return false;
    }

    const result = await this.oauthHandler.exchangeCodeForSession(code);
    if (result.success && result.session) {
      await this.handleSuccessfulAuth(result.session);
      return true;
    }

    console.error('[SupabaseAuthProvider] OAuth callback failed:', result.error);
    return false;
  }

  async getAccessToken(): Promise<string | null> {
    const session = this.authStateEmitter.currentSession;
    if (!session) {
      return null;
    }

    // Check if token is expired
    if (session.expiresAt <= Date.now()) {
      // Try to refresh
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        return null;
      }
      return this.authStateEmitter.currentSession?.accessToken ?? null;
    }

    return session.accessToken;
  }

  dispose(): void {
    this.cancelTokenRefresh();
    this.disposables.dispose();
  }

  /**
   * Handle successful authentication.
   */
  private async handleSuccessfulAuth(session: AuthSession): Promise<void> {
    await this.sessionStorage.storeSession(session);
    this.emitAuthState('SIGNED_IN', session);
    this.scheduleTokenRefresh(session);
    this.refreshRetryCount = 0;
  }

  /**
   * Schedule token refresh before expiry.
   */
  private scheduleTokenRefresh(session: AuthSession): void {
    this.cancelTokenRefresh();

    const now = Date.now();
    const expiresAt = session.expiresAt;
    const refreshAt = expiresAt - this.refreshConfig.refreshBufferMs;

    if (refreshAt <= now) {
      // Token about to expire - refresh now
      this.refreshToken().catch((err) => {
        console.error('[SupabaseAuthProvider] Refresh error:', err);
      });
      return;
    }

    const delay = refreshAt - now;
    console.log(`[SupabaseAuthProvider] Scheduling refresh in ${Math.round(delay / 1000)}s`);

    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch((err) => {
        console.error('[SupabaseAuthProvider] Scheduled refresh error:', err);
      });
    }, delay);
  }

  /**
   * Cancel scheduled token refresh.
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Emit authentication state change.
   */
  private emitAuthState(event: AuthStateEvent, session: AuthSession | null): void {
    this.authStateEmitter.emit(event, session);
  }
}

/**
 * Configure token refresh settings.
 *
 * @param provider - Auth provider to configure
 * @param config - Refresh configuration
 */
export function configureTokenRefresh(
  provider: SupabaseAuthProviderImpl,
  config: Partial<TokenRefreshConfig>
): void {
  (provider as any).refreshConfig = { ...DEFAULT_TOKEN_REFRESH_CONFIG, ...config };
}
