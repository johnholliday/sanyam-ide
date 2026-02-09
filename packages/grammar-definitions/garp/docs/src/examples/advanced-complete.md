---
layout: base.njk
title: Complete GARP Program
order: 6
---

# Complete GARP Program

A comprehensive example demonstrating all GARP language concepts working together: retention schedules, disposition rules, policies, assessments, and organization.

## Example

```garp
// Advanced Example: A complete GARP information governance program
// Demonstrates all concepts: organization, policies, retention schedules,
// disposition rules, and assessments working together

// ============================================================================
// RETENTION SCHEDULES - Define how long different record types are kept
// ============================================================================

retention HRRecords {
    description "Employee personnel records retention"
    recordType "Personnel Files, Performance Reviews, Disciplinary Records"
    period "7 years after termination"
    trigger "Employee termination date"
    legalBasis "EEOC Regulations, State Employment Laws"
}

retention ContractRecords {
    description "Business contracts and agreements"
    recordType "Vendor Contracts, Customer Agreements, NDAs"
    period "10 years after expiration"
    trigger "Contract expiration or termination"
    legalBasis "Statute of Limitations, SOX Compliance"
}

retention EmailRecords {
    description "Business email communications"
    recordType "Email messages with business value"
    period "3 years"
    trigger "Message date"
    legalBasis "Business Records Retention Best Practices"
}

retention FinancialAuditRecords {
    description "Financial audit and compliance documentation"
    recordType "Audit Reports, Financial Statements, Tax Filings"
    period "Permanent"
    trigger "Record creation"
    legalBasis "SEC Requirements, IRS Regulations"
}

// ============================================================================
// DISPOSITION RULES - Define how records are disposed after retention
// ============================================================================

disposition HRDisposition {
    description "Secure destruction of HR records"
    method Destroy
    approval required
    retention HRRecords
}

disposition ContractArchival {
    description "Archive expired contracts to long-term storage"
    method Archive
    retention ContractRecords
}

disposition EmailPurge {
    description "Automated deletion of aged email"
    method Destroy
    retention EmailRecords
}

disposition AuditPermanentArchive {
    description "Transfer audit records to permanent archive"
    method Transfer
    approval required
    retention FinancialAuditRecords
}

// ============================================================================
// POLICIES - Define governance rules aligned with GARP principles
// ============================================================================

policy InformationSecurityPolicy {
    description "Comprehensive policy for protecting organizational information assets"
    principle Protection
    status Active
    owner "Chief Information Security Officer"
    effective "2024-01-01"

    requirement DataClassification {
        description "All information must be classified: Public, Internal, Confidential, Restricted"
        mandatory true
    }

    requirement EncryptionStandards {
        description "AES-256 encryption required for Confidential and Restricted data"
        mandatory true
    }

    requirement AccessReview {
        description "Access permissions must be reviewed quarterly"
        mandatory true
    }

    requirement IncidentResponse {
        description "Security incidents must be reported within 24 hours"
        mandatory true
    }
}

policy RecordsRetentionPolicy {
    description "Organization-wide policy governing record retention and disposition"
    principle Retention
    status Active
    owner "Records Management Officer"
    effective "2024-01-01"

    requirement RetentionScheduleCompliance {
        description "All business units must follow approved retention schedules"
        mandatory true
    }

    requirement LegalHoldProcess {
        description "Legal holds suspend normal disposition until released"
        mandatory true
    }

    requirement DispositionApproval {
        description "Records disposition requires documented approval"
        mandatory true
    }
}

policy TransparencyPolicy {
    description "Policy ensuring stakeholders have visibility into information governance"
    principle Transparency
    status Active
    owner "Chief Compliance Officer"
    effective "2024-03-01"

    requirement PolicyPublication {
        description "All IG policies must be published on the corporate intranet"
        mandatory true
    }

    requirement TrainingProgram {
        description "Annual IG training required for all employees"
        mandatory true
    }

    requirement MetricsReporting {
        description "Quarterly IG metrics reported to executive leadership"
    }
}

policy CompliancePolicy {
    description "Policy ensuring adherence to regulatory requirements"
    principle Compliance
    status Active
    owner "Chief Compliance Officer"
    effective "2024-01-15"

    requirement RegulatoryMonitoring {
        description "Monitor regulatory changes affecting records management"
        mandatory true
    }

    requirement AuditReadiness {
        description "Maintain audit-ready documentation at all times"
        mandatory true
    }
}

// ============================================================================
// ASSESSMENTS - Track maturity and improvement over time
// ============================================================================

assessment AnnualGARPAssessment2024 {
    description "Annual comprehensive GARP maturity assessment"
    date "2024-11-30"
    assessor "InfoGov Consulting Partners LLP"

    score Accountability : Transformational
        notes "Executive-level sponsorship, dedicated RIM team, board oversight"

    score Integrity : Proactive
        notes "Strong audit trails, metadata governance program in place"

    score Protection : Proactive
        notes "Comprehensive security controls, encryption deployed"

    score Compliance : Proactive
        notes "Proactive regulatory monitoring, strong audit performance"

    score Availability : Essential
        notes "Basic search capabilities, room for improvement"

    score Retention : Proactive
        notes "Retention schedules applied consistently across systems"

    score Disposition : Essential
        notes "Formal disposition process established, needs automation"

    score Transparency : Proactive
        notes "Policies published, training program active, metrics reported"

    finding AvailabilityImprovement {
        description "Enterprise search does not index all repositories"
        principle Availability
        severity Medium
    }

    finding DispositionAutomation {
        description "Disposition process is manual and labor-intensive"
        principle Disposition
        severity Low
    }

    recommendation EnterpriseSearchExpansion {
        description "Expand enterprise search to include SharePoint and file shares"
        principle Availability
        priority ShortTerm
        targetLevel Proactive
    }

    recommendation AutomatedDisposition {
        description "Implement automated disposition workflows with approval routing"
        principle Disposition
        priority MediumTerm
        targetLevel Proactive
    }
}

// ============================================================================
// ORGANIZATION - Ties everything together
// ============================================================================

organization GlobalEnterprisesCorp {
    description "A multinational corporation with mature information governance"
    maturity Proactive

    // Reference all governance policies
    uses policy InformationSecurityPolicy
    uses policy RecordsRetentionPolicy
    uses policy TransparencyPolicy
    uses policy CompliancePolicy

    // Reference assessments
    assessed by AnnualGARPAssessment2024
}
```

## Structure Overview

This complete model demonstrates:

### 1. Retention Schedules
Four schedules covering different record types:
- HR records (7 years after termination)
- Contracts (10 years after expiration)
- Email (3 years)
- Financial/Audit (Permanent)

### 2. Disposition Rules
Four rules linked to retention schedules:
- Destruction for HR and email
- Archival for contracts
- Transfer for permanent records

### 3. Policies
Four policies addressing different GARP principles:
- Protection (Information Security)
- Retention (Records Retention)
- Transparency (Stakeholder Communication)
- Compliance (Regulatory Adherence)

### 4. Assessment
Comprehensive annual assessment including:
- Scores for all 8 principles
- Findings identifying gaps
- Recommendations for improvement

### 5. Organization
Ties everything together:
- Overall maturity level
- References to all policies
- Reference to assessment

## Key Relationships

```
Organization
├── uses policy InformationSecurityPolicy (Protection)
├── uses policy RecordsRetentionPolicy (Retention)
├── uses policy TransparencyPolicy (Transparency)
├── uses policy CompliancePolicy (Compliance)
└── assessed by AnnualGARPAssessment2024
         ├── scores all 8 principles
         ├── documents findings
         └── provides recommendations

Retention Schedules → Disposition Rules
├── HRRecords → HRDisposition (Destroy)
├── ContractRecords → ContractArchival (Archive)
├── EmailRecords → EmailPurge (Destroy)
└── FinancialAuditRecords → AuditPermanentArchive (Transfer)
```

## Best Practices Demonstrated

1. **Define dependencies first** - Retention schedules before dispositions, policies before organization
2. **Use comments** - Section headers improve readability
3. **Complete coverage** - Address all relevant principles
4. **Document rationale** - Notes explain scores and decisions
5. **Link related elements** - Dispositions reference retention, organization references policies
6. **Prioritize improvements** - Recommendations have priorities and target levels
