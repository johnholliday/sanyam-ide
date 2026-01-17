/**
 * ECML Language Contribution
 *
 * Provides the language contribution for the ECML grammar
 * to the unified LSP/GLSP server.
 *
 * @packageDocumentation
 */

import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
  ContributionContext,
  GrammarManifest,
} from '@sanyam/types';

import { ECML_MANIFEST } from '../manifest.js';
import { ecmlLspOverrides } from './lsp-overrides.js';
import { ecmlGlspOverrides } from './glsp-overrides.js';

/**
 * Convert the existing ECML manifest to the new GrammarManifest format.
 * The ECML manifest has a different structure, so we need to adapt it.
 */
function convertToGrammarManifest(): GrammarManifest {
  const nodeTypes: Record<string, any> = {};
  const edgeTypes: Record<string, any> = {};

  // Convert rootTypes to nodeTypes
  for (const rootType of ECML_MANIFEST.rootTypes) {
    if (rootType.diagramNode) {
      nodeTypes[rootType.astType] = {
        type: rootType.diagramNode.glspType,
        label: (node: any) => node.title ?? node.name,
        icon: rootType.icon,
        cssClass: rootType.diagramNode.cssClass,
      };
    }
  }

  // Extract edge types from diagram types
  const overviewDiagram = ECML_MANIFEST.diagramTypes.find(d => d.id === 'ecml-overview');
  if (overviewDiagram) {
    for (const edgeType of overviewDiagram.edgeTypes) {
      edgeTypes[edgeType.glspType.replace('edge:', '')] = {
        type: edgeType.glspType,
        label: (edge: any) => edge.name ?? '',
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
    name: ECML_MANIFEST.languageId,
    fileExtensions: [ECML_MANIFEST.fileExtension],

    diagram: {
      nodeTypes,
      edgeTypes,
      layout: {
        algorithm: 'elk',
        direction: 'RIGHT',
        spacing: {
          node: 60,
          edge: 30,
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
 * Custom LSP providers for ECML.
 *
 * These override the default LSP providers with ECML-specific behavior.
 * See lsp-overrides.ts for implementation details.
 */
const customLspProviders: Partial<LspFeatureProviders> = {
  hover: ecmlLspOverrides.hover,
  completion: ecmlLspOverrides.completion,
};

/**
 * Custom GLSP providers for ECML.
 *
 * These override specific GLSP methods with ECML-specific behavior.
 * Uses partial overrides to extend defaults rather than replace them.
 * See glsp-overrides.ts for implementation details.
 */
const customGlspProviders: Partial<GlspFeatureProviders> = {
  astToGModel: ecmlGlspOverrides.astToGModel as any,
  toolPalette: ecmlGlspOverrides.toolPalette as any,
  layout: ecmlGlspOverrides.layout as any,
};

/**
 * Create the ECML language contribution.
 *
 * @param context - Contribution context with services
 * @returns The language contribution configuration
 */
export function createContribution(
  context: ContributionContext
): LanguageContribution {
  return {
    languageId: 'ecml',
    fileExtensions: ['.ecml'],
    generatedModule: context.generatedModule,
    manifest: convertToGrammarManifest(),
    lspProviders: customLspProviders,
    glspProviders: customGlspProviders,
    disabledFeatures: [],
  };
}

/**
 * Access the raw ECML manifest for advanced use cases.
 */
export { ECML_MANIFEST };

export default createContribution;
