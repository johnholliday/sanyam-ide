/**
 * Pino-backed implementation of SanyamLogger.
 *
 * Works in Node.js environments (language server, Theia backend).
 * For browser usage, pino automatically delegates to console.* methods.
 *
 * @packageDocumentation
 */

import pino from 'pino';
import type { LogContext, LoggerOptions, LogLevel, SanyamLogger } from './types.js';

/**
 * Valid log levels for the SANYAM_LOG_LEVEL environment variable.
 */
const VALID_LEVELS = new Set<string>(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

/**
 * Resolve the effective log level from options and environment.
 *
 * Priority: options.level > SANYAM_LOG_LEVEL env var > 'info'
 */
function resolveLevel(options: LoggerOptions): LogLevel {
  if (options.level) {
    return options.level;
  }

  const envLevel = typeof process !== 'undefined'
    ? process.env['SANYAM_LOG_LEVEL']
    : undefined;

  if (envLevel && VALID_LEVELS.has(envLevel)) {
    return envLevel as LogLevel;
  }

  return 'info';
}

/**
 * Build pino transport options for pretty-printing.
 */
function buildTransport(options: LoggerOptions): pino.TransportSingleOptions | undefined {
  if (!options.pretty) {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  };
}

/**
 * Wrap a pino.Logger as a SanyamLogger.
 *
 * This adapter ensures a stable public API that doesn't leak pino internals.
 */
function wrapPino(pinoInstance: pino.Logger): SanyamLogger {
  const logger: SanyamLogger = {
    get level(): LogLevel {
      return pinoInstance.level as LogLevel;
    },
    set level(value: LogLevel) {
      pinoInstance.level = value;
    },

    trace(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.trace(contextOrMsg);
      } else {
        pinoInstance.trace(contextOrMsg, msg!);
      }
    },

    debug(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.debug(contextOrMsg);
      } else {
        pinoInstance.debug(contextOrMsg, msg!);
      }
    },

    info(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.info(contextOrMsg);
      } else {
        pinoInstance.info(contextOrMsg, msg!);
      }
    },

    warn(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.warn(contextOrMsg);
      } else {
        pinoInstance.warn(contextOrMsg, msg!);
      }
    },

    error(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.error(contextOrMsg);
      } else {
        pinoInstance.error(contextOrMsg, msg!);
      }
    },

    fatal(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        pinoInstance.fatal(contextOrMsg);
      } else {
        pinoInstance.fatal(contextOrMsg, msg!);
      }
    },

    child(bindings: LogContext): SanyamLogger {
      return wrapPino(pinoInstance.child(bindings));
    },
  };

  return logger;
}

/**
 * Create a structured logger for use in the SANYAM platform.
 *
 * @param options - Logger configuration
 * @returns A SanyamLogger backed by pino
 *
 * @example
 * ```ts
 * // Basic usage
 * const logger = createLogger({ name: 'MyComponent' });
 * logger.info('Server started');
 *
 * // With structured context
 * logger.info({ port: 3000, host: 'localhost' }, 'Server started');
 *
 * // Child logger with bound context
 * const reqLogger = logger.child({ requestId: 'abc-123' });
 * reqLogger.info('Processing request');
 *
 * // Pretty output for development
 * const devLogger = createLogger({ name: 'Dev', pretty: true });
 * ```
 */
/**
 * Detect whether we are running in a browser environment.
 */
const isBrowser = typeof window !== 'undefined';

export function createLogger(options: LoggerOptions): SanyamLogger {
  const level = resolveLevel(options);

  if (isBrowser) {
    // In browsers, pino delegates to console.* methods.
    // asObject: true passes structured objects so context fields are preserved.
    const pinoInstance = pino({
      name: options.name,
      level,
      browser: { asObject: true },
    });
    return wrapPino(pinoInstance);
  }

  const transport = buildTransport(options);

  const pinoOptions: pino.LoggerOptions = {
    name: options.name,
    level,
  };

  const pinoInstance = transport
    ? pino(pinoOptions, pino.transport(transport))
    : pino(pinoOptions);

  return wrapPino(pinoInstance);
}
