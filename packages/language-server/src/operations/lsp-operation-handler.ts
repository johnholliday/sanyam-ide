/**
 * LSP Operation Handler
 *
 * Handles workspace/executeCommand requests for grammar operations.
 * Provides the LSP channel for operation invocation.
 *
 * @packageDocumentation
 */

import type { Connection } from 'vscode-languageserver';
import type { DocumentReference, OperationUser } from '@sanyam/types';
import type { OperationExecutor, ExecuteOperationResult } from './operation-executor.js';
import type { OperationRegistry } from './operation-registry.js';
import type { JobManager } from './job-manager.js';
import { createLogger } from '@sanyam/logger';
import { isFileUriReference, isInlineContentReference } from '@sanyam/types';

const logger = createLogger({ name: 'LspOperationHandler' });

/**
 * Command prefix for grammar operations.
 */
const OPERATION_COMMAND_PREFIX = 'sanyam.operation.';

/**
 * Arguments for operation execution command.
 */
interface OperationCommandArgs {
  /** Document reference (URI string or full reference) */
  document?: string | DocumentReference;

  /** Legacy: URI as a separate parameter */
  uri?: string;

  /** Selected element IDs */
  selectedIds?: string[];

  /** Operation-specific input */
  input?: Record<string, unknown>;

  /** User info (for authenticated requests) */
  user?: OperationUser;
}

/**
 * Arguments for job status command.
 */
interface JobStatusArgs {
  /** Job ID */
  jobId: string;
}

/**
 * Arguments for list operations command.
 */
interface ListOperationsArgs {
  /** Language ID (optional - lists all if not provided) */
  languageId?: string;
}

/**
 * Sets up LSP operation handlers on the connection.
 *
 * Registers command handlers for:
 * - sanyam.operation.{languageId}.{operationId} - Execute operations
 * - sanyam.operation.listOperations - List available operations
 * - sanyam.operation.getJobStatus - Get async job status
 * - sanyam.operation.getJobResult - Get async job result
 * - sanyam.operation.cancelJob - Cancel running job
 *
 * @param connection - LSP connection
 * @param executor - Operation executor
 * @param registry - Operation registry
 * @param jobManager - Job manager
 */
export function setupLspOperationHandlers(
  connection: Connection,
  executor: OperationExecutor,
  registry: OperationRegistry,
  jobManager: JobManager
): void {
  // Handle workspace/executeCommand
  connection.onExecuteCommand(async (params) => {
    const { command, arguments: args = [] } = params;

    logger.debug({ command, argCount: args.length }, 'Received executeCommand');

    // Handle operation execution commands
    if (command.startsWith(OPERATION_COMMAND_PREFIX)) {
      return handleOperationCommand(command, args, executor);
    }

    // Handle utility commands
    switch (command) {
      case 'sanyam.operation.listOperations':
        return handleListOperations(args[0] as ListOperationsArgs | undefined, registry);

      case 'sanyam.operation.getJobStatus':
        return handleGetJobStatus(args[0] as JobStatusArgs, jobManager);

      case 'sanyam.operation.getJobResult':
        return handleGetJobResult(args[0] as JobStatusArgs, jobManager);

      case 'sanyam.operation.cancelJob':
        return handleCancelJob(args[0] as JobStatusArgs, jobManager);

      default:
        logger.debug({ command }, 'Unknown command');
        return null;
    }
  });

  logger.info('LSP operation handlers registered');
}

/**
 * Handle an operation execution command.
 */
async function handleOperationCommand(
  command: string,
  args: unknown[],
  executor: OperationExecutor
): Promise<ExecuteOperationResult> {
  // Parse command: sanyam.operation.{languageId}.{operationId}
  const parts = command.slice(OPERATION_COMMAND_PREFIX.length).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      success: false,
      error: `Invalid operation command format: ${command}. Expected: sanyam.operation.{languageId}.{operationId}`,
      correlationId: 'invalid-command',
    };
  }

  const languageId = parts[0];
  const operationId = parts[1];

  // Parse arguments
  const cmdArgs = (args[0] ?? {}) as OperationCommandArgs;

  // Resolve document reference
  let document: DocumentReference;

  if (cmdArgs.document) {
    if (typeof cmdArgs.document === 'string') {
      document = { uri: cmdArgs.document };
    } else {
      document = cmdArgs.document;
    }
  } else if (cmdArgs.uri) {
    document = { uri: cmdArgs.uri };
  } else {
    return {
      success: false,
      error: 'Missing document reference. Provide either "document" or "uri" parameter.',
      correlationId: 'missing-document',
    };
  }

  // Execute the operation
  return executor.execute({
    languageId,
    operationId,
    document,
    selectedIds: cmdArgs.selectedIds,
    input: cmdArgs.input,
    user: cmdArgs.user,
  });
}

/**
 * Handle list operations command.
 */
function handleListOperations(
  args: ListOperationsArgs | undefined,
  registry: OperationRegistry
): { operations: { languageId: string; operations: unknown[] }[] } {
  if (args?.languageId) {
    const operations = registry.getOperationDeclarations(args.languageId);
    return {
      operations: [{ languageId: args.languageId, operations }],
    };
  }

  // List all
  const result: { languageId: string; operations: unknown[] }[] = [];
  for (const languageId of registry.getAllLanguageIds()) {
    const operations = registry.getOperationDeclarations(languageId);
    result.push({ languageId, operations });
  }
  return { operations: result };
}

/**
 * Handle get job status command.
 */
async function handleGetJobStatus(
  args: JobStatusArgs,
  jobManager: JobManager
): Promise<{ success: boolean; job?: unknown; error?: string }> {
  if (!args?.jobId) {
    return { success: false, error: 'Missing jobId parameter' };
  }

  const job = await jobManager.getJob(args.jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${args.jobId}` };
  }

  return { success: true, job };
}

/**
 * Handle get job result command.
 */
async function handleGetJobResult(
  args: JobStatusArgs,
  jobManager: JobManager
): Promise<{ success: boolean; job?: unknown; error?: string }> {
  if (!args?.jobId) {
    return { success: false, error: 'Missing jobId parameter' };
  }

  const job = await jobManager.getJobResult(args.jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${args.jobId}` };
  }

  return { success: true, job };
}

/**
 * Handle cancel job command.
 */
async function handleCancelJob(
  args: JobStatusArgs,
  jobManager: JobManager
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!args?.jobId) {
    return { success: false, error: 'Missing jobId parameter' };
  }

  const cancelled = await jobManager.cancelJob(args.jobId);
  return { success: true, cancelled };
}

/**
 * Build command name for an operation.
 *
 * @param languageId - Language ID
 * @param operationId - Operation ID
 * @returns Full command name
 */
export function buildOperationCommand(languageId: string, operationId: string): string {
  return `${OPERATION_COMMAND_PREFIX}${languageId}.${operationId}`;
}

/**
 * Parse operation command name.
 *
 * @param command - Full command name
 * @returns Language ID and operation ID, or undefined if not an operation command
 */
export function parseOperationCommand(command: string): { languageId: string; operationId: string } | undefined {
  if (!command.startsWith(OPERATION_COMMAND_PREFIX)) {
    return undefined;
  }

  const parts = command.slice(OPERATION_COMMAND_PREFIX.length).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return undefined;
  }

  return { languageId: parts[0], operationId: parts[1] };
}
