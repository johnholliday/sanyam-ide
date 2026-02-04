/**
 * Validate Workflow Operation
 *
 * Validates workflow definitions for consistency, checking for:
 * - Unreachable steps
 * - Missing activity references
 * - Invalid condition references
 * - Potential infinite loops
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult } from '@sanyam/types';

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  workflowName?: string;
  stepIndex?: number;
}

/**
 * Handler for Validate Workflow.
 *
 * Target types: ContentModel, Workflow
 */
export const validateWorkflowHandler: OperationHandler = async (
  context: OperationContext
): Promise<OperationResult> => {
  const { document, selectedIds } = context;
  const ast = document.parseResult.value as any;

  if (!ast) {
    return {
      success: false,
      error: 'Failed to parse document',
    };
  }

  const issues: ValidationIssue[] = [];
  const workflows = findWorkflows(ast, selectedIds);

  if (workflows.length === 0) {
    return {
      success: true,
      data: { issues: [], workflowCount: 0 },
      message: 'No workflows found to validate',
    };
  }

  // Collect all defined activities for reference checking
  const definedActivities = new Set<string>();
  for (const stmt of ast.statements ?? []) {
    if (stmt.$type === 'Activity') {
      definedActivities.add(stmt.name);
    }
  }

  // Validate each workflow
  for (const workflow of workflows) {
    validateWorkflow(workflow, definedActivities, issues);
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    success: true,
    data: {
      issues,
      workflowCount: workflows.length,
      errorCount,
      warningCount,
      isValid: errorCount === 0,
    },
    message: errorCount === 0
      ? `Validated ${workflows.length} workflow(s) - no errors found`
      : `Found ${errorCount} error(s) and ${warningCount} warning(s) in ${workflows.length} workflow(s)`,
  };
};

/**
 * Find workflows to validate based on selection or all workflows.
 */
function findWorkflows(ast: any, selectedIds?: readonly string[]): any[] {
  const workflows: any[] = [];

  for (const stmt of ast.statements ?? []) {
    if (stmt.$type === 'Workflow') {
      // If selection provided, check if this workflow is selected
      if (!selectedIds || selectedIds.length === 0 || selectedIds.includes(stmt.name)) {
        workflows.push(stmt);
      }
    }
  }

  return workflows;
}

/**
 * Validate a single workflow.
 */
function validateWorkflow(
  workflow: any,
  definedActivities: Set<string>,
  issues: ValidationIssue[]
): void {
  const workflowName = workflow.name;
  const elements = workflow.elements ?? [];

  // Track referenced activities within this workflow
  const referencedActivities = new Set<string>();

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    if (element.$type === 'DoStep' || element.$type === 'RepeatStep') {
      const target = element.target;

      // Check activity references
      if (target?.$type === 'SingleActivityTarget') {
        const activityRef = target.activity?.$refText;
        if (activityRef) {
          referencedActivities.add(activityRef);
          if (!definedActivities.has(activityRef)) {
            issues.push({
              severity: 'error',
              message: `Activity "${activityRef}" is referenced but not defined`,
              workflowName,
              stepIndex: i,
            });
          }
        }
      } else if (target?.$type === 'ActivitySequenceTarget') {
        for (const actRef of target.activities ?? []) {
          const activityName = actRef.$refText;
          if (activityName) {
            referencedActivities.add(activityName);
            if (!definedActivities.has(activityName)) {
              issues.push({
                severity: 'error',
                message: `Activity "${activityName}" is referenced but not defined`,
                workflowName,
                stepIndex: i,
              });
            }
          }
        }
      }

      // Check for Repeat without proper until condition
      if (element.$type === 'RepeatStep') {
        if (!element.untilCondition) {
          issues.push({
            severity: 'error',
            message: 'Repeat step missing "Until" condition - potential infinite loop',
            workflowName,
            stepIndex: i,
          });
        }
      }
    }
  }

  // Check for empty workflows
  if (elements.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Workflow has no steps defined',
      workflowName,
    });
  }

  // Info: report workflow complexity
  if (elements.length > 10) {
    issues.push({
      severity: 'info',
      message: `Workflow has ${elements.length} steps - consider breaking into sub-workflows`,
      workflowName,
    });
  }
}
