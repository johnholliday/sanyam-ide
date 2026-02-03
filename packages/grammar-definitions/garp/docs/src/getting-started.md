---
layout: base.njk
title: Getting Started
---

# Getting Started with GARP

This guide will walk you through the basics of the GARP language, from your first organization definition to a complete information governance model.

## Your First GARP File

Create a new file with the `.garp` extension and start by defining your organization:

```garp
organization MyCompany {
    description "My company's information governance program"
    maturity Essential
}
```

This defines an organization at the **Essential** maturity level - meeting minimum requirements for information governance.

## Adding a Policy

Policies define the rules and requirements for managing information. Each policy should address one of the 8 GARP principles:

```garp
policy RecordsRetentionPolicy {
    description "Governs how long different types of records are retained"
    principle Retention
    status Active
    owner "Records Manager"
    effective "2024-01-01"

    requirement MinimumRetention {
        description "All business records must be retained for at least 3 years"
        mandatory true
    }

    requirement LegalHold {
        description "Records under legal hold are exempt from normal disposition"
        mandatory true
    }
}
```

<div class="callout callout-tip">
<strong>Tip:</strong> Use the <code>mandatory true</code> attribute to mark requirements that must be met for compliance.
</div>

## Linking Policies to Organizations

Connect your policies to your organization using the `uses policy` syntax:

```garp
organization MyCompany {
    description "My company's information governance program"
    maturity Essential
    uses policy RecordsRetentionPolicy
}

policy RecordsRetentionPolicy {
    description "Governs how long different types of records are retained"
    principle Retention
    status Active
    owner "Records Manager"
    effective "2024-01-01"
}
```

## Defining Retention Schedules

Retention schedules specify how long different types of records should be kept:

```garp
retention FinancialRecords {
    description "Retention schedule for financial documents"
    recordType "Invoices, Purchase Orders, Financial Statements"
    period "7 years"
    trigger "End of fiscal year"
    legalBasis "IRS Regulations, SOX Compliance"
}

retention HRRecords {
    description "Employee personnel files"
    recordType "Employment Records, Performance Reviews"
    period "7 years after termination"
    trigger "Employee termination date"
    legalBasis "EEOC Regulations, State Employment Laws"
}
```

## Creating Disposition Rules

Disposition rules define how records are handled after their retention period expires:

```garp
disposition FinancialDisposition {
    description "Secure destruction of financial records"
    method Destroy
    approval required
    retention FinancialRecords
}

disposition HRArchival {
    description "Archive terminated employee files"
    method Archive
    retention HRRecords
}
```

The available disposition methods are:
- **Destroy** - Securely destroy the records
- **Archive** - Move to long-term archival storage
- **Transfer** - Transfer to another entity or system
- **Review** - Review for further action

## Conducting an Assessment

Assessments measure your organization's maturity against GARP principles:

```garp
assessment AnnualGARPReview {
    description "Annual GARP maturity assessment"
    date "2024-12-01"
    assessor "InfoGov Consulting Partners"

    // Score each of the 8 principles
    score Accountability : Proactive
        notes "Strong executive sponsorship"
    score Integrity : Essential
        notes "Basic audit trails in place"
    score Protection : Proactive
        notes "Encryption deployed, access controls implemented"
    score Compliance : Essential
        notes "Meeting regulatory requirements"
    score Availability : InDevelopment
        notes "Search capabilities need improvement"
    score Retention : Essential
        notes "Retention schedules exist but not consistently applied"
    score Disposition : SubStandard
        notes "No formal disposition process"
    score Transparency : Essential
        notes "Policies documented but not widely communicated"
}
```

## Adding Findings and Recommendations

Document issues discovered during assessments:

```garp
assessment AnnualGARPReview {
    description "Annual GARP maturity assessment"
    date "2024-12-01"
    assessor "InfoGov Consulting Partners"

    score Disposition : SubStandard
        notes "No formal disposition process"

    finding DispositionGap {
        description "Organization lacks formal disposition procedures"
        principle Disposition
        severity Critical
    }

    recommendation ImplementDisposition {
        description "Establish disposition workflow with approval gates"
        principle Disposition
        priority Immediate
        targetLevel Essential
    }
}
```

## Complete Example

Here's a complete GARP model bringing all concepts together:

```garp
// Retention schedules
retention ContractRecords {
    description "Business contracts and agreements"
    recordType "Vendor Contracts, NDAs, Service Agreements"
    period "10 years after expiration"
    trigger "Contract expiration date"
    legalBasis "Statute of Limitations"
}

// Disposition rules
disposition ContractDisposition {
    description "Secure destruction of expired contracts"
    method Destroy
    approval required
    retention ContractRecords
}

// Policy
policy ContractManagementPolicy {
    description "Policy governing contract lifecycle management"
    principle Retention
    status Active
    owner "Legal Department"
    effective "2024-01-01"

    requirement ContractTracking {
        description "All contracts must be tracked in the CLM system"
        mandatory true
    }

    requirement ExpirationMonitoring {
        description "Contracts approaching expiration must be reviewed"
        mandatory true
    }
}

// Assessment
assessment Q4Review {
    description "Q4 2024 Contract Management Review"
    date "2024-12-15"
    assessor "Internal Audit"

    score Retention : Proactive
        notes "Consistent application of retention schedules"

    finding AutomationGap {
        description "Disposition process is manual and error-prone"
        principle Disposition
        severity Medium
    }

    recommendation AutomateDisposition {
        description "Implement automated disposition workflows"
        principle Disposition
        priority ShortTerm
        targetLevel Proactive
    }
}

// Organization
organization AcmeCorp {
    description "A corporation with strong contract governance"
    maturity Proactive
    uses policy ContractManagementPolicy
    assessed by Q4Review
}
```

## Next Steps

- Explore the [Language Reference](/language-reference/) for complete syntax documentation
- See more [Examples](/examples/) of GARP models
- Learn about the [8 GARP Principles](/#what-is-garp) in detail
