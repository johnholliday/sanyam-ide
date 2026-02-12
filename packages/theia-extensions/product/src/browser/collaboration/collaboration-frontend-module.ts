/**
 * Collaboration Frontend Module
 *
 * Inversify container module for real-time collaboration features.
 *
 * @packageDocumentation
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import {
  CollaborationSessionService,
  CollaborationSessionServiceImpl,
} from './collaboration-session-service.js';
import { StartLiveSessionCommand } from './start-live-session-command.js';
import { JoinSessionCommand } from './join-session-command.js';
import { EndSessionCommand } from './end-session-command.js';

/**
 * Frontend module for real-time collaboration features.
 */
export const CollaborationFrontendModule = new ContainerModule((bind) => {
  // Collaboration session service
  bind(CollaborationSessionService).to(CollaborationSessionServiceImpl).inSingletonScope();

  // Start Live Session command
  bind(StartLiveSessionCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(StartLiveSessionCommand);
  bind(MenuContribution).toService(StartLiveSessionCommand);

  // Join Session command
  bind(JoinSessionCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(JoinSessionCommand);
  bind(MenuContribution).toService(JoinSessionCommand);

  // End Session command
  bind(EndSessionCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(EndSessionCommand);
  bind(MenuContribution).toService(EndSessionCommand);
});

export default CollaborationFrontendModule;
