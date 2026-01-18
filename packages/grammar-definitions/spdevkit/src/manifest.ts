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
 */
export const manifest: GrammarManifest = {
  languageId: 'spdevkit',
  displayName: 'SPDevKit',
  fileExtension: '.spdevkit',
  baseExtension: '.spdevkit',
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
        shape: 'rectangle',
        cssClass: 'application-node',
        defaultSize: { width: 180, height: 80 },
      },
    },
    {
      astType: 'Entity',
      displayName: 'Entity',
      fileSuffix: '.entity',
      folder: 'entities',
      icon: 'symbol-class',
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
        cssClass: 'entity-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'Service',
      displayName: 'Service',
      fileSuffix: '.service',
      folder: 'services',
      icon: 'symbol-method',
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
        shape: 'rectangle',
        cssClass: 'service-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'Workflow',
      displayName: 'Workflow',
      fileSuffix: '.workflow',
      folder: 'workflows',
      icon: 'git-merge',
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
        shape: 'rectangle',
        cssClass: 'workflow-node',
        defaultSize: { width: 180, height: 80 },
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
                icon: 'symbol-class',
                action: { type: 'create-node', glspType: 'node:entity' },
              },
              {
                id: 'create-service',
                label: 'Service',
                icon: 'symbol-method',
                action: { type: 'create-node', glspType: 'node:service' },
              },
              {
                id: 'create-workflow',
                label: 'Workflow',
                icon: 'git-merge',
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
