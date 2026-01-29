/**
 * Default Call Hierarchy Provider (T043)
 *
 * Provides call hierarchy for function/rule calls.
 *
 * @packageDocumentation
 */

import type {
  CallHierarchyItem,
  CallHierarchyPrepareParams,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  SymbolKind,
} from 'vscode-languageserver';
import type { LspContext, WorkspaceContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { URI } from 'langium';
import { findLeafNodeAtOffsetSafe, getDocument, isNamed, streamAllContents, asRecord } from '../helpers/langium-compat.js';
import { isReference } from 'langium';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'LspProvider' });

/**
 * Default call hierarchy provider.
 */
export const defaultCallHierarchyProvider = {
  /**
   * Prepare call hierarchy items for the given position.
   */
  async prepare(
    context: LspContext,
    params: CallHierarchyPrepareParams
  ): Promise<CallHierarchyItem[] | null> {
    const { document, services, token } = context;

    // Check for built-in call hierarchy provider
    const callHierarchyProvider = services.lsp.CallHierarchyProvider;
    if (callHierarchyProvider && 'prepareCallHierarchy' in callHierarchyProvider) {
      try {
        const result = await (callHierarchyProvider as { prepareCallHierarchy: (doc: unknown, params: CallHierarchyPrepareParams, token: unknown) => Promise<CallHierarchyItem[] | null> }).prepareCallHierarchy(document, params, token);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in Langium CallHierarchyProvider.prepare');
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
    const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    // Find a callable element at this position
    const callable = findCallableElement(cstNode.astNode);
    if (!callable) {
      return null;
    }

    // Build call hierarchy item
    const item = buildCallHierarchyItem(callable, document);
    if (!item) {
      return null;
    }

    return [item];
  },

  /**
   * Find incoming calls (callers of this function).
   */
  async incomingCalls(
    item: CallHierarchyItem,
    context: WorkspaceContext
  ): Promise<CallHierarchyIncomingCall[] | null> {
    const { shared, token } = context;

    // Find the target function by URI and position
    const targetDoc = shared.workspace.LangiumDocuments.getDocument(URI.parse(item.uri));
    if (!targetDoc) {
      return null;
    }

    const rootNode = targetDoc.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Find the callable at the item position
    const offset = targetDoc.textDocument.offsetAt(item.selectionRange.start);
    const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    const target = findCallableElement(cstNode.astNode);
    if (!target) {
      return null;
    }

    // Find all callers across the workspace
    const incomingCalls = await findIncomingCalls(target, shared);

    return incomingCalls.length > 0 ? incomingCalls : null;
  },

  /**
   * Find outgoing calls (functions called by this function).
   */
  async outgoingCalls(
    item: CallHierarchyItem,
    context: WorkspaceContext
  ): Promise<CallHierarchyOutgoingCall[] | null> {
    const { shared, token } = context;

    // Find the source function by URI and position
    const sourceDoc = shared.workspace.LangiumDocuments.getDocument(URI.parse(item.uri));
    if (!sourceDoc) {
      return null;
    }

    const rootNode = sourceDoc.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    // Find the callable at the item position
    const offset = sourceDoc.textDocument.offsetAt(item.selectionRange.start);
    const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
    if (!cstNode?.astNode) {
      return null;
    }

    const source = findCallableElement(cstNode.astNode);
    if (!source) {
      return null;
    }

    // Find all calls made by this function
    const outgoingCalls = findOutgoingCalls(source, shared);

    return outgoingCalls.length > 0 ? outgoingCalls : null;
  },
};

/**
 * Find a callable element (function, rule, method) at or containing the given node.
 */
function findCallableElement(astNode: AstNode): AstNode | null {
  let current: AstNode | undefined = astNode;

  while (current) {
    const type = current.$type.toLowerCase();
    if (
      type.includes('function') ||
      type.includes('method') ||
      type.includes('rule') ||
      type.includes('operation') ||
      type.includes('action')
    ) {
      if (isNamed(current)) {
        return current;
      }
    }
    current = current.$container;
  }

  return null;
}

/**
 * Build a call hierarchy item from an AST node.
 */
function buildCallHierarchyItem(
  node: AstNode,
  document: LspContext['document']
): CallHierarchyItem | null {
  if (!isNamed(node)) {
    return null;
  }

  const cstNode = node.$cstNode;
  if (!cstNode) {
    return null;
  }

  const doc = getDocument(node);
  if (!doc) {
    return null;
  }

  return {
    name: node.name,
    kind: getSymbolKind(node),
    uri: doc.uri.toString(),
    range: {
      start: doc.textDocument.positionAt(cstNode.offset),
      end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
    selectionRange: {
      start: doc.textDocument.positionAt(cstNode.offset),
      end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
    data: {
      type: node.$type,
    },
  };
}

/**
 * Get symbol kind for a callable node.
 */
function getSymbolKind(node: AstNode): SymbolKind {
  const type = node.$type.toLowerCase();

  if (type.includes('method')) {
    return 6; // SymbolKind.Method
  }
  if (type.includes('function')) {
    return 12; // SymbolKind.Function
  }
  if (type.includes('rule')) {
    return 12; // SymbolKind.Function
  }

  return 12; // SymbolKind.Function (default)
}

/**
 * Find all incoming calls (callers) to a target function.
 */
async function findIncomingCalls(
  target: AstNode,
  shared: WorkspaceContext['shared']
): Promise<CallHierarchyIncomingCall[]> {
  const incomingCalls: CallHierarchyIncomingCall[] = [];
  const targetName = isNamed(target) ? target.name : null;

  if (!targetName) {
    return incomingCalls;
  }

  // Search all documents
  const documents = shared.workspace.LangiumDocuments;

  for (const doc of documents.all) {
    const rootNode = doc.parseResult?.value;
    if (!rootNode) {
      continue;
    }

    // Find all call sites to this function
    for (const node of streamAllContents(rootNode)) {
      const callRanges = findCallsToTarget(node, target, targetName, doc);
      if (callRanges.length > 0) {
        // Find the containing function
        const caller = findCallableElement(node);
        if (caller && caller !== target) {
          const item = buildCallHierarchyItem(caller, doc);
          if (item) {
            incomingCalls.push({
              from: item,
              fromRanges: callRanges,
            });
          }
        }
      }
    }
  }

  return incomingCalls;
}

/**
 * Find call sites to a target within a node.
 */
function findCallsToTarget(
  node: AstNode,
  target: AstNode,
  targetName: string,
  document: LspContext['document']
): { start: { line: number; character: number }; end: { line: number; character: number } }[] {
  const ranges: ReturnType<typeof findCallsToTarget> = [];

  // Check properties for call references
  const callProps = ['callee', 'function', 'rule', 'target', 'operation'];

  for (const prop of callProps) {
    if (!(prop in node)) {
      continue;
    }

    const value = asRecord(node)[prop];

    if (isReference(value)) {
      if (value.ref === target || value.$refText === targetName) {
        const refNode = value.$refNode;
        if (refNode) {
          ranges.push({
            start: document.textDocument.positionAt(refNode.offset),
            end: document.textDocument.positionAt(refNode.offset + refNode.length),
          });
        }
      }
    }
  }

  return ranges;
}

/**
 * Find all outgoing calls from a source function.
 */
function findOutgoingCalls(
  source: AstNode,
  shared: WorkspaceContext['shared']
): CallHierarchyOutgoingCall[] {
  const outgoingCalls: CallHierarchyOutgoingCall[] = [];
  const callMap = new Map<string, { item: CallHierarchyItem; ranges: ReturnType<typeof findCallsToTarget> }>();

  // Find all calls within this function
  for (const node of streamAllContents(source)) {
    const callTarget = findCallTarget(node);
    if (callTarget && callTarget !== source) {
      const targetDoc = getDocument(callTarget);
      if (targetDoc) {
        const item = buildCallHierarchyItem(callTarget, targetDoc);
        if (item) {
          const key = `${item.uri}#${item.name}`;
          const existing = callMap.get(key);

          const cstNode = node.$cstNode;
          if (cstNode) {
            const range = {
              start: targetDoc.textDocument.positionAt(cstNode.offset),
              end: targetDoc.textDocument.positionAt(cstNode.offset + cstNode.length),
            };

            if (existing) {
              existing.ranges.push(range);
            } else {
              callMap.set(key, { item, ranges: [range] });
            }
          }
        }
      }
    }
  }

  // Convert to outgoing calls
  for (const { item, ranges } of callMap.values()) {
    outgoingCalls.push({
      to: item,
      fromRanges: ranges,
    });
  }

  return outgoingCalls;
}

/**
 * Find the target of a call in a node.
 */
function findCallTarget(node: AstNode): AstNode | null {
  const type = node.$type.toLowerCase();

  // Check if this is a call node
  if (!type.includes('call') && !type.includes('invocation')) {
    return null;
  }

  // Check call target properties
  const callProps = ['callee', 'function', 'rule', 'target', 'operation'];

  for (const prop of callProps) {
    if (!(prop in node)) {
      continue;
    }

    const value = asRecord(node)[prop];

    if (isReference(value) && value.ref) {
      return value.ref;
    }
  }

  return null;
}

/**
 * Create a call hierarchy provider with custom logic.
 */
export function createCallHierarchyProvider(
  customPrepare?: (astNode: AstNode) => AstNode | null
): typeof defaultCallHierarchyProvider {
  if (!customPrepare) {
    return defaultCallHierarchyProvider;
  }

  return {
    ...defaultCallHierarchyProvider,
    async prepare(
      context: LspContext,
      params: CallHierarchyPrepareParams
    ): Promise<CallHierarchyItem[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const offset = document.textDocument.offsetAt(params.position);
      const cstNode = findLeafNodeAtOffsetSafe(rootNode.$cstNode, offset);
      if (!cstNode?.astNode) {
        return null;
      }

      const callable = customPrepare(cstNode.astNode);
      if (!callable) {
        return null;
      }

      const item = buildCallHierarchyItem(callable, document);
      return item ? [item] : null;
    },
  };
}
