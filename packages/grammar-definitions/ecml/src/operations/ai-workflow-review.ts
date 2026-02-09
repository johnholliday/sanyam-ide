/**
 * AI Workflow Review Operation
 *
 * AI-powered analysis of workflow definitions to identify potential issues,
 * suggest improvements, and ensure best practices are followed.
 *
 * @packageDocumentation
 */

import type {
  OperationHandler,
  OperationContext,
  OperationResult,
  ProgressCallback,
} from '@sanyam/types';

interface WorkflowAnalysis {
  workflowName: string;
  workflowTitle: string;
  complexity: 'low' | 'medium' | 'high';
  stepCount: number;
  issues: AnalysisIssue[];
  suggestions: string[];
}

interface AnalysisIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
}

/**
 * Handler for AI Workflow Review.
 *
 * Target types: ContentModel, Workflow
 */
export const aiWorkflowReviewHandler: OperationHandler = async (
  context: OperationContext,
  onProgress?: ProgressCallback
): Promise<OperationResult> => {
  const { document, selectedIds, input } = context;
  const ast = document.parseResult.value as any;

  if (!ast) {
    return {
      success: false,
      error: 'Failed to parse document',
    };
  }

  onProgress?.(0, 'Analyzing workflows...');

  // Find workflows to analyze
  const workflows = findWorkflows(ast, selectedIds);

  if (workflows.length === 0) {
    return {
      success: true,
      data: { analyses: [], workflowCount: 0 },
      message: 'No workflows found to analyze',
    };
  }

  const analyses: WorkflowAnalysis[] = [];
  const includeOptimizations = input?.includeOptimizations !== false;

  for (let i = 0; i < workflows.length; i++) {
    const workflow = workflows[i];
    const progress = Math.round(((i + 1) / workflows.length) * 80);
    onProgress?.(progress, `Analyzing workflow: ${workflow.name}`);

    const analysis = analyzeWorkflow(workflow, ast, includeOptimizations);
    analyses.push(analysis);
  }

  onProgress?.(90, 'Generating recommendations...');

  // Generate summary
  const totalIssues = analyses.reduce((sum, a) => sum + a.issues.length, 0);
  const criticalCount = analyses.reduce(
    (sum, a) => sum + a.issues.filter(i => i.severity === 'critical').length,
    0
  );

  onProgress?.(100, 'Analysis complete');

  return {
    success: true,
    data: {
      analyses,
      summary: {
        workflowCount: workflows.length,
        totalIssues,
        criticalCount,
        averageComplexity: getAverageComplexity(analyses),
      },
    },
    message: `Analyzed ${workflows.length} workflow(s) - found ${totalIssues} issue(s)`,
  };
};

/**
 * Find workflows to analyze.
 */
function findWorkflows(ast: any, selectedIds?: readonly string[]): any[] {
  const workflows: any[] = [];

  for (const stmt of ast.statements ?? []) {
    if (stmt.$type === 'Workflow') {
      if (!selectedIds || selectedIds.length === 0 || selectedIds.includes(stmt.name)) {
        workflows.push(stmt);
      }
    }
  }

  return workflows;
}

/**
 * Analyze a single workflow.
 */
function analyzeWorkflow(
  workflow: any,
  ast: any,
  includeOptimizations: boolean
): WorkflowAnalysis {
  const elements = workflow.elements ?? [];
  const steps = elements.filter((e: any) => e.$type === 'DoStep' || e.$type === 'RepeatStep');
  const issues: AnalysisIssue[] = [];
  const suggestions: string[] = [];

  const title = workflow.title?.replace(/^["']|["']$/g, '') ?? workflow.name;

  // Determine complexity
  const complexity = getComplexity(steps.length);

  // Check for common patterns and issues

  // 1. Empty workflow
  if (steps.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'Structure',
      message: 'Workflow has no steps defined',
    });
    suggestions.push('Add workflow steps using "Do" or "Repeat" statements');
  }

  // 2. Sequential duplicate activities
  const duplicateActivities = findSequentialDuplicates(steps);
  if (duplicateActivities.length > 0) {
    issues.push({
      severity: 'info',
      category: 'Optimization',
      message: `Sequential duplicate activities detected: ${duplicateActivities.join(', ')}`,
    });
    if (includeOptimizations) {
      suggestions.push('Consider consolidating sequential duplicate activities');
    }
  }

  // 3. Conditional without fallback
  const conditionalSteps = steps.filter((s: any) => s.conditional);
  if (conditionalSteps.length > 0 && conditionalSteps.length === steps.length) {
    issues.push({
      severity: 'warning',
      category: 'Logic',
      message: 'All steps are conditional - workflow may not execute any steps',
    });
    suggestions.push('Consider adding at least one unconditional step as a fallback');
  }

  // 4. Repeat without clear exit condition
  const repeatSteps = steps.filter((s: any) => s.$type === 'RepeatStep');
  for (const repeat of repeatSteps) {
    if (!repeat.untilCondition) {
      issues.push({
        severity: 'critical',
        category: 'Logic',
        message: 'Repeat step without "Until" condition - potential infinite loop',
      });
    } else {
      // Check if condition can ever be true
      const condition = repeat.untilCondition;
      if (condition.$type === 'ActivityCondition') {
        // Activity status conditions are generally ok
      } else if (condition.$type === 'FieldValueCondition') {
        // Check if field is modified within the repeated activity
        issues.push({
          severity: 'info',
          category: 'Logic',
          message: 'Verify that the repeat condition can be satisfied by the repeated activity',
        });
      }
    }
  }

  // 5. Complexity suggestions
  if (complexity === 'high') {
    suggestions.push('Consider breaking this workflow into sub-workflows for better maintainability');
  }

  // 6. Missing description
  if (!workflow.description) {
    issues.push({
      severity: 'info',
      category: 'Documentation',
      message: 'Workflow is missing a description',
    });
    suggestions.push('Add a description to document the workflow\'s purpose');
  }

  // 7. Activity role coverage
  const activities = collectActivities(steps);
  const activitiesWithoutRoles = activities.filter((a: any) => {
    const activity = findActivityDefinition(ast, a);
    return activity && !activity.roles;
  });

  if (activitiesWithoutRoles.length > 0) {
    issues.push({
      severity: 'info',
      category: 'Access Control',
      message: `Some activities lack role assignments: ${activitiesWithoutRoles.join(', ')}`,
    });
    suggestions.push('Consider assigning roles to activities for access control');
  }

  // 8. Best practices
  if (includeOptimizations) {
    if (steps.length > 1 && !steps.some((s: any) => s.$type === 'RepeatStep')) {
      suggestions.push('Consider if any steps should repeat until a condition is met');
    }

    if (activities.length > 3 && !conditionalSteps.length) {
      suggestions.push('Consider adding conditional logic for complex workflows');
    }
  }

  return {
    workflowName: workflow.name,
    workflowTitle: title,
    complexity,
    stepCount: steps.length,
    issues,
    suggestions,
  };
}

/**
 * Determine workflow complexity based on step count.
 */
function getComplexity(stepCount: number): 'low' | 'medium' | 'high' {
  if (stepCount <= 3) return 'low';
  if (stepCount <= 7) return 'medium';
  return 'high';
}

/**
 * Find sequential duplicate activities.
 */
function findSequentialDuplicates(steps: any[]): string[] {
  const duplicates: string[] = [];
  let prevActivity: string | null = null;

  for (const step of steps) {
    const target = step.target;
    let activityName: string | null = null;

    if (target?.$type === 'SingleActivityTarget') {
      activityName = target.activity?.$refText;
    }

    if (activityName && activityName === prevActivity && !duplicates.includes(activityName)) {
      duplicates.push(activityName);
    }

    prevActivity = activityName;
  }

  return duplicates;
}

/**
 * Collect all referenced activities from steps.
 */
function collectActivities(steps: any[]): string[] {
  const activities: string[] = [];

  for (const step of steps) {
    const target = step.target;
    if (target?.$type === 'SingleActivityTarget') {
      const name = target.activity?.$refText;
      if (name && !activities.includes(name)) {
        activities.push(name);
      }
    } else if (target?.$type === 'ActivitySequenceTarget') {
      for (const actRef of target.activities ?? []) {
        const name = actRef.$refText;
        if (name && !activities.includes(name)) {
          activities.push(name);
        }
      }
    }
  }

  return activities;
}

/**
 * Find activity definition in AST.
 */
function findActivityDefinition(ast: any, activityName: string): any | undefined {
  for (const stmt of ast.statements ?? []) {
    if (stmt.$type === 'Activity' && stmt.name === activityName) {
      return stmt;
    }
  }
  return undefined;
}

/**
 * Calculate average complexity.
 */
function getAverageComplexity(analyses: WorkflowAnalysis[]): string {
  if (analyses.length === 0) return 'n/a';

  const scores = analyses.map(a => {
    switch (a.complexity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
    }
  });

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg < 1.5) return 'low';
  if (avg < 2.5) return 'medium';
  return 'high';
}
