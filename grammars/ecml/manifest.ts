import type { GrammarManifest } from '@sanyam/types';

export const ECML_MANIFEST: GrammarManifest = {
  languageId: 'ecml',
  displayName: 'ECML',
  fileExtension: '.ecml',
  baseExtension: '.ecml',
  rootTypes: [
    {
      astType: 'Actor',
      displayName: 'Actor',
      fileSuffix: '.actor',
      folder: 'actors',
      icon: 'person',
      template: `Actor \${name} "Actor Title" "Description of the actor"
`,
      templateInputs: [
        { id: 'name', label: 'Actor Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:actor',
        shape: 'ellipse',
        cssClass: 'actor-node',
        defaultSize: { width: 120, height: 60 }
      }
    },
    {
      astType: 'Activity',
      displayName: 'Activity',
      fileSuffix: '.activity',
      folder: 'activities',
      icon: 'checklist',
      template: `Activity \${name} "Activity Title" "Description of the activity"
`,
      templateInputs: [
        { id: 'name', label: 'Activity Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:activity',
        shape: 'rectangle',
        cssClass: 'activity-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'Task',
      displayName: 'Task',
      fileSuffix: '.task',
      folder: 'tasks',
      icon: 'checklist',
      template: `Task \${name} "Task Title" "Description of the task"
`,
      templateInputs: [
        { id: 'name', label: 'Task Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:task',
        shape: 'rectangle',
        cssClass: 'task-node',
        defaultSize: { width: 140, height: 50 }
      }
    },
    {
      astType: 'Content',
      displayName: 'Content',
      fileSuffix: '.content',
      folder: 'contents',
      icon: 'file',
      template: `Content \${name} "Content Title" "Description of the content"
`,
      templateInputs: [
        { id: 'name', label: 'Content Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:content',
        shape: 'rectangle',
        cssClass: 'content-node',
        defaultSize: { width: 140, height: 50 }
      }
    },
    {
      astType: 'SecurityGroup',
      displayName: 'Security Group',
      fileSuffix: '.securitygroup',
      folder: 'securitygroups',
      icon: 'shield',
      template: `SecurityGroup \${name} "Security Group Title" "Description"
`,
      templateInputs: [
        { id: 'name', label: 'Security Group Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:securitygroup',
        shape: 'hexagon',
        cssClass: 'securitygroup-node',
        defaultSize: { width: 160, height: 70 }
      }
    },
    {
      astType: 'Permission',
      displayName: 'Permission',
      fileSuffix: '.permission',
      folder: 'permissions',
      icon: 'shield',
      template: `Permission \${name} "Permission Title" "Description"
`,
      templateInputs: [
        { id: 'name', label: 'Permission Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:permission',
        shape: 'rectangle',
        cssClass: 'permission-node',
        defaultSize: { width: 140, height: 50 }
      }
    },
    {
      astType: 'RetentionLabel',
      displayName: 'Retention Label',
      fileSuffix: '.retentionlabel',
      folder: 'retentionlabels',
      icon: 'tag',
      template: `RetentionLabel \${name} "Retention Label Title" "Description"
`,
      templateInputs: [
        { id: 'name', label: 'Retention Label Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:retentionlabel',
        shape: 'rectangle',
        cssClass: 'retentionlabel-node',
        defaultSize: { width: 150, height: 50 }
      }
    },
    {
      astType: 'SensitivityLabel',
      displayName: 'Sensitivity Label',
      fileSuffix: '.sensitivitylabel',
      folder: 'sensitivitylabels',
      icon: 'tag',
      template: `SensitivityLabel \${name} "Sensitivity Label Title" "Description"
`,
      templateInputs: [
        { id: 'name', label: 'Sensitivity Label Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:sensitivitylabel',
        shape: 'rectangle',
        cssClass: 'sensitivitylabel-node',
        defaultSize: { width: 160, height: 50 }
      }
    },
    {
      astType: 'Workflow',
      displayName: 'Workflow',
      fileSuffix: '.workflow',
      folder: 'workflows',
      icon: 'git-merge',
      template: `Workflow \${name} "Workflow Title" "Description" {
  // Add workflow steps here
}
`,
      templateInputs: [
        { id: 'name', label: 'Workflow Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:workflow',
        shape: 'rectangle',
        cssClass: 'workflow-node',
        defaultSize: { width: 160, height: 70 }
      }
    }
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'ecml-overview',
      displayName: 'ECML Overview',
      fileType: 'ContentModel',
      nodeTypes: [
        { glspType: 'node:actor', creatable: true, showable: true },
        { glspType: 'node:activity', creatable: true, showable: true },
        { glspType: 'node:task', creatable: true, showable: true },
        { glspType: 'node:content', creatable: true, showable: true },
        { glspType: 'node:securitygroup', creatable: true, showable: true },
        { glspType: 'node:permission', creatable: true, showable: true },
        { glspType: 'node:retentionlabel', creatable: true, showable: true },
        { glspType: 'node:sensitivitylabel', creatable: true, showable: true },
        { glspType: 'node:workflow', creatable: true, showable: true }
      ],
      edgeTypes: [
        { glspType: 'edge:flow', creatable: true, showable: true },
        { glspType: 'edge:assignment', creatable: true, showable: true }
      ],
      toolPalette: {
        groups: [
          {
            id: 'actors',
            label: 'Actors',
            items: [
              {
                id: 'create-actor',
                label: 'Actor',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:actor' }
              }
            ]
          },
          {
            id: 'processes',
            label: 'Processes',
            items: [
              {
                id: 'create-activity',
                label: 'Activity',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:activity' }
              },
              {
                id: 'create-task',
                label: 'Task',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:task' }
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
            id: 'content',
            label: 'Content',
            items: [
              {
                id: 'create-content',
                label: 'Content',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:content' }
              }
            ]
          },
          {
            id: 'security',
            label: 'Security & Compliance',
            items: [
              {
                id: 'create-securitygroup',
                label: 'Security Group',
                icon: 'shield',
                action: { type: 'create-node', glspType: 'node:securitygroup' }
              },
              {
                id: 'create-permission',
                label: 'Permission',
                icon: 'shield',
                action: { type: 'create-node', glspType: 'node:permission' }
              },
              {
                id: 'create-retentionlabel',
                label: 'Retention Label',
                icon: 'tag',
                action: { type: 'create-node', glspType: 'node:retentionlabel' }
              },
              {
                id: 'create-sensitivitylabel',
                label: 'Sensitivity Label',
                icon: 'tag',
                action: { type: 'create-node', glspType: 'node:sensitivitylabel' }
              }
            ]
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-flow',
                label: 'Flow',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:flow' }
              },
              {
                id: 'create-assignment',
                label: 'Assignment',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:assignment' }
              }
            ]
          }
        ]
      }
    }
  ]
};
