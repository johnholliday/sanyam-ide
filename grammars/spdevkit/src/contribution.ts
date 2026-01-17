/**
 * SPDevKit Language Contribution (T134)
 *
 * Provides the language contribution for the SPDevKit grammar
 * to the unified LSP/GLSP server.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  ContributionContext,
  GrammarManifest,
} from '@sanyam/types';

import { SPDEVKIT_MANIFEST } from '../manifest.js';

/**
 * Convert the SPDevKit manifest to the new GrammarManifest format.
 */
function convertToGrammarManifest(): GrammarManifest {
  const nodeTypes: Record<string, any> = {};
  const edgeTypes: Record<string, any> = {};

  // Convert rootTypes to nodeTypes
  for (const rootType of SPDEVKIT_MANIFEST.rootTypes) {
    if (rootType.diagramNode) {
      nodeTypes[rootType.astType] = {
        type: rootType.diagramNode.glspType,
        label: (node: any) => node.name ?? rootType.displayName,
        icon: rootType.icon,
        cssClass: rootType.diagramNode.cssClass,
        shape: rootType.diagramNode.shape,
        defaultSize: rootType.diagramNode.defaultSize,
      };
    }
  }

  // Extract edge types from diagram types
  const overviewDiagram = SPDEVKIT_MANIFEST.diagramTypes.find(d => d.id === 'spdevkit-overview');
  if (overviewDiagram) {
    for (const edgeType of overviewDiagram.edgeTypes) {
      const edgeId = edgeType.glspType.replace('edge:', '');
      edgeTypes[edgeId] = {
        type: edgeType.glspType,
        label: (edge: any) => edge.name ?? edgeId,
        sourceAnchor: 'right',
        targetAnchor: 'left',
      };
    }
  }

  // Build tool palette from manifest
  const toolPaletteGroups = overviewDiagram?.toolPalette?.groups.map(group => ({
    id: group.id,
    label: group.label,
    tools: group.items.map(item => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      description: `Create a ${item.label}`,
    })),
  })) ?? [];

  return {
    name: SPDEVKIT_MANIFEST.languageId,
    fileExtensions: [SPDEVKIT_MANIFEST.fileExtension],

    diagram: {
      nodeTypes,
      edgeTypes,
      layout: {
        algorithm: 'elk',
        direction: 'DOWN',
        spacing: {
          node: 50,
          edge: 25,
        },
      },
    },

    toolPalette: {
      groups: toolPaletteGroups,
    },

    disabledFeatures: [],
  };
}

/**
 * Create the SPDevKit language contribution.
 *
 * @param context - Contribution context with services
 * @returns The language contribution configuration
 */
export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: 'spdevkit',
    fileExtensions: ['.spdk'],
    generatedModule: context.generatedModule,
    manifest: convertToGrammarManifest(),
    lspProviders: {},
    glspProviders: {},
    disabledFeatures: [],
  };
}

/**
 * Access the raw SPDevKit manifest for advanced use cases.
 */
export { SPDEVKIT_MANIFEST };

export default createContribution;
