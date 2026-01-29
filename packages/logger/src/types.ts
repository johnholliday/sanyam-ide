/**
 * Log level values ordered by severity.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Structured context attached to log messages.
 * Keys are strings; values are any JSON-serializable data.
 */
export type LogContext = Record<string, unknown>;

/**
 * Unified logging interface for the SANYAM platform.
 *
 * Implementations exist for:
 * - Language server (direct pino)
 * - Theia Node backend (pino + ILogger bridge)
 * - Theia browser frontend (pino/browser)
 *
 * @example
 * ```ts
 * const logger = createLogger({ name: 'AstToGModel' });
 * logger.info({ uri: doc.uri }, 'Converting AST to GModel');
 * logger.debug({ nodeCount: 42 }, 'Nodes enumerated');
 * ```
 */
export interface SanyamLogger {
  /** Current log level. Can be changed at runtime. */
  level: LogLevel;

  /** Log at trace level. */
  trace(context: LogContext, msg: string): void;
  trace(msg: string): void;

  /** Log at debug level. */
  debug(context: LogContext, msg: string): void;
  debug(msg: string): void;

  /** Log at info level. */
  info(context: LogContext, msg: string): void;
  info(msg: string): void;

  /** Log at warn level. */
  warn(context: LogContext, msg: string): void;
  warn(msg: string): void;

  /** Log at error level. */
  error(context: LogContext, msg: string): void;
  error(msg: string): void;

  /** Log at fatal level. */
  fatal(context: LogContext, msg: string): void;
  fatal(msg: string): void;

  /**
   * Create a child logger with additional bound context.
   * All messages from the child include the parent's context fields.
   *
   * @param bindings - Context fields to bind to every message
   * @returns A new logger with the merged context
   */
  child(bindings: LogContext): SanyamLogger;
}

/**
 * Options for creating a SanyamLogger instance.
 */
export interface LoggerOptions {
  /** Logger name, typically the module or component name (e.g. 'AstToGModel'). */
  name: string;

  /** Initial log level. Defaults to SANYAM_LOG_LEVEL env var, then 'info'. */
  level?: LogLevel;

  /**
   * Enable pretty-printing for development.
   * When true, uses pino-pretty for human-readable output.
   * Defaults to false (structured JSON).
   */
  pretty?: boolean;
}
