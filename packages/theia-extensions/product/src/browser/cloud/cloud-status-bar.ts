/**
 * Cloud Status Bar
 *
 * Status bar widget showing signed-in user and cloud connection status.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from '@theia/core/shared/inversify';
import {
  FrontendApplicationContribution,
  StatusBar,
  StatusBarAlignment,
} from '@theia/core/lib/browser';
import { DisposableCollection } from '@theia/core';
import {
  AuthStateEmitter,
  SupabaseAuthProvider,
  type AuthStateEmitterType,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import { CLOUD_SIGN_IN_COMMAND, CLOUD_SIGN_OUT_COMMAND } from './cloud-auth-commands.js';
import {
  CollaborationSessionService,
  type CollaborationSessionServiceType,
} from '../collaboration/collaboration-session-service.js';
import { COPY_ROOM_CODE_COMMAND } from '../collaboration/start-live-session-command.js';

/**
 * Status bar entry ID.
 */
export const CLOUD_STATUS_BAR_ID = 'sanyam-cloud-status';

/**
 * Collaboration status bar entry ID.
 */
export const COLLABORATION_STATUS_BAR_ID = 'sanyam-collaboration-status';

/**
 * Status bar priority (higher = further right).
 */
const STATUS_BAR_PRIORITY = 100;
const COLLABORATION_STATUS_BAR_PRIORITY = 99;

/**
 * Cloud status bar contribution.
 */
@injectable()
export class CloudStatusBarContribution implements FrontendApplicationContribution {
  private readonly disposables = new DisposableCollection();

  @inject(StatusBar)
  private readonly statusBar!: StatusBar;

  @inject(AuthStateEmitter)
  private readonly authStateEmitter!: AuthStateEmitterType;

  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(CollaborationSessionService) @optional()
  private readonly collaborationService?: CollaborationSessionServiceType;

  @postConstruct()
  protected init(): void {
    // Subscribe to auth state changes
    this.disposables.push(
      this.authStateEmitter.onAuthStateChange(() => {
        this.updateStatusBar();
      })
    );

    // Subscribe to collaboration session changes (if available)
    if (this.collaborationService) {
      this.disposables.push(
        this.collaborationService.events.onSessionChange(() => {
          this.updateCollaborationStatusBar();
        })
      );
      this.disposables.push(
        this.collaborationService.events.onParticipantsChange(() => {
          this.updateCollaborationStatusBar();
        })
      );
    }
  }

  async onStart(): Promise<void> {
    // Initialize auth provider
    await this.authProvider.initialize();

    // Initial status bar updates
    this.updateStatusBar();
    this.updateCollaborationStatusBar();
  }

  onStop(): void {
    this.disposables.dispose();
    this.statusBar.removeElement(CLOUD_STATUS_BAR_ID);
    this.statusBar.removeElement(COLLABORATION_STATUS_BAR_ID);
  }

  /**
   * Update status bar based on auth state.
   */
  private updateStatusBar(): void {
    const session = this.authStateEmitter.currentSession;

    if (!this.authProvider.isConfigured) {
      // Cloud not configured - show disabled state
      this.statusBar.setElement(CLOUD_STATUS_BAR_ID, {
        text: '$(cloud-offline) Cloud Disabled',
        tooltip: 'Cloud services are not configured',
        alignment: StatusBarAlignment.RIGHT,
        priority: STATUS_BAR_PRIORITY,
      });
      return;
    }

    if (session) {
      // User is signed in
      const displayName = session.user.display_name ?? session.user.email;
      const tier = session.user.tier;
      const tierBadge = tier === 'free' ? '' : ` (${tier})`;

      this.statusBar.setElement(CLOUD_STATUS_BAR_ID, {
        text: `$(account) ${displayName}${tierBadge}`,
        tooltip: `Signed in as ${session.user.email}\nTier: ${tier}\nClick to sign out`,
        alignment: StatusBarAlignment.RIGHT,
        priority: STATUS_BAR_PRIORITY,
        command: CLOUD_SIGN_OUT_COMMAND.id,
      });
    } else {
      // User is not signed in
      this.statusBar.setElement(CLOUD_STATUS_BAR_ID, {
        text: '$(sign-in) Sign In',
        tooltip: 'Sign in to Sanyam Cloud',
        alignment: StatusBarAlignment.RIGHT,
        priority: STATUS_BAR_PRIORITY,
        command: CLOUD_SIGN_IN_COMMAND.id,
      });
    }
  }

  /**
   * Update collaboration status bar based on session state.
   */
  private updateCollaborationStatusBar(): void {
    if (!this.collaborationService) {
      return;
    }

    const session = this.collaborationService.currentSession;

    if (session) {
      const participantCount = session.participants.length;
      const roleText = session.isHost ? 'Hosting' : 'In Session';

      this.statusBar.setElement(COLLABORATION_STATUS_BAR_ID, {
        text: `$(broadcast) ${roleText} (${participantCount})`,
        tooltip: `Live Collaboration: ${session.id}\n${participantCount} participant${participantCount !== 1 ? 's' : ''}\nClick to copy room code`,
        alignment: StatusBarAlignment.RIGHT,
        priority: COLLABORATION_STATUS_BAR_PRIORITY,
        command: COPY_ROOM_CODE_COMMAND.id,
      });
    } else {
      // No active session - remove the status bar element
      this.statusBar.removeElement(COLLABORATION_STATUS_BAR_ID);
    }
  }
}
