/**
 * @sanyam/types - Grammar Operation Handler Types
 *
 * This file defines the types for implementing grammar operation handlers.
 * Operation handlers are the runtime implementations of operations declared
 * in the GrammarManifest.
 *
 * @packageDocumentation
 */

import type { LangiumDocument } from 'langium';

// =============================================================================
// Operation Context
// =============================================================================

/**
 * User information for authenticated operations.
 */
export interface OperationUser {
  /** Unique user identifier */
  readonly id: string;

  /** User email address */
  readonly email: string;

  /** User's licensing tier (e.g., 'free', 'pro', 'enterprise') */
  readonly tier: string;
}

/**
 * Context provided to operation handlers during execution.
 *
 * @example
 * ```typescript
 * async function handleGeneratePowerShell(
 *   context: OperationContext,
 *   onProgress?: ProgressCallback
 * ): Promise<OperationResult> {
 *   const model = context.document.parseResult.value;
 *   // Generate script from model...
 *   return { success: true, data: { script: generatedScript } };
 * }
 * ```
 */
export interface OperationContext {
  /**
   * The Langium document containing the parsed AST.
   * Use `document.parseResult.value` to access the AST root.
   */
  readonly document: LangiumDocument;

  /**
   * Selected element IDs from the diagram or tree.
   * Empty array if no selection or selection not applicable.
   */
  readonly selectedIds?: readonly string[];

  /**
   * User-provided input from dialog fields.
   * Keys match the `id` fields from OperationDialogField definitions.
   */
  readonly input?: Record<string, unknown>;

  /**
   * Authenticated user information.
   * Only present for authenticated requests.
   */
  readonly user?: OperationUser;

  /**
   * Unique correlation ID for request tracing.
   * Use this for logging to correlate related log entries.
   */
  readonly correlationId: string;

  /**
   * The language ID of the document being operated on.
   */
  readonly languageId: string;

  /**
   * The document URI.
   */
  readonly documentUri: string;
}

// =============================================================================
// Operation Result
// =============================================================================

/**
 * Result returned from an operation handler.
 *
 * @example
 * ```typescript
 * // Success with data
 * return {
 *   success: true,
 *   data: { script: generatedScript },
 *   message: 'PowerShell script generated successfully'
 * };
 *
 * // Failure with error
 * return {
 *   success: false,
 *   error: 'Content model is missing required fields'
 * };
 * ```
 */
export interface OperationResult {
  /**
   * Whether the operation completed successfully.
   */
  readonly success: boolean;

  /**
   * Operation-specific result data.
   * Structure depends on the operation type.
   */
  readonly data?: unknown;

  /**
   * Human-readable success message.
   * Shown in notifications or output panel.
   */
  readonly message?: string;

  /**
   * Human-readable error message.
   * Only present when success is false.
   */
  readonly error?: string;
}

// =============================================================================
// Progress Callback
// =============================================================================

/**
 * Callback for reporting operation progress.
 *
 * @param progress - Progress percentage (0-100)
 * @param message - Optional progress message
 *
 * @example
 * ```typescript
 * async function analyzeCompliance(
 *   context: OperationContext,
 *   onProgress?: ProgressCallback
 * ): Promise<OperationResult> {
 *   onProgress?.(0, 'Starting compliance analysis...');
 *
 *   // Analyze model...
 *   onProgress?.(50, 'Checking regulatory requirements...');
 *
 *   // Complete analysis...
 *   onProgress?.(100, 'Analysis complete');
 *
 *   return { success: true, data: analysisResult };
 * }
 * ```
 */
export type ProgressCallback = (progress: number, message?: string) => void;

// =============================================================================
// Operation Handler
// =============================================================================

/**
 * Function type for operation handler implementations.
 *
 * Handlers receive an OperationContext and optional progress callback,
 * and return a Promise resolving to an OperationResult.
 *
 * @example
 * ```typescript
 * // Simple synchronous operation
 * const generatePowerShellHandler: OperationHandler = async (context) => {
 *   const model = context.document.parseResult.value as ContentModel;
 *   const script = generatePowerShellScript(model, context.selectedIds);
 *   return { success: true, data: { script } };
 * };
 *
 * // Async operation with progress
 * const aiAnalyzeHandler: OperationHandler = async (context, onProgress) => {
 *   onProgress?.(0, 'Initializing AI analysis...');
 *
 *   const result = await callAiService(context.document);
 *   onProgress?.(100, 'Complete');
 *
 *   return { success: true, data: result };
 * };
 * ```
 */
export type OperationHandler = (
  context: OperationContext,
  onProgress?: ProgressCallback
) => Promise<OperationResult>;

/**
 * Map of operation IDs to their handler implementations.
 *
 * Grammar packages export this from their contribution to register
 * handlers for operations declared in the manifest.
 *
 * @example
 * ```typescript
 * // packages/grammar-definitions/ecml/src/operations/index.ts
 * import { generatePowerShellHandler } from './generate-powershell.js';
 * import { exportMarkdownHandler } from './export-markdown.js';
 * import { aiAnalyzeComplianceHandler } from './ai-analyze-compliance.js';
 *
 * export const operationHandlers: OperationHandlers = {
 *   'generate-powershell': generatePowerShellHandler,
 *   'export-markdown': exportMarkdownHandler,
 *   'ai-analyze-compliance': aiAnalyzeComplianceHandler,
 * };
 * ```
 */
export type OperationHandlers = Record<string, OperationHandler>;

// =============================================================================
// Async Job Types
// =============================================================================

/**
 * Status of an async operation job.
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Async job information returned when starting an async operation.
 */
export interface JobInfo {
  /** Unique job identifier */
  readonly jobId: string;

  /** Current job status */
  readonly status: JobStatus;

  /** Progress percentage (0-100) */
  readonly progress: number;

  /** Current progress message */
  readonly message?: string;

  /** Job creation timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Job last update timestamp (ISO 8601) */
  readonly updatedAt: string;

  /** Job completion timestamp (ISO 8601), if completed */
  readonly completedAt?: string;
}

/**
 * Complete job result including the operation result.
 */
export interface JobResult extends JobInfo {
  /** The operation result, present when status is 'completed' */
  readonly result?: OperationResult;

  /** Error message, present when status is 'failed' */
  readonly error?: string;
}
