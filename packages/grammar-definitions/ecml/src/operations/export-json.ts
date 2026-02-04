/**
 * Export JSON Operation
 *
 * Export the content model as a JSON representation for integration
 * with external tools and services.
 *
 * @packageDocumentation
 */

import type { OperationHandler, OperationContext, OperationResult } from '@sanyam/types';

/**
 * Handler for Export JSON.
 *
 * Target types: ContentModel
 */
export const exportJsonHandler: OperationHandler = async (
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

  // Serialize the AST to JSON, excluding internal Langium properties
  const jsonData = serializeAst(ast);

  return {
    success: true,
    data: {
      json: jsonData,
      fileName: `${getModelName(ast)}.json`,
    },
    message: 'Model exported as JSON successfully',
  };
};

/**
 * Extract model name from pragmas or use default.
 */
function getModelName(ast: any): string {
  const titlePragma = ast.pragmas?.find((p: any) => p.$type === 'TitlePragma');
  if (titlePragma?.title) {
    return sanitizeFileName(titlePragma.title);
  }
  return 'content-model';
}

/**
 * Sanitize string for use as filename.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/^["']|["']$/g, '') // Remove quotes
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace special chars
    .replace(/-+/g, '-') // Collapse multiple dashes
    .toLowerCase();
}

/**
 * Recursively serialize AST node, excluding Langium internal properties.
 */
function serializeAst(node: any): any {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(serializeAst);
  }

  if (typeof node === 'object') {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(node)) {
      // Skip Langium internal properties
      if (key.startsWith('$') || key === '_$container') {
        continue;
      }

      // Handle cross-references
      if (value && typeof value === 'object' && '$refText' in (value as any)) {
        result[key] = { ref: (value as any).$refText };
        continue;
      }

      result[key] = serializeAst(value);
    }

    // Include the type for better JSON structure
    if (node.$type) {
      result['_type'] = node.$type;
    }

    return result;
  }

  return node;
}
