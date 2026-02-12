/**
 * Start Live Session Command
 *
 * Command to start a real-time collaboration session.
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
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import {
  CollaborationSessionService,
  type CollaborationSessionServiceType,
} from './collaboration-session-service.js';

/**
 * Start Live Session command.
 */
export const START_LIVE_SESSION_COMMAND: Command = {
  id: 'sanyam.collaboration.startLiveSession',
  label: 'Sanyam: Start Live Collaboration Session',
  category: 'Collaboration',
};

/**
 * Copy Room Code command.
 */
export const COPY_ROOM_CODE_COMMAND: Command = {
  id: 'sanyam.collaboration.copyRoomCode',
  label: 'Sanyam: Copy Room Code',
  category: 'Collaboration',
};

/**
 * Start Live Session command contribution.
 */
@injectable()
export class StartLiveSessionCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(CollaborationSessionService)
  private readonly collaborationService!: CollaborationSessionServiceType;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  @inject(ClipboardService)
  private readonly clipboardService!: ClipboardService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(START_LIVE_SESSION_COMMAND, {
      execute: () => this.startSession(),
      isEnabled: () => this.canStartSession(),
      isVisible: () => this.authProvider.isConfigured,
    });

    commands.registerCommand(COPY_ROOM_CODE_COMMAND, {
      execute: () => this.copyRoomCode(),
      isEnabled: () => this.collaborationService.isInSession,
      isVisible: () => this.collaborationService.isInSession,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'collaboration'], {
      commandId: START_LIVE_SESSION_COMMAND.id,
      order: '1',
    });

    menus.registerMenuAction(['sanyam', 'collaboration'], {
      commandId: COPY_ROOM_CODE_COMMAND.id,
      order: '2',
    });
  }

  /**
   * Check if user can start a session.
   */
  private canStartSession(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    if (this.collaborationService.isInSession) {
      return false;
    }

    // Check tier (Pro+ required)
    const session = this.authProvider.session;
    if (!session?.user) {
      return false;
    }

    // TODO: Use FeatureGate to check tier
    // For now, allow if authenticated
    return true;
  }

  /**
   * Start a collaboration session.
   */
  private async startSession(): Promise<void> {
    // Check tier
    const session = this.authProvider.session;
    const tier = session?.user?.tier ?? 'free';

    if (tier === 'free') {
      const result = await this.messageService.warn(
        nls.localizeByDefault(
          'Live collaboration requires a Pro or Enterprise subscription. Would you like to upgrade?'
        ),
        'Upgrade',
        'Cancel'
      );

      if (result === 'Upgrade') {
        // TODO: Open upgrade dialog/URL
        this.messageService.info('Upgrade functionality coming soon!');
      }
      return;
    }

    try {
      const sessionId = await this.collaborationService.startSession();

      // Copy to clipboard automatically
      await this.clipboardService.writeText(sessionId);

      this.messageService.info(
        `Live session started! Room code: ${sessionId} (copied to clipboard)\n\n` +
        `Share this code with collaborators to invite them.`
      );
    } catch (error) {
      this.messageService.error(`Failed to start session: ${error}`);
    }
  }

  /**
   * Copy the current room code to clipboard.
   */
  private async copyRoomCode(): Promise<void> {
    const session = this.collaborationService.currentSession;
    if (!session) {
      return;
    }

    await this.clipboardService.writeText(session.id);
    this.messageService.info(`Room code ${session.id} copied to clipboard`);
  }
}
