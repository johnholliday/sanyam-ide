import type { GrammarManifest } from '@sanyam/types';

export const SPDEVKIT_MANIFEST: GrammarManifest = {
  languageId: 'spdevkit',
  displayName: 'SPDevKit',
  fileExtension: '.spdk',
  baseExtension: '.spdk',
  rootTypes: [
    {
      astType: 'Application',
      displayName: 'Application',
      fileSuffix: '.application',
      folder: 'applications',
      icon: 'symbol-namespace',
      template: `application \${name} {
  // Add application details here
}
`,
      templateInputs: [
        { id: 'name', label: 'Application Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:application',
        shape: 'rectangle',
        cssClass: 'application-node',
        defaultSize: { width: 180, height: 70 }
      }
    },
    {
      astType: 'Entity',
      displayName: 'Entity',
      fileSuffix: '.entity',
      folder: 'entities',
      icon: 'symbol-class',
      template: `entity \${name} {
  // Add properties here
}
`,
      templateInputs: [
        { id: 'name', label: 'Entity Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:entity',
        shape: 'rectangle',
        cssClass: 'entity-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'Service',
      displayName: 'Service',
      fileSuffix: '.service',
      folder: 'services',
      icon: 'symbol-method',
      template: `service \${name} {
  // Add operations here
}
`,
      templateInputs: [
        { id: 'name', label: 'Service Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:service',
        shape: 'rectangle',
        cssClass: 'service-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'Workflow',
      displayName: 'Workflow',
      fileSuffix: '.workflow',
      folder: 'workflows',
      icon: 'git-merge',
      template: `workflow \${name} {
  // Add steps here
}
`,
      templateInputs: [
        { id: 'name', label: 'Workflow Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:workflow',
        shape: 'rectangle',
        cssClass: 'workflow-node',
        defaultSize: { width: 160, height: 60 }
      }
    }
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
        { glspType: 'node:workflow', creatable: true, showable: true }
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true }
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
                icon: 'symbol-namespace',
                action: { type: 'create-node', glspType: 'node:application' }
              },
              {
                id: 'create-entity',
                label: 'Entity',
                icon: 'symbol-class',
                action: { type: 'create-node', glspType: 'node:entity' }
              },
              {
                id: 'create-service',
                label: 'Service',
                icon: 'symbol-method',
                action: { type: 'create-node', glspType: 'node:service' }
              },
              {
                id: 'create-workflow',
                label: 'Workflow',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:workflow' }
              }
            ]
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-connection',
                label: 'Connection',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:connection' }
              }
            ]
          }
        ]
      }
    }
  ]
};
