/**
 * Grammar Operation Service
 *
 * Service for invoking grammar operations via the REST API.
 * Provides a unified interface for the IDE to execute operations.
 *
 * @packageDocumentation
 */

import { inject, injectable, postConstruct, optional } from 'inversify';
import { MessageService } from '@theia/core';
import type {
  GrammarOperation,
  OperationResult,
  JobInfo,
} from '@sanyam/types';
import {
  LanguageClientProviderSymbol,
  type LanguageClientProvider,
} from '../diagram-language-client';

/**
 * Symbol for injection.
 */
export const GrammarOperationService = Symbol('GrammarOperationService');

/**
 * Result of operation execution.
 */
export interface OperationExecutionResult {
  success: boolean;
  result?: OperationResult;
  jobId?: string;
  error?: string;
}

/**
 * Options for executing an operation.
 */
export interface ExecuteOperationOptions {
  /** Language ID */
  languageId: string;

  /** Operation ID */
  operationId: string;

  /** Document URI */
  uri: string;

  /** Selected element IDs (optional) */
  selectedIds?: string[];

  /** Operation-specific input (optional) */
  input?: Record<string, unknown>;
}

/**
 * Service interface for grammar operations.
 */
export interface GrammarOperationServiceInterface {
  /**
   * Get available operations for a language.
   */
  getOperations(languageId: string): Promise<GrammarOperation[]>;

  /**
   * Execute an operation.
   */
  executeOperation(options: ExecuteOperationOptions): Promise<OperationExecutionResult>;

  /**
   * Get job status for async operations.
   */
  getJobStatus(jobId: string): Promise<JobInfo | undefined>;

  /**
   * Get job result for completed async operations.
   */
  getJobResult(jobId: string): Promise<{ job: JobInfo; result?: OperationResult } | undefined>;

  /**
   * Cancel an async job.
   */
  cancelJob(jobId: string): Promise<boolean>;
}

/**
 * Default implementation of GrammarOperationService.
 *
 * Uses the REST API to execute operations on the language server.
 */
@injectable()
export class GrammarOperationServiceImpl implements GrammarOperationServiceInterface {
  @inject(MessageService)
  protected readonly messageService: MessageService;

  @inject(LanguageClientProviderSymbol) @optional()
  protected readonly languageClientProvider?: LanguageClientProvider;

  /** Cached operations by language ID */
  private operationsCache = new Map<string, GrammarOperation[]>();

  /** REST API base URL - uses relative path, proxied via @sanyam-ide/api-proxy */
  private readonly restApiUrl = '/api/v1';

  @postConstruct()
  protected init(): void {
    // Service initialized
  }

  /**
   * Get available operations for a language.
   *
   * Operations metadata is currently only available via REST API since
   * the GLSP service doesn't have a dedicated method for this.
   */
  async getOperations(languageId: string): Promise<GrammarOperation[]> {
    // Check cache first
    const cached = this.operationsCache.get(languageId);
    if (cached) {
      return cached;
    }

    // Use REST API to fetch operations
    // Note: getOperations currently only uses REST because the GLSP service
    // doesn't expose operation metadata. The backend could be extended to
    // provide this via a new GLSP method if needed.
    return this.getOperationsViaRest(languageId);
  }

  /**
   * Execute an operation.
   *
   * Attempts to execute via the internal RPC channel first (using workspace/executeCommand),
   * falling back to REST API if RPC is not available or fails.
   */
  async executeOperation(options: ExecuteOperationOptions): Promise<OperationExecutionResult> {
    const { languageId, operationId, uri, selectedIds, input } = options;

    // Try RPC via language client provider first
    if (this.languageClientProvider) {
      try {
        const result = await this.languageClientProvider.sendRequest<OperationExecutionResult>(
          'workspace/executeCommand',
          {
            command: `sanyam.operation.${languageId}.${operationId}`,
            arguments: [{ uri, selectedIds, input }],
          }
        );
        return result;
      } catch (error) {
        console.error('Failed to execute operation via RPC, trying REST:', error);
        // Fall through to REST API
      }
    }

    // Use REST API as fallback
    return this.executeOperationViaRest(options);
  }

  /**
   * Get job status for async operations.
   */
  async getJobStatus(jobId: string): Promise<JobInfo | undefined> {
    return this.getJobStatusViaRest(jobId);
  }

  /**
   * Get job result for completed async operations.
   */
  async getJobResult(jobId: string): Promise<{ job: JobInfo; result?: OperationResult } | undefined> {
    return this.getJobResultViaRest(jobId);
  }

  /**
   * Cancel an async job.
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return this.cancelJobViaRest(jobId);
  }

  /**
   * Clear the operations cache.
   */
  clearCache(): void {
    this.operationsCache.clear();
  }

  // REST API fallback methods

  private async getOperationsViaRest(languageId: string): Promise<GrammarOperation[]> {
    try {
      const response = await fetch(`${this.restApiUrl}/${languageId}/operations`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json() as { success: boolean; data?: { operations: GrammarOperation[] } };
      const operations = data.data?.operations ?? [];
      this.operationsCache.set(languageId, operations);
      return operations;
    } catch (error) {
      console.error('REST API fallback failed:', error);
      return [];
    }
  }

  private async executeOperationViaRest(options: ExecuteOperationOptions): Promise<OperationExecutionResult> {
    const { languageId, operationId, uri, selectedIds, input } = options;

    try {
      const response = await fetch(`${this.restApiUrl}/${languageId}/operations/${operationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, selectedIds, input }),
      });

      const data = await response.json() as any;

      if (data.success) {
        if (data.jobId) {
          return { success: true, jobId: data.jobId };
        }
        return {
          success: true,
          result: { success: true, data: data.data, message: data.message },
        };
      }

      return { success: false, error: data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async getJobStatusViaRest(jobId: string): Promise<JobInfo | undefined> {
    try {
      const response = await fetch(`${this.restApiUrl}/jobs/${jobId}`);
      if (!response.ok) return undefined;
      const data = await response.json() as { success: boolean; data?: JobInfo };
      return data.data;
    } catch {
      return undefined;
    }
  }

  private async getJobResultViaRest(jobId: string): Promise<{ job: JobInfo; result?: OperationResult } | undefined> {
    try {
      const response = await fetch(`${this.restApiUrl}/jobs/${jobId}/result`);
      if (!response.ok) return undefined;
      const data = await response.json() as { success: boolean; data?: any };
      if (data.data) {
        return {
          job: data.data,
          result: data.data.result,
        };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async cancelJobViaRest(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.restApiUrl}/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) return false;
      const data = await response.json() as { success: boolean; data?: { cancelled: boolean } };
      return data.data?.cancelled ?? false;
    } catch {
      return false;
    }
  }
}
