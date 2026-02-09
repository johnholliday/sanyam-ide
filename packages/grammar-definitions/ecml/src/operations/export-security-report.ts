/**
 * Export Security Report Operation
 *
 * Generate a comprehensive security report documenting all security
 * configurations in the content model including security groups,
 * permissions, retention labels, and sensitivity labels.
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult } from '@sanyam/types';

/**
 * Handler for Export Security Report.
 *
 * Target types: ContentModel
 */
export const exportSecurityReportHandler: OperationHandler = async (
  context: OperationContext
): Promise<OperationResult> => {
  const { document } = context;
  const ast = document.parseResult.value as any;

  if (!ast) {
    return {
      success: false,
      error: 'Failed to parse document',
    };
  }

  const report = generateSecurityReport(ast);

  return {
    success: true,
    data: {
      markdown: report,
      fileName: 'security-report.md',
    },
    message: 'Security report generated successfully',
  };
};

/**
 * Generate the security report markdown.
 */
function generateSecurityReport(ast: any): string {
  const lines: string[] = [];
  const statements = ast.statements ?? [];

  // Get model title
  const titlePragma = ast.pragmas?.find((p: any) => p.$type === 'TitlePragma');
  const modelTitle = titlePragma?.title?.replace(/^["']|["']$/g, '') ?? 'Content Model';

  // Header
  lines.push(`# Security Report: ${modelTitle}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');

  const securityGroups = statements.filter((s: any) => s.$type === 'SecurityGroup');
  const permissions = statements.filter((s: any) => s.$type === 'Permission');
  const retentionLabels = statements.filter((s: any) => s.$type === 'RetentionLabel');
  const sensitivityLabels = statements.filter((s: any) => s.$type === 'SensitivityLabel');
  const actors = statements.filter((s: any) => s.$type === 'Actor');

  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Security Groups | ${securityGroups.length} |`);
  lines.push(`| Permissions | ${permissions.length} |`);
  lines.push(`| Retention Labels | ${retentionLabels.length} |`);
  lines.push(`| Sensitivity Labels | ${sensitivityLabels.length} |`);
  lines.push(`| Actors | ${actors.length} |`);
  lines.push('');

  // Actors Section
  if (actors.length > 0) {
    lines.push('## Actors');
    lines.push('');
    lines.push('Actors represent users or systems that interact with content.');
    lines.push('');
    lines.push('| Name | Title | Description |');
    lines.push('|------|-------|-------------|');
    for (const actor of actors) {
      const title = actor.title?.replace(/^["']|["']$/g, '') ?? '';
      const desc = actor.description?.replace(/^["']|["']$/g, '') ?? '';
      lines.push(`| ${actor.name} | ${title} | ${desc} |`);
    }
    lines.push('');
  }

  // Security Groups Section
  if (securityGroups.length > 0) {
    lines.push('## Security Groups');
    lines.push('');
    lines.push('Security groups define collections of actors with shared permissions.');
    lines.push('');

    for (const sg of securityGroups) {
      const title = sg.title?.replace(/^["']|["']$/g, '') ?? sg.name;
      const desc = sg.description?.replace(/^["']|["']$/g, '') ?? '';

      lines.push(`### ${title}`);
      lines.push('');
      if (desc) {
        lines.push(desc);
        lines.push('');
      }

      lines.push(`- **Identifier:** \`${sg.name}\``);

      if (sg.members?.members && sg.members.members.length > 0) {
        const memberNames = sg.members.members.map((m: any) => m.$refText).join(', ');
        lines.push(`- **Members:** ${memberNames}`);
      }

      if (sg.permAssign?.permissions && sg.permAssign.permissions.length > 0) {
        const permNames = sg.permAssign.permissions.map((p: any) => p.$refText).join(', ');
        lines.push(`- **Permissions:** ${permNames}`);
      }

      lines.push('');
    }
  }

  // Permissions Section
  if (permissions.length > 0) {
    lines.push('## Permissions');
    lines.push('');
    lines.push('Defined permission levels available for assignment.');
    lines.push('');
    lines.push('| Name | Title | Description |');
    lines.push('|------|-------|-------------|');
    for (const perm of permissions) {
      const title = perm.title?.replace(/^["']|["']$/g, '') ?? '';
      const desc = perm.description?.replace(/^["']|["']$/g, '') ?? '';
      lines.push(`| ${perm.name} | ${title} | ${desc} |`);
    }
    lines.push('');
  }

  // Retention Labels Section
  if (retentionLabels.length > 0) {
    lines.push('## Retention Labels');
    lines.push('');
    lines.push('Retention labels define how long content must be retained for compliance.');
    lines.push('');
    lines.push('| Name | Title | Description |');
    lines.push('|------|-------|-------------|');
    for (const label of retentionLabels) {
      const title = label.title?.replace(/^["']|["']$/g, '') ?? '';
      const desc = label.description?.replace(/^["']|["']$/g, '') ?? '';
      lines.push(`| ${label.name} | ${title} | ${desc} |`);
    }
    lines.push('');
  }

  // Sensitivity Labels Section
  if (sensitivityLabels.length > 0) {
    lines.push('## Sensitivity Labels');
    lines.push('');
    lines.push('Sensitivity labels classify content based on information protection requirements.');
    lines.push('');
    lines.push('| Name | Title | Description |');
    lines.push('|------|-------|-------------|');
    for (const label of sensitivityLabels) {
      const title = label.title?.replace(/^["']|["']$/g, '') ?? '';
      const desc = label.description?.replace(/^["']|["']$/g, '') ?? '';
      lines.push(`| ${label.name} | ${title} | ${desc} |`);
    }
    lines.push('');
  }

  // Content with Labels Section
  const contentWithLabels = statements.filter(
    (s: any) => s.$type === 'Content' && s.labels
  );

  if (contentWithLabels.length > 0) {
    lines.push('## Content Label Assignments');
    lines.push('');
    lines.push('Content items with security/compliance labels assigned.');
    lines.push('');
    lines.push('| Content | Retention Label | Sensitivity Label |');
    lines.push('|---------|-----------------|-------------------|');
    for (const content of contentWithLabels) {
      const title = content.title?.replace(/^["']|["']$/g, '') ?? content.name;
      const labelContent = content.labels?.LabelAssignmentContent;
      let retention = '-';
      let sensitivity = '-';

      if (labelContent?.retention?.$refText) {
        retention = labelContent.retention.$refText;
      }
      if (labelContent?.sensitivity?.$refText) {
        sensitivity = labelContent.sensitivity.$refText;
      } else if (labelContent?.$type === 'SensitivityOnly') {
        sensitivity = labelContent.sensitivity?.$refText ?? '-';
      }

      lines.push(`| ${title} | ${retention} | ${sensitivity} |`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('## Security Recommendations');
  lines.push('');

  const recommendations: string[] = [];

  if (securityGroups.length === 0) {
    recommendations.push('- Consider defining security groups to organize access control');
  }

  if (permissions.length === 0) {
    recommendations.push('- Define permission levels for granular access control');
  }

  if (retentionLabels.length === 0) {
    recommendations.push('- Add retention labels to ensure regulatory compliance');
  }

  if (sensitivityLabels.length === 0) {
    recommendations.push('- Add sensitivity labels for information protection classification');
  }

  // Check for security groups without members
  const emptyGroups = securityGroups.filter((sg: any) => !sg.members?.members?.length);
  if (emptyGroups.length > 0) {
    const names = emptyGroups.map((sg: any) => sg.name).join(', ');
    recommendations.push(`- Security groups without members: ${names}`);
  }

  if (recommendations.length === 0) {
    lines.push('No critical security recommendations at this time.');
  } else {
    lines.push(...recommendations);
  }

  lines.push('');
  lines.push('---');
  lines.push('*Report generated by ECML - Enterprise Content Modeling Language*');

  return lines.join('\n');
}
