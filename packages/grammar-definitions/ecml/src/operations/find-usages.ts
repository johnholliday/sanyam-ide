/**
 * Find Usages Operation
 *
 * Find all references to a selected element across the content model.
 * Useful for understanding dependencies before making changes.
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult } from '@sanyam/types';

interface UsageLocation {
  /** Type of the element containing the reference */
  containerType: string;
  /** Name of the container element */
  containerName: string;
  /** Property where the reference appears */
  property: string;
  /** Human-readable context */
  context: string;
}

interface UsageResult {
  /** Name of the element being searched */
  elementName: string;
  /** Type of the element */
  elementType: string;
  /** Number of usages found */
  usageCount: number;
  /** Detailed usage locations */
  usages: UsageLocation[];
}

/**
 * Handler for Find Usages.
 *
 * Target types: Actor, Activity, Task, Content, SecurityGroup, Permission, RetentionLabel, SensitivityLabel
 */
export const findUsagesHandler: OperationHandler = async (
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

  if (!selectedIds || selectedIds.length === 0) {
    return {
      success: false,
      error: 'No element selected. Please select an element to find its usages.',
    };
  }

  // Find the selected element(s)
  const results: UsageResult[] = [];

  for (const elementName of selectedIds) {
    const element = findElementByName(ast, elementName);
    if (element) {
      const usages = findAllUsages(ast, elementName, element.$type);
      results.push({
        elementName,
        elementType: element.$type,
        usageCount: usages.length,
        usages,
      });
    }
  }

  if (results.length === 0) {
    return {
      success: false,
      error: 'Selected element(s) not found in the model',
    };
  }

  const totalUsages = results.reduce((sum, r) => sum + r.usageCount, 0);

  return {
    success: true,
    data: { results },
    message: `Found ${totalUsages} usage(s) for ${results.length} element(s)`,
  };
};

/**
 * Find an element by name in the AST.
 */
function findElementByName(ast: any, name: string): any | undefined {
  for (const stmt of ast.statements ?? []) {
    if (stmt.name === name) {
      return stmt;
    }
  }
  return undefined;
}

/**
 * Find all usages of an element across the model.
 */
function findAllUsages(ast: any, elementName: string, elementType: string): UsageLocation[] {
  const usages: UsageLocation[] = [];

  for (const stmt of ast.statements ?? []) {
    findUsagesInNode(stmt, elementName, elementType, usages);
  }

  return usages;
}

/**
 * Recursively find usages in a node.
 */
function findUsagesInNode(
  node: any,
  targetName: string,
  targetType: string,
  usages: UsageLocation[]
): void {
  if (!node || typeof node !== 'object') return;

  const containerType = node.$type;
  const containerName = node.name || 'unnamed';

  // Check cross-references in this node
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;

    // Single reference
    if (value && typeof value === 'object' && '$refText' in (value as any)) {
      if ((value as any).$refText === targetName) {
        usages.push({
          containerType,
          containerName,
          property: key,
          context: getUsageContext(node, key, targetType),
        });
      }
    }

    // Array of references
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          if ('$refText' in item && item.$refText === targetName) {
            usages.push({
              containerType,
              containerName,
              property: key,
              context: getUsageContext(node, key, targetType),
            });
          } else {
            // Recurse into nested objects
            findUsagesInNode(item, targetName, targetType, usages);
          }
        }
      }
    }

    // Nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !('$refText' in value)) {
      findUsagesInNode(value, targetName, targetType, usages);
    }
  }
}

/**
 * Generate human-readable context for a usage.
 */
function getUsageContext(container: any, property: string, targetType: string): string {
  const containerType = container.$type;
  const containerName = container.name || 'unnamed';
  const title = container.title?.replace(/^["']|["']$/g, '') || containerName;

  switch (property) {
    case 'members':
      return `Member of ${containerType} "${title}"`;
    case 'roles':
      return `Assigned role in ${containerType} "${title}"`;
    case 'permissions':
      return `Permission assignment in ${containerType} "${title}"`;
    case 'retention':
      return `Retention label for ${containerType} "${title}"`;
    case 'sensitivity':
      return `Sensitivity label for ${containerType} "${title}"`;
    case 'sources':
      return `Input flow source for ${containerType} "${title}"`;
    case 'targets':
      return `Output flow target for ${containerType} "${title}"`;
    case 'activity':
    case 'activities':
      return `Referenced in workflow step of "${title}"`;
    default:
      return `Referenced in ${containerType} "${title}" (${property})`;
  }
}
