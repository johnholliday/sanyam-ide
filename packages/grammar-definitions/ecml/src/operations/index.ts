/**
 * ECML Operation Handlers
 *
 * Exports all operation handlers for the ECML grammar.
 *
 * @packageDocumentation
 */

import type { OperationHandlers } from '@sanyam/types';
import { generatePowerShellHandler } from './generate-powershell.js';
import { exportMarkdownHandler } from './export-markdown.js';
import { aiAnalyzeComplianceHandler } from './ai-analyze-compliance.js';
import { exportJsonHandler } from './export-json.js';
import { validateWorkflowHandler } from './validate-workflow.js';
import { generateBicepHandler } from './generate-bicep.js';
import { findUsagesHandler } from './find-usages.js';
import { exportSecurityReportHandler } from './export-security-report.js';
import { aiWorkflowReviewHandler } from './ai-workflow-review.js';

/**
 * Map of operation IDs to their handler implementations.
 */
export const operationHandlers: OperationHandlers = {
  'generate-powershell': generatePowerShellHandler,
  'export-markdown': exportMarkdownHandler,
  'ai-analyze-compliance': aiAnalyzeComplianceHandler,
  'export-json': exportJsonHandler,
  'validate-workflow': validateWorkflowHandler,
  'generate-bicep': generateBicepHandler,
  'find-usages': findUsagesHandler,
  'export-security-report': exportSecurityReportHandler,
  'ai-workflow-review': aiWorkflowReviewHandler,
};

// Re-export individual handlers for direct use
export { generatePowerShellHandler } from './generate-powershell.js';
export { exportMarkdownHandler } from './export-markdown.js';
export { aiAnalyzeComplianceHandler } from './ai-analyze-compliance.js';
export { exportJsonHandler } from './export-json.js';
export { validateWorkflowHandler } from './validate-workflow.js';
export { generateBicepHandler } from './generate-bicep.js';
export { findUsagesHandler } from './find-usages.js';
export { exportSecurityReportHandler } from './export-security-report.js';
export { aiWorkflowReviewHandler } from './ai-workflow-review.js';
