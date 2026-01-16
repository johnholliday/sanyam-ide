import type { GrammarManifest } from '@sanyam/types';

export const ISO_42001_MANIFEST: GrammarManifest = {
  languageId: 'iso-42001',
  displayName: 'ISO 42001',
  fileExtension: '.iso42001',
  baseExtension: '.iso42001',
  rootTypes: [
    {
      astType: 'Organization',
      displayName: 'Organization',
      fileSuffix: '.organization',
      folder: 'organizations',
      icon: 'organization',
      template: `organization \${name} {
  description "Organization description"
  // Add context, stakeholders, and AI roles
}
`,
      templateInputs: [
        { id: 'name', label: 'Organization Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:organization',
        shape: 'rectangle',
        cssClass: 'organization-node',
        defaultSize: { width: 180, height: 80 }
      }
    },
    {
      astType: 'AIManagementSystem',
      displayName: 'AI Management System',
      fileSuffix: '.aims',
      folder: 'aims',
      icon: 'symbol-namespace',
      template: `aims \${name} {
  version "1.0"
  // Add scope, policy, and objectives
}
`,
      templateInputs: [
        { id: 'name', label: 'AIMS Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:aimangementsystem',
        shape: 'rectangle',
        cssClass: 'aims-node',
        defaultSize: { width: 200, height: 90 }
      }
    },
    {
      astType: 'AISystem',
      displayName: 'AI System',
      fileSuffix: '.aisystem',
      folder: 'aisystems',
      icon: 'robot',
      template: `aiSystem \${name} {
  description "AI system description"
  // Add classification, components, and lifecycle
}
`,
      templateInputs: [
        { id: 'name', label: 'AI System Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:aisystem',
        shape: 'hexagon',
        cssClass: 'aisystem-node',
        defaultSize: { width: 160, height: 80 }
      }
    },
    {
      astType: 'StakeholderRegistry',
      displayName: 'Stakeholder Registry',
      fileSuffix: '.stakeholders',
      folder: 'stakeholders',
      icon: 'people',
      template: `stakeholderRegistry \${name} {
  description "Stakeholder registry"
  // Add stakeholders
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:stakeholderregistry',
        shape: 'rectangle',
        cssClass: 'stakeholderregistry-node',
        defaultSize: { width: 170, height: 60 }
      }
    },
    {
      astType: 'ControlCatalog',
      displayName: 'Control Catalog',
      fileSuffix: '.controls',
      folder: 'controls',
      icon: 'checklist',
      template: `controlCatalog \${name} {
  description "ISO 42001 Annex A Controls"
  // Add control families and controls
}
`,
      templateInputs: [
        { id: 'name', label: 'Catalog Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:controlcatalog',
        shape: 'rectangle',
        cssClass: 'controlcatalog-node',
        defaultSize: { width: 160, height: 60 }
      }
    },
    {
      astType: 'RiskRegistry',
      displayName: 'Risk Registry',
      fileSuffix: '.risks',
      folder: 'risks',
      icon: 'warning',
      template: `riskRegistry \${name} {
  description "AI Risk Registry"
  // Add risks
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:riskregistry',
        shape: 'diamond',
        cssClass: 'riskregistry-node',
        defaultSize: { width: 150, height: 70 }
      }
    },
    {
      astType: 'ImpactAssessment',
      displayName: 'Impact Assessment',
      fileSuffix: '.impact',
      folder: 'impacts',
      icon: 'graph',
      template: `impactAssessment \${name} {
  aiSystem SystemRef
  assessmentDate 2024-01-01
  // Add impacts and mitigations
}
`,
      templateInputs: [
        { id: 'name', label: 'Assessment Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:impactassessment',
        shape: 'rectangle',
        cssClass: 'impactassessment-node',
        defaultSize: { width: 170, height: 60 }
      }
    },
    {
      astType: 'AuditProgram',
      displayName: 'Audit Program',
      fileSuffix: '.audits',
      folder: 'audits',
      icon: 'search',
      template: `auditProgram \${name} {
  year 2024
  // Add audits
}
`,
      templateInputs: [
        { id: 'name', label: 'Program Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:auditprogram',
        shape: 'rectangle',
        cssClass: 'auditprogram-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'StatementOfApplicability',
      displayName: 'Statement of Applicability',
      fileSuffix: '.soa',
      folder: 'soa',
      icon: 'file-text',
      template: `soa \${name} {
  version "1.0"
  // Add control declarations
}
`,
      templateInputs: [
        { id: 'name', label: 'SOA Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:soa',
        shape: 'rectangle',
        cssClass: 'soa-node',
        defaultSize: { width: 180, height: 60 }
      }
    },
    {
      astType: 'DocumentRegistry',
      displayName: 'Document Registry',
      fileSuffix: '.documents',
      folder: 'documents',
      icon: 'file',
      template: `documentRegistry \${name} {
  description "AIMS Document Registry"
  // Add documents
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:documentregistry',
        shape: 'rectangle',
        cssClass: 'documentregistry-node',
        defaultSize: { width: 160, height: 60 }
      }
    },
    {
      astType: 'ImprovementPlan',
      displayName: 'Improvement Plan',
      fileSuffix: '.improvement',
      folder: 'improvements',
      icon: 'arrow-up',
      template: `improvementPlan \${name} {
  description "Continual Improvement Plan"
  // Add nonconformities and initiatives
}
`,
      templateInputs: [
        { id: 'name', label: 'Plan Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:improvementplan',
        shape: 'rectangle',
        cssClass: 'improvementplan-node',
        defaultSize: { width: 160, height: 60 }
      }
    },
    {
      astType: 'DataInventory',
      displayName: 'Data Inventory',
      fileSuffix: '.data',
      folder: 'data',
      icon: 'database',
      template: `dataInventory \${name} {
  description "AI Data Inventory"
  // Add datasets
}
`,
      templateInputs: [
        { id: 'name', label: 'Inventory Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:datainventory',
        shape: 'rectangle',
        cssClass: 'datainventory-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'SupplierRegistry',
      displayName: 'Supplier Registry',
      fileSuffix: '.suppliers',
      folder: 'suppliers',
      icon: 'package',
      template: `supplierRegistry \${name} {
  description "AI Supplier Registry"
  // Add suppliers
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:supplierregistry',
        shape: 'rectangle',
        cssClass: 'supplierregistry-node',
        defaultSize: { width: 160, height: 60 }
      }
    },
    {
      astType: 'IncidentRegistry',
      displayName: 'Incident Registry',
      fileSuffix: '.incidents',
      folder: 'incidents',
      icon: 'flame',
      template: `incidentRegistry \${name} {
  description "AI Incident Registry"
  // Add incidents
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:incidentregistry',
        shape: 'rectangle',
        cssClass: 'incidentregistry-node',
        defaultSize: { width: 160, height: 60 }
      }
    },
    {
      astType: 'ManagementReview',
      displayName: 'Management Review',
      fileSuffix: '.review',
      folder: 'reviews',
      icon: 'comment-discussion',
      template: `managementReview \${name} {
  date 2024-01-01
  // Add inputs and outputs
}
`,
      templateInputs: [
        { id: 'name', label: 'Review Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:managementreview',
        shape: 'rectangle',
        cssClass: 'managementreview-node',
        defaultSize: { width: 170, height: 60 }
      }
    }
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'iso42001-overview',
      displayName: 'ISO 42001 Overview',
      fileType: 'AssessmentModel',
      nodeTypes: [
        { glspType: 'node:organization', creatable: true, showable: true },
        { glspType: 'node:aimanagementsystem', creatable: true, showable: true },
        { glspType: 'node:aisystem', creatable: true, showable: true },
        { glspType: 'node:stakeholderregistry', creatable: true, showable: true },
        { glspType: 'node:controlcatalog', creatable: true, showable: true },
        { glspType: 'node:riskregistry', creatable: true, showable: true },
        { glspType: 'node:impactassessment', creatable: true, showable: true },
        { glspType: 'node:auditprogram', creatable: true, showable: true },
        { glspType: 'node:soa', creatable: true, showable: true },
        { glspType: 'node:documentregistry', creatable: true, showable: true },
        { glspType: 'node:improvementplan', creatable: true, showable: true },
        { glspType: 'node:datainventory', creatable: true, showable: true },
        { glspType: 'node:supplierregistry', creatable: true, showable: true },
        { glspType: 'node:incidentregistry', creatable: true, showable: true },
        { glspType: 'node:managementreview', creatable: true, showable: true }
      ],
      edgeTypes: [
        { glspType: 'edge:reference', creatable: true, showable: true },
        { glspType: 'edge:mitigates', creatable: true, showable: true }
      ],
      toolPalette: {
        groups: [
          {
            id: 'context',
            label: 'Context (Clause 4)',
            items: [
              {
                id: 'create-organization',
                label: 'Organization',
                icon: 'organization',
                action: { type: 'create-node', glspType: 'node:organization' }
              },
              {
                id: 'create-stakeholderregistry',
                label: 'Stakeholder Registry',
                icon: 'people',
                action: { type: 'create-node', glspType: 'node:stakeholderregistry' }
              }
            ]
          },
          {
            id: 'aims',
            label: 'AIMS (Clauses 4-6)',
            items: [
              {
                id: 'create-aims',
                label: 'AI Management System',
                icon: 'symbol-namespace',
                action: { type: 'create-node', glspType: 'node:aimanagementsystem' }
              },
              {
                id: 'create-aisystem',
                label: 'AI System',
                icon: 'robot',
                action: { type: 'create-node', glspType: 'node:aisystem' }
              }
            ]
          },
          {
            id: 'risk',
            label: 'Risk & Controls',
            items: [
              {
                id: 'create-riskregistry',
                label: 'Risk Registry',
                icon: 'warning',
                action: { type: 'create-node', glspType: 'node:riskregistry' }
              },
              {
                id: 'create-controlcatalog',
                label: 'Control Catalog',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:controlcatalog' }
              },
              {
                id: 'create-impactassessment',
                label: 'Impact Assessment',
                icon: 'graph',
                action: { type: 'create-node', glspType: 'node:impactassessment' }
              }
            ]
          },
          {
            id: 'operations',
            label: 'Operations (Clause 8)',
            items: [
              {
                id: 'create-datainventory',
                label: 'Data Inventory',
                icon: 'database',
                action: { type: 'create-node', glspType: 'node:datainventory' }
              },
              {
                id: 'create-supplierregistry',
                label: 'Supplier Registry',
                icon: 'package',
                action: { type: 'create-node', glspType: 'node:supplierregistry' }
              },
              {
                id: 'create-incidentregistry',
                label: 'Incident Registry',
                icon: 'flame',
                action: { type: 'create-node', glspType: 'node:incidentregistry' }
              }
            ]
          },
          {
            id: 'evaluation',
            label: 'Evaluation (Clause 9)',
            items: [
              {
                id: 'create-auditprogram',
                label: 'Audit Program',
                icon: 'search',
                action: { type: 'create-node', glspType: 'node:auditprogram' }
              },
              {
                id: 'create-managementreview',
                label: 'Management Review',
                icon: 'comment-discussion',
                action: { type: 'create-node', glspType: 'node:managementreview' }
              }
            ]
          },
          {
            id: 'improvement',
            label: 'Improvement (Clause 10)',
            items: [
              {
                id: 'create-improvementplan',
                label: 'Improvement Plan',
                icon: 'arrow-up',
                action: { type: 'create-node', glspType: 'node:improvementplan' }
              }
            ]
          },
          {
            id: 'documentation',
            label: 'Documentation',
            items: [
              {
                id: 'create-soa',
                label: 'Statement of Applicability',
                icon: 'file-text',
                action: { type: 'create-node', glspType: 'node:soa' }
              },
              {
                id: 'create-documentregistry',
                label: 'Document Registry',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:documentregistry' }
              }
            ]
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-reference',
                label: 'Reference',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:reference' }
              },
              {
                id: 'create-mitigates',
                label: 'Mitigates',
                icon: 'shield',
                action: { type: 'create-edge', glspType: 'edge:mitigates' }
              }
            ]
          }
        ]
      }
    }
  ]
};
