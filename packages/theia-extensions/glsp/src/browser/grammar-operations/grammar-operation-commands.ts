/**
 * Grammar Operation Commands
 *
 * Command contributions for grammar operations.
 * Registers commands for each operation declared in grammar manifests.
 *
 * @packageDocumentation
 */

import { inject, injectable } from 'inversify';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  MessageService,
  URI,
  QuickPickService,
} from '@theia/core';
import { ApplicationShell, Saveable, NavigatableWidget } from '@theia/core/lib/browser';
import { UriSelection } from '@theia/core/lib/common/selection';
import type { OutputChannel } from '@theia/output/lib/browser/output-channel';
import type { GrammarOperation } from '@sanyam/types';
import { GrammarRegistry } from '@sanyam-ide/product/lib/browser/grammar-registry';
import {
  GrammarOperationService,
  GrammarOperationServiceInterface,
} from './grammar-operation-service';
import { GrammarOperationOutput, GrammarOperationOutputService } from './grammar-operation-output';

/**
 * Command prefix for grammar operations.
 */
const OPERATION_COMMAND_PREFIX = 'sanyam.operation.';

/**
 * Namespace for grammar operation commands.
 */
export namespace GrammarOperationCommands {
  /**
   * Category for operation commands.
   */
  export const CATEGORY = 'Grammar Operations';

  /**
   * Build command ID for an operation.
   */
  export function buildCommandId(languageId: string, operationId: string): string {
    return `${OPERATION_COMMAND_PREFIX}${languageId}.${operationId}`;
  }

  /**
   * Parse command ID to extract language and operation IDs.
   */
  export function parseCommandId(commandId: string): { languageId: string; operationId: string } | undefined {
    if (!commandId.startsWith(OPERATION_COMMAND_PREFIX)) {
      return undefined;
    }
    const parts = commandId.slice(OPERATION_COMMAND_PREFIX.length).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return undefined;
    }
    return { languageId: parts[0], operationId: parts[1] };
  }
}

/**
 * Command contribution for grammar operations.
 *
 * Dynamically registers commands based on operations declared in grammar manifests.
 */
@injectable()
export class GrammarOperationCommandContribution implements CommandContribution {
  @inject(GrammarOperationService)
  protected readonly operationService: GrammarOperationServiceInterface;

  @inject(MessageService)
  protected readonly messageService: MessageService;

  @inject(ApplicationShell)
  protected readonly shell: ApplicationShell;

  @inject(GrammarOperationOutput)
  protected readonly outputService: GrammarOperationOutputService;

  @inject(GrammarRegistry)
  protected readonly grammarRegistry: GrammarRegistry;

  @inject(QuickPickService)
  protected readonly quickPickService: QuickPickService;

  /** Map of registered command IDs to their operations */
  private registeredCommands = new Map<string, { languageId: string; operation: GrammarOperation }>();

  /** Active async jobs being tracked */
  private activeJobs = new Map<string, { jobId: string; operationId: string; languageId: string }>();

  /**
   * Register grammar operation commands.
   */
  registerCommands(commands: CommandRegistry): void {
    // Register a generic execute operation command
    // When invoked without args, shows a quick pick to select an operation
    commands.registerCommand(
      {
        id: 'sanyam.operation.execute',
        label: 'Execute Grammar Operation',
        category: GrammarOperationCommands.CATEGORY,
      },
      {
        execute: async (args: unknown) => {
          let languageId: string | undefined;
          let operationId: string | undefined;
          let uri: string | undefined;
          let selectedIds: string[] | undefined;
          let input: Record<string, unknown> | undefined;

          // Try to extract from explicit args first
          if (args && typeof args === 'object') {
            const argObj = args as Record<string, unknown>;
            languageId = typeof argObj['languageId'] === 'string' ? argObj['languageId'] : undefined;
            operationId = typeof argObj['operationId'] === 'string' ? argObj['operationId'] : undefined;
            uri = typeof argObj['uri'] === 'string' ? argObj['uri'] : undefined;
            selectedIds = Array.isArray(argObj['selectedIds']) ? argObj['selectedIds'] as string[] : undefined;
            input = argObj['input'] && typeof argObj['input'] === 'object' ? argObj['input'] as Record<string, unknown> : undefined;
          }

          // Infer URI from current editor if not provided
          if (!uri) {
            uri = this.getCurrentEditorUri();
          }

          if (!uri) {
            this.messageService.warn('No document is currently open');
            return;
          }

          // Infer language ID from file extension if not provided
          if (!languageId) {
            const manifest = this.grammarRegistry.getManifestByFilePath(uri);
            if (manifest) {
              languageId = manifest.languageId;
            }
          }

          if (!languageId) {
            this.messageService.error('Could not determine language for current file');
            return;
          }

          // If no operation specified, show a quick pick
          if (!operationId) {
            const operations = this.getRegisteredOperations(languageId);
            if (operations.length === 0) {
              this.messageService.info(`No operations available for ${languageId}`);
              return;
            }

            const items = operations.map(op => ({
              label: op.displayName,
              description: op.category,
              detail: op.description,
              value: op.id,
            }));

            const selected = await this.quickPickService.show(items, {
              placeholder: 'Select an operation to execute',
            });

            if (!selected) {
              return; // User cancelled
            }

            operationId = selected.value;
          }

          await this.executeOperation(languageId, operationId, uri, selectedIds, input);
        },
      }
    );

    // Register list operations command
    // When invoked without args, uses the current editor's language
    commands.registerCommand(
      {
        id: 'sanyam.operation.list',
        label: 'List Available Operations',
        category: GrammarOperationCommands.CATEGORY,
      },
      {
        execute: async (args: unknown) => {
          let languageId: string | undefined;

          // Try to extract from explicit args
          if (args && typeof args === 'object') {
            const argObj = args as Record<string, unknown>;
            languageId = typeof argObj['languageId'] === 'string' ? argObj['languageId'] : undefined;
          }

          // Infer from current editor if not provided
          if (!languageId) {
            const uri = this.getCurrentEditorUri();
            if (uri) {
              const manifest = this.grammarRegistry.getManifestByFilePath(uri);
              if (manifest) {
                languageId = manifest.languageId;
              }
            }
          }

          if (!languageId) {
            this.messageService.error('No grammar file is currently open');
            return [];
          }

          // Use locally registered operations (from manifest) - more reliable than REST API
          const operations = this.getRegisteredOperations(languageId);

          // Show the operations in a message or output channel
          if (operations.length === 0) {
            this.messageService.info(`No operations registered for ${languageId}`);
          } else {
            const channel = this.outputService.getChannel(languageId);
            channel.appendLine(`Available operations for ${languageId}:`);
            channel.appendLine('');
            for (const op of operations) {
              channel.appendLine(`  ${op.displayName} (${op.id})`);
              if (op.description) {
                channel.appendLine(`    ${op.description}`);
              }
              channel.appendLine(`    Category: ${op.category ?? 'Other'}`);
              channel.appendLine('');
            }
            channel.show();
          }

          return operations;
        },
      }
    );
  }

  /**
   * Register commands for a specific language's operations.
   *
   * Called when a grammar is loaded to register its operation commands.
   * Operations are passed directly from the GrammarManifest for immediate availability.
   *
   * @param languageId - The language ID
   * @param operations - Operations from the grammar manifest
   * @param commands - The command registry
   */
  registerLanguageOperations(languageId: string, operations: readonly GrammarOperation[], commands: CommandRegistry): void {
    for (const operation of operations) {
      const commandId = GrammarOperationCommands.buildCommandId(languageId, operation.id);

      // Skip if already registered
      if (this.registeredCommands.has(commandId)) {
        continue;
      }

      const command: Command = {
        id: commandId,
        label: operation.displayName,
        category: operation.category ?? GrammarOperationCommands.CATEGORY,
        iconClass: operation.icon ? `codicon codicon-${operation.icon}` : undefined,
      };

      commands.registerCommand(command, {
        execute: async (...args: unknown[]) => {
          // Extract URI from various argument formats:
          // - String URI directly
          // - Theia URI object
          // - Widget with navigatable URI
          // - UriSelection from file explorer
          // - Object with uri property
          const resolvedUri = this.extractUri(args) ?? this.getCurrentEditorUri();
          if (!resolvedUri) {
            this.messageService.warn('No document is currently open');
            return;
          }

          // Extract selectedIds if provided as second argument (from diagram context menu)
          // Format: args = [uri, selectedIds?, input?]
          let selectedIds: string[] | undefined;
          let input: Record<string, unknown> | undefined;

          // Check for selectedIds as second argument (array of strings)
          if (args.length > 1 && Array.isArray(args[1])) {
            const ids = args[1];
            if (ids.every(id => typeof id === 'string')) {
              selectedIds = ids as string[];
            }
          }

          // Check for input as third argument (plain object, must be JSON-serializable)
          if (args.length > 2 && args[2] && typeof args[2] === 'object') {
            const maybeInput = args[2] as Record<string, unknown>;
            // Only accept plain objects that look like input data
            // Avoid widgets and other complex objects with circular references
            if (this.isPlainObject(maybeInput)) {
              input = maybeInput;
            }
          }

          await this.executeOperation(languageId, operation.id, resolvedUri, selectedIds, input);
        },
        isEnabled: () => this.isOperationEnabled(languageId, operation),
        isVisible: () => this.isOperationVisible(languageId, operation),
      });

      this.registeredCommands.set(commandId, { languageId, operation });
    }
  }

  /**
   * Execute an operation.
   */
  private async executeOperation(
    languageId: string,
    operationId: string,
    uri: string,
    selectedIds?: string[],
    input?: Record<string, unknown>
  ): Promise<void> {
    const commandId = GrammarOperationCommands.buildCommandId(languageId, operationId);
    const registered = this.registeredCommands.get(commandId);
    const operation = registered?.operation;
    const displayName = operation?.displayName ?? operationId;

    // Get output channel
    const channel = this.outputService.getChannel(languageId);
    channel.appendLine(`Executing: ${displayName}`);
    channel.appendLine(`Document: ${uri}`);
    if (selectedIds?.length) {
      channel.appendLine(`Selected: ${selectedIds.join(', ')}`);
    }
    channel.appendLine('');

    try {
      const result = await this.operationService.executeOperation({
        languageId,
        operationId,
        uri,
        selectedIds,
        input,
      });

      if (result.success) {
        if (result.jobId) {
          // Async operation - track job
          this.activeJobs.set(result.jobId, { jobId: result.jobId, operationId, languageId });
          channel.appendLine(`Started async job: ${result.jobId}`);
          this.messageService.info(`${displayName} started (Job: ${result.jobId})`);
          this.pollJobStatus(result.jobId, languageId, displayName, channel);
        } else if (result.result) {
          // Sync operation - show result
          this.handleOperationResult(displayName, result.result, channel);
        }
      } else {
        channel.appendLine(`Error: ${result.error}`);
        this.messageService.error(`${displayName} failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      channel.appendLine(`Error: ${errorMessage}`);
      this.messageService.error(`${displayName} failed: ${errorMessage}`);
    }
  }

  /**
   * Handle operation result.
   */
  private handleOperationResult(
    displayName: string,
    result: { success: boolean; data?: unknown; message?: string; error?: string },
    channel: OutputChannel
  ): void {
    if (result.success) {
      channel.appendLine(`Success: ${result.message ?? 'Operation completed'}`);

      // Format and output data if present
      if (result.data) {
        channel.appendLine('');
        channel.appendLine('Result:');

        if (typeof result.data === 'object') {
          const data = result.data as Record<string, unknown>;

          // Special handling for common result types
          if ('script' in data && typeof data['script'] === 'string') {
            channel.appendLine('--- Generated Script ---');
            channel.appendLine(data['script'] as string);
            channel.appendLine('--- End Script ---');
          } else if ('content' in data && typeof data['content'] === 'string') {
            channel.appendLine('--- Generated Content ---');
            channel.appendLine(data['content'] as string);
            channel.appendLine('--- End Content ---');
          } else {
            channel.appendLine(JSON.stringify(data, null, 2));
          }
        } else {
          channel.appendLine(String(result.data));
        }
      }

      this.messageService.info(`${displayName}: ${result.message ?? 'Completed'}`);
    } else {
      channel.appendLine(`Failed: ${result.error ?? 'Unknown error'}`);
      this.messageService.error(`${displayName}: ${result.error ?? 'Failed'}`);
    }
  }

  /**
   * Poll async job status.
   */
  private async pollJobStatus(
    jobId: string,
    languageId: string,
    displayName: string,
    channel: OutputChannel
  ): Promise<void> {
    const pollInterval = 2000; // 2 seconds
    const maxPolls = 300; // 10 minutes max
    let polls = 0;

    const poll = async (): Promise<void> => {
      // Check if job was cancelled
      if (!this.activeJobs.has(jobId)) {
        channel.appendLine('Job cancelled by user');
        return;
      }

      try {
        const status = await this.operationService.getJobStatus(jobId);

        if (!status) {
          channel.appendLine('Job not found');
          this.activeJobs.delete(jobId);
          return;
        }

        // Update progress
        if (status.message) {
          channel.appendLine(`[${status.progress}%] ${status.message}`);
        }

        // Check if complete
        if (status.status === 'completed' || status.status === 'failed') {
          this.activeJobs.delete(jobId);

          const result = await this.operationService.getJobResult(jobId);
          if (result?.result) {
            this.handleOperationResult(displayName, result.result, channel);
          } else if (status.status === 'failed') {
            channel.appendLine(`Job failed`);
            this.messageService.error(`${displayName} failed`);
          }
          return;
        }

        // Check if cancelled
        if (status.status === 'cancelled') {
          this.activeJobs.delete(jobId);
          channel.appendLine('Job was cancelled');
          return;
        }

        // Continue polling
        polls++;
        if (polls < maxPolls) {
          setTimeout(poll, pollInterval);
        } else {
          channel.appendLine('Job timed out after 10 minutes');
          this.activeJobs.delete(jobId);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        polls++;
        if (polls < maxPolls) {
          setTimeout(poll, pollInterval);
        }
      }
    };

    // Start polling
    setTimeout(poll, pollInterval);
  }

  /**
   * Extract URI from command arguments.
   *
   * Handles various argument formats that can be passed from context menus:
   * - String URI directly
   * - Theia URI object
   * - Widget with navigatable URI
   * - UriSelection from file explorer
   * - Object with uri property
   */
  private extractUri(args: unknown[]): string | undefined {
    for (const arg of args) {
      if (arg === undefined || arg === null) {
        continue;
      }

      // String URI
      if (typeof arg === 'string') {
        if (arg.startsWith('file:') || arg.startsWith('/')) {
          return arg;
        }
        continue;
      }

      // Theia URI object
      if (arg instanceof URI) {
        return arg.toString();
      }

      // Array of selections (file explorer often passes arrays)
      if (Array.isArray(arg)) {
        for (const item of arg) {
          const uri = this.extractUriFromObject(item);
          if (uri) {
            return uri;
          }
        }
        continue;
      }

      // Single object
      if (typeof arg === 'object') {
        const uri = this.extractUriFromObject(arg);
        if (uri) {
          return uri;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract URI from a single object (selection, widget, etc.)
   */
  private extractUriFromObject(obj: unknown): string | undefined {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    // Theia URI object
    if (obj instanceof URI) {
      return obj.toString();
    }

    // UriSelection (from file explorer)
    if (UriSelection.is(obj)) {
      return UriSelection.getUri(obj)?.toString();
    }

    // NavigatableWidget
    if (NavigatableWidget.is(obj)) {
      return obj.getResourceUri()?.toString();
    }

    const record = obj as Record<string, unknown>;

    // Object with uri property (string or URI)
    if ('uri' in record) {
      const uri = record['uri'];
      if (typeof uri === 'string') {
        return uri;
      }
      if (uri instanceof URI) {
        return uri.toString();
      }
      // uri might be an object with toString()
      if (uri && typeof uri === 'object' && 'toString' in uri) {
        const uriStr = (uri as { toString(): string }).toString();
        if (uriStr.startsWith('file:') || uriStr.startsWith('/')) {
          return uriStr;
        }
      }
    }

    // Object with path property (sometimes used)
    if ('path' in record && typeof record['path'] === 'string') {
      const path = record['path'];
      if (path.startsWith('/')) {
        return `file://${path}`;
      }
    }

    // FileStatNode or similar with fileStat.resource
    if ('fileStat' in record && record['fileStat'] && typeof record['fileStat'] === 'object') {
      const fileStat = record['fileStat'] as Record<string, unknown>;
      if ('resource' in fileStat) {
        const resource = fileStat['resource'];
        if (typeof resource === 'string') {
          return resource;
        }
        if (resource instanceof URI) {
          return resource.toString();
        }
        if (resource && typeof resource === 'object' && 'toString' in resource) {
          return (resource as { toString(): string }).toString();
        }
      }
    }

    return undefined;
  }

  /**
   * Check if an object is a plain JSON-serializable object.
   *
   * Returns false for class instances, widgets, DOM elements, etc.
   * that might have circular references or non-serializable properties.
   */
  private isPlainObject(obj: Record<string, unknown>): boolean {
    // Check if it's a plain object (not a class instance)
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      // It's a class instance - skip it to avoid circular references
      return false;
    }

    // Check for common non-serializable patterns
    if ('node' in obj || '_layout' in obj || 'parent' in obj || 'toDispose' in obj) {
      // Looks like a Theia widget or similar - skip it
      return false;
    }

    // Try to detect if it can be safely serialized
    try {
      JSON.stringify(obj);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get URI of the current editor.
   */
  private getCurrentEditorUri(): string | undefined {
    const widget = this.shell.currentWidget;
    if (widget) {
      // Check for NavigatableWidget
      if (NavigatableWidget.is(widget)) {
        return widget.getResourceUri()?.toString();
      }
      // Check for Saveable with URI
      if (Saveable.is(widget)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const saveable = widget as any;
        if (saveable.uri) {
          const uri = saveable.uri;
          if (typeof uri === 'string') {
            return uri;
          }
          if (uri instanceof URI) {
            return uri.toString();
          }
          if (uri && typeof uri === 'object' && typeof uri.toString === 'function') {
            return uri.toString();
          }
        }
      }
      // Check widget ID for URI
      const id = widget.id;
      if (id && id.startsWith('file:')) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Check if an operation is enabled.
   *
   * Operations are always enabled - the execute handler will handle the case
   * when no URI is available by showing a warning message. This allows operations
   * to be invoked from context menus where the URI comes from the context target
   * rather than the current editor.
   */
  private isOperationEnabled(_languageId: string, _operation: GrammarOperation): boolean {
    // Always enabled - URI is resolved at execution time from context or current editor
    return true;
  }

  /**
   * Check if an operation is visible.
   */
  private isOperationVisible(languageId: string, operation: GrammarOperation): boolean {
    // Operations are always visible; could add context-specific visibility here
    return true;
  }

  /**
   * Get registered operations for a language.
   */
  getRegisteredOperations(languageId: string): GrammarOperation[] {
    const operations: GrammarOperation[] = [];
    for (const entry of this.registeredCommands.values()) {
      if (entry.languageId === languageId) {
        operations.push(entry.operation);
      }
    }
    return operations;
  }
}
