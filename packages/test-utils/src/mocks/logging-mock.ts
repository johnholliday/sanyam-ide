/**
 * Logging mock for capturing and asserting on log output.
 *
 * Installs spies on console methods to capture log calls by level.
 */

import type { LogLevel } from '../types.js';

/**
 * Captured log entry.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Additional arguments */
  args: unknown[];
  /** Timestamp of log call */
  timestamp: number;
}

/**
 * Logging mock interface.
 */
export interface LoggingMock {
  /** Captured logs by level */
  readonly logs: Readonly<Record<LogLevel, readonly LogEntry[]>>;

  /**
   * Get all logs at a specific level.
   * @param level - Log level to filter by
   */
  getByLevel(level: LogLevel): readonly LogEntry[];

  /**
   * Check if any log contains a substring.
   * @param level - Log level to check
   * @param substring - Substring to search for
   */
  hasLogContaining(level: LogLevel, substring: string): boolean;

  /** Clear all captured logs */
  clear(): void;

  /** Install spies on console methods */
  install(): void;

  /** Remove spies from console methods */
  uninstall(): void;
}

/**
 * Creates a logging mock that captures console output.
 *
 * @returns Logging mock for testing
 *
 * @example
 * ```typescript
 * const logger = createLoggingMock();
 *
 * logger.install();
 * try {
 *   console.log('Test message');
 *   console.error('Error occurred');
 *
 *   expect(logger.hasLogContaining('info', 'Test')).toBe(true);
 *   expect(logger.getByLevel('error')).toHaveLength(1);
 * } finally {
 *   logger.uninstall();
 * }
 * ```
 */
export function createLoggingMock(): LoggingMock {
  const logs: Record<LogLevel, LogEntry[]> = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  // Store original console methods
  let originalConsole: {
    debug: typeof console.debug;
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;

  function captureLog(level: LogLevel, message: unknown, ...args: unknown[]): void {
    logs[level].push({
      level,
      message: String(message),
      args,
      timestamp: Date.now(),
    });
  }

  return {
    get logs(): Readonly<Record<LogLevel, readonly LogEntry[]>> {
      return {
        debug: [...logs.debug],
        info: [...logs.info],
        warn: [...logs.warn],
        error: [...logs.error],
      };
    },

    getByLevel(level: LogLevel): readonly LogEntry[] {
      return [...logs[level]];
    },

    hasLogContaining(level: LogLevel, substring: string): boolean {
      return logs[level].some(
        (entry) =>
          entry.message.includes(substring) ||
          entry.args.some((arg) => String(arg).includes(substring))
      );
    },

    clear(): void {
      logs.debug.length = 0;
      logs.info.length = 0;
      logs.warn.length = 0;
      logs.error.length = 0;
    },

    install(): void {
      if (originalConsole) {
        return; // Already installed
      }

      originalConsole = {
        debug: console.debug,
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
      };

      console.debug = (message: unknown, ...args: unknown[]) => {
        captureLog('debug', message, ...args);
        originalConsole?.debug(message, ...args);
      };

      console.log = (message: unknown, ...args: unknown[]) => {
        captureLog('info', message, ...args);
        originalConsole?.log(message, ...args);
      };

      console.info = (message: unknown, ...args: unknown[]) => {
        captureLog('info', message, ...args);
        originalConsole?.info(message, ...args);
      };

      console.warn = (message: unknown, ...args: unknown[]) => {
        captureLog('warn', message, ...args);
        originalConsole?.warn(message, ...args);
      };

      console.error = (message: unknown, ...args: unknown[]) => {
        captureLog('error', message, ...args);
        originalConsole?.error(message, ...args);
      };
    },

    uninstall(): void {
      if (!originalConsole) {
        return; // Not installed
      }

      console.debug = originalConsole.debug;
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;

      originalConsole = null;
    },
  };
}
