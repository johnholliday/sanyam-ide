/**
 * Default Inlay Hint Provider (T050)
 *
 * Provides inline parameter and type hints.
 *
 * @packageDocumentation
 */

import type {
  InlayHint,
  InlayHintParams,
  InlayHintKind,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { isReference, streamAllContents } from 'langium';

/**
 * Default inlay hint provider.
 */
export const defaultInlayHintProvider = {
  /**
   * Provide inlay hints for the document.
   */
  async provide(
    context: LspContext,
    params: InlayHintParams
  ): Promise<InlayHint[] | null> {
    const { document, services, token } = context;

    // Check for built-in inlay hint provider first
    const inlayHintProvider = services.lsp.InlayHintProvider;
    if (inlayHintProvider) {
      try {
        const result = await inlayHintProvider.getInlayHints(document, params, token);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium InlayHintProvider:', error);
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    const hints: InlayHint[] = [];

    // Get range offsets
    const startOffset = document.textDocument.offsetAt(params.range.start);
    const endOffset = document.textDocument.offsetAt(params.range.end);

    // Find nodes within range and generate hints
    for (const node of streamAllContents(rootNode)) {
      const cstNode = node.$cstNode;
      if (!cstNode) {
        continue;
      }

      // Skip nodes outside the requested range
      if (cstNode.offset + cstNode.length < startOffset || cstNode.offset > endOffset) {
        continue;
      }

      // Generate hints for this node
      const nodeHints = generateHintsForNode(node, document);
      hints.push(...nodeHints);
    }

    return hints.length > 0 ? hints : null;
  },

  /**
   * Resolve additional details for an inlay hint.
   */
  async resolve(
    hint: InlayHint,
    context: LspContext
  ): Promise<InlayHint> {
    // Add tooltip if not present
    if (!hint.tooltip && hint.label) {
      const labelText = typeof hint.label === 'string'
        ? hint.label
        : hint.label.map(p => typeof p === 'string' ? p : p.value).join('');

      hint.tooltip = {
        kind: 'markdown',
        value: `**${labelText}**`,
      };
    }

    return hint;
  },
};

/**
 * Generate inlay hints for an AST node.
 */
function generateHintsForNode(
  node: AstNode,
  document: LspContext['document']
): InlayHint[] {
  const hints: InlayHint[] = [];
  const type = node.$type.toLowerCase();

  // Generate type hints for variables/properties without explicit types
  if (
    type.includes('variable') ||
    type.includes('property') ||
    type.includes('parameter') ||
    type.includes('field')
  ) {
    const typeHint = generateTypeHint(node, document);
    if (typeHint) {
      hints.push(typeHint);
    }
  }

  // Generate parameter hints for function calls
  if (type.includes('call') || type.includes('invocation')) {
    const paramHints = generateParameterHints(node, document);
    hints.push(...paramHints);
  }

  return hints;
}

/**
 * Generate a type hint for a node.
 */
function generateTypeHint(
  node: AstNode,
  document: LspContext['document']
): InlayHint | null {
  // Check if type is inferred (not explicitly stated)
  if ('type' in node && node.type) {
    // Type is explicit, no hint needed
    return null;
  }

  // Try to infer type
  const inferredType = inferType(node);
  if (!inferredType) {
    return null;
  }

  const cstNode = node.$cstNode;
  if (!cstNode) {
    return null;
  }

  return {
    position: document.textDocument.positionAt(cstNode.offset + cstNode.length),
    label: `: ${inferredType}`,
    kind: 1, // InlayHintKind.Type
    paddingLeft: false,
    paddingRight: true,
  };
}

/**
 * Infer the type of a node.
 */
function inferType(node: AstNode): string | null {
  // Check for initializer/value to infer type
  const valueProps = ['value', 'initializer', 'defaultValue', 'init'];

  for (const prop of valueProps) {
    if (!(prop in node)) {
      continue;
    }

    const value = (node as Record<string, unknown>)[prop];

    // Infer from literal types
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }

    // Infer from reference
    if (isReference(value) && value.ref) {
      const refType = value.ref.$type;
      return refType;
    }

    // Infer from nested node type
    if (typeof value === 'object' && value !== null && '$type' in value) {
      return (value as AstNode).$type;
    }
  }

  return null;
}

/**
 * Generate parameter hints for a function call.
 */
function generateParameterHints(
  callNode: AstNode,
  document: LspContext['document']
): InlayHint[] {
  const hints: InlayHint[] = [];

  // Get the callee to find parameter names
  const callee = getCallee(callNode);
  if (!callee) {
    return hints;
  }

  // Get parameter names from callee
  const paramNames = getParameterNames(callee);
  if (paramNames.length === 0) {
    return hints;
  }

  // Get arguments from call
  const args = getArguments(callNode);

  // Generate hints for each argument
  for (let i = 0; i < Math.min(args.length, paramNames.length); i++) {
    const arg = args[i];
    const paramName = paramNames[i];

    if (!arg || !paramName) {
      continue;
    }

    // Skip if argument already has a name (named parameter syntax)
    if (isNamedArgument(arg)) {
      continue;
    }

    const argCstNode = arg.$cstNode;
    if (!argCstNode) {
      continue;
    }

    hints.push({
      position: document.textDocument.positionAt(argCstNode.offset),
      label: `${paramName}:`,
      kind: 2, // InlayHintKind.Parameter
      paddingLeft: false,
      paddingRight: true,
    });
  }

  return hints;
}

/**
 * Get the callee from a call node.
 */
function getCallee(callNode: AstNode): AstNode | null {
  const calleeProps = ['callee', 'function', 'rule', 'target'];

  for (const prop of calleeProps) {
    if (prop in callNode) {
      const value = (callNode as Record<string, unknown>)[prop];
      if (isReference(value) && value.ref) {
        return value.ref;
      }
    }
  }

  return null;
}

/**
 * Get parameter names from a function definition.
 */
function getParameterNames(funcNode: AstNode): string[] {
  const names: string[] = [];
  const paramProps = ['parameters', 'params', 'arguments', 'args'];

  for (const prop of paramProps) {
    if (prop in funcNode) {
      const params = (funcNode as Record<string, unknown>)[prop];
      if (Array.isArray(params)) {
        for (const param of params) {
          if (typeof param === 'object' && param !== null && 'name' in param) {
            names.push(String((param as { name: unknown }).name));
          }
        }
        break;
      }
    }
  }

  return names;
}

/**
 * Get arguments from a call node.
 */
function getArguments(callNode: AstNode): AstNode[] {
  const argProps = ['arguments', 'args', 'params', 'parameters'];

  for (const prop of argProps) {
    if (prop in callNode) {
      const args = (callNode as Record<string, unknown>)[prop];
      if (Array.isArray(args)) {
        return args.filter((a): a is AstNode =>
          typeof a === 'object' && a !== null && '$type' in a
        );
      }
    }
  }

  return [];
}

/**
 * Check if an argument is a named argument.
 */
function isNamedArgument(arg: AstNode): boolean {
  // Check if argument has a name property separate from value
  return 'name' in arg && 'value' in arg;
}

/**
 * Create an inlay hint provider with custom hint generation.
 */
export function createInlayHintProvider(
  customGenerator?: (node: AstNode, document: LspContext['document']) => InlayHint[]
): typeof defaultInlayHintProvider {
  if (!customGenerator) {
    return defaultInlayHintProvider;
  }

  return {
    ...defaultInlayHintProvider,
    async provide(
      context: LspContext,
      params: InlayHintParams
    ): Promise<InlayHint[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const hints: InlayHint[] = [];
      const startOffset = document.textDocument.offsetAt(params.range.start);
      const endOffset = document.textDocument.offsetAt(params.range.end);

      for (const node of streamAllContents(rootNode)) {
        const cstNode = node.$cstNode;
        if (!cstNode) continue;

        if (cstNode.offset + cstNode.length < startOffset || cstNode.offset > endOffset) {
          continue;
        }

        const nodeHints = customGenerator(node, document);
        hints.push(...nodeHints);
      }

      return hints.length > 0 ? hints : null;
    },
  };
}
