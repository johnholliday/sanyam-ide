/**
 * Supabase Client Factory
 *
 * Creates user-scoped Supabase clients for Row-Level Security (RLS) enforcement.
 * Service-role client is available for system operations only.
 *
 * @packageDocumentation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { injectable } from 'inversify';

/**
 * DI token for SupabaseClientFactory.
 */
export const SupabaseClientFactory = Symbol('SupabaseClientFactory');

/**
 * Configuration for Supabase connection.
 */
export interface SupabaseConfig {
  /** Supabase project URL */
  readonly url: string;

  /** Supabase anonymous key (for user-scoped clients) */
  readonly anonKey: string;

  /** Supabase service role key (for system operations, server-only) */
  readonly serviceRoleKey?: string;
}

/**
 * Factory for creating Supabase clients with different access levels.
 */
export interface SupabaseClientFactory {
  /**
   * Whether cloud services are properly configured.
   * False if SUPABASE_URL or SUPABASE_ANON_KEY are missing.
   */
  readonly isConfigured: boolean;

  /**
   * Whether the client is currently online and connected.
   * Observable flag that updates on connection state changes.
   */
  readonly isOnline: boolean;

  /**
   * Subscribe to online status changes.
   * @param callback - Called when online status changes
   * @returns Unsubscribe function
   */
  onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void;

  /**
   * Creates a user-scoped Supabase client for RLS enforcement.
   * All user-facing operations MUST use this client type.
   *
   * @param accessToken - User's Supabase access token
   * @returns User-scoped Supabase client
   * @throws Error if cloud is not configured
   */
  createUserScopedClient(accessToken: string): SupabaseClient;

  /**
   * Gets the service-role client for system operations.
   * ONLY use for: tier lookups, background jobs, admin operations.
   * NEVER use for user-facing operations.
   *
   * @returns Service-role Supabase client
   * @throws Error if service role key is not configured
   */
  getServiceRoleClient(): SupabaseClient;

  /**
   * Gets an anonymous client for public operations (e.g., tier_limits lookup).
   *
   * @returns Anonymous Supabase client
   * @throws Error if cloud is not configured
   */
  getAnonClient(): SupabaseClient;
}

/**
 * Default implementation of SupabaseClientFactory.
 */
@injectable()
export class SupabaseClientFactoryImpl implements SupabaseClientFactory {
  private readonly config: SupabaseConfig | null;
  private readonly onlineStatusListeners: Set<(isOnline: boolean) => void> =
    new Set();
  private _isOnline = true;
  private serviceRoleClient: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;

  constructor() {
    // Load configuration from environment
    const url = process.env['SUPABASE_URL'];
    const anonKey = process.env['SUPABASE_ANON_KEY'];
    const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (url && anonKey) {
      this.config = { url, anonKey, serviceRoleKey };
    } else {
      this.config = null;
    }
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.onlineStatusListeners.add(callback);
    return () => {
      this.onlineStatusListeners.delete(callback);
    };
  }

  /**
   * Updates the online status and notifies all listeners.
   * @internal
   */
  setOnlineStatus(isOnline: boolean): void {
    if (this._isOnline !== isOnline) {
      this._isOnline = isOnline;
      for (const listener of this.onlineStatusListeners) {
        try {
          listener(isOnline);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  createUserScopedClient(accessToken: string): SupabaseClient {
    if (!this.config) {
      throw new Error(
        'Cloud services not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      );
    }

    return createClient(this.config.url, this.config.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getServiceRoleClient(): SupabaseClient {
    if (!this.config) {
      throw new Error(
        'Cloud services not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      );
    }

    if (!this.config.serviceRoleKey) {
      throw new Error(
        'Service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable.'
      );
    }

    if (!this.serviceRoleClient) {
      this.serviceRoleClient = createClient(
        this.config.url,
        this.config.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }

    return this.serviceRoleClient;
  }

  getAnonClient(): SupabaseClient {
    if (!this.config) {
      throw new Error(
        'Cloud services not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      );
    }

    if (!this.anonClient) {
      this.anonClient = createClient(this.config.url, this.config.anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    return this.anonClient;
  }
}
