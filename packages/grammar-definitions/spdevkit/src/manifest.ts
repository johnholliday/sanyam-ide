/**
 * SPDevKit Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * SPDevKit Grammar Manifest
 *
 * Note: Fields populated from @{token} comments in the grammar file are marked with [tag].
 * Logo is handled by webpack asset bundling. The logo.svg file is copied
 * to assets/logos/spdevkit.svg at build time.
 */
export const manifest: GrammarManifest = {
  languageId: 'spdevkit',
  displayName: 'SPDevKit',  // [tag] @name
  summary: 'A development environment for modeling collaborative applications for SharePoint Online.',  // [tag] @description
  tagline: 'SharePoint Development Kit',  // [tag] @tagline
  keyFeatures: [
    { feature: 'Application Modeling', description: 'Define complete application structures declaratively' },
    { feature: 'Entity Definitions', description: 'Create typed entity schemas with properties' },
    { feature: 'Service Operations', description: 'Define services with input/output specifications' },
    { feature: 'Workflow Design', description: 'Model multi-step workflows with conditional logic' },
    { feature: 'Visual Architecture', description: 'Visualize application architecture with interactive diagrams' },
  ],
  coreConcepts: [
    { concept: 'Application', description: 'A top-level container for related components' },
    { concept: 'Entity', description: 'A data structure with typed properties' },
    { concept: 'Service', description: 'A business operation with defined inputs and outputs' },
    { concept: 'Workflow', description: 'A sequence of steps for process automation' },
  ],
  quickExample: `application MyApp {
  description "Sample application"
  version "1.0.0"
}

entity User {
  name: string
  email: string
}`,
  fileExtension: '.spdk',  // [tag] @extension
  baseExtension: '.spdk',  // [tag] @extension
  // logo field omitted - handled by webpack asset bundling (assets/logos/spdevkit.svg)
  rootTypes: [
    {
      astType: 'Application',
      displayName: 'Application',
      fileSuffix: '.application',
      folder: 'applications',
      icon: 'package',
      template: `application \${name} {
    description "TODO: Add description"
    version "1.0.0"
}
`,
      templateInputs: [
        { id: 'name', label: 'Application Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:application',
        shape: 'rounded',
        cssClass: 'SPDevKit.Application',
        defaultSize: { width: 180, height: 80 },
        tooltip: 'Application: \${name}',
      },
    },
    {
      astType: 'Entity',
      displayName: 'Entity',
      fileSuffix: '.entity',
      folder: 'entities',
      icon: 'class',
      template: `entity \${name} {
    // Add properties here
    // name: string
    // age: number
}
`,
      templateInputs: [
        { id: 'name', label: 'Entity Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:entity',
        shape: 'rectangle',
        cssClass: 'SPDevKit.Entity',
        defaultSize: { width: 150, height: 60 },
        tooltip: 'Entity: \${name}',
      },
    },
    {
      astType: 'Service',
      displayName: 'Service',
      fileSuffix: '.service',
      folder: 'services',
      icon: 'method',
      template: `service \${name} {
    description "TODO: Add description"
    // Add operations here
    // operation doSomething(input: string) -> string
}
`,
      templateInputs: [
        { id: 'name', label: 'Service Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:service',
        shape: 'hexagon',
        cssClass: 'SPDevKit.Service',
        defaultSize: { width: 150, height: 70 },
        tooltip: 'Service: \${name}',
      },
    },
    {
      astType: 'Workflow',
      displayName: 'Workflow',
      fileSuffix: '.workflow',
      folder: 'workflows',
      icon: 'workflow',
      template: `workflow \${name} {
    description "TODO: Add description"
    // Add steps here
    // step Start {
    //     action "Initialize"
    //     next ProcessStep
    // }
}
`,
      templateInputs: [
        { id: 'name', label: 'Workflow Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:workflow',
        shape: 'rounded',
        cssClass: 'SPDevKit.Workflow',
        defaultSize: { width: 180, height: 80 },
        tooltip: 'Workflow: \${name}',
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'spdevkit-overview',
      displayName: 'SPDevKit Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:application', creatable: true, showable: true },
        { glspType: 'node:entity', creatable: true, showable: true },
        { glspType: 'node:service', creatable: true, showable: true },
        { glspType: 'node:workflow', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'elements',
            label: 'Elements',
            items: [
              {
                id: 'create-application',
                label: 'Application',
                icon: 'package',
                action: { type: 'create-node', glspType: 'node:application' },
              },
              {
                id: 'create-entity',
                label: 'Entity',
                icon: 'class',
                action: { type: 'create-node', glspType: 'node:entity' },
              },
              {
                id: 'create-service',
                label: 'Service',
                icon: 'method',
                action: { type: 'create-node', glspType: 'node:service' },
              },
              {
                id: 'create-workflow',
                label: 'Workflow',
                icon: 'workflow',
                action: { type: 'create-node', glspType: 'node:workflow' },
              },
            ],
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-connection',
                label: 'Connection',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:connection' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
