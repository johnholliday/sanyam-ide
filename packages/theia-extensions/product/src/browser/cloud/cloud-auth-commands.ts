/**
 * Cloud Auth Commands
 *
 * Sign In and Sign Out commands for cloud authentication.
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
import { QuickInputService, QuickPickItem } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
  type OAuthProvider,
} from '@sanyam/supabase-auth';

/**
 * Sign In command.
 */
export const CLOUD_SIGN_IN_COMMAND: Command = {
  id: 'sanyam.cloud.signIn',
  label: 'Sanyam: Sign In to Cloud',
  category: 'Sanyam Cloud',
};

/**
 * Sign Out command.
 */
export const CLOUD_SIGN_OUT_COMMAND: Command = {
  id: 'sanyam.cloud.signOut',
  label: 'Sanyam: Sign Out from Cloud',
  category: 'Sanyam Cloud',
};

/**
 * Sign Up command.
 */
export const CLOUD_SIGN_UP_COMMAND: Command = {
  id: 'sanyam.cloud.signUp',
  label: 'Sanyam: Create Cloud Account',
  category: 'Sanyam Cloud',
};

/**
 * Cloud menu path.
 */
const CLOUD_MENU = ['sanyam', 'cloud'];

/**
 * Provider icons.
 */
const PROVIDER_ICONS: Record<OAuthProvider, string> = {
  email: 'mail',
  github: 'github',
  google: 'account',
  azure: 'azure',
};

/**
 * Cloud authentication commands contribution.
 */
@injectable()
export class CloudAuthCommands implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  registerCommands(commands: CommandRegistry): void {
    // Sign In command
    commands.registerCommand(CLOUD_SIGN_IN_COMMAND, {
      execute: () => this.showSignInDialog(),
      isEnabled: () => this.authProvider.isConfigured && !this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });

    // Sign Out command
    commands.registerCommand(CLOUD_SIGN_OUT_COMMAND, {
      execute: () => this.signOut(),
      isEnabled: () => this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });

    // Sign Up command
    commands.registerCommand(CLOUD_SIGN_UP_COMMAND, {
      execute: () => this.showSignUpDialog(),
      isEnabled: () => this.authProvider.isConfigured && !this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    // Add cloud submenu under main menu
    menus.registerSubmenu(CLOUD_MENU, 'Cloud');

    menus.registerMenuAction(CLOUD_MENU, {
      commandId: CLOUD_SIGN_IN_COMMAND.id,
      order: '1',
    });

    menus.registerMenuAction(CLOUD_MENU, {
      commandId: CLOUD_SIGN_OUT_COMMAND.id,
      order: '2',
    });

    menus.registerMenuAction(CLOUD_MENU, {
      commandId: CLOUD_SIGN_UP_COMMAND.id,
      order: '3',
    });
  }

  /**
   * Show sign in dialog with provider selection.
   */
  private async showSignInDialog(): Promise<void> {
    const providers = this.authProvider.availableProviders;

    if (providers.length === 0) {
      this.messageService.error('No authentication providers configured');
      return;
    }

    // Build quick pick items for each provider
    const items: QuickPickItem[] = providers.map((provider) => ({
      label: `$(${PROVIDER_ICONS[provider.id]}) ${provider.label}`,
      description: provider.id === 'email' ? 'Email & Password' : `Sign in with ${provider.label}`,
      detail: undefined,
      id: provider.id,
    }));

    // Add magic link option if email is available
    const hasEmail = providers.some((p) => p.id === 'email');
    if (hasEmail) {
      items.push({
        label: '$(link) Magic Link',
        description: 'Sign in with email link (passwordless)',
        id: 'magic-link',
      });
    }

    const selected = await this.quickInputService.showQuickPick(items, {
      title: 'Sign In to Sanyam Cloud',
      placeholder: 'Choose a sign-in method',
    });

    if (!selected) {
      return;
    }

    const providerId = (selected as any).id as OAuthProvider | 'magic-link';

    if (providerId === 'email') {
      await this.showEmailPasswordDialog();
    } else if (providerId === 'magic-link') {
      await this.showMagicLinkDialog();
    } else {
      await this.signInWithOAuth(providerId);
    }
  }

  /**
   * Show email/password sign in dialog.
   */
  private async showEmailPasswordDialog(): Promise<void> {
    const email = await this.quickInputService.input({
      title: 'Sign In with Email',
      prompt: 'Enter your email address',
      placeHolder: 'you@example.com',
      validateInput: async (value) => {
        if (!value || !value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return undefined;
      },
    });

    if (!email) {
      return;
    }

    const password = await this.quickInputService.input({
      title: 'Sign In with Email',
      prompt: 'Enter your password',
      password: true,
      validateInput: async (value) => {
        if (!value || value.length < 6) {
          return 'Password must be at least 6 characters';
        }
        return undefined;
      },
    });

    if (!password) {
      return;
    }

    try {
      const success = await this.authProvider.signInWithPassword(email, password);
      if (success) {
        this.messageService.info('Successfully signed in to Sanyam Cloud');
      } else {
        this.messageService.error('Sign in failed. Please check your credentials.');
      }
    } catch (error) {
      this.messageService.error(`Sign in failed: ${error}`);
    }
  }

  /**
   * Show magic link dialog.
   */
  private async showMagicLinkDialog(): Promise<void> {
    const email = await this.quickInputService.input({
      title: 'Sign In with Magic Link',
      prompt: 'Enter your email address',
      placeHolder: 'you@example.com',
      validateInput: async (value) => {
        if (!value || !value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return undefined;
      },
    });

    if (!email) {
      return;
    }

    try {
      const success = await this.authProvider.signInWithMagicLink(email);
      if (success) {
        this.messageService.info('Check your email for a sign-in link');
      } else {
        this.messageService.error('Failed to send magic link');
      }
    } catch (error) {
      this.messageService.error(`Failed to send magic link: ${error}`);
    }
  }

  /**
   * Sign in with OAuth provider.
   */
  private async signInWithOAuth(provider: OAuthProvider): Promise<void> {
    try {
      const success = await this.authProvider.signInWithOAuth(provider);
      if (success) {
        // For OAuth, browser will be redirected
        this.messageService.info('Redirecting to sign-in...');
      } else {
        this.messageService.error('OAuth sign in failed');
      }
    } catch (error) {
      this.messageService.error(`OAuth sign in failed: ${error}`);
    }
  }

  /**
   * Show sign up dialog.
   */
  private async showSignUpDialog(): Promise<void> {
    const email = await this.quickInputService.input({
      title: 'Create Sanyam Cloud Account',
      prompt: 'Enter your email address',
      placeHolder: 'you@example.com',
      validateInput: async (value) => {
        if (!value || !value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return undefined;
      },
    });

    if (!email) {
      return;
    }

    const password = await this.quickInputService.input({
      title: 'Create Sanyam Cloud Account',
      prompt: 'Choose a password (min 8 characters)',
      password: true,
      validateInput: async (value) => {
        if (!value || value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return undefined;
      },
    });

    if (!password) {
      return;
    }

    const confirmPassword = await this.quickInputService.input({
      title: 'Create Sanyam Cloud Account',
      prompt: 'Confirm your password',
      password: true,
      validateInput: async (value) => {
        if (value !== password) {
          return 'Passwords do not match';
        }
        return undefined;
      },
    });

    if (!confirmPassword) {
      return;
    }

    try {
      const success = await this.authProvider.signUp(email, password);
      if (success) {
        this.messageService.info(
          'Account created! Check your email to confirm your address.'
        );
      } else {
        this.messageService.error('Sign up failed. Please try again.');
      }
    } catch (error) {
      this.messageService.error(`Sign up failed: ${error}`);
    }
  }

  /**
   * Sign out from cloud.
   */
  private async signOut(): Promise<void> {
    try {
      await this.authProvider.signOut();
      this.messageService.info('Signed out from Sanyam Cloud');
    } catch (error) {
      this.messageService.error(`Sign out failed: ${error}`);
    }
  }
}
