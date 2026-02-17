/**
 * Supabase Auth Frontend Module
 *
 * Inversify container module for Theia frontend authentication integration.
 *
 * @packageDocumentation
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import {
  AuthStateEmitter,
  AuthStateEmitterImpl,
  AuthSessionStorage,
  AuthSessionStorageImpl,
  OAuthHandler,
  OAuthHandlerImpl,
  SecretStorage,
  SupabaseAuthProvider,
  SupabaseAuthProviderImpl,
  normalizeProvider,
  type OAuthConfig,
  type OAuthProvider,
  type SecretStorage as SecretStorageType,
} from '@sanyam/supabase-auth';
import { CloudStatusBarContribution } from './cloud-status-bar.js';
import { CloudAuthCommands } from './cloud-auth-commands.js';
import { SaveToCloudCommand } from './save-to-cloud-command.js';
import { OpenCloudDocumentCommand } from './open-cloud-document.js';
import { RestoreDocumentCommand } from './restore-document-command.js';
import { ShareDocumentCommand } from './share-document-command.js';
import { DocumentHistoryCommand } from './document-history-command.js';
import { ManageApiKeysCommand } from './manage-api-keys-command.js';

/**
 * Browser-side SecretStorage backed by `localStorage`.
 *
 * Keys are prefixed to avoid collisions with other Theia storage.
 */
class BrowserSecretStorage implements SecretStorageType {
  private static readonly PREFIX = 'sanyam.secret.';

  async get(key: string): Promise<string | undefined> {
    const v = localStorage.getItem(BrowserSecretStorage.PREFIX + key);
    return v ?? undefined;
  }

  async store(key: string, value: string): Promise<void> {
    localStorage.setItem(BrowserSecretStorage.PREFIX + key, value);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(BrowserSecretStorage.PREFIX + key);
  }
}

/**
 * Environment-based OAuth configuration.
 */
function getOAuthConfigFromWindow(): OAuthConfig | null {
  // Config injected by server into window object
  const config = (window as any).__SANYAM_CONFIG__;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    return null;
  }

  const providers: OAuthProvider[] = (config.authProviders ?? 'email,github,google')
    .split(',')
    .map((p: string) => normalizeProvider(p));

  return {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    providers,
    isDesktop: false, // Frontend is always browser
    redirectUrl: config.authRedirectUrl ?? `${window.location.origin}/auth/callback`,
  };
}

/**
 * Frontend module for Supabase authentication.
 */
export const SupabaseAuthFrontendModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  // Auth state emitter
  bind(AuthStateEmitter).to(AuthStateEmitterImpl).inSingletonScope();

  // Persistent secret storage backed by localStorage
  bind(SecretStorage).toConstantValue(new BrowserSecretStorage());

  // Session storage (uses SecretStorage bound above)
  bind(AuthSessionStorage).to(AuthSessionStorageImpl).inSingletonScope();

  // OAuth configuration from window
  const oauthConfig = getOAuthConfigFromWindow();

  if (oauthConfig) {
    bind<OAuthConfig>('OAuthConfig').toConstantValue(oauthConfig);
    bind(OAuthHandler).to(OAuthHandlerImpl).inSingletonScope();
  }

  // Main auth provider
  bind(SupabaseAuthProvider).to(SupabaseAuthProviderImpl).inSingletonScope();

  // Status bar contribution
  bind(CloudStatusBarContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(CloudStatusBarContribution);

  // Command contributions - Auth
  bind(CloudAuthCommands).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CloudAuthCommands);
  bind(MenuContribution).toService(CloudAuthCommands);

  // Command contributions - Save to Cloud
  bind(SaveToCloudCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(SaveToCloudCommand);
  bind(MenuContribution).toService(SaveToCloudCommand);

  // Command contributions - Open Cloud Document
  bind(OpenCloudDocumentCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(OpenCloudDocumentCommand);
  bind(MenuContribution).toService(OpenCloudDocumentCommand);

  // Command contributions - Restore Document
  bind(RestoreDocumentCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(RestoreDocumentCommand);
  bind(MenuContribution).toService(RestoreDocumentCommand);

  // Command contributions - Share Document
  bind(ShareDocumentCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(ShareDocumentCommand);
  bind(MenuContribution).toService(ShareDocumentCommand);

  // Command contributions - Document History
  bind(DocumentHistoryCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(DocumentHistoryCommand);
  bind(MenuContribution).toService(DocumentHistoryCommand);

  // Command contributions - Manage API Keys
  bind(ManageApiKeysCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(ManageApiKeysCommand);
  bind(MenuContribution).toService(ManageApiKeysCommand);
});

export default SupabaseAuthFrontendModule;
