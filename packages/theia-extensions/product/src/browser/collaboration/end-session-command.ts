/**
 * End Session Command
 *
 * Command to end or leave a collaboration session.
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
import {
  CollaborationSessionService,
  type CollaborationSessionServiceType,
} from './collaboration-session-service.js';

/**
 * End Session command (for hosts).
 */
export const END_SESSION_COMMAND: Command = {
  id: 'sanyam.collaboration.endSession',
  label: 'Sanyam: End Collaboration Session',
  category: 'Collaboration',
};

/**
 * Leave Session command (for participants).
 */
export const LEAVE_SESSION_COMMAND: Command = {
  id: 'sanyam.collaboration.leaveSession',
  label: 'Sanyam: Leave Collaboration Session',
  category: 'Collaboration',
};

/**
 * End Session command contribution.
 */
@injectable()
export class EndSessionCommand implements CommandContribution, MenuContribution {
  @inject(CollaborationSessionService)
  private readonly collaborationService!: CollaborationSessionServiceType;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(END_SESSION_COMMAND, {
      execute: () => this.endSession(),
      isEnabled: () => this.isHost(),
      isVisible: () => this.isHost(),
    });

    commands.registerCommand(LEAVE_SESSION_COMMAND, {
      execute: () => this.leaveSession(),
      isEnabled: () => this.isParticipant(),
      isVisible: () => this.isParticipant(),
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'collaboration'], {
      commandId: END_SESSION_COMMAND.id,
      order: '10',
    });

    menus.registerMenuAction(['sanyam', 'collaboration'], {
      commandId: LEAVE_SESSION_COMMAND.id,
      order: '11',
    });
  }

  /**
   * Check if current user is the session host.
   */
  private isHost(): boolean {
    const session = this.collaborationService.currentSession;
    return session?.isHost ?? false;
  }

  /**
   * Check if current user is a participant (not host).
   */
  private isParticipant(): boolean {
    const session = this.collaborationService.currentSession;
    return session !== undefined && !session.isHost;
  }

  /**
   * End the collaboration session (host only).
   */
  private async endSession(): Promise<void> {
    const session = this.collaborationService.currentSession;
    if (!session || !session.isHost) {
      return;
    }

    const participantCount = session.participants.length - 1; // Exclude host

    if (participantCount > 0) {
      const confirm = await this.messageService.warn(
        `Ending this session will disconnect ${participantCount} participant${participantCount > 1 ? 's' : ''}. Are you sure?`,
        'End Session',
        'Cancel'
      );

      if (confirm !== 'End Session') {
        return;
      }
    }

    try {
      await this.collaborationService.endSession();
    } catch (error) {
      this.messageService.error(`Failed to end session: ${error}`);
    }
  }

  /**
   * Leave the collaboration session (participant only).
   */
  private async leaveSession(): Promise<void> {
    const session = this.collaborationService.currentSession;
    if (!session || session.isHost) {
      return;
    }

    try {
      await this.collaborationService.endSession();
    } catch (error) {
      this.messageService.error(`Failed to leave session: ${error}`);
    }
  }
}
