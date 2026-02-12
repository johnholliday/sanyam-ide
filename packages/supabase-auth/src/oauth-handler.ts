/**
 * OAuth Handler
 *
 * Handles OAuth authentication flows for browser and desktop (Electron) environments.
 * Desktop uses loopback redirect; browser uses standard OAuth redirect.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { createClient, type SupabaseClient, type Provider } from '@supabase/supabase-js';
import type { AuthSession, UserProfile, SubscriptionTier } from '@sanyam/types';

/**
 * DI token for OAuthHandler.
 */
export const OAuthHandler = Symbol('OAuthHandler');

/**
 * OAuth provider identifier.
 */
export type OAuthProvider = 'github' | 'google' | 'azure' | 'email';

/**
 * OAuth handler configuration.
 */
export interface OAuthConfig {
  /** Supabase project URL */
  readonly supabaseUrl: string;

  /** Supabase anonymous key */
  readonly supabaseAnonKey: string;

  /** Available OAuth providers */
  readonly providers: OAuthProvider[];

  /** Custom redirect URL (for desktop loopback) */
  readonly redirectUrl?: string;

  /** Whether running in Electron/desktop environment */
  readonly isDesktop?: boolean;
}

/**
 * OAuth result from sign-in flow.
 */
export interface OAuthResult {
  /** Whether authentication succeeded */
  readonly success: boolean;

  /** Session on success */
  readonly session?: AuthSession;

  /** Error message on failure */
  readonly error?: string;
}

/**
 * Interface for OAuth authentication handler.
 */
export interface OAuthHandler {
  /**
   * Get available OAuth providers.
   */
  readonly availableProviders: OAuthProvider[];

  /**
   * Whether running in desktop mode.
   */
  readonly isDesktop: boolean;

  /**
   * Sign in with email/password.
   *
   * @param email - User email
   * @param password - User password
   * @returns OAuth result
   */
  signInWithPassword(email: string, password: string): Promise<OAuthResult>;

  /**
   * Sign in with magic link (passwordless).
   *
   * @param email - User email
   * @returns OAuth result (pending email confirmation)
   */
  signInWithMagicLink(email: string): Promise<OAuthResult>;

  /**
   * Sign in with OAuth provider.
   * For desktop, opens browser and waits for loopback redirect.
   * For browser, redirects to provider.
   *
   * @param provider - OAuth provider
   * @returns OAuth result
   */
  signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult>;

  /**
   * Sign up with email/password.
   *
   * @param email - User email
   * @param password - User password
   * @returns OAuth result
   */
  signUp(email: string, password: string): Promise<OAuthResult>;

  /**
   * Sign out current user.
   */
  signOut(): Promise<void>;

  /**
   * Refresh access token using refresh token.
   *
   * @param refreshToken - Refresh token
   * @returns OAuth result with new session
   */
  refreshSession(refreshToken: string): Promise<OAuthResult>;

  /**
   * Exchange code for session (OAuth callback).
   *
   * @param code - Authorization code
   * @returns OAuth result
   */
  exchangeCodeForSession(code: string): Promise<OAuthResult>;

  /**
   * Get the current Supabase client (for direct API calls).
   */
  getClient(): SupabaseClient;
}

/**
 * Default implementation of OAuthHandler.
 */
@injectable()
export class OAuthHandlerImpl implements OAuthHandler {
  private readonly client: SupabaseClient;
  private readonly config: OAuthConfig;

  constructor(
    @inject('OAuthConfig') config: OAuthConfig
  ) {
    this.config = config;
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: !config.isDesktop,
      },
    });
  }

  get availableProviders(): OAuthProvider[] {
    return this.config.providers;
  }

  get isDesktop(): boolean {
    return this.config.isDesktop ?? false;
  }

  async signInWithPassword(email: string, password: string): Promise<OAuthResult> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session || !data.user) {
        return { success: false, error: 'No session returned' };
      }

      return {
        success: true,
        session: this.mapSession(data.session, data.user),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async signInWithMagicLink(email: string): Promise<OAuthResult> {
    try {
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: this.getRedirectUrl(),
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Magic link sent - user needs to click the link
      return {
        success: true,
        // No session yet - will be established when user clicks the link
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult> {
    if (provider === 'email') {
      return { success: false, error: 'Use signInWithPassword or signInWithMagicLink for email' };
    }

    try {
      const supabaseProvider = this.mapToSupabaseProvider(provider);
      const redirectUrl = this.getRedirectUrl();

      if (this.isDesktop) {
        // Desktop: Use PKCE flow with loopback redirect
        return await this.handleDesktopOAuth(supabaseProvider, redirectUrl);
      } else {
        // Browser: Standard OAuth redirect
        return await this.handleBrowserOAuth(supabaseProvider, redirectUrl);
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async signUp(email: string, password: string): Promise<OAuthResult> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: this.getRedirectUrl(),
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Sign up failed' };
      }

      // Check if email confirmation is required
      if (!data.session) {
        return {
          success: true,
          // No session yet - email confirmation may be required
        };
      }

      return {
        success: true,
        session: this.mapSession(data.session, data.user),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async refreshSession(refreshToken: string): Promise<OAuthResult> {
    try {
      const { data, error } = await this.client.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session || !data.user) {
        return { success: false, error: 'No session returned' };
      }

      return {
        success: true,
        session: this.mapSession(data.session, data.user),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async exchangeCodeForSession(code: string): Promise<OAuthResult> {
    try {
      const { data, error } = await this.client.auth.exchangeCodeForSession(code);

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session || !data.user) {
        return { success: false, error: 'No session returned' };
      }

      return {
        success: true,
        session: this.mapSession(data.session, data.user),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Get redirect URL for OAuth flows.
   */
  private getRedirectUrl(): string {
    if (this.config.redirectUrl) {
      return this.config.redirectUrl;
    }

    if (this.isDesktop) {
      // Desktop loopback URL - will be handled by local server
      return 'http://localhost:54321/auth/callback';
    }

    // Browser - use current origin
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/callback`;
    }

    return 'http://localhost:3000/auth/callback';
  }

  /**
   * Handle OAuth flow for desktop (Electron).
   * Opens external browser and waits for loopback callback.
   */
  private async handleDesktopOAuth(
    provider: Provider,
    redirectUrl: string
  ): Promise<OAuthResult> {
    // Generate OAuth URL
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // Get URL instead of redirecting
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.url) {
      return { success: false, error: 'No OAuth URL returned' };
    }

    // In desktop mode, caller is responsible for:
    // 1. Opening the URL in system browser
    // 2. Starting a local server to receive the callback
    // 3. Calling exchangeCodeForSession with the code
    return {
      success: true,
      // Return URL in error field for caller to handle
      error: `OAUTH_URL:${data.url}`,
    };
  }

  /**
   * Handle OAuth flow for browser.
   * Redirects to provider; session is established on callback.
   */
  private async handleBrowserOAuth(
    provider: Provider,
    redirectUrl: string
  ): Promise<OAuthResult> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Browser will be redirected - no session yet
    return { success: true };
  }

  /**
   * Map internal provider to Supabase provider type.
   */
  private mapToSupabaseProvider(provider: OAuthProvider): Provider {
    switch (provider) {
      case 'github':
        return 'github';
      case 'google':
        return 'google';
      case 'azure':
        return 'azure';
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Map Supabase session to our AuthSession type.
   */
  private mapSession(
    session: { access_token: string; refresh_token: string; expires_at?: number },
    user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }
  ): AuthSession {
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email ?? '',
      display_name: (user.user_metadata?.['full_name'] as string) ?? (user.user_metadata?.['name'] as string) ?? null,
      avatar_url: (user.user_metadata?.['avatar_url'] as string) ?? null,
      tier: (user.app_metadata?.['tier'] as SubscriptionTier) ?? 'free',
      storage_used_bytes: 0, // Will be fetched separately
      document_count: 0, // Will be fetched separately
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      id: session.access_token.slice(0, 16), // Use token prefix as session ID
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000,
      user: userProfile,
    };
  }
}

/**
 * Create OAuth handler from environment variables.
 *
 * @param isDesktop - Whether running in desktop mode
 * @returns OAuthHandler instance or null if not configured
 */
export function createOAuthHandlerFromEnv(isDesktop = false): OAuthHandler | null {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Parse available providers from environment
  const providersEnv = process.env['SANYAM_AUTH_PROVIDERS'] ?? 'email,github,google';
  const providers = providersEnv.split(',').map((p) => p.trim()) as OAuthProvider[];

  const config: OAuthConfig = {
    supabaseUrl,
    supabaseAnonKey,
    providers,
    isDesktop,
    redirectUrl: process.env['SANYAM_AUTH_REDIRECT_URL'],
  };

  return new OAuthHandlerImpl(config as any);
}
