/**
 * Operation Executor
 *
 * Executes grammar operations with context management,
 * progress reporting, and error handling.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'crypto';
import type {
  OperationContext,
  OperationResult,
  ProgressCallback,
  DocumentReference,
  OperationUser,
} from '@sanyam/types';
import type { LangiumDocument } from 'langium';
import type { OperationRegistry, RegisteredOperation } from './operation-registry.js';
import type { UnifiedDocumentResolver } from '../services/document-resolver.js';
import type { JobManager } from './job-manager.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'OperationExecutor' });

/**
 * Parameters for executing an operation.
 */
export interface ExecuteOperationParams {
  /** Language ID */
  languageId: string;

  /** Operation ID */
  operationId: string;

  /** Document reference */
  document: DocumentReference;

  /** Selected element IDs (optional) */
  selectedIds?: readonly string[];

  /** Operation-specific input (optional) */
  input?: Record<string, unknown>;

  /** Authenticated user (optional) */
  user?: OperationUser;

  /** Correlation ID for tracing (generated if not provided) */
  correlationId?: string;
}

/**
 * Result of operation execution.
 */
export interface ExecuteOperationResult {
  /** Whether execution was successful */
  success: boolean;

  /** The operation result (if synchronous and successful) */
  result?: OperationResult;

  /** Job ID (if asynchronous operation) */
  jobId?: string;

  /** Error message (if failed) */
  error?: string;

  /** Correlation ID used for this execution */
  correlationId: string;

  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Operation executor configuration.
 */
export interface OperationExecutorConfig {
  /** Maximum execution time for sync operations (ms) */
  syncTimeoutMs?: number;

  /** Whether to enable detailed logging */
  verbose?: boolean;
}

/**
 * Executes grammar operations with full context management.
 *
 * Supports both synchronous and asynchronous operations,
 * with progress reporting for long-running tasks.
 */
export class OperationExecutor {
  private readonly registry: OperationRegistry;
  private readonly documentResolver: UnifiedDocumentResolver;
  private readonly jobManager: JobManager;
  private readonly config: Required<OperationExecutorConfig>;

  constructor(
    registry: OperationRegistry,
    documentResolver: UnifiedDocumentResolver,
    jobManager: JobManager,
    config?: OperationExecutorConfig
  ) {
    this.registry = registry;
    this.documentResolver = documentResolver;
    this.jobManager = jobManager;
    this.config = {
      syncTimeoutMs: config?.syncTimeoutMs ?? 30000,
      verbose: config?.verbose ?? false,
    };
  }

  /**
   * Execute an operation.
   *
   * For async operations, returns a job ID immediately.
   * For sync operations, executes and returns the result.
   *
   * @param params - Execution parameters
   * @returns Execution result
   */
  async execute(params: ExecuteOperationParams): Promise<ExecuteOperationResult> {
    const correlationId = params.correlationId ?? randomUUID();
    const startTime = Date.now();

    logger.info(
      {
        correlationId,
        languageId: params.languageId,
        operationId: params.operationId,
        hasSelection: !!params.selectedIds?.length,
        hasInput: !!params.input,
        hasUser: !!params.user,
      },
      'Executing operation'
    );

    try {
      // Get the operation from registry
      const operation = this.registry.getOperation(params.languageId, params.operationId);
      if (!operation) {
        return {
          success: false,
          error: `Operation not found: ${params.languageId}/${params.operationId}`,
          correlationId,
          durationMs: Date.now() - startTime,
        };
      }

      // Check licensing requirements
      const licensingError = this.checkLicensing(operation, params.user);
      if (licensingError) {
        return {
          success: false,
          error: licensingError,
          correlationId,
          durationMs: Date.now() - startTime,
        };
      }

      // Resolve the document
      let document: LangiumDocument;
      try {
        document = await this.documentResolver.resolve(params.document);
      } catch (docError) {
        return {
          success: false,
          error: `Failed to resolve document: ${docError instanceof Error ? docError.message : String(docError)}`,
          correlationId,
          durationMs: Date.now() - startTime,
        };
      }

      // Build the operation context
      const context: OperationContext = {
        document,
        selectedIds: params.selectedIds ? [...params.selectedIds] : undefined,
        input: params.input,
        user: params.user,
        correlationId,
        languageId: params.languageId,
        documentUri: document.uri.toString(),
      };

      // Check if this is an async operation
      if (operation.declaration.execution?.async) {
        return this.executeAsync(operation, context, startTime);
      }

      // Execute synchronously
      return this.executeSync(operation, context, startTime);
    } catch (error) {
      logger.error(
        { err: error, correlationId },
        'Unexpected error during operation execution'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        correlationId,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute an operation synchronously.
   */
  private async executeSync(
    operation: RegisteredOperation,
    context: OperationContext,
    startTime: number
  ): Promise<ExecuteOperationResult> {
    try {
      // Create a progress callback (for sync ops, we just log)
      const onProgress: ProgressCallback = (progress, message) => {
        if (this.config.verbose) {
          logger.debug(
            { correlationId: context.correlationId, progress, message },
            'Operation progress'
          );
        }
      };

      // Execute with timeout
      const result = await Promise.race([
        operation.handler(context, onProgress),
        this.createTimeoutPromise(this.config.syncTimeoutMs),
      ]);

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId: context.correlationId,
          success: result.success,
          durationMs,
        },
        'Operation completed'
      );

      return {
        success: result.success,
        result,
        correlationId: context.correlationId,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof TimeoutError) {
        logger.warn(
          { correlationId: context.correlationId, timeoutMs: this.config.syncTimeoutMs },
          'Operation timed out'
        );
        return {
          success: false,
          error: `Operation timed out after ${this.config.syncTimeoutMs}ms`,
          correlationId: context.correlationId,
          durationMs,
        };
      }

      logger.error(
        { err: error, correlationId: context.correlationId },
        'Operation execution failed'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        correlationId: context.correlationId,
        durationMs,
      };
    }
  }

  /**
   * Execute an operation asynchronously via job manager.
   */
  private async executeAsync(
    operation: RegisteredOperation,
    context: OperationContext,
    startTime: number
  ): Promise<ExecuteOperationResult> {
    try {
      // Create a job
      const jobId = await this.jobManager.createJob(
        context.correlationId,
        operation.declaration.id,
        context.languageId,
        context.documentUri
      );

      // Start the job execution in the background
      this.executeJobAsync(jobId, operation, context).catch((error) => {
        logger.error(
          { err: error, jobId, correlationId: context.correlationId },
          'Async job execution failed'
        );
      });

      logger.info(
        { correlationId: context.correlationId, jobId },
        'Async operation started'
      );

      return {
        success: true,
        jobId,
        correlationId: context.correlationId,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        correlationId: context.correlationId,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a job asynchronously (background).
   */
  private async executeJobAsync(
    jobId: string,
    operation: RegisteredOperation,
    context: OperationContext
  ): Promise<void> {
    try {
      await this.jobManager.updateJobStatus(jobId, 'running');

      // Create progress callback that updates job
      const onProgress: ProgressCallback = (progress, message) => {
        this.jobManager.updateJobProgress(jobId, progress, message).catch((err) => {
          logger.warn({ err, jobId }, 'Failed to update job progress');
        });
      };

      const result = await operation.handler(context, onProgress);

      if (result.success) {
        await this.jobManager.completeJob(jobId, result);
      } else {
        await this.jobManager.failJob(jobId, result.error ?? 'Operation failed');
      }
    } catch (error) {
      await this.jobManager.failJob(
        jobId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Check licensing requirements for an operation.
   */
  private checkLicensing(
    operation: RegisteredOperation,
    user?: OperationUser
  ): string | null {
    const licensing = operation.declaration.licensing;
    if (!licensing) {
      return null;
    }

    // Check authentication requirement
    if (licensing.requiresAuth && !user) {
      return 'Authentication required for this operation';
    }

    // Check tier requirement
    if (licensing.tier && user) {
      const allowedTiers = this.getTierHierarchy(licensing.tier);
      if (!allowedTiers.includes(user.tier)) {
        return `This operation requires ${licensing.tier} tier or higher`;
      }
    }

    return null;
  }

  /**
   * Get tier hierarchy for licensing checks.
   */
  private getTierHierarchy(requiredTier: string): string[] {
    // Simple tier hierarchy: free < pro < enterprise
    const hierarchy = ['enterprise', 'pro', 'free'];
    const index = hierarchy.indexOf(requiredTier);
    if (index === -1) {
      return [requiredTier];
    }
    return hierarchy.slice(0, index + 1);
  }

  /**
   * Create a timeout promise.
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${ms}ms`));
      }, ms);
    });
  }
}

/**
 * Custom error for operation timeouts.
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
