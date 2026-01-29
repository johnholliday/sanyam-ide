/**
 * Pino-backed implementation of SanyamLogger.
 *
 * Works in Node.js environments (language server, Theia backend).
 * For browser usage, pino automatically delegates to console.* methods.
 *
 * @packageDocumentation
 */

import pino from 'pino';
import type { DestinationStream } from 'pino';
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
 * Build a pino destination stream that includes Seq if `SANYAM_SEQ_URL` is set.
 *
 * pino-seq v2 is an ESM package that exports `createStream()` — it is NOT a
 * pino transport (does not export a worker-compatible function). Therefore we
 * use `pino.multistream()` to tee output to both stdout and the Seq stream.
 *
 * Because pino-seq is ESM-only (with top-level await in its dependency chain),
 * it must be loaded via dynamic `import()`. This function is async; the caller
 * should create the logger immediately and upgrade the destination once the
 * import resolves.
 */
async function buildSeqDestination(): Promise<DestinationStream | undefined> {
  const seqUrl = typeof process !== 'undefined'
    ? process.env['SANYAM_SEQ_URL']
    : undefined;

  if (!seqUrl) {
    return undefined;
  }

  try {
    // Dynamic import with computed specifier to prevent webpack from
    // bundling pino-seq (which is Node-only and ESM with top-level await).
    const moduleName = 'pino-' + 'seq';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinoSeq = await (Function('m', 'return import(m)') as (m: string) => Promise<any>)(moduleName);
    const createStream = pinoSeq.default?.createStream ?? pinoSeq.createStream ?? pinoSeq.default;
    if (typeof createStream !== 'function') {
      return undefined;
    }

    const seqStream = createStream({
      serverUrl: seqUrl,
      ...(process.env['SANYAM_SEQ_API_KEY']
        ? { apiKey: process.env['SANYAM_SEQ_API_KEY'] }
        : {}),
    }) as DestinationStream;

    return pino.multistream([
      { stream: pino.destination(1) },  // stdout
      { stream: seqStream },
    ]);
  } catch {
    // pino-seq not available or failed to initialize — stdout only.
    return undefined;
  }
}

/**
 * Wrap a pino.Logger as a SanyamLogger.
 *
 * The wrapper uses a mutable `delegate` reference so the underlying pino
 * instance can be swapped (e.g. when Seq stream becomes available after
 * async initialization).
 *
 * This adapter ensures a stable public API that doesn't leak pino internals.
 */
function wrapPino(initialInstance: pino.Logger): SanyamLogger & { _setDelegate(p: pino.Logger): void } {
  let delegate = initialInstance;

  const logger: SanyamLogger & { _setDelegate(p: pino.Logger): void } = {
    get level(): LogLevel {
      return delegate.level as LogLevel;
    },
    set level(value: LogLevel) {
      delegate.level = value;
    },

    trace(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.trace(contextOrMsg);
      } else {
        delegate.trace(contextOrMsg, msg!);
      }
    },

    debug(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.debug(contextOrMsg);
      } else {
        delegate.debug(contextOrMsg, msg!);
      }
    },

    info(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.info(contextOrMsg);
      } else {
        delegate.info(contextOrMsg, msg!);
      }
    },

    warn(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.warn(contextOrMsg);
      } else {
        delegate.warn(contextOrMsg, msg!);
      }
    },

    error(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.error(contextOrMsg);
      } else {
        delegate.error(contextOrMsg, msg!);
      }
    },

    fatal(contextOrMsg: LogContext | string, msg?: string): void {
      if (typeof contextOrMsg === 'string') {
        delegate.fatal(contextOrMsg);
      } else {
        delegate.fatal(contextOrMsg, msg!);
      }
    },

    child(bindings: LogContext): SanyamLogger {
      return wrapPino(delegate.child(bindings));
    },

    /**
     * Replace the underlying pino instance. Used internally to upgrade
     * from stdout-only to stdout+Seq after async initialization.
     */
    _setDelegate(p: pino.Logger): void {
      delegate = p;
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

  const logger = wrapPino(pinoInstance);

  // Asynchronously attach Seq stream if SANYAM_SEQ_URL is configured.
  // The logger works immediately (stdout or pretty). Once the async import
  // of pino-seq resolves, the delegate is swapped to a multistream that
  // writes to both stdout and Seq. Logs emitted before the swap go to
  // stdout only — this is acceptable since the import resolves in ~ms.
  if (!transport) {
    // Only for non-pretty mode. Pretty mode uses pino.transport() which
    // runs in a worker thread and can't be combined with multistream.
    void buildSeqDestination().then((dest) => {
      if (dest) {
        logger._setDelegate(pino(pinoOptions, dest));
      }
    });
  }

  return logger;
}
