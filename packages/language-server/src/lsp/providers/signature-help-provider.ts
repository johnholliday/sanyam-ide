/**
 * Default Signature Help Provider (T038)
 *
 * Provides function signature information during function calls.
 *
 * @packageDocumentation
 */

import type {
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { findLeafNodeAtOffset } from 'langium';

/**
 * Default signature help provider.
 */
export const defaultSignatureHelpProvider = {
  /**
   * Provide signature help for function calls.
   */
  async provide(
    context: LspContext,
    params: SignatureHelpParams
  ): Promise<SignatureHelp | null> {
    const { document, services, token } = context;

    // Check for built-in signature help provider first
    const signatureHelpProvider = services.lsp.SignatureHelpProvider;
    if (signatureHelpProvider) {
      try {
        const result = await signatureHelpProvider.getSignatureHelp(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium SignatureHelpProvider:', error);
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Get offset from position
    const offset = document.textDocument.offsetAt(params.position);

    // Find the CST node at the position
    const cstNode = findLeafNodeAtOffset(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    // Find a function call context
    const callContext = findCallContext(cstNode.astNode, offset, document);
    if (!callContext) {
      return null;
    }

    // Build signature help
    const signatures = buildSignatureHelp(callContext);
    if (!signatures || signatures.length === 0) {
      return null;
    }

    return {
      signatures,
      activeSignature: 0,
      activeParameter: callContext.activeParameter,
    };
  },

  /** Default trigger characters */
  triggerCharacters: ['(', ','] as readonly string[],

  /** Default retrigger characters */
  retriggerCharacters: [')'] as readonly string[],
};

/**
 * Information about a function call context.
 */
interface CallContext {
  /** The function/rule being called */
  callee: AstNode;
  /** Parameters of the function */
  parameters: ParameterInfo[];
  /** Index of the currently active parameter */
  activeParameter: number;
  /** Documentation for the function */
  documentation?: string;
}

/**
 * Information about a parameter.
 */
interface ParameterInfo {
  name: string;
  type?: string;
  documentation?: string;
  optional?: boolean;
}

/**
 * Find the function call context at the cursor position.
 */
function findCallContext(
  astNode: AstNode,
  offset: number,
  document: LspContext['document']
): CallContext | null {
  // Walk up the AST to find a function call node
  let current: AstNode | undefined = astNode;

  while (current) {
    const callContext = extractCallContext(current, offset, document);
    if (callContext) {
      return callContext;
    }
    current = current.$container;
  }

  return null;
}

/**
 * Extract call context from a potential function call node.
 */
function extractCallContext(
  node: AstNode,
  offset: number,
  document: LspContext['document']
): CallContext | null {
  const type = node.$type.toLowerCase();

  // Check if this looks like a function call
  if (!type.includes('call') && !type.includes('invocation') && !type.includes('application')) {
    return null;
  }

  // Try to extract function/callee reference
  const callee = getCallee(node);
  if (!callee) {
    return null;
  }

  // Try to extract parameters
  const parameters = getParameters(callee);

  // Calculate active parameter based on cursor position
  const activeParameter = calculateActiveParameter(node, offset, document);

  // Get documentation
  const documentation = getDocumentation(callee);

  return {
    callee,
    parameters,
    activeParameter,
    documentation,
  };
}

/**
 * Get the callee (function being called) from a call node.
 */
function getCallee(callNode: AstNode): AstNode | null {
  // Check common property names
  if ('callee' in callNode && callNode.callee) {
    const callee = callNode.callee;
    if (typeof callee === 'object' && callee !== null) {
      if ('ref' in callee && callee.ref) {
        return callee.ref as AstNode;
      }
      return callee as AstNode;
    }
  }

  if ('function' in callNode && callNode.function) {
    const func = callNode.function;
    if (typeof func === 'object' && func !== null) {
      if ('ref' in func && func.ref) {
        return func.ref as AstNode;
      }
      return func as AstNode;
    }
  }

  if ('rule' in callNode && callNode.rule) {
    const rule = callNode.rule;
    if (typeof rule === 'object' && rule !== null) {
      if ('ref' in rule && rule.ref) {
        return rule.ref as AstNode;
      }
      return rule as AstNode;
    }
  }

  return null;
}

/**
 * Get parameters from a function definition.
 */
function getParameters(funcNode: AstNode): ParameterInfo[] {
  const parameters: ParameterInfo[] = [];

  // Check common property names for parameters
  const paramProps = ['parameters', 'params', 'arguments', 'args'];

  for (const prop of paramProps) {
    if (prop in funcNode) {
      const params = (funcNode as Record<string, unknown>)[prop];
      if (Array.isArray(params)) {
        for (const param of params) {
          if (typeof param === 'object' && param !== null) {
            const paramInfo: ParameterInfo = {
              name: getParamName(param),
            };

            const paramType = getParamType(param);
            if (paramType) {
              paramInfo.type = paramType;
            }

            if ('optional' in param && param.optional) {
              paramInfo.optional = true;
            }

            parameters.push(paramInfo);
          }
        }
        break;
      }
    }
  }

  return parameters;
}

/**
 * Get parameter name.
 */
function getParamName(param: object): string {
  if ('name' in param && typeof param.name === 'string') {
    return param.name;
  }
  return 'unknown';
}

/**
 * Get parameter type.
 */
function getParamType(param: object): string | undefined {
  if ('type' in param) {
    const type = param.type;
    if (typeof type === 'string') {
      return type;
    }
    if (typeof type === 'object' && type !== null) {
      if ('$refText' in type && typeof type.$refText === 'string') {
        return type.$refText;
      }
      if ('name' in type && typeof type.name === 'string') {
        return type.name;
      }
    }
  }
  return undefined;
}

/**
 * Calculate which parameter is active based on cursor position.
 */
function calculateActiveParameter(
  callNode: AstNode,
  offset: number,
  document: LspContext['document']
): number {
  const cstNode = callNode.$cstNode;
  if (!cstNode) {
    return 0;
  }

  // Get the text of the call
  const text = document.textDocument.getText({
    start: document.textDocument.positionAt(cstNode.offset),
    end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
  });

  // Calculate relative offset within the call
  const relativeOffset = offset - cstNode.offset;

  // Find opening paren
  const openParen = text.indexOf('(');
  if (openParen < 0 || relativeOffset <= openParen) {
    return 0;
  }

  // Count commas before cursor (accounting for nested parens)
  let commaCount = 0;
  let parenDepth = 0;

  for (let i = openParen; i < relativeOffset && i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
    } else if (char === ',' && parenDepth === 1) {
      commaCount++;
    }
  }

  return commaCount;
}

/**
 * Get documentation for a function.
 */
function getDocumentation(funcNode: AstNode): string | undefined {
  if ('description' in funcNode && typeof funcNode.description === 'string') {
    return funcNode.description;
  }
  if ('documentation' in funcNode && typeof funcNode.documentation === 'string') {
    return funcNode.documentation;
  }
  return undefined;
}

/**
 * Build signature information from call context.
 */
function buildSignatureHelp(context: CallContext): SignatureInformation[] {
  // Build parameter labels
  const paramLabels = context.parameters.map((p) => {
    if (p.type) {
      return p.optional ? `${p.name}?: ${p.type}` : `${p.name}: ${p.type}`;
    }
    return p.optional ? `${p.name}?` : p.name;
  });

  // Build signature label
  const calleeName = 'name' in context.callee && typeof context.callee.name === 'string'
    ? context.callee.name
    : context.callee.$type;
  const signatureLabel = `${calleeName}(${paramLabels.join(', ')})`;

  // Build parameter information
  const parameters: ParameterInformation[] = [];
  let currentOffset = calleeName.length + 1; // After "name("

  for (let i = 0; i < context.parameters.length; i++) {
    const param = context.parameters[i];
    const paramLabel = paramLabels[i] ?? param?.name ?? '';

    parameters.push({
      label: [currentOffset, currentOffset + paramLabel.length],
      documentation: param?.documentation,
    });

    currentOffset += paramLabel.length;
    if (i < context.parameters.length - 1) {
      currentOffset += 2; // ", "
    }
  }

  const signature: SignatureInformation = {
    label: signatureLabel,
    documentation: context.documentation
      ? { kind: 'markdown', value: context.documentation }
      : undefined,
    parameters,
  };

  return [signature];
}

/**
 * Create a signature help provider with custom configuration.
 */
export function createSignatureHelpProvider(config?: {
  triggerCharacters?: readonly string[];
  retriggerCharacters?: readonly string[];
}): typeof defaultSignatureHelpProvider {
  return {
    ...defaultSignatureHelpProvider,
    triggerCharacters: config?.triggerCharacters ?? defaultSignatureHelpProvider.triggerCharacters,
    retriggerCharacters: config?.retriggerCharacters ?? defaultSignatureHelpProvider.retriggerCharacters,
  };
}
