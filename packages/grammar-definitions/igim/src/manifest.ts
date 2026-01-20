/**
 * IGIM Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for the Information Governance Implementation Model.
 *
 * Based on ARMA International's seven-area IGIM framework.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * IGIM Grammar Manifest
 */
export const manifest: GrammarManifest = {
  languageId: 'igim',
  displayName: 'Information Governance Implementation Model',
  summary: 'A domain-specific language for implementing ARMA International\'s seven-area Information Governance Implementation Model, covering steering committees, authorities, processes, and infrastructure.',
  tagline: 'Govern information systematically',
  keyFeatures: [
    { feature: 'Seven-Area Framework', description: 'Model all IGIM areas from steering to infrastructure' },
    { feature: 'Maturity Assessment', description: 'Assess and track IG program maturity' },
    { feature: 'Risk Management', description: 'Document and manage information risks' },
    { feature: 'Process Documentation', description: 'Define IG processes with metrics and steps' },
    { feature: 'Visual Governance', description: 'Visualize IG program components and dependencies' },
  ],
  coreConcepts: [
    { concept: 'IGProgram', description: 'The top-level information governance program' },
    { concept: 'SteeringCommittee', description: 'The IG leadership and governance body' },
    { concept: 'Authority', description: 'Regulatory and compliance requirements' },
    { concept: 'Process', description: 'An IG process with steps and metrics' },
    { concept: 'Capability', description: 'An information lifecycle capability' },
    { concept: 'Infrastructure', description: 'Technology supporting IG activities' },
  ],
  quickExample: `program EnterpriseIG {
  description "Enterprise Information Governance"
  maturity developing

  committee IGBoard {
    description "IG Steering Committee"
    meets monthly
  }
}`,
  fileExtension: '.igim',
  baseExtension: '.igim',
  rootTypes: [
    // Entry point - IG Program
    {
      astType: 'IGProgram',
      displayName: 'IG Program',
      fileSuffix: '.program',
      folder: 'programs',
      icon: 'briefcase',
      template: `program \${name} {
  description "Information Governance Program"
  maturity initial

  // Add steering committee, authorities, supports, processes,
  // capabilities, structures, and infrastructure elements
}
`,
      templateInputs: [
        { id: 'name', label: 'Program Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:igprogram',
        shape: 'rectangle',
        cssClass: 'igprogram-node',
        defaultSize: { width: 200, height: 80 },
      },
    },

    // 1. Steering Committee
    {
      astType: 'SteeringCommittee',
      displayName: 'Steering Committee',
      fileSuffix: '.committee',
      folder: 'committees',
      icon: 'organization',
      template: `committee \${name} {
  description "IG leadership team"
  meets monthly

  // Add chair and members
  responsibilities {
    "Provide strategic direction for IG program"
    "Review and approve IG policies"
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Committee Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:steeringcommittee',
        shape: 'rectangle',
        cssClass: 'steeringcommittee-node',
        defaultSize: { width: 180, height: 70 },
      },
    },

    // Stakeholder
    {
      astType: 'Stakeholder',
      displayName: 'Stakeholder',
      fileSuffix: '.stakeholder',
      folder: 'stakeholders',
      icon: 'person',
      template: `stakeholder \${name} {
  title "Title"
  department "Department"
  role business
}
`,
      templateInputs: [
        { id: 'name', label: 'Stakeholder Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:stakeholder',
        shape: 'ellipse',
        cssClass: 'stakeholder-node',
        defaultSize: { width: 120, height: 60 },
      },
    },

    // 2. Authority
    {
      astType: 'Authority',
      displayName: 'Authority',
      fileSuffix: '.authority',
      folder: 'authorities',
      icon: 'law',
      template: `authority \${name} {
  description "Regulatory or compliance authority"
  type regulation
  source "Source organization"

  requirements {
    requirement req1 {
      text "Requirement description"
      priority medium
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Authority Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:authority',
        shape: 'hexagon',
        cssClass: 'authority-node',
        defaultSize: { width: 160, height: 70 },
      },
    },

    // Risk
    {
      astType: 'Risk',
      displayName: 'Risk',
      fileSuffix: '.risk',
      folder: 'risks',
      icon: 'warning',
      template: `risk \${name} {
  description "Risk description"
  category compliance
  likelihood medium
  impact medium
  tolerance low
}
`,
      templateInputs: [
        { id: 'name', label: 'Risk Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:risk',
        shape: 'diamond',
        cssClass: 'risk-node',
        defaultSize: { width: 140, height: 70 },
      },
    },

    // 3. Support
    {
      astType: 'Support',
      displayName: 'Support',
      fileSuffix: '.support',
      folder: 'supports',
      icon: 'tools',
      template: `support \${name} {
  description "Organizational support structure"
  type training
  status planned

  activities {
    activity training-session {
      description "Training session activity"
      frequency quarterly
      audience "All employees"
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Support Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:support',
        shape: 'rectangle',
        cssClass: 'support-node',
        defaultSize: { width: 150, height: 60 },
      },
    },

    // 4. Process
    {
      astType: 'Process',
      displayName: 'Process',
      fileSuffix: '.process',
      folder: 'processes',
      icon: 'git-merge',
      template: `process \${name} {
  description "IG process definition"
  type procedure
  status planned

  metrics {
    metric completion-rate {
      description "Percentage of completion"
      target "95%"
      frequency monthly
    }
  }

  steps {
    step 1 initiate {
      description "Initiate the process"
    }
    step 2 execute {
      description "Execute main activities"
    }
    step 3 review {
      description "Review results"
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Process Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:process',
        shape: 'rectangle',
        cssClass: 'process-node',
        defaultSize: { width: 160, height: 70 },
      },
    },

    // Policy Document
    {
      astType: 'PolicyDocument',
      displayName: 'Policy Document',
      fileSuffix: '.document',
      folder: 'documents',
      icon: 'file',
      template: `document \${name} {
  title "Document Title"
  type policy
  version "1.0"
  status draft
}
`,
      templateInputs: [
        { id: 'name', label: 'Document Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:policydocument',
        shape: 'rectangle',
        cssClass: 'policydocument-node',
        defaultSize: { width: 140, height: 50 },
      },
    },

    // 5. Capability
    {
      astType: 'Capability',
      displayName: 'Capability',
      fileSuffix: '.capability',
      folder: 'capabilities',
      icon: 'lightbulb',
      template: `capability \${name} {
  description "Information lifecycle capability"
  type lifecycle
  status planned
  maturity initial

  lifecycleStages {
    stage creation {
      description "Information creation stage"
      phase creation
      controls {
        "Classification at point of creation"
        "Metadata capture"
      }
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Capability Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:capability',
        shape: 'ellipse',
        cssClass: 'capability-node',
        defaultSize: { width: 160, height: 70 },
      },
    },

    // 6. Structure
    {
      astType: 'Structure',
      displayName: 'Structure',
      fileSuffix: '.structure',
      folder: 'structures',
      icon: 'type-hierarchy',
      template: `structure \${name} {
  description "Information organization structure"
  type taxonomy
  status planned

  elements {
    element root {
      description "Root element"
      properties {
        code: "ROOT"
      }
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Structure Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:structure',
        shape: 'hexagon',
        cssClass: 'structure-node',
        defaultSize: { width: 150, height: 65 },
      },
    },

    // 7. Infrastructure
    {
      astType: 'Infrastructure',
      displayName: 'Infrastructure',
      fileSuffix: '.infrastructure',
      folder: 'infrastructure',
      icon: 'server',
      template: `infrastructure \${name} {
  description "Technology infrastructure component"
  type application
  status planned
  vendor "Vendor Name"
  sla "99.9% uptime"

  securityControls {
    control access-ctrl {
      description "Access control mechanism"
      type access-control
      status implemented
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Infrastructure Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:infrastructure',
        shape: 'rectangle',
        cssClass: 'infrastructure-node',
        defaultSize: { width: 160, height: 70 },
      },
    },

    // Maturity Assessment
    {
      astType: 'MaturityAssessment',
      displayName: 'Maturity Assessment',
      fileSuffix: '.assessment',
      folder: 'assessments',
      icon: 'graph',
      template: `assessment \${name} {
  date "2024-01-01"
  overallMaturity initial

  ratings {
    steeringCommittee initial
    authorities initial
    supports initial
    processes initial
    capabilities initial
    structures initial
    infrastructure initial
  }

  findings {
    finding gap1 {
      area steering-committee
      description "Finding description"
      recommendation "Recommendation"
      priority high
    }
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Assessment Name', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:maturityassessment',
        shape: 'rectangle',
        cssClass: 'maturityassessment-node',
        defaultSize: { width: 180, height: 70 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'igim-overview',
      displayName: 'IGIM Overview',
      fileType: 'Model',
      nodeTypes: [
        { glspType: 'node:igprogram', creatable: true, showable: true },
        { glspType: 'node:steeringcommittee', creatable: true, showable: true },
        { glspType: 'node:stakeholder', creatable: true, showable: true },
        { glspType: 'node:authority', creatable: true, showable: true },
        { glspType: 'node:risk', creatable: true, showable: true },
        { glspType: 'node:support', creatable: true, showable: true },
        { glspType: 'node:process', creatable: true, showable: true },
        { glspType: 'node:policydocument', creatable: true, showable: true },
        { glspType: 'node:capability', creatable: true, showable: true },
        { glspType: 'node:structure', creatable: true, showable: true },
        { glspType: 'node:infrastructure', creatable: true, showable: true },
        { glspType: 'node:maturityassessment', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:connection', creatable: true, showable: true },
        { glspType: 'edge:dependency', creatable: true, showable: true },
        { glspType: 'edge:reference', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'governance',
            label: 'Governance',
            items: [
              {
                id: 'create-igprogram',
                label: 'IG Program',
                icon: 'briefcase',
                action: { type: 'create-node', glspType: 'node:igprogram' },
              },
              {
                id: 'create-steeringcommittee',
                label: 'Steering Committee',
                icon: 'organization',
                action: { type: 'create-node', glspType: 'node:steeringcommittee' },
              },
              {
                id: 'create-stakeholder',
                label: 'Stakeholder',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:stakeholder' },
              },
            ],
          },
          {
            id: 'compliance',
            label: 'Compliance',
            items: [
              {
                id: 'create-authority',
                label: 'Authority',
                icon: 'law',
                action: { type: 'create-node', glspType: 'node:authority' },
              },
              {
                id: 'create-risk',
                label: 'Risk',
                icon: 'warning',
                action: { type: 'create-node', glspType: 'node:risk' },
              },
            ],
          },
          {
            id: 'operations',
            label: 'Operations',
            items: [
              {
                id: 'create-support',
                label: 'Support',
                icon: 'tools',
                action: { type: 'create-node', glspType: 'node:support' },
              },
              {
                id: 'create-process',
                label: 'Process',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:process' },
              },
              {
                id: 'create-policydocument',
                label: 'Policy Document',
                icon: 'file',
                action: { type: 'create-node', glspType: 'node:policydocument' },
              },
            ],
          },
          {
            id: 'information',
            label: 'Information',
            items: [
              {
                id: 'create-capability',
                label: 'Capability',
                icon: 'lightbulb',
                action: { type: 'create-node', glspType: 'node:capability' },
              },
              {
                id: 'create-structure',
                label: 'Structure',
                icon: 'type-hierarchy',
                action: { type: 'create-node', glspType: 'node:structure' },
              },
            ],
          },
          {
            id: 'technology',
            label: 'Technology',
            items: [
              {
                id: 'create-infrastructure',
                label: 'Infrastructure',
                icon: 'server',
                action: { type: 'create-node', glspType: 'node:infrastructure' },
              },
            ],
          },
          {
            id: 'assessment',
            label: 'Assessment',
            items: [
              {
                id: 'create-maturityassessment',
                label: 'Maturity Assessment',
                icon: 'graph',
                action: { type: 'create-node', glspType: 'node:maturityassessment' },
              },
            ],
          },
          {
            id: 'edges',
            label: 'Connections',
            items: [
              {
                id: 'create-connection',
                label: 'Connection',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:connection' },
              },
              {
                id: 'create-dependency',
                label: 'Dependency',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:dependency' },
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
