/**
 * Collaboration Session Service
 *
 * Wraps OCT (Open Collaboration Tools) for real-time collaboration sessions.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event, Disposable, DisposableCollection } from '@theia/core';
import { MessageService } from '@theia/core';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'CollaborationSessionService' });

/**
 * Participant in a collaboration session.
 */
export interface CollaborationParticipant {
  /** Unique participant ID */
  id: string;
  /** Display name */
  name: string;
  /** Assigned color for cursor/selection */
  color: string;
  /** Whether this is the local user */
  isLocal: boolean;
  /** Whether this participant is the host */
  isHost: boolean;
}

/**
 * Collaboration session state.
 */
export interface CollaborationSession {
  /** Session ID (room code) */
  id: string;
  /** Whether this user is the host */
  isHost: boolean;
  /** Current participants */
  participants: CollaborationParticipant[];
  /** Session creation time */
  createdAt: Date;
}

/**
 * Collaboration session events.
 */
export interface CollaborationEvents {
  /** Fired when a session starts or ends */
  onSessionChange: Event<CollaborationSession | undefined>;
  /** Fired when participants join or leave */
  onParticipantsChange: Event<CollaborationParticipant[]>;
}

/**
 * Service for managing real-time collaboration sessions.
 */
export const CollaborationSessionService = Symbol('CollaborationSessionService');

/**
 * Collaboration session service interface.
 */
export interface CollaborationSessionServiceType {
  /** Current active session */
  readonly currentSession: CollaborationSession | undefined;
  /** Whether a session is active */
  readonly isInSession: boolean;
  /** Events for session state changes */
  readonly events: CollaborationEvents;

  /**
   * Start a new collaboration session as host.
   * @returns Session ID (room code) to share with collaborators
   */
  startSession(): Promise<string>;

  /**
   * Join an existing session.
   * @param sessionId - Room code to join
   */
  joinSession(sessionId: string): Promise<void>;

  /**
   * End the current session.
   * Hosts end the session for all, participants just leave.
   */
  endSession(): Promise<void>;
}

/**
 * Default colors for participant cursors/selections.
 */
const PARTICIPANT_COLORS = [
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#009688', // Teal
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#795548', // Brown
];

/**
 * Implementation of CollaborationSessionService.
 */
@injectable()
export class CollaborationSessionServiceImpl implements CollaborationSessionServiceType, Disposable {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  private readonly disposables = new DisposableCollection();

  private _currentSession: CollaborationSession | undefined;
  private colorIndex = 0;

  private readonly onSessionChangeEmitter = new Emitter<CollaborationSession | undefined>();
  private readonly onParticipantsChangeEmitter = new Emitter<CollaborationParticipant[]>();

  readonly events: CollaborationEvents = {
    onSessionChange: this.onSessionChangeEmitter.event,
    onParticipantsChange: this.onParticipantsChangeEmitter.event,
  };

  @postConstruct()
  protected init(): void {
    this.disposables.push(this.onSessionChangeEmitter);
    this.disposables.push(this.onParticipantsChangeEmitter);
  }

  get currentSession(): CollaborationSession | undefined {
    return this._currentSession;
  }

  get isInSession(): boolean {
    return this._currentSession !== undefined;
  }

  async startSession(): Promise<string> {
    if (this._currentSession) {
      throw new Error('Already in a collaboration session');
    }

    if (!this.authProvider.isAuthenticated) {
      throw new Error('Must be signed in to start a collaboration session');
    }

    const user = this.authProvider.currentUser;
    if (!user) {
      throw new Error('No user information available');
    }

    try {
      // Generate a random session ID (room code)
      const sessionId = this.generateSessionId();

      // Create local participant (host)
      const localParticipant: CollaborationParticipant = {
        id: user.id,
        name: user.email?.split('@')[0] ?? 'Anonymous',
        color: this.getNextColor(),
        isLocal: true,
        isHost: true,
      };

      this._currentSession = {
        id: sessionId,
        isHost: true,
        participants: [localParticipant],
        createdAt: new Date(),
      };

      logger.info({ sessionId }, 'Started collaboration session');
      this.onSessionChangeEmitter.fire(this._currentSession);
      this.onParticipantsChangeEmitter.fire(this._currentSession.participants);

      // TODO: Initialize OCT connection with Yjs
      // This is a stub - actual implementation would connect to signaling server

      return sessionId;
    } catch (error) {
      logger.error({ err: error }, 'Failed to start collaboration session');
      throw error;
    }
  }

  async joinSession(sessionId: string): Promise<void> {
    if (this._currentSession) {
      throw new Error('Already in a collaboration session');
    }

    if (!this.authProvider.isAuthenticated) {
      throw new Error('Must be signed in to join a collaboration session');
    }

    const user = this.authProvider.currentUser;
    if (!user) {
      throw new Error('No user information available');
    }

    try {
      // Create local participant
      const localParticipant: CollaborationParticipant = {
        id: user.id,
        name: user.email?.split('@')[0] ?? 'Anonymous',
        color: this.getNextColor(),
        isLocal: true,
        isHost: false,
      };

      this._currentSession = {
        id: sessionId,
        isHost: false,
        participants: [localParticipant],
        createdAt: new Date(),
      };

      logger.info({ sessionId }, 'Joined collaboration session');
      this.onSessionChangeEmitter.fire(this._currentSession);
      this.onParticipantsChangeEmitter.fire(this._currentSession.participants);

      // TODO: Connect to existing OCT session via signaling server
      // This is a stub - actual implementation would connect to the room

      this.messageService.info(`Joined collaboration session: ${sessionId}`);
    } catch (error) {
      logger.error({ err: error, sessionId }, 'Failed to join collaboration session');
      throw error;
    }
  }

  async endSession(): Promise<void> {
    if (!this._currentSession) {
      return;
    }

    const wasHost = this._currentSession.isHost;
    const sessionId = this._currentSession.id;

    try {
      // TODO: Disconnect from OCT session
      // If host, signal session end to all participants
      // If participant, just leave

      this._currentSession = undefined;
      this.onSessionChangeEmitter.fire(undefined);
      this.onParticipantsChangeEmitter.fire([]);

      if (wasHost) {
        logger.info({ sessionId }, 'Ended collaboration session (host)');
        this.messageService.info('Collaboration session ended');
      } else {
        logger.info({ sessionId }, 'Left collaboration session');
        this.messageService.info('Left collaboration session');
      }
    } catch (error) {
      logger.error({ err: error, sessionId }, 'Failed to end collaboration session');
      throw error;
    }
  }

  /**
   * Generate a random session ID (room code).
   */
  private generateSessionId(): string {
    // Generate a readable 6-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get next participant color.
   */
  private getNextColor(): string {
    const color = PARTICIPANT_COLORS[this.colorIndex % PARTICIPANT_COLORS.length];
    this.colorIndex++;
    return color;
  }

  dispose(): void {
    this.disposables.dispose();
  }
}
