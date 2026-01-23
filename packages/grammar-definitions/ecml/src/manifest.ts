/**
 * ECML Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for Enterprise Content Modeling Language.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * ECML Grammar Manifest
 *
 * Note: Logo is handled by webpack asset bundling. The logo.svg file is copied
 * to assets/logos/ecml.svg at build time.
 */
export const manifest: GrammarManifest = {
  languageId: 'ecml',
  displayName: 'Enterprise Content Modeling Language',
  summary: 'A domain-specific language for modeling enterprise content management workflows, security policies, and compliance requirements.',
  tagline: 'Enterprise Content Modeling Language',
  keyFeatures: [
    { feature: 'Content Lifecycle', description: 'Model complete content lifecycle from creation to archival' },
    { feature: 'Security Policies', description: 'Define security groups and granular permissions' },
    { feature: 'Compliance Labels', description: 'Manage retention and sensitivity labels for regulatory compliance' },
    { feature: 'Visual Workflows', description: 'Design and visualize content workflows with drag-and-drop diagrams' },
    { feature: 'Actor Modeling', description: 'Define actors and their access control relationships' },
  ],
  coreConcepts: [
    { concept: 'Actor', description: 'A user or system that interacts with content' },
    { concept: 'Activity', description: 'A business process or workflow step' },
    { concept: 'Task', description: 'A discrete unit of work within an activity' },
    { concept: 'Content', description: 'A document or data item being managed' },
    { concept: 'SecurityGroup', description: 'A collection of permissions assigned to actors' },
    { concept: 'Workflow', description: 'A sequence of activities that process content' },
  ],
  quickExample: `Actor Admin "Administrator" "System administrator"
Content Policy "Security Policy" "Organization security policy"
SecurityGroup Admins "Admin Group" "Administrative users"
Permission FullAccess "Full Access" "Complete system access"`,
  fileExtension: '.ecml',
  baseExtension: '.ecml',
  // logo field omitted - handled by webpack asset bundling (assets/logos/ecml.svg)
  packageFile: {
    fileName: 'model.ecml',
    displayName: 'Content Model',
    icon: 'book',
  },
  rootTypes: [
    {
      astType: 'Actor',
      displayName: 'Actor',
      fileSuffix: '.actor',
      folder: 'actors',
      icon: 'person',
      template: `Actor \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Actor Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:actor',
        shape: 'ellipse',
        cssClass: 'actor-node',
        defaultSize: { width: 120, height: 80 },
      },
    },
    {
      astType: 'Activity',
      displayName: 'Activity',
      fileSuffix: '.activity',
      folder: 'activities',
      icon: 'checklist',
      template: `Activity \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Activity Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:activity',
        shape: 'rectangle',
        cssClass: 'activity-node',
        defaultSize: { width: 160, height: 60 },
      },
    },
    {
      astType: 'Task',
      displayName: 'Task',
      fileSuffix: '.task',
      folder: 'tasks',
      icon: 'tasklist',
      template: `Task \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Task Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:task',
        shape: 'rectangle',
        cssClass: 'task-node',
        defaultSize: { width: 140, height: 50 },
      },
    },
    {
      astType: 'Content',
      displayName: 'Content',
      fileSuffix: '.content',
      folder: 'content',
      icon: 'file',
      template: `Content \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Content Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:content',
        shape: 'rectangle',
        cssClass: 'content-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'SecurityGroup',
      displayName: 'Security Group',
      fileSuffix: '.secgroup',
      folder: 'security',
      icon: 'shield',
      template: `SecurityGroup \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Security Group Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:securitygroup',
        shape: 'hexagon',
        cssClass: 'security-group-node',
        defaultSize: { width: 140, height: 70 },
      },
    },
    {
      astType: 'Permission',
      displayName: 'Permission',
      fileSuffix: '.permission',
      folder: 'permissions',
      icon: 'key',
      template: `Permission \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Permission Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:permission',
        shape: 'diamond',
        cssClass: 'permission-node',
        defaultSize: { width: 100, height: 60 },
      },
    },
    {
      astType: 'RetentionLabel',
      displayName: 'Retention Label',
      fileSuffix: '.retention',
      folder: 'labels',
      icon: 'clock',
      template: `RetentionLabel \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Retention Label Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:retentionlabel',
        shape: 'rectangle',
        cssClass: 'retention-label-node',
        defaultSize: { width: 130, height: 50 },
      },
    },
    {
      astType: 'SensitivityLabel',
      displayName: 'Sensitivity Label',
      fileSuffix: '.sensitivity',
      folder: 'labels',
      icon: 'warning',
      template: `SensitivityLabel \${name} "\${name}" "Description of \${name}"
`,
      templateInputs: [
        { id: 'name', label: 'Sensitivity Label Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:sensitivitylabel',
        shape: 'rectangle',
        cssClass: 'sensitivity-label-node',
        defaultSize: { width: 130, height: 50 },
      },
    },
    {
      astType: 'Workflow',
      displayName: 'Workflow',
      fileSuffix: '.workflow',
      folder: 'workflows',
      icon: 'git-merge',
      template: `Workflow \${name} "\${name}" "Description of \${name}" {
  // Add workflow steps here
}
`,
      templateInputs: [
        { id: 'name', label: 'Workflow Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:workflow',
        shape: 'rectangle',
        cssClass: 'workflow-node',
        defaultSize: { width: 180, height: 100 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'ecml-overview',
      displayName: 'Content Model Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:actor', creatable: true, showable: true },
        { glspType: 'node:activity', creatable: true, showable: true },
        { glspType: 'node:task', creatable: true, showable: true },
        { glspType: 'node:content', creatable: true, showable: true },
        { glspType: 'node:securitygroup', creatable: true, showable: true },
        { glspType: 'node:permission', creatable: true, showable: true },
        { glspType: 'node:retentionlabel', creatable: true, showable: true },
        { glspType: 'node:sensitivitylabel', creatable: true, showable: true },
        { glspType: 'node:workflow', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:flow', creatable: true, showable: true },
        { glspType: 'edge:assignment', creatable: true, showable: true },
        { glspType: 'edge:reference', creatable: true, showable: true },
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
                action: { type: 'create-node', glspType: 'node:actor' },
              },
            ],
          },
          {
            id: 'activities',
            label: 'Activities & Tasks',
            items: [
              {
                id: 'create-activity',
                label: 'Activity',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:activity' },
              },
              {
                id: 'create-task',
                label: 'Task',
                icon: 'tasklist',
                action: { type: 'create-node', glspType: 'node:task' },
              },
            ],
          },
          {
            id: 'content',
            label: 'Content',
            items: [
              {
                id: 'create-content',
                label: 'Content',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:content' },
              },
            ],
          },
          {
            id: 'security',
            label: 'Security & Compliance',
            items: [
              {
                id: 'create-securitygroup',
                label: 'Security Group',
                icon: 'shield',
                action: { type: 'create-node', glspType: 'node:securitygroup' },
              },
              {
                id: 'create-permission',
                label: 'Permission',
                icon: 'key',
                action: { type: 'create-node', glspType: 'node:permission' },
              },
              {
                id: 'create-retentionlabel',
                label: 'Retention Label',
                icon: 'clock',
                action: { type: 'create-node', glspType: 'node:retentionlabel' },
              },
              {
                id: 'create-sensitivitylabel',
                label: 'Sensitivity Label',
                icon: 'warning',
                action: { type: 'create-node', glspType: 'node:sensitivitylabel' },
              },
            ],
          },
          {
            id: 'workflows',
            label: 'Workflows',
            items: [
              {
                id: 'create-workflow',
                label: 'Workflow',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:workflow' },
              },
            ],
          },
          {
            id: 'edges',
            label: 'Connections',
            items: [
              {
                id: 'create-flow',
                label: 'Content Flow',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:flow' },
              },
              {
                id: 'create-assignment',
                label: 'Assignment',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:assignment' },
              },
              {
                id: 'create-reference',
                label: 'Reference',
                icon: 'references',
                action: { type: 'create-edge', glspType: 'edge:reference' },
              },
            ],
          },
        ],
      },
    },
    {
      id: 'ecml-workflow',
      displayName: 'Workflow Diagram',
      fileType: 'Workflow',
      nodeTypes: [
        { glspType: 'node:activity', creatable: true, showable: true },
        { glspType: 'node:task', creatable: true, showable: true },
        { glspType: 'node:content', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:flow', creatable: true, showable: true },
        { glspType: 'edge:conditional', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'workflow-elements',
            label: 'Workflow Elements',
            items: [
              {
                id: 'create-activity',
                label: 'Activity',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:activity' },
              },
              {
                id: 'create-task',
                label: 'Task',
                icon: 'tasklist',
                action: { type: 'create-node', glspType: 'node:task' },
              },
              {
                id: 'create-content',
                label: 'Content',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:content' },
              },
            ],
          },
          {
            id: 'workflow-edges',
            label: 'Flow Connections',
            items: [
              {
                id: 'create-flow',
                label: 'Flow',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:flow' },
              },
              {
                id: 'create-conditional',
                label: 'Conditional',
                icon: 'git-compare',
                action: { type: 'create-edge', glspType: 'edge:conditional' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
