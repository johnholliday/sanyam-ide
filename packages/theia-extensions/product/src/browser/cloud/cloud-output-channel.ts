/**
 * Cloud Output Channel
 *
 * Dedicated Theia output channel for Sanyam Cloud operations.
 * Provides structured logging with configurable verbosity.
 *
 * @packageDocumentation
 */

import { inject, injectable } from '@theia/core/shared/inversify';
import { OutputChannelManager, OutputChannel } from '@theia/output/lib/browser/output-channel';

/**
 * Log verbosity level (lower = more verbose).
 */
export type CloudLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<CloudLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * DI token.
 */
export const CloudOutputChannel = Symbol('CloudOutputChannel');

/**
 * Service interface for cloud operation output.
 */
export interface CloudOutputChannelService {
  /** Set the minimum log level. Messages below this level are suppressed. */
  setLevel(level: CloudLogLevel): void;

  /** Log a debug message (most verbose). */
  debug(message: string): void;

  /** Log an informational message. */
  info(message: string): void;

  /** Log a warning. */
  warn(message: string): void;

  /** Log an error. */
  error(message: string): void;

  /** Show the output channel panel. */
  show(): void;

  /** Clear all output. */
  clear(): void;
}

/**
 * Default implementation backed by a single Theia output channel.
 */
@injectable()
export class CloudOutputChannelServiceImpl implements CloudOutputChannelService {
  @inject(OutputChannelManager)
  private readonly outputChannelManager!: OutputChannelManager;

  private channel: OutputChannel | undefined;
  private level: CloudLogLevel = 'info';

  private getChannel(): OutputChannel {
    if (!this.channel) {
      this.channel = this.outputChannelManager.getChannel('Sanyam Cloud');
    }
    return this.channel;
  }

  setLevel(level: CloudLogLevel): void {
    this.level = level;
    this.appendLine('info', `Log level set to ${level}`);
  }

  debug(message: string): void {
    this.appendLine('debug', message);
  }

  info(message: string): void {
    this.appendLine('info', message);
  }

  warn(message: string): void {
    this.appendLine('warn', message);
  }

  error(message: string): void {
    this.appendLine('error', message);
  }

  show(): void {
    this.getChannel().show();
  }

  clear(): void {
    this.getChannel().clear();
  }

  private appendLine(level: CloudLogLevel, message: string): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.level]) {
      return;
    }
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const tag = level.toUpperCase().padEnd(5);
    this.getChannel().appendLine(`[${ts}] ${tag} ${message}`);
  }
}
