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
 *
 * This is a minimal example showing the required fields for a GrammarManifest.
 * For production use with full features, see the ecml package.
 */
export const manifest: GrammarManifest = {
  languageId: 'example-minimal',
  displayName: 'Example Minimal',
  summary: 'A minimal example grammar demonstrating the basic structure required for SANYAM platform integration.',
  tagline: 'Start simple, grow fast',
  keyFeatures: [
    { feature: 'Minimal Setup', description: 'Shows the minimum required configuration' },
    { feature: 'Type-Safe', description: 'Full TypeScript type checking support' },
    { feature: 'Extensible', description: 'Easy to extend with additional features' },
  ],
  coreConcepts: [
    { concept: 'Element', description: 'A basic building block in the grammar' },
  ],
  quickExample: `// Add your example syntax here
element MyElement {
  name: "Example"
}`,
  fileExtension: '.exm',
  baseExtension: '.exm',
  diagrammingEnabled: false,
  rootTypes: [
    {
      astType: 'Element',
      displayName: 'Element',
      fileSuffix: '.element',
      folder: 'elements',
      icon: 'class',
      template: `element \${name} {
  // Add properties here
}
`,
      templateInputs: [
        { id: 'name', label: 'Element Name', type: 'string', required: true },
      ],
    },
  ],
};

export default manifest;
