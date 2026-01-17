/**
 * ECML GLSP Overrides (T115)
 *
 * Custom GLSP providers for the ECML language.
 * These override specific GLSP behavior with ECML-specific implementations.
 *
 * @packageDocumentation
 */

import type {
  AstToGModelProvider,
  GlspContext,
  ToolPaletteProvider,
  LayoutProvider,
} from '@sanyam/types';

/**
 * Custom label generator for ECML elements.
 *
 * Provides rich labels including element type icons and formatted names.
 */
export function getEcmlLabel(node: any): string {
  // Get the element type
  const type = node.$type ?? 'Unknown';

  // ECML element type icons
  const icons: Record<string, string> = {
    Actor: '👤',
    Activity: '📋',
    Task: '✅',
    Content: '📄',
    SecurityGroup: '🛡️',
    Permission: '🔐',
    RetentionLabel: '🏷️',
    SensitivityLabel: '⚠️',
    Workflow: '🔄',
  };

  const icon = icons[type] ?? '📦';
  const name = node.name ?? 'Unnamed';
  const title = node.title ?? '';

  // Format: icon Name "Title"
  if (title) {
    return `${icon} ${name}\n"${title}"`;
  }
  return `${icon} ${name}`;
}

/**
 * Custom CSS class generator for ECML elements.
 *
 * Generates CSS classes based on element type and state.
 */
export function getEcmlCssClass(node: any): string {
  const type = node.$type ?? 'unknown';
  const classes = [`ecml-${type.toLowerCase()}`];

  // Add state-based classes
  if (node.deprecated) {
    classes.push('ecml-deprecated');
  }
  if (node.critical) {
    classes.push('ecml-critical');
  }
  if (node.draft) {
    classes.push('ecml-draft');
  }

  return classes.join(' ');
}

/**
 * Custom icon generator for ECML elements.
 *
 * Returns the icon identifier for diagram rendering.
 */
export function getEcmlIcon(node: any): string {
  const type = node.$type ?? 'Unknown';

  const iconMap: Record<string, string> = {
    Actor: 'person',
    Activity: 'checklist',
    Task: 'checklist',
    Content: 'file',
    SecurityGroup: 'shield',
    Permission: 'shield',
    RetentionLabel: 'tag',
    SensitivityLabel: 'tag',
    Workflow: 'git-merge',
  };

  return iconMap[type] ?? 'question';
}

/**
 * Custom size calculator for ECML elements.
 *
 * Calculates node size based on content and type.
 */
export function getEcmlSize(node: any): { width: number; height: number } {
  const type = node.$type ?? 'Unknown';
  const name = node.name ?? '';
  const title = node.title ?? '';

  // Base sizes by type
  const baseSizes: Record<string, { width: number; height: number }> = {
    Actor: { width: 120, height: 60 },
    Activity: { width: 150, height: 60 },
    Task: { width: 140, height: 50 },
    Content: { width: 140, height: 50 },
    SecurityGroup: { width: 160, height: 70 },
    Permission: { width: 140, height: 50 },
    RetentionLabel: { width: 150, height: 50 },
    SensitivityLabel: { width: 160, height: 50 },
    Workflow: { width: 160, height: 70 },
  };

  const baseSize = baseSizes[type] ?? { width: 100, height: 50 };

  // Adjust width based on text length
  const textLength = Math.max(name.length, title.length);
  const adjustedWidth = Math.max(baseSize.width, textLength * 8 + 40);

  return {
    width: adjustedWidth,
    height: baseSize.height,
  };
}

/**
 * Partial AstToGModel provider override.
 *
 * Overrides specific methods while inheriting defaults.
 */
export const ecmlAstToGModelOverrides: Partial<AstToGModelProvider> = {
  getLabel: getEcmlLabel,
  getCssClass: getEcmlCssClass,
  getIcon: getEcmlIcon,
  getSize: getEcmlSize,
};

/**
 * Custom tool palette configuration for ECML.
 *
 * Organizes tools into ECML-specific groups.
 */
export const ecmlToolPaletteOverride: Partial<ToolPaletteProvider> = {
  async getTools(context: GlspContext) {
    return {
      groups: [
        {
          id: 'actors',
          label: '👤 Actors',
          tools: [
            {
              id: 'create-actor',
              label: 'Actor',
              icon: 'person',
              description: 'Create a person or system that interacts with content',
            },
          ],
        },
        {
          id: 'processes',
          label: '📋 Processes',
          tools: [
            {
              id: 'create-activity',
              label: 'Activity',
              icon: 'checklist',
              description: 'Create a business activity',
            },
            {
              id: 'create-task',
              label: 'Task',
              icon: 'checklist',
              description: 'Create a specific task',
            },
            {
              id: 'create-workflow',
              label: 'Workflow',
              icon: 'git-merge',
              description: 'Create a workflow sequence',
            },
          ],
        },
        {
          id: 'content',
          label: '📄 Content',
          tools: [
            {
              id: 'create-content',
              label: 'Content',
              icon: 'file',
              description: 'Create a content item',
            },
          ],
        },
        {
          id: 'security',
          label: '🛡️ Security',
          tools: [
            {
              id: 'create-security-group',
              label: 'Security Group',
              icon: 'shield',
              description: 'Create a security group',
            },
            {
              id: 'create-permission',
              label: 'Permission',
              icon: 'shield',
              description: 'Create a permission',
            },
          ],
        },
        {
          id: 'labels',
          label: '🏷️ Labels',
          tools: [
            {
              id: 'create-retention-label',
              label: 'Retention Label',
              icon: 'tag',
              description: 'Create a retention label',
            },
            {
              id: 'create-sensitivity-label',
              label: 'Sensitivity Label',
              icon: 'tag',
              description: 'Create a sensitivity label',
            },
          ],
        },
        {
          id: 'connections',
          label: '🔗 Connections',
          tools: [
            {
              id: 'create-flow',
              label: 'Flow',
              icon: 'arrow-right',
              description: 'Create a flow connection',
            },
            {
              id: 'create-assignment',
              label: 'Assignment',
              icon: 'link',
              description: 'Create an assignment connection',
            },
          ],
        },
      ],
    };
  },
};

/**
 * Custom layout configuration for ECML diagrams.
 *
 * Uses a hierarchical layout optimized for ECML structure.
 */
export const ecmlLayoutOverride: Partial<LayoutProvider> = {
  getLayoutOptions(context: GlspContext) {
    return {
      algorithm: 'elk-layered',
      direction: 'RIGHT',
      spacing: {
        node: 60,
        edge: 30,
        layer: 100,
      },
      nodeSize: {
        minWidth: 100,
        minHeight: 50,
      },
      edgeRouting: 'orthogonal',
      hierarchyHandling: 'INCLUDE_CHILDREN',
    };
  },
};

/**
 * All ECML GLSP overrides.
 */
export const ecmlGlspOverrides = {
  astToGModel: ecmlAstToGModelOverrides,
  toolPalette: ecmlToolPaletteOverride,
  layout: ecmlLayoutOverride,
};

export default ecmlGlspOverrides;
