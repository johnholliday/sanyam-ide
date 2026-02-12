/**
 * @sanyam/supabase-auth
 *
 * Supabase authentication provider for Sanyam IDE with Theia integration.
 *
 * @packageDocumentation
 */

// Auth state management
export {
  AuthStateEmitter,
  AuthStateEmitterImpl,
  createAuthStateEmitter,
  type AuthStateEmitter as AuthStateEmitterType,
} from './auth-state-emitter.js';

// Session storage
export {
  AuthSessionStorage,
  AuthSessionStorageImpl,
  SecretStorage,
  createAuthSessionStorage,
  type AuthSessionStorage as AuthSessionStorageType,
  type SecretStorage as SecretStorageType,
} from './auth-session-storage.js';

// OAuth handling
export {
  OAuthHandler,
  OAuthHandlerImpl,
  createOAuthHandlerFromEnv,
  type OAuthHandler as OAuthHandlerType,
  type OAuthConfig,
  type OAuthProvider,
  type OAuthResult,
} from './oauth-handler.js';

// Main auth provider
export {
  SupabaseAuthProvider,
  SupabaseAuthProviderImpl,
  configureTokenRefresh,
  DEFAULT_TOKEN_REFRESH_CONFIG,
  type SupabaseAuthProvider as SupabaseAuthProviderType,
  type TokenRefreshConfig,
  type AuthProviderInfo,
} from './supabase-auth-provider.js';

// DI module
export {
  createSupabaseAuthModule,
  createSupabaseAuthModuleFromEnv,
  bindSecretStorage,
  OAuthConfigToken,
} from './supabase-auth-module.js';

// Re-export types from @sanyam/types for convenience
export type {
  AuthSession,
  AuthState,
  AuthStateEvent,
  UserProfile,
} from '@sanyam/types';
