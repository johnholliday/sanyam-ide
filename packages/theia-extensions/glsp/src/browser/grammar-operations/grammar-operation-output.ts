/**
 * Grammar Operation Output
 *
 * Output channel management for grammar operations.
 * Provides per-grammar output channels for operation results.
 *
 * @packageDocumentation
 */

import { inject, injectable } from 'inversify';
import { OutputChannelManager, OutputChannel } from '@theia/output/lib/browser/output-channel';

/**
 * Symbol for injection.
 */
export const GrammarOperationOutput = Symbol('GrammarOperationOutput');

/**
 * Service interface for grammar operation output.
 */
export interface GrammarOperationOutputService {
  /**
   * Get or create an output channel for a grammar.
   *
   * @param languageId - Language ID
   * @returns Output channel for the grammar
   */
  getChannel(languageId: string): OutputChannel;

  /**
   * Show the output channel for a grammar.
   *
   * @param languageId - Language ID
   */
  showChannel(languageId: string): void;

  /**
   * Clear the output channel for a grammar.
   *
   * @param languageId - Language ID
   */
  clearChannel(languageId: string): void;

  /**
   * Dispose of all output channels.
   */
  dispose(): void;
}

/**
 * Default implementation of GrammarOperationOutputService.
 */
@injectable()
export class GrammarOperationOutputServiceImpl implements GrammarOperationOutputService {
  @inject(OutputChannelManager)
  protected readonly outputChannelManager: OutputChannelManager;

  /** Map of language ID to output channel */
  private channels = new Map<string, OutputChannel>();

  /**
   * Get or create an output channel for a grammar.
   */
  getChannel(languageId: string): OutputChannel {
    let channel = this.channels.get(languageId);
    if (!channel) {
      const displayName = this.getDisplayName(languageId);
      channel = this.outputChannelManager.getChannel(`${displayName} Operations`);
      this.channels.set(languageId, channel);
    }
    return channel;
  }

  /**
   * Show the output channel for a grammar.
   */
  showChannel(languageId: string): void {
    const channel = this.getChannel(languageId);
    channel.show();
  }

  /**
   * Clear the output channel for a grammar.
   */
  clearChannel(languageId: string): void {
    const channel = this.channels.get(languageId);
    if (channel) {
      channel.clear();
    }
  }

  /**
   * Dispose of all output channels.
   */
  dispose(): void {
    for (const channel of this.channels.values()) {
      channel.dispose();
    }
    this.channels.clear();
  }

  /**
   * Get display name for a language.
   */
  private getDisplayName(languageId: string): string {
    // Capitalize first letter and replace hyphens with spaces
    const words = languageId.split('-');
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
}
