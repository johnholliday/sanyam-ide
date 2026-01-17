/**
 * Example Minimal Grammar Manifest
 *
 * Demonstrates the minimal manifest configuration
 * required for SANYAM integration.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * Example Minimal Grammar Manifest
 */
export const manifest: GrammarManifest = {
  name: 'example-minimal',
  fileExtensions: ['.exm', '.example'],

  diagram: {
    nodeTypes: {
      /**
       * Box node type - renders as a rectangle
       */
      Box: {
        type: 'node:box',
        label: (node: any) => node.label ?? node.name,
        cssClass: (node: any) => `box-node box-${node.color ?? 'gray'}`,
        icon: 'box-icon',
      },
    },

    edgeTypes: {
      /**
       * Arrow edge type - connects boxes
       */
      Arrow: {
        type: 'edge:arrow',
        label: (edge: any) => edge.label ?? edge.name,
        sourceAnchor: 'right',
        targetAnchor: 'left',
        cssClass: 'arrow-edge',
      },
    },

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
    groups: [
      {
        id: 'elements',
        label: 'Elements',
        tools: [
          {
            id: 'box',
            label: 'Box',
            icon: 'box-icon',
            description: 'Create a new box',
          },
          {
            id: 'arrow',
            label: 'Arrow',
            icon: 'arrow-icon',
            description: 'Create an arrow between boxes',
          },
        ],
      },
    ],
  },

  disabledFeatures: [],
};

export default manifest;
