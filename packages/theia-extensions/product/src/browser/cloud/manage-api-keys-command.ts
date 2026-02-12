/**
 * Manage API Keys Command
 *
 * Command to create, list, and revoke API keys for programmatic access.
 *
 * @packageDocumentation
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import {
  CommandContribution,
  CommandRegistry,
  Command,
  MenuContribution,
  MenuModelRegistry,
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core';
import { QuickInputService, QuickPickItem } from '@theia/core/lib/browser';
import { ClipboardService } from '@theia/core/lib/browser';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';

/**
 * Manage API Keys command.
 */
export const MANAGE_API_KEYS_COMMAND: Command = {
  id: 'sanyam.cloud.manageApiKeys',
  label: 'Sanyam: Manage API Keys',
  category: 'Sanyam Cloud',
};

/**
 * Create API Key command.
 */
export const CREATE_API_KEY_COMMAND: Command = {
  id: 'sanyam.cloud.createApiKey',
  label: 'Sanyam: Create API Key',
  category: 'Sanyam Cloud',
};

/**
 * API scope options.
 */
const API_SCOPES = [
  { label: 'documents:read', description: 'Read access to documents' },
  { label: 'documents:write', description: 'Write access to documents' },
  { label: 'documents:delete', description: 'Delete access to documents' },
] as const;

/**
 * API Key interface.
 */
interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
}

/**
 * Manage API Keys command contribution.
 */
@injectable()
export class ManageApiKeysCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  @inject(ClipboardService)
  private readonly clipboardService!: ClipboardService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(MANAGE_API_KEYS_COMMAND, {
      execute: () => this.manageApiKeys(),
      isEnabled: () => this.canManageKeys(),
      isVisible: () => this.authProvider.isConfigured,
    });

    commands.registerCommand(CREATE_API_KEY_COMMAND, {
      execute: () => this.createApiKey(),
      isEnabled: () => this.canManageKeys(),
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'cloud'], {
      commandId: MANAGE_API_KEYS_COMMAND.id,
      order: '8',
    });
  }

  /**
   * Check if user can manage API keys.
   */
  private canManageKeys(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    // Check tier (Pro+ required)
    const user = this.authProvider.currentUser;
    if (!user) {
      return false;
    }

    const tier = (user as any)?.user_metadata?.subscription_tier ?? 'free';
    return tier !== 'free';
  }

  /**
   * Main entry point for managing API keys.
   */
  private async manageApiKeys(): Promise<void> {
    // Check tier
    const user = this.authProvider.currentUser;
    const tier = (user as any)?.user_metadata?.subscription_tier ?? 'free';

    if (tier === 'free') {
      const result = await this.messageService.warn(
        'API key management requires a Pro or Enterprise subscription. Would you like to upgrade?',
        'Upgrade',
        'Cancel'
      );

      if (result === 'Upgrade') {
        this.messageService.info('Upgrade functionality coming soon!');
      }
      return;
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      // Fetch API keys
      const response = await fetch('/api/v1/api-keys', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to fetch API keys: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      const keys: ApiKey[] = await response.json();

      // Build quick pick items
      const items: QuickPickItem[] = [
        { label: '$(add) Create New API Key', id: 'create', alwaysShow: true },
        { label: '', kind: 2 }, // Separator
      ];

      if (keys.length === 0) {
        items.push({ label: 'No API keys found', id: 'none', description: 'Create one to get started' });
      } else {
        for (const key of keys) {
          const lastUsed = key.last_used_at
            ? `Last used: ${new Date(key.last_used_at).toLocaleDateString()}`
            : 'Never used';

          items.push({
            label: `$(key) ${key.name}`,
            description: key.scopes.join(', '),
            detail: `Created: ${new Date(key.created_at).toLocaleDateString()} • ${lastUsed}`,
            id: key.id,
          });
        }
      }

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'API Keys',
        placeholder: 'Select an action or API key to manage',
      });

      if (!selected) {
        return;
      }

      const action = (selected as any).id;

      if (action === 'create') {
        await this.createApiKey();
      } else if (action !== 'none') {
        await this.manageKey(action, keys.find((k) => k.id === action)!);
      }
    } catch (error) {
      this.messageService.error(`Failed to manage API keys: ${error}`);
    }
  }

  /**
   * Create a new API key.
   */
  private async createApiKey(): Promise<void> {
    try {
      // Get key name
      const name = await this.quickInputService.input({
        title: 'Create API Key',
        prompt: 'Enter a name for this API key',
        placeHolder: 'e.g., CI/CD Pipeline',
        validateInput: (value) => {
          if (!value || value.length < 1) {
            return 'Name is required';
          }
          if (value.length > 100) {
            return 'Name must be 100 characters or less';
          }
          return undefined;
        },
      });

      if (!name) {
        return;
      }

      // Select scopes
      const scopeItems = API_SCOPES.map((s) => ({
        label: s.label,
        description: s.description,
        picked: s.label === 'documents:read', // Default to read-only
      }));

      const selectedScopes = await this.quickInputService.showQuickPick(scopeItems, {
        title: 'Select API Scopes',
        placeholder: 'Choose the permissions for this key',
        canPickMany: true,
      });

      if (!selectedScopes || selectedScopes.length === 0) {
        this.messageService.warn('At least one scope is required');
        return;
      }

      const scopes = (selectedScopes as any[]).map((s) => s.label);

      // Create the key
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, scopes }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to create API key: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      const result = await response.json();

      // Copy key to clipboard
      await this.clipboardService.writeText(result.key);

      this.messageService.info(
        `API key "${name}" created and copied to clipboard!\n\n` +
        `Key: ${result.key}\n\n` +
        `⚠️ Store this key securely - it will not be shown again.`
      );
    } catch (error) {
      this.messageService.error(`Failed to create API key: ${error}`);
    }
  }

  /**
   * Manage a specific API key.
   */
  private async manageKey(keyId: string, key: ApiKey): Promise<void> {
    const action = await this.quickInputService.showQuickPick([
      { label: '$(copy) Copy Key ID', id: 'copy-id' },
      { label: '$(trash) Revoke Key', id: 'revoke', description: 'Permanently disable this key' },
    ], {
      title: `Manage: ${key.name}`,
      placeholder: 'Choose an action',
    });

    if (!action) {
      return;
    }

    switch ((action as any).id) {
      case 'copy-id':
        await this.clipboardService.writeText(keyId);
        this.messageService.info('Key ID copied to clipboard');
        break;
      case 'revoke':
        await this.revokeKey(keyId, key.name);
        break;
    }
  }

  /**
   * Revoke an API key.
   */
  private async revokeKey(keyId: string, keyName: string): Promise<void> {
    const confirm = await this.messageService.warn(
      `Are you sure you want to revoke "${keyName}"?\n\nThis action cannot be undone. Any applications using this key will stop working.`,
      'Revoke',
      'Cancel'
    );

    if (confirm !== 'Revoke') {
      return;
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to revoke API key: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      this.messageService.info(`API key "${keyName}" has been revoked`);
    } catch (error) {
      this.messageService.error(`Failed to revoke API key: ${error}`);
    }
  }
}
