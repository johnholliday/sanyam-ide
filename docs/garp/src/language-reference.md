---
layout: base.njk
title: Language Reference
---

# Language Reference

Complete reference documentation for the GARP language syntax and semantics.

## Overview

A GARP model consists of one or more top-level elements:

- **Organization** - An entity with a recordkeeping program
- **Policy** - A recordkeeping policy addressing GARP principles
- **Assessment** - An evaluation against GARP principles
- **RetentionSchedule** - Defines how long records are kept
- **DispositionRule** - Defines how records are disposed

## Organizations

An organization represents an entity with an information governance program.

### Syntax

```garp
organization <name> {
    description "<description>"
    maturity <MaturityLevel>
    uses policy <PolicyName>
    assessed by <AssessmentName>
}
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Text description of the organization |
| `maturity` | No | Overall maturity level (see [Maturity Levels](#maturity-levels)) |
| `uses policy` | No | Reference to a Policy (can have multiple) |
| `assessed by` | No | Reference to an Assessment (can have multiple) |

### Example

```garp
organization GlobalEnterprises {
    description "A multinational corporation with mature IG program"
    maturity Proactive
    uses policy DataProtectionPolicy
    uses policy RetentionPolicy
    assessed by AnnualAssessment2024
}
```

## Policies

Policies define governance rules that address specific GARP principles.

### Syntax

```garp
policy <name> {
    description "<description>"
    principle <Principle>
    status <PolicyStatus>
    owner "<owner name>"
    effective "<date>"

    requirement <name> {
        description "<description>"
        mandatory true
    }
}
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Text description of the policy |
| `principle` | No | The GARP principle this policy addresses |
| `status` | No | Current policy status (see [Policy Status](#policy-status)) |
| `owner` | No | Person or role responsible for the policy |
| `effective` | No | Effective date (string format) |

### Requirements

Policies can contain nested `requirement` blocks:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | What the requirement entails |
| `mandatory` | No | Set to `true` for mandatory requirements |

### Example

```garp
policy InformationSecurityPolicy {
    description "Comprehensive policy for protecting information assets"
    principle Protection
    status Active
    owner "Chief Information Security Officer"
    effective "2024-01-01"

    requirement DataClassification {
        description "All information must be classified"
        mandatory true
    }

    requirement EncryptionStandards {
        description "AES-256 encryption required for sensitive data"
        mandatory true
    }

    requirement AccessReview {
        description "Access permissions reviewed quarterly"
    }
}
```

## Assessments

Assessments evaluate an organization's practices against GARP principles and document findings.

### Syntax

```garp
assessment <name> {
    description "<description>"
    date "<date>"
    assessor "<assessor name>"

    score <Principle> : <MaturityLevel>
        notes "<notes>"

    finding <name> {
        description "<description>"
        principle <Principle>
        severity <Severity>
    }

    recommendation <name> {
        description "<description>"
        principle <Principle>
        priority <Priority>
        targetLevel <MaturityLevel>
    }
}
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Assessment scope and purpose |
| `date` | No | Date of assessment |
| `assessor` | No | Person or firm conducting assessment |

### Principle Scores

Score each GARP principle with a maturity level:

```garp
score Accountability : Proactive
    notes "Strong executive sponsorship and oversight"
```

The `notes` attribute is optional and provides context for the score.

### Findings

Document issues or gaps discovered:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | What was found |
| `principle` | No | Related GARP principle |
| `severity` | No | Finding severity (see [Severity Levels](#severity-levels)) |

### Recommendations

Suggest improvements:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Recommended action |
| `principle` | No | Related GARP principle |
| `priority` | No | Implementation priority (see [Priority Levels](#priority-levels)) |
| `targetLevel` | No | Target maturity level after implementation |

### Example

```garp
assessment Q4GARPAudit {
    description "Quarterly GARP compliance assessment"
    date "2024-12-15"
    assessor "External Audit Firm"

    score Accountability : Proactive
        notes "Clear executive sponsorship"
    score Integrity : Essential
        notes "Basic audit trails exist"
    score Protection : Proactive
        notes "Robust security controls"
    score Compliance : Essential
    score Availability : InDevelopment
        notes "Search capabilities limited"
    score Retention : Essential
    score Disposition : SubStandard
        notes "No formal process"
    score Transparency : Essential

    finding DispositionGap {
        description "No formal disposition process exists"
        principle Disposition
        severity Critical
    }

    finding SearchLimitations {
        description "Users cannot easily find records"
        principle Availability
        severity Medium
    }

    recommendation ImplementDisposition {
        description "Establish formal disposition workflow"
        principle Disposition
        priority Immediate
        targetLevel Essential
    }

    recommendation EnhanceSearch {
        description "Implement enterprise search solution"
        principle Availability
        priority ShortTerm
        targetLevel Proactive
    }
}
```

## Retention Schedules

Define how long different types of records should be retained.

### Syntax

```garp
retention <name> {
    description "<description>"
    recordType "<record types covered>"
    period "<retention period>"
    trigger "<retention trigger>"
    legalBasis "<legal or regulatory basis>"
}
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Purpose of this retention schedule |
| `recordType` | No | Types of records covered |
| `period` | No | How long to retain (e.g., "7 years") |
| `trigger` | No | Event that starts retention (e.g., "creation", "termination") |
| `legalBasis` | No | Legal or regulatory requirement |

### Example

```garp
retention HRRecords {
    description "Employee personnel records retention"
    recordType "Personnel Files, Performance Reviews, Disciplinary Records"
    period "7 years after termination"
    trigger "Employee termination date"
    legalBasis "EEOC Regulations, State Employment Laws"
}

retention FinancialRecords {
    description "Financial and tax documentation"
    recordType "Tax Returns, Audit Reports, Financial Statements"
    period "Permanent"
    trigger "Record creation"
    legalBasis "IRS Regulations, SEC Requirements"
}
```

## Disposition Rules

Define how records are disposed after their retention period.

### Syntax

```garp
disposition <name> {
    description "<description>"
    method <DispositionMethod>
    approval required
    retention <RetentionScheduleName>
}
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `description` | No | Description of disposition process |
| `method` | No | How records are disposed (see [Disposition Methods](#disposition-methods)) |
| `approval` | No | Set to `required` if approval needed |
| `retention` | No | Reference to associated retention schedule |

### Example

```garp
disposition HRDestruction {
    description "Secure destruction of HR records"
    method Destroy
    approval required
    retention HRRecords
}

disposition FinancialArchive {
    description "Transfer financial records to permanent archive"
    method Transfer
    approval required
    retention FinancialRecords
}
```

## Principles

The 8 GARP principles:

| Principle | Description |
|-----------|-------------|
| `Accountability` | Senior executive oversight of the IG program |
| `Integrity` | Information authenticity and provenance |
| `Protection` | Appropriate access controls and security |
| `Compliance` | Adherence to laws, regulations, and policies |
| `Availability` | Timely location and retrieval of information |
| `Retention` | Appropriate retention based on requirements |
| `Disposition` | Secure disposal when no longer needed |
| `Transparency` | Documented processes available to stakeholders |

## Maturity Levels

The 5-level maturity model:

| Level | Name | Description |
|-------|------|-------------|
| 1 | `SubStandard` | No formal program; significant risk |
| 2 | `InDevelopment` | Recognizes need; being developed |
| 3 | `Essential` | Minimum requirements met |
| 4 | `Proactive` | Exceeds requirements; continuous improvement |
| 5 | `Transformational` | Industry leader; strategic value |

## Policy Status

| Status | Description |
|--------|-------------|
| `Draft` | Policy is being developed |
| `Active` | Policy is currently in effect |
| `UnderReview` | Policy is being reviewed/updated |
| `Retired` | Policy is no longer in effect |

## Severity Levels

For assessment findings:

| Severity | Description |
|----------|-------------|
| `Critical` | Immediate action required; major compliance risk |
| `High` | Significant issue requiring prompt attention |
| `Medium` | Moderate issue to address in near term |
| `Low` | Minor issue for future improvement |
| `Info` | Informational observation |

## Priority Levels

For recommendations:

| Priority | Description |
|----------|-------------|
| `Immediate` | Address now; critical path |
| `ShortTerm` | Address within 1-3 months |
| `MediumTerm` | Address within 3-12 months |
| `LongTerm` | Address within 1+ years |

## Disposition Methods

| Method | Description |
|--------|-------------|
| `Destroy` | Securely destroy/delete records |
| `Archive` | Move to long-term archival storage |
| `Transfer` | Transfer to another entity or system |
| `Review` | Review for further retention decision |

## Comments

GARP supports both single-line and multi-line comments:

```garp
// This is a single-line comment

/*
 * This is a multi-line comment
 * spanning multiple lines
 */

organization MyOrg {
    description "An organization"  // Inline comment
    maturity Essential
}
```

## Identifiers

Names (identifiers) must:
- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Be unique within their scope

```garp
// Valid identifiers
organization MyOrg { }
policy Data_Protection_Policy { }
retention HR_Records_2024 { }

// Invalid identifiers
// organization 123Org { }      // Cannot start with number
// policy My-Policy { }         // Cannot contain hyphen
```

## Strings

String values are enclosed in double or single quotes:

```garp
description "This is a string with double quotes"
owner 'This is a string with single quotes'
```
