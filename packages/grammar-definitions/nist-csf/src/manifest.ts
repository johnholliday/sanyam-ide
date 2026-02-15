/**
 * NIST CSF Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for the NIST Cybersecurity Framework DSL.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * NIST CSF Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: 'nist-csf',
  displayName: 'NIST CSF',
  summary: 'A domain-specific language for implementing the NIST Cybersecurity Framework, enabling structured documentation of functions, categories, controls, and profiles.',
  tagline: 'Cybersecurity risk, structured',
  keyFeatures: [
    { feature: 'Framework Core', description: 'Model the five CSF functions with categories and subcategories' },
    { feature: 'Profile Management', description: 'Create organization-specific security profiles' },
    { feature: 'Control Mapping', description: 'Map controls to framework requirements' },
    { feature: 'Reference Linking', description: 'Link to informative references and standards' },
    { feature: 'Visual Architecture', description: 'Visualize security framework structure' },
  ],
  coreConcepts: [
    { concept: 'Framework', description: 'The NIST CSF implementation container' },
    { concept: 'Profile', description: 'An organization-specific security profile' },
    { concept: 'Function', description: 'A CSF core function (Identify, Protect, etc.)' },
    { concept: 'Category', description: 'A grouping of cybersecurity outcomes' },
    { concept: 'Subcategory', description: 'A specific cybersecurity outcome' },
    { concept: 'Control', description: 'A security control implementation' },
  ],
  quickExample: `framework EnterpriseCSF {
  description "Enterprise cybersecurity framework"
  version "2.0"
}

profile CurrentState {
  description "Current security posture"
  target "Enterprise"
}`,
  fileExtension: '.nist-csf',
  baseExtension: '.nist-csf',
  rootTypes: [
    {
      astType: 'Framework',
      displayName: 'Framework',
      fileSuffix: '.framework',
      folder: 'frameworks',
      icon: 'shield',
      template: `framework \${name} {
  description "NIST Cybersecurity Framework implementation"
  version "2.0"
}
`,
      templateInputs: [
        { id: 'name', label: 'Framework Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:framework',
        shape: 'rectangle',
        cssClass: 'framework-node',
        defaultSize: { width: 200, height: 80 },
      },
    },
    {
      astType: 'Profile',
      displayName: 'Profile',
      fileSuffix: '.profile',
      folder: 'profiles',
      icon: 'person',
      template: `profile \${name} {
  description "Organization-specific CSF profile"
  target "Enterprise"
}
`,
      templateInputs: [
        { id: 'name', label: 'Profile Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:profile',
        shape: 'rectangle',
        cssClass: 'profile-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'Function',
      displayName: 'Function',
      fileSuffix: '.function',
      folder: 'functions',
      icon: 'method',
      template: `function Identify {
  description "Develop organizational understanding to manage cybersecurity risk"
}
`,
      templateInputs: [
        { id: 'name', label: 'Function Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:function',
        shape: 'rectangle',
        cssClass: 'function-node',
        defaultSize: { width: 160, height: 60 },
      },
    },
    {
      astType: 'Category',
      displayName: 'Category',
      fileSuffix: '.category',
      folder: 'categories',
      icon: 'folder',
      template: `category \${name} {
  id "ID.AM"
  description "Assets and data that enable the organization to achieve business purposes"
}
`,
      templateInputs: [
        { id: 'name', label: 'Category Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:category',
        shape: 'rectangle',
        cssClass: 'category-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'Subcategory',
      displayName: 'Subcategory',
      fileSuffix: '.subcategory',
      folder: 'subcategories',
      icon: 'checklist',
      template: `subcategory \${name} {
  id "ID.AM-1"
  description "Physical devices and systems are inventoried"
}
`,
      templateInputs: [
        { id: 'name', label: 'Subcategory Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:subcategory',
        shape: 'rectangle',
        cssClass: 'subcategory-node',
        defaultSize: { width: 140, height: 50 },
      },
    },
    {
      astType: 'Control',
      displayName: 'Control',
      fileSuffix: '.control',
      folder: 'controls',
      icon: 'gear',
      template: `control \${name} {
  id "AC-1"
  family "Access Control"
  description "Access control policy and procedures"
  baseline Moderate
}
`,
      templateInputs: [
        { id: 'name', label: 'Control Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:control',
        shape: 'rectangle',
        cssClass: 'control-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'InformativeReference',
      displayName: 'Informative Reference',
      fileSuffix: '.reference',
      folder: 'references',
      icon: 'link',
      template: `reference \${name} {
  standard "NIST SP 800-53"
  section "AC-1"
  url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}
`,
      templateInputs: [
        { id: 'name', label: 'Reference Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:informativereference',
        shape: 'rectangle',
        cssClass: 'informativereference-node',
        defaultSize: { width: 160, height: 50 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'nist-csf-overview',
      displayName: 'NIST CSF Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:framework', creatable: true, showable: true },
        { glspType: 'node:profile', creatable: true, showable: true },
        { glspType: 'node:function', creatable: true, showable: true },
        { glspType: 'node:category', creatable: true, showable: true },
        { glspType: 'node:subcategory', creatable: true, showable: true },
        { glspType: 'node:control', creatable: true, showable: true },
        { glspType: 'node:informativereference', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'framework-elements',
            label: 'Framework',
            items: [
              {
                id: 'create-framework',
                label: 'Framework',
                icon: 'shield',
                action: { type: 'create-node', glspType: 'node:framework' },
              },
              {
                id: 'create-profile',
                label: 'Profile',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:profile' },
              },
            ],
          },
          {
            id: 'core-elements',
            label: 'Core',
            items: [
              {
                id: 'create-function',
                label: 'Function',
                icon: 'method',
                action: { type: 'create-node', glspType: 'node:function' },
              },
              {
                id: 'create-category',
                label: 'Category',
                icon: 'folder',
                action: { type: 'create-node', glspType: 'node:category' },
              },
              {
                id: 'create-subcategory',
                label: 'Subcategory',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:subcategory' },
              },
            ],
          },
          {
            id: 'reference-elements',
            label: 'References',
            items: [
              {
                id: 'create-control',
                label: 'Control',
                icon: 'gear',
                action: { type: 'create-node', glspType: 'node:control' },
              },
              {
                id: 'create-informativereference',
                label: 'Reference',
                icon: 'link',
                action: { type: 'create-node', glspType: 'node:informativereference' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
