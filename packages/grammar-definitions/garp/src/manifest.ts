/**
 * GARP Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for Generally Accepted Recordkeeping Principles.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * GARP Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: 'garp',
  displayName: 'GARP',
  summary: 'A domain-specific language for implementing Generally Accepted Recordkeeping Principles, enabling structured records management policies and retention schedules.',
  tagline: 'Records management by principle',
  keyFeatures: [
    { feature: 'Policy Framework', description: 'Define policies aligned to GARP principles' },
    { feature: 'Retention Schedules', description: 'Configure retention periods and triggers' },
    { feature: 'Disposition Rules', description: 'Specify disposition methods and approvals' },
    { feature: 'Maturity Assessment', description: 'Track organizational maturity levels' },
    { feature: 'Visual Compliance', description: 'Visualize policy relationships and dependencies' },
  ],
  coreConcepts: [
    { concept: 'Organization', description: 'The entity implementing GARP principles' },
    { concept: 'Policy', description: 'A records management policy aligned to GARP' },
    { concept: 'Assessment', description: 'An evaluation of GARP compliance' },
    { concept: 'RetentionSchedule', description: 'Rules for record retention periods' },
    { concept: 'DispositionRule', description: 'Methods and approvals for record disposition' },
  ],
  quickExample: `organization AcmeCorp {
  description "Corporate records management"
  maturity Essential
}

policy RecordsRetention {
  description "Corporate retention policy"
  principle Retention
  status Approved
  owner "Records Manager"
}`,
  fileExtension: '.garp',
  baseExtension: '.garp',
  rootTypes: [
    {
      astType: 'Organization',
      displayName: 'Organization',
      fileSuffix: '.organization',
      folder: 'organizations',
      icon: 'folder',
      template: `organization \${name} {
  description "Enter organization description"
  maturity Essential
}
`,
      templateInputs: [
        { id: 'name', label: 'Organization Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:organization',
        shape: 'rectangle',
        cssClass: 'organization-node',
        defaultSize: { width: 180, height: 80 },
      },
    },
    {
      astType: 'Policy',
      displayName: 'Policy',
      fileSuffix: '.policy',
      folder: 'policies',
      icon: 'file',
      template: `policy \${name} {
  description "Enter policy description"
  principle Accountability
  status Draft
  owner "Policy Owner"
}
`,
      templateInputs: [
        { id: 'name', label: 'Policy Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:policy',
        shape: 'rectangle',
        cssClass: 'policy-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'Assessment',
      displayName: 'Assessment',
      fileSuffix: '.assessment',
      folder: 'assessments',
      icon: 'checklist',
      template: `assessment \${name} {
  description "Enter assessment description"
  date "2025-01-01"
  assessor "Assessor Name"
}
`,
      templateInputs: [
        { id: 'name', label: 'Assessment Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:assessment',
        shape: 'rectangle',
        cssClass: 'assessment-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'RetentionSchedule',
      displayName: 'Retention Schedule',
      fileSuffix: '.retention',
      folder: 'retention-schedules',
      icon: 'gear',
      template: `retention \${name} {
  description "Enter retention schedule description"
  recordType "Record Type"
  period "7 years"
  trigger "creation"
}
`,
      templateInputs: [
        { id: 'name', label: 'Retention Schedule Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:retentionschedule',
        shape: 'rectangle',
        cssClass: 'retentionschedule-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
    {
      astType: 'DispositionRule',
      displayName: 'Disposition Rule',
      fileSuffix: '.disposition',
      folder: 'disposition-rules',
      icon: 'symbol-method',
      template: `disposition \${name} {
  description "Enter disposition rule description"
  method Destroy
  approval required
}
`,
      templateInputs: [
        { id: 'name', label: 'Disposition Rule Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:dispositionrule',
        shape: 'rectangle',
        cssClass: 'dispositionrule-node',
        defaultSize: { width: 150, height: 60 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'garp-overview',
      displayName: 'GARP Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:organization', creatable: true, showable: true },
        { glspType: 'node:policy', creatable: true, showable: true },
        { glspType: 'node:assessment', creatable: true, showable: true },
        { glspType: 'node:retentionschedule', creatable: true, showable: true },
        { glspType: 'node:dispositionrule', creatable: true, showable: true },
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
                id: 'create-organization',
                label: 'Organization',
                icon: 'folder',
                action: { type: 'create-node', glspType: 'node:organization' },
              },
              {
                id: 'create-policy',
                label: 'Policy',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:policy' },
              },
              {
                id: 'create-assessment',
                label: 'Assessment',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:assessment' },
              },
              {
                id: 'create-retentionschedule',
                label: 'Retention Schedule',
                icon: 'gear',
                action: { type: 'create-node', glspType: 'node:retentionschedule' },
              },
              {
                id: 'create-dispositionrule',
                label: 'Disposition Rule',
                icon: 'symbol-method',
                action: { type: 'create-node', glspType: 'node:dispositionrule' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
