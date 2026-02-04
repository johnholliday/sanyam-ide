/**
 * AI Compliance Analysis Operation
 *
 * AI-powered analysis to identify potential regulatory compliance issues.
 * This is an async operation that returns a job ID.
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult, ProgressCallback } from '@sanyam/types';

/**
 * Supported regulations for compliance analysis.
 */
type Regulation = 'gdpr' | 'hipaa' | 'sox' | 'all';

/**
 * Compliance finding severity levels.
 */
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * A compliance finding from the analysis.
 */
interface ComplianceFinding {
  id: string;
  regulation: string;
  severity: Severity;
  title: string;
  description: string;
  element?: string;
  recommendation?: string;
}

/**
 * Handler for AI compliance analysis.
 */
export const aiAnalyzeComplianceHandler: OperationHandler = async (
  context: OperationContext,
  onProgress?: ProgressCallback
): Promise<OperationResult> => {
  const { document, input } = context;
  const ast = document.parseResult.value as any;

  if (!ast) {
    return {
      success: false,
      error: 'Failed to parse document',
    };
  }

  // Get input parameters
  const regulations = (input?.['regulations'] as Regulation) ?? 'all';
  const includeRecommendations = (input?.['includeRecommendations'] as boolean) ?? true;

  onProgress?.(0, 'Starting compliance analysis...');

  // Simulate AI analysis (in a real implementation, this would call an AI service)
  const findings: ComplianceFinding[] = [];

  onProgress?.(10, 'Analyzing data retention policies...');
  await simulateProcessing(500);
  findings.push(...analyzeRetentionPolicies(ast, regulations));

  onProgress?.(30, 'Analyzing access controls...');
  await simulateProcessing(500);
  findings.push(...analyzeAccessControls(ast, regulations));

  onProgress?.(50, 'Analyzing sensitivity classifications...');
  await simulateProcessing(500);
  findings.push(...analyzeSensitivityLabels(ast, regulations));

  onProgress?.(70, 'Analyzing data flows...');
  await simulateProcessing(500);
  findings.push(...analyzeDataFlows(ast, regulations));

  if (includeRecommendations) {
    onProgress?.(85, 'Generating recommendations...');
    await simulateProcessing(300);
    addRecommendations(findings);
  }

  onProgress?.(100, 'Analysis complete');

  // Generate summary
  const summary = generateSummary(findings);

  return {
    success: true,
    data: {
      summary,
      findings,
      analyzedElements: countElements(ast),
      regulations: regulations === 'all' ? ['gdpr', 'hipaa', 'sox'] : [regulations],
    },
    message: `Analysis complete: ${findings.length} findings identified`,
  };
};

/**
 * Analyze retention policies for compliance issues.
 */
function analyzeRetentionPolicies(ast: any, regulations: Regulation): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const statements = ast.statements ?? [];

  // Check for retention labels
  const retentionLabels = statements.filter((s: any) => s.$type === 'RetentionLabel');

  if (retentionLabels.length === 0) {
    findings.push({
      id: 'RET-001',
      regulation: 'gdpr',
      severity: 'high',
      title: 'No Retention Policies Defined',
      description: 'The content model does not define any retention labels. GDPR requires organizations to establish data retention periods.',
      element: 'Model',
    });
  }

  // Check content types for retention associations
  const contentTypes = statements.filter((s: any) => s.$type === 'Content');
  for (const content of contentTypes) {
    if (!content.retentionLabel && !content.retention) {
      findings.push({
        id: `RET-002-${content.name}`,
        regulation: 'gdpr',
        severity: 'medium',
        title: 'Content Type Missing Retention Policy',
        description: `Content type "${content.displayName ?? content.name}" does not have an associated retention policy.`,
        element: content.name,
      });
    }
  }

  return findings;
}

/**
 * Analyze access controls for compliance issues.
 */
function analyzeAccessControls(ast: any, regulations: Regulation): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const statements = ast.statements ?? [];

  const securityGroups = statements.filter((s: any) => s.$type === 'SecurityGroup');
  const permissions = statements.filter((s: any) => s.$type === 'Permission');

  if (securityGroups.length === 0) {
    findings.push({
      id: 'ACC-001',
      regulation: 'sox',
      severity: 'critical',
      title: 'No Access Control Groups Defined',
      description: 'The content model does not define any security groups. SOX requires proper segregation of duties and access controls.',
      element: 'Model',
    });
  }

  // Check for overly permissive permissions
  for (const permission of permissions) {
    const actions = permission.actions ?? [];
    if (actions.includes('*') || actions.includes('all')) {
      findings.push({
        id: `ACC-002-${permission.name}`,
        regulation: 'sox',
        severity: 'high',
        title: 'Overly Permissive Permission',
        description: `Permission "${permission.displayName ?? permission.name}" grants unrestricted access. This violates the principle of least privilege.`,
        element: permission.name,
      });
    }
  }

  return findings;
}

/**
 * Analyze sensitivity labels for compliance issues.
 */
function analyzeSensitivityLabels(ast: any, regulations: Regulation): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const statements = ast.statements ?? [];

  const sensitivityLabels = statements.filter((s: any) => s.$type === 'SensitivityLabel');

  // HIPAA-specific checks
  if (regulations === 'hipaa' || regulations === 'all') {
    const hasPhiLabel = sensitivityLabels.some((l: any) =>
      (l.name?.toLowerCase().includes('phi')) ||
      (l.name?.toLowerCase().includes('health')) ||
      (l.displayName?.toLowerCase().includes('protected health'))
    );

    if (!hasPhiLabel) {
      findings.push({
        id: 'SEN-001',
        regulation: 'hipaa',
        severity: 'high',
        title: 'No PHI Classification Label',
        description: 'No sensitivity label for Protected Health Information (PHI) is defined. HIPAA requires proper classification of health data.',
        element: 'Model',
      });
    }
  }

  // GDPR-specific checks
  if (regulations === 'gdpr' || regulations === 'all') {
    const hasPiiLabel = sensitivityLabels.some((l: any) =>
      (l.name?.toLowerCase().includes('pii')) ||
      (l.name?.toLowerCase().includes('personal')) ||
      (l.displayName?.toLowerCase().includes('personal'))
    );

    if (!hasPiiLabel) {
      findings.push({
        id: 'SEN-002',
        regulation: 'gdpr',
        severity: 'high',
        title: 'No PII Classification Label',
        description: 'No sensitivity label for Personally Identifiable Information (PII) is defined. GDPR requires proper identification and protection of personal data.',
        element: 'Model',
      });
    }
  }

  return findings;
}

/**
 * Analyze data flows for compliance issues.
 */
function analyzeDataFlows(ast: any, regulations: Regulation): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const statements = ast.statements ?? [];

  const workflows = statements.filter((s: any) => s.$type === 'Workflow');

  for (const workflow of workflows) {
    const steps = workflow.steps ?? [];

    // Check for data export steps without encryption
    for (const step of steps) {
      if (step.name?.toLowerCase().includes('export') || step.name?.toLowerCase().includes('transfer')) {
        findings.push({
          id: `FLW-001-${workflow.name}-${step.name}`,
          regulation: 'gdpr',
          severity: 'medium',
          title: 'Data Transfer Step Detected',
          description: `Workflow "${workflow.displayName ?? workflow.name}" contains a data transfer step "${step.name}". Ensure appropriate safeguards are in place for cross-border transfers.`,
          element: `${workflow.name}.${step.name}`,
        });
      }
    }
  }

  return findings;
}

/**
 * Add recommendations to findings.
 */
function addRecommendations(findings: ComplianceFinding[]): void {
  const recommendations: Record<string, string> = {
    'RET-001': 'Define retention labels for different content categories. Consider 7 years for financial documents, 3 years for general business records.',
    'RET-002': 'Associate each content type with an appropriate retention label based on the data category and regulatory requirements.',
    'ACC-001': 'Create security groups based on job functions (e.g., HR, Finance, Legal) and apply the principle of least privilege.',
    'ACC-002': 'Replace wildcard permissions with specific, enumerated actions. Consider creating separate permissions for read, write, and delete operations.',
    'SEN-001': 'Create a PHI sensitivity label and apply it to all content types that may contain health information.',
    'SEN-002': 'Create a PII sensitivity label and apply it to content types containing personal data (names, emails, addresses, etc.).',
    'FLW-001': 'Implement encryption for data in transit and ensure proper data processing agreements are in place for any external transfers.',
  };

  for (const finding of findings) {
    const baseId = finding.id.split('-').slice(0, 2).join('-');
    finding.recommendation = recommendations[baseId] ?? 'Review and address this finding according to your organization\'s compliance policies.';
  }
}

/**
 * Generate summary statistics.
 */
function generateSummary(findings: ComplianceFinding[]): {
  total: number;
  bySeverity: Record<Severity, number>;
  byRegulation: Record<string, number>;
} {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byRegulation: Record<string, number> = {};

  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byRegulation[finding.regulation] = (byRegulation[finding.regulation] ?? 0) + 1;
  }

  return {
    total: findings.length,
    bySeverity,
    byRegulation,
  };
}

/**
 * Count elements in the AST.
 */
function countElements(ast: any): number {
  return (ast.statements ?? []).length;
}

/**
 * Simulate processing time.
 */
function simulateProcessing(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
