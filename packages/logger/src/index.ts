/**
 * @sanyam/logger - Structured Logging
 *
 * Provides a unified logging interface for the SANYAM platform,
 * backed by pino for structured JSON output with log levels.
 *
 * @packageDocumentation
 */

export { createLogger } from './pino-logger.js';
export type { SanyamLogger, LoggerOptions, LogLevel, LogContext } from './types.js';
