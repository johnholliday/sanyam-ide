/**
 * Mock CommandRegistry for Theia testing.
 *
 * Captures command registrations and allows command execution for verification.
 */

/**
 * Command handler function type.
 */
export type CommandHandler = (...args: unknown[]) => unknown;

/**
 * Disposable interface for command registration cleanup.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Mock CommandRegistry that captures command registrations.
 */
export interface MockCommandRegistry {
  /**
   * Register a command handler.
   * @param id - Command identifier
   * @param handler - Command handler function
   * @returns Disposable for cleanup
   */
  registerCommand(id: string, handler: CommandHandler): Disposable;

  /**
   * Execute a registered command.
   * @param id - Command identifier
   * @param args - Command arguments
   * @returns Command result
   */
  executeCommand<T>(id: string, ...args: unknown[]): Promise<T>;

  /**
   * Check if a command is registered.
   * @param id - Command identifier
   */
  hasCommand(id: string): boolean;

  /**
   * Access all registered commands for test assertions.
   */
  readonly commands: ReadonlyMap<string, CommandHandler>;
}

/**
 * Creates a mock CommandRegistry that captures command registrations.
 *
 * @returns Mock command registry for testing
 *
 * @example
 * ```typescript
 * const commandRegistry = createMockCommandRegistry();
 *
 * commandRegistry.registerCommand('my.command', (arg) => `Hello, ${arg}!`);
 *
 * expect(commandRegistry.hasCommand('my.command')).toBe(true);
 *
 * const result = await commandRegistry.executeCommand<string>('my.command', 'World');
 * expect(result).toBe('Hello, World!');
 * ```
 */
export function createMockCommandRegistry(): MockCommandRegistry {
  const commands = new Map<string, CommandHandler>();

  return {
    registerCommand(id: string, handler: CommandHandler): Disposable {
      commands.set(id, handler);
      return {
        dispose(): void {
          commands.delete(id);
        },
      };
    },

    async executeCommand<T>(id: string, ...args: unknown[]): Promise<T> {
      const handler = commands.get(id);
      if (!handler) {
        throw new Error(`Command not found: ${id}`);
      }
      const result = handler(...args);
      // Handle both sync and async handlers
      return Promise.resolve(result) as Promise<T>;
    },

    hasCommand(id: string): boolean {
      return commands.has(id);
    },

    get commands(): ReadonlyMap<string, CommandHandler> {
      return commands;
    },
  };
}
