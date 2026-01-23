/**
 * Grammar Manifest for {{languageId}}
 *
 * This file exports the GrammarManifest which configures
 * the language server and diagram editor for this grammar.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * {{languageId}} Grammar Manifest
 *
 * Configures how the language is processed by the unified server:
 * - File extensions and language identification
 * - Diagram node and edge type mappings
 * - Tool palette and context menu configuration
 * - Validation and formatting settings
 */
export const manifest: GrammarManifest = {
  /**
   * Unique identifier for this language.
   * Used for document routing and capability registration.
   */
  name: '{{languageId}}',

  /**
   * File extensions associated with this language.
   * Include the leading dot (e.g., '.ecml').
   */
  fileExtensions: {{fileExtensionsArray}},

  /**
   * Diagram configuration (optional).
   * Configure this section to enable visual editing.
   */
  diagram: {
    /**
     * Node type mappings.
     * Maps AST node types to diagram node configurations.
     */
    nodeTypes: {
      // Example:
      // Entity: {
      //   type: 'node:entity',
      //   label: (node) => node.name,
      //   icon: 'entity-icon',
      //   cssClass: 'entity-node',
      // },
    },

    /**
     * Edge type mappings.
     * Maps AST reference types to diagram edge configurations.
     */
    edgeTypes: {
      // Example:
      // Reference: {
      //   type: 'edge:reference',
      //   label: (edge) => edge.name,
      //   sourceAnchor: 'right',
      //   targetAnchor: 'left',
      // },
    },

    /**
     * Layout algorithm configuration.
     */
    layout: {
      algorithm: 'elk',
      direction: 'RIGHT',
      spacing: {
        node: 50,
        edge: 20,
      },
    },
  },

  /**
   * Tool palette configuration.
   * Define tools available for creating diagram elements.
   */
  toolPalette: {
    groups: [
      // Example:
      // {
      //   id: 'nodes',
      //   label: 'Nodes',
      //   tools: [
      //     { id: 'entity', label: 'Entity', icon: 'entity-icon' },
      //   ],
      // },
    ],
  },

  /**
   * Disabled features.
   * List feature names to disable specific LSP/GLSP capabilities.
   */
  disabledFeatures: [],
};

export default manifest;
