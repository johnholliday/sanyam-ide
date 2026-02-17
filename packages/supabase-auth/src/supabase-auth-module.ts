/**
 * Supabase Auth DI Module
 *
 * Inversify container module for @sanyam/supabase-auth services.
 *
 * @packageDocumentation
 */

import { ContainerModule, interfaces } from 'inversify';
import {
  AuthStateEmitter,
  AuthStateEmitterImpl,
} from './auth-state-emitter.js';
import {
  AuthSessionStorage,
  AuthSessionStorageImpl,
  SecretStorage,
} from './auth-session-storage.js';
import {
  OAuthHandler,
  OAuthHandlerImpl,
  normalizeProvider,
  type OAuthConfig,
} from './oauth-handler.js';
import {
  SupabaseAuthProvider,
  SupabaseAuthProviderImpl,
} from './supabase-auth-provider.js';

/**
 * DI token for OAuthConfig.
 */
export const OAuthConfigToken = Symbol('OAuthConfig');

/**
 * Create DI bindings for supabase-auth services.
 *
 * @param config - Optional OAuth configuration
 * @returns Container module
 */
export function createSupabaseAuthModule(config?: OAuthConfig): ContainerModule {
  return new ContainerModule((bind) => {
    // Auth state emitter
    bind(AuthStateEmitter).to(AuthStateEmitterImpl).inSingletonScope();

    // Session storage
    bind(AuthSessionStorage).to(AuthSessionStorageImpl).inSingletonScope();

    // OAuth handler (only if configured)
    if (config) {
      bind<OAuthConfig>('OAuthConfig').toConstantValue(config);
      bind(OAuthHandler).to(OAuthHandlerImpl).inSingletonScope();
    }

    // Main auth provider
    bind(SupabaseAuthProvider).to(SupabaseAuthProviderImpl).inSingletonScope();
  });
}

/**
 * Create DI bindings from environment variables.
 *
 * @returns Container module or null if not configured
 */
export function createSupabaseAuthModuleFromEnv(): ContainerModule | null {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('[SupabaseAuthModule] Supabase not configured, auth disabled');
    return null;
  }

  // Parse providers from environment, normalising aliases (e.g. azure-ad → azure)
  const providersEnv = process.env['SANYAM_AUTH_PROVIDERS'] ?? 'email,github,google';
  const providers = providersEnv.split(',').map(normalizeProvider);

  // Detect desktop mode
  const isDesktop = typeof process !== 'undefined' &&
    (process.versions?.['electron'] !== undefined || process.env['SANYAM_DESKTOP'] === 'true');

  const redirectUrl = process.env['SANYAM_AUTH_REDIRECT_URL'];
  const config: OAuthConfig = {
    supabaseUrl,
    supabaseAnonKey,
    providers,
    isDesktop,
    ...(redirectUrl !== undefined && { redirectUrl }),
  };

  return createSupabaseAuthModule(config);
}

/**
 * Bind SecretStorage to the container.
 * Call this in the frontend module to provide Theia's SecretStorage.
 *
 * @param bind - Container bind function
 * @param secretStorage - Theia SecretStorage instance
 */
export function bindSecretStorage(
  bind: interfaces.Bind,
  secretStorage: any
): void {
  bind(SecretStorage).toConstantValue(secretStorage);
}
