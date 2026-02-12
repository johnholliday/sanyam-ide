/**
 * Join Session Command
 *
 * Command to join an existing collaboration session with a room code.
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
import { MessageService, nls } from '@theia/core';
import { QuickInputService } from '@theia/core/lib/browser';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import {
  CollaborationSessionService,
  type CollaborationSessionServiceType,
} from './collaboration-session-service.js';

/**
 * Join Session command.
 */
export const JOIN_SESSION_COMMAND: Command = {
  id: 'sanyam.collaboration.joinSession',
  label: 'Sanyam: Join Live Collaboration Session',
  category: 'Collaboration',
};

/**
 * Join Session command contribution.
 */
@injectable()
export class JoinSessionCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(CollaborationSessionService)
  private readonly collaborationService!: CollaborationSessionServiceType;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(JOIN_SESSION_COMMAND, {
      execute: (roomCode?: string) => this.joinSession(roomCode),
      isEnabled: () => this.canJoinSession(),
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'collaboration'], {
      commandId: JOIN_SESSION_COMMAND.id,
      order: '3',
    });
  }

  /**
   * Check if user can join a session.
   */
  private canJoinSession(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    if (this.collaborationService.isInSession) {
      return false;
    }

    return true;
  }

  /**
   * Join a collaboration session.
   */
  private async joinSession(roomCode?: string): Promise<void> {
    // Check tier for joining
    const user = this.authProvider.currentUser;
    const tier = (user as any)?.user_metadata?.subscription_tier ?? 'free';

    if (tier === 'free') {
      const result = await this.messageService.warn(
        nls.localizeByDefault(
          'Live collaboration requires a Pro or Enterprise subscription. Would you like to upgrade?'
        ),
        'Upgrade',
        'Cancel'
      );

      if (result === 'Upgrade') {
        this.messageService.info('Upgrade functionality coming soon!');
      }
      return;
    }

    // Get room code if not provided
    let code = roomCode;
    if (!code) {
      const input = await this.quickInputService.input({
        title: 'Join Collaboration Session',
        prompt: 'Enter the room code shared by the host',
        placeHolder: 'e.g., ABC123',
        validateInput: (value) => {
          if (!value || value.length < 4) {
            return 'Room code must be at least 4 characters';
          }
          if (!/^[A-Z0-9]+$/i.test(value)) {
            return 'Room code can only contain letters and numbers';
          }
          return undefined;
        },
      });

      if (!input) {
        return;
      }

      code = input.toUpperCase();
    }

    try {
      await this.collaborationService.joinSession(code);
    } catch (error) {
      this.messageService.error(`Failed to join session: ${error}`);
    }
  }
}
