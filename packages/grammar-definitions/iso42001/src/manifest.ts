/**
 * ISO 42001 Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for ISO/IEC 42001:2023 AI Management System assessments.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * ISO 42001 Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: 'iso42001',
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
    industry TECHNOLOGY
    size MEDIUM

    context {
        internal {
            issue InternalIssue1 {
                description "Internal context issue"
                category ORGANIZATIONAL
                relevance HIGH
            }
        }
        external {
            issue ExternalIssue1 {
                description "External context issue"
                category REGULATORY
                relevance HIGH
            }
        }
    }
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
      astType: 'AIManagementSystem',
      displayName: 'AI Management System',
      fileSuffix: '.aims',
      folder: 'aims',
      icon: 'shield',
      template: `aims \${name} {
    version "1.0"

    scope {
        description "Scope of the AI Management System"
    }

    policy {
        statement "AI policy statement"
        principles {
            principle Fairness {
                description "Ensure fair and unbiased AI systems"
                category FAIRNESS
            }
            principle Transparency {
                description "Maintain transparency in AI operations"
                category TRANSPARENCY
            }
        }
    }

    objectives {
        objective Objective1 {
            description "AI management objective"
            status NOT_STARTED
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'AIMS Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:aimanagementystem',
        shape: 'rectangle',
        cssClass: 'aims-node',
        defaultSize: { width: 200, height: 100 },
      },
    },
    {
      astType: 'AISystem',
      displayName: 'AI System',
      fileSuffix: '.aisystem',
      folder: 'aisystems',
      icon: 'symbol-class',
      template: `aiSystem \${name} {
    description "AI system description"
    version "1.0"
    status DEVELOPMENT

    classification {
        type MACHINE_LEARNING
        riskLevel LIMITED
        autonomyLevel HUMAN_IN_THE_LOOP
    }

    purpose {
        intendedUse "Intended use description"
    }

    lifecycle {
        stage DEVELOPMENT
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'AI System Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:aisystem',
        shape: 'rectangle',
        cssClass: 'aisystem-node',
        defaultSize: { width: 180, height: 80 },
      },
    },
    {
      astType: 'StakeholderRegistry',
      displayName: 'Stakeholder Registry',
      fileSuffix: '.stakeholders',
      folder: 'stakeholders',
      icon: 'person',
      template: `stakeholderRegistry \${name} {
    description "Registry of stakeholders"

    stakeholder Customer {
        type CUSTOMER
        description "Primary customers"
        influence HIGH
        interest HIGH
    }

    stakeholder Regulator {
        type REGULATOR
        description "Regulatory bodies"
        influence VERY_HIGH
        interest HIGH
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:stakeholderregistry',
        shape: 'rectangle',
        cssClass: 'stakeholder-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'ControlCatalog',
      displayName: 'Control Catalog',
      fileSuffix: '.controls',
      folder: 'controls',
      icon: 'checklist',
      template: `controlCatalog \${name} {
    description "Control catalog for ISO 42001 compliance"
    version "1.0"
    basedOn "ISO/IEC 42001:2023 Annex A"

    family AIGovernance {
        title "AI Governance Controls"
        description "Controls for AI governance and accountability"

        control AIPolicy {
            title "AI Policy"
            objective "Establish and maintain AI policy"
            implementation {
                status NOT_IMPLEMENTED
            }
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Catalog Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:controlcatalog',
        shape: 'rectangle',
        cssClass: 'control-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'RiskRegistry',
      displayName: 'Risk Registry',
      fileSuffix: '.risks',
      folder: 'risks',
      icon: 'warning',
      template: `riskRegistry \${name} {
    description "AI risk registry"
    methodology "ISO 31000 aligned risk assessment"

    risk AlgorithmBias {
        description "Risk of algorithmic bias in AI outputs"
        category ETHICAL
        source ALGORITHM_BIAS

        assessment {
            likelihood POSSIBLE
            impact MAJOR
            inherentRisk HIGH
        }

        treatment {
            strategy MITIGATE
            description "Implement bias testing and monitoring"
            status PLANNED
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:riskregistry',
        shape: 'rectangle',
        cssClass: 'risk-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'ImpactAssessment',
      displayName: 'Impact Assessment',
      fileSuffix: '.impact',
      folder: 'impacts',
      icon: 'graph',
      template: `impactAssessment \${name} {
    aiSystem SystemRef
    assessmentDate 2024-01-15
    assessor "Assessment Team"
    status DRAFT

    context {
        intendedUse "Description of intended use"
    }

    individualImpacts {
        impact PrivacyImpact {
            description "Potential privacy impact"
            type PRIVACY
            severity MODERATE
            likelihood POSSIBLE
        }
    }

    conclusion {
        summary "Assessment summary"
        overallRiskLevel LIMITED
        decision PROCEED_WITH_CONDITIONS
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Assessment Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:impactassessment',
        shape: 'rectangle',
        cssClass: 'impact-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'AuditProgram',
      displayName: 'Audit Program',
      fileSuffix: '.audits',
      folder: 'audits',
      icon: 'search',
      template: `auditProgram \${name} {
    description "Annual audit program"
    year 2024
    objectives "Verify conformity with ISO 42001 requirements"

    audit InternalAudit1 {
        type INTERNAL
        scope "Full AIMS scope"
        plannedDate 2024-06-01
        status PLANNED
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Program Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:auditprogram',
        shape: 'rectangle',
        cssClass: 'audit-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'StatementOfApplicability',
      displayName: 'Statement of Applicability',
      fileSuffix: '.soa',
      folder: 'soa',
      icon: 'file-text',
      template: `soa \${name} {
    version "1.0"
    date 2024-01-15
    approvedBy "Management Representative"
}
`,
      templateInputs: [
        { id: 'name', label: 'SOA Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:statementofapplicability',
        shape: 'rectangle',
        cssClass: 'soa-node',
        defaultSize: { width: 200, height: 60 },
      },
    },
    {
      astType: 'DocumentRegistry',
      displayName: 'Document Registry',
      fileSuffix: '.documents',
      folder: 'documents',
      icon: 'file',
      template: `documentRegistry \${name} {
    description "AIMS document registry"

    document AIPolicy {
        title "AI Policy Document"
        type POLICY
        version "1.0"
        status APPROVED
        owner "Management Representative"
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:documentregistry',
        shape: 'rectangle',
        cssClass: 'document-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'ImprovementPlan',
      displayName: 'Improvement Plan',
      fileSuffix: '.improvement',
      folder: 'improvements',
      icon: 'arrow-up',
      template: `improvementPlan \${name} {
    description "Continual improvement plan"

    period {
        startDate 2024-01-01
        endDate 2024-12-31
    }

    initiatives {
        initiative AIMaturity {
            title "AI Capability Maturity Improvement"
            description "Improve AI management maturity"
            type CAPABILITY_BUILDING
            priority HIGH
            status PROPOSED
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Plan Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:improvementplan',
        shape: 'rectangle',
        cssClass: 'improvement-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'DataInventory',
      displayName: 'Data Inventory',
      fileSuffix: '.data',
      folder: 'data',
      icon: 'database',
      template: `dataInventory \${name} {
    description "AI data inventory"

    dataset TrainingData {
        description "Primary training dataset"
        purpose TRAINING

        acquisition {
            source "Internal systems"
            legalBasis LEGITIMATE_INTERESTS
        }

        quality {
            completeness GOOD
            accuracy GOOD
            overallRating MEDIUM
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Inventory Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:datainventory',
        shape: 'rectangle',
        cssClass: 'data-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'SupplierRegistry',
      displayName: 'Supplier Registry',
      fileSuffix: '.suppliers',
      folder: 'suppliers',
      icon: 'package',
      template: `supplierRegistry \${name} {
    description "AI supplier registry"

    supplier CloudProvider {
        companyName "Cloud AI Provider"
        type CLOUD_PROVIDER
        criticality CRITICAL
        riskLevel MEDIUM

        dueDiligence {
            aiPoliciesReviewed [X]
            securityAssessed [X]
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:supplierregistry',
        shape: 'rectangle',
        cssClass: 'supplier-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'IncidentRegistry',
      displayName: 'Incident Registry',
      fileSuffix: '.incidents',
      folder: 'incidents',
      icon: 'zap',
      template: `incidentRegistry \${name} {
    description "AI incident registry"

    incident Incident001 {
        description "AI incident description"
        detectedDate 2024-01-15
        severity MEDIUM
        status DETECTED

        classification {
            type UNINTENDED_BEHAVIOR
            rootCause MODEL_ISSUE
        }
    }
}
`,
      templateInputs: [
        { id: 'name', label: 'Registry Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:incidentregistry',
        shape: 'rectangle',
        cssClass: 'incident-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
    {
      astType: 'ManagementReview',
      displayName: 'Management Review',
      fileSuffix: '.review',
      folder: 'reviews',
      icon: 'note',
      template: `managementReview \${name} {
    date 2024-06-15
    chairperson "CEO"
    participants { "CTO", "CISO", "AI Lead" }

    inputs {
        aimsPerformance "AIMS performance summary"
        auditResults "Internal audit results"
        riskAssessmentResults "Updated risk assessment"
    }

    outputs {
        decision ImprovementDecision {
            description "Decision to improve AI governance"
            type IMPROVEMENT
            status PENDING
        }
    }

    nextReviewDate 2024-12-15
}
`,
      templateInputs: [
        { id: 'name', label: 'Review Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:managementreview',
        shape: 'rectangle',
        cssClass: 'review-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'iso42001-overview',
      displayName: 'ISO 42001 Overview',
      fileType: 'AssessmentModel',
      nodeTypes: [
        { glspType: 'node:organization', creatable: true, showable: true },
        { glspType: 'node:aimanagementystem', creatable: true, showable: true },
        { glspType: 'node:aisystem', creatable: true, showable: true },
        { glspType: 'node:stakeholderregistry', creatable: true, showable: true },
        { glspType: 'node:controlcatalog', creatable: true, showable: true },
        { glspType: 'node:riskregistry', creatable: true, showable: true },
        { glspType: 'node:impactassessment', creatable: true, showable: true },
        { glspType: 'node:auditprogram', creatable: true, showable: true },
        { glspType: 'node:statementofapplicability', creatable: true, showable: true },
        { glspType: 'node:documentregistry', creatable: true, showable: true },
        { glspType: 'node:improvementplan', creatable: true, showable: true },
        { glspType: 'node:datainventory', creatable: true, showable: true },
        { glspType: 'node:supplierregistry', creatable: true, showable: true },
        { glspType: 'node:incidentregistry', creatable: true, showable: true },
        { glspType: 'node:managementreview', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true },
        { glspType: 'edge:reference', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'context',
            label: 'Context',
            items: [
              {
                id: 'create-organization',
                label: 'Organization',
                icon: 'organization',
                action: { type: 'create-node', glspType: 'node:organization' },
              },
              {
                id: 'create-stakeholderregistry',
                label: 'Stakeholder Registry',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:stakeholderregistry' },
              },
            ],
          },
          {
            id: 'aims',
            label: 'AIMS',
            items: [
              {
                id: 'create-aimanagementystem',
                label: 'AI Management System',
                icon: 'shield',
                action: { type: 'create-node', glspType: 'node:aimanagementystem' },
              },
              {
                id: 'create-aisystem',
                label: 'AI System',
                icon: 'symbol-class',
                action: { type: 'create-node', glspType: 'node:aisystem' },
              },
            ],
          },
          {
            id: 'risk-control',
            label: 'Risk & Control',
            items: [
              {
                id: 'create-controlcatalog',
                label: 'Control Catalog',
                icon: 'checklist',
                action: { type: 'create-node', glspType: 'node:controlcatalog' },
              },
              {
                id: 'create-riskregistry',
                label: 'Risk Registry',
                icon: 'warning',
                action: { type: 'create-node', glspType: 'node:riskregistry' },
              },
              {
                id: 'create-impactassessment',
                label: 'Impact Assessment',
                icon: 'graph',
                action: { type: 'create-node', glspType: 'node:impactassessment' },
              },
            ],
          },
          {
            id: 'audit-compliance',
            label: 'Audit & Compliance',
            items: [
              {
                id: 'create-auditprogram',
                label: 'Audit Program',
                icon: 'search',
                action: { type: 'create-node', glspType: 'node:auditprogram' },
              },
              {
                id: 'create-statementofapplicability',
                label: 'Statement of Applicability',
                icon: 'file-text',
                action: { type: 'create-node', glspType: 'node:statementofapplicability' },
              },
            ],
          },
          {
            id: 'data-suppliers',
            label: 'Data & Suppliers',
            items: [
              {
                id: 'create-datainventory',
                label: 'Data Inventory',
                icon: 'database',
                action: { type: 'create-node', glspType: 'node:datainventory' },
              },
              {
                id: 'create-supplierregistry',
                label: 'Supplier Registry',
                icon: 'package',
                action: { type: 'create-node', glspType: 'node:supplierregistry' },
              },
            ],
          },
          {
            id: 'improvement',
            label: 'Improvement',
            items: [
              {
                id: 'create-improvementplan',
                label: 'Improvement Plan',
                icon: 'arrow-up',
                action: { type: 'create-node', glspType: 'node:improvementplan' },
              },
              {
                id: 'create-incidentregistry',
                label: 'Incident Registry',
                icon: 'zap',
                action: { type: 'create-node', glspType: 'node:incidentregistry' },
              },
              {
                id: 'create-managementreview',
                label: 'Management Review',
                icon: 'note',
                action: { type: 'create-node', glspType: 'node:managementreview' },
              },
            ],
          },
          {
            id: 'documentation',
            label: 'Documentation',
            items: [
              {
                id: 'create-documentregistry',
                label: 'Document Registry',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:documentregistry' },
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
  ],
};

export default manifest;
