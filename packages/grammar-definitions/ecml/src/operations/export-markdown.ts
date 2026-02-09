/**
 * Export Markdown Operation
 *
 * Exports ECML content models as Markdown documentation.
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult } from '@sanyam/types';

/**
 * Handler for exporting ECML models as Markdown.
 */
export const exportMarkdownHandler: OperationHandler = async (
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

  // Generate Markdown
  const markdown = generateMarkdown(ast);

  return {
    success: true,
    data: {
      content: markdown,
      contentType: 'text/markdown',
      fileName: `${getModelName(ast)}-documentation.md`,
    },
    message: 'Markdown documentation generated successfully',
  };
};

/**
 * Generate Markdown documentation from the AST.
 */
function generateMarkdown(ast: any): string {
  const lines: string[] = [];
  const modelName = getModelName(ast);

  // Title
  lines.push(`# ${modelName}`);
  lines.push('');
  lines.push(`> Generated from ECML on ${new Date().toLocaleDateString()}`);
  lines.push('');

  // Collect statements by type
  const statements = ast.statements ?? [];
  const byType = new Map<string, any[]>();

  for (const stmt of statements) {
    const type = stmt.$type ?? 'Unknown';
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(stmt);
  }

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  for (const [type, items] of byType.entries()) {
    const plural = pluralize(type);
    lines.push(`- [${plural}](#${plural.toLowerCase().replace(/\s+/g, '-')}) (${items.length})`);
  }
  lines.push('');

  // Generate sections for each type
  for (const [type, items] of byType.entries()) {
    lines.push(`## ${pluralize(type)}`);
    lines.push('');

    for (const item of items) {
      lines.push(generateItemMarkdown(type, item));
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This documentation was automatically generated from ECML source.*');

  return lines.join('\n');
}

/**
 * Generate Markdown for a single item.
 */
function generateItemMarkdown(type: string, item: any): string {
  const lines: string[] = [];
  const name = item.name ?? 'Untitled';
  const displayName = item.displayName ?? name;
  const description = item.description ?? 'No description provided.';

  lines.push(`### ${displayName}`);
  lines.push('');
  lines.push(`**Identifier:** \`${name}\``);
  lines.push('');
  lines.push(`**Description:** ${description}`);
  lines.push('');

  // Type-specific details
  switch (type) {
    case 'Actor':
      if (item.roles && item.roles.length > 0) {
        lines.push('**Roles:**');
        for (const role of item.roles) {
          lines.push(`- ${role}`);
        }
        lines.push('');
      }
      break;

    case 'SecurityGroup':
      if (item.members && item.members.length > 0) {
        lines.push('**Members:**');
        for (const member of item.members) {
          const memberRef = member.ref ?? member;
          lines.push(`- ${typeof memberRef === 'string' ? memberRef : memberRef.name ?? 'Unknown'}`);
        }
        lines.push('');
      }
      break;

    case 'Permission':
      if (item.actions && item.actions.length > 0) {
        lines.push('**Actions:**');
        for (const action of item.actions) {
          lines.push(`- ${action}`);
        }
        lines.push('');
      }
      break;

    case 'RetentionLabel':
      if (item.duration) {
        lines.push(`**Retention Duration:** ${item.duration}`);
        lines.push('');
      }
      if (item.action) {
        lines.push(`**After Retention:** ${item.action}`);
        lines.push('');
      }
      break;

    case 'SensitivityLabel':
      if (item.level) {
        lines.push(`**Sensitivity Level:** ${item.level}`);
        lines.push('');
      }
      break;

    case 'Workflow':
      if (item.steps && item.steps.length > 0) {
        lines.push('**Workflow Steps:**');
        lines.push('');
        lines.push('| Step | Type | Description |');
        lines.push('|------|------|-------------|');
        for (const step of item.steps) {
          const stepName = step.name ?? 'Unnamed';
          const stepType = step.$type ?? 'Step';
          const stepDesc = step.description ?? '-';
          lines.push(`| ${stepName} | ${stepType} | ${stepDesc} |`);
        }
        lines.push('');
      }
      break;
  }

  return lines.join('\n');
}

/**
 * Get model name from AST.
 */
function getModelName(ast: any): string {
  const pragmas = ast.pragmas ?? [];
  for (const pragma of pragmas) {
    if (pragma.name === 'model' && pragma.value) {
      return pragma.value;
    }
  }
  return 'Content Model';
}

/**
 * Pluralize a type name.
 */
function pluralize(type: string): string {
  const irregular: Record<string, string> = {
    'Activity': 'Activities',
    'SecurityGroup': 'Security Groups',
    'RetentionLabel': 'Retention Labels',
    'SensitivityLabel': 'Sensitivity Labels',
  };

  if (irregular[type]) {
    return irregular[type];
  }

  if (type.endsWith('s')) {
    return type + 'es';
  }

  return type + 's';
}
