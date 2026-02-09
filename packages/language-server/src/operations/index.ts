/**
 * Operations Module
 *
 * Exports operation infrastructure components.
 *
 * @packageDocumentation
 */

export { OperationRegistry, type RegisteredOperation } from './operation-registry.js';
export {
  OperationExecutor,
  type ExecuteOperationParams,
  type ExecuteOperationResult,
  type OperationExecutorConfig,
} from './operation-executor.js';
export { JobManager, type JobManagerConfig } from './job-manager.js';
export {
  setupLspOperationHandlers,
  buildOperationCommand,
  parseOperationCommand,
} from './lsp-operation-handler.js';
