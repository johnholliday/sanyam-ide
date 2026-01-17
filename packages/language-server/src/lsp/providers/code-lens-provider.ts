/**
 * Default Code Lens Provider (T046)
 *
 * Provides inline actionable information (references count, run actions, etc.).
 *
 * @packageDocumentation
 */

import type {
  CodeLens,
  CodeLensParams,
  Command,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { AstNode } from 'langium';
import { isNamed, streamAllContents } from '../helpers/langium-compat.js';

/**
 * Default code lens provider.
 */
export const defaultCodeLensProvider = {
  /**
   * Provide code lenses for the document.
   */
  async provide(
    context: LspContext,
    params: CodeLensParams
  ): Promise<CodeLens[] | null> {
    const { document, services, token } = context;

    // Check for built-in code lens provider first
    const codeLensProvider = services.lsp.CodeLensProvider;
    if (codeLensProvider) {
      try {
        const result = await codeLensProvider.provideCodeLens(document, params, token);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        console.error('Error in Langium CodeLensProvider:', error);
      }
    }

    // Fall back to our implementation
    const rootNode = document.parseResult?.value;
    if (!rootNode) {
      return null;
    }

    const codeLenses: CodeLens[] = [];

    // Add code lenses for named elements
    for (const node of streamAllContents(rootNode)) {
      if (!isNamed(node)) {
        continue;
      }

      const cstNode = node.$cstNode;
      if (!cstNode) {
        continue;
      }

      // Create code lens for this element
      const lens = createCodeLensForNode(node, document);
      if (lens) {
        codeLenses.push(lens);
      }
    }

    return codeLenses.length > 0 ? codeLenses : null;
  },

  /**
   * Resolve additional details for a code lens.
   */
  async resolve(
    lens: CodeLens,
    context: LspContext
  ): Promise<CodeLens> {
    const { document, shared } = context;

    // If lens has data, resolve it
    if (lens.data) {
      const data = lens.data as { type: string; name: string };

      // Count references for "references" lens
      if (data.type === 'references') {
        const refCount = await countReferences(data.name, shared);
        lens.command = {
          title: `${refCount} reference${refCount !== 1 ? 's' : ''}`,
          command: 'sanyam.findReferences',
          arguments: [document.uri.toString(), lens.range.start],
        };
      }
    }

    return lens;
  },
};

/**
 * Create a code lens for an AST node.
 */
function createCodeLensForNode(
  node: AstNode & { name: string },
  document: LspContext['document']
): CodeLens | null {
  const cstNode = node.$cstNode;
  if (!cstNode) {
    return null;
  }

  // Create a "references" code lens
  return {
    range: {
      start: document.textDocument.positionAt(cstNode.offset),
      end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
    },
    data: {
      type: 'references',
      name: node.name,
      nodeType: node.$type,
    },
    // Command will be resolved later
  };
}

/**
 * Count references to a named element across the workspace.
 */
async function countReferences(
  name: string,
  shared: LspContext['shared']
): Promise<number> {
  let count = 0;

  // Search all documents
  const documents = shared.workspace.LangiumDocuments;

  for (const doc of documents.all) {
    const text = doc.textDocument.getText();
    // Simple text search (more accurate would use reference finding)
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = text.match(regex);
    if (matches) {
      // Subtract 1 for the definition itself if in the same doc
      count += matches.length;
    }
  }

  // Subtract 1 for the definition
  return Math.max(0, count - 1);
}

/**
 * Create a code lens provider with custom lens generation.
 */
export function createCodeLensProvider(
  customGenerator?: (node: AstNode, document: LspContext['document']) => CodeLens | null
): typeof defaultCodeLensProvider {
  if (!customGenerator) {
    return defaultCodeLensProvider;
  }

  return {
    ...defaultCodeLensProvider,
    async provide(
      context: LspContext,
      params: CodeLensParams
    ): Promise<CodeLens[] | null> {
      const { document } = context;

      const rootNode = document.parseResult?.value;
      if (!rootNode) {
        return null;
      }

      const codeLenses: CodeLens[] = [];

      for (const node of streamAllContents(rootNode)) {
        const lens = customGenerator(node, document);
        if (lens) {
          codeLenses.push(lens);
        }
      }

      return codeLenses.length > 0 ? codeLenses : null;
    },
  };
}
