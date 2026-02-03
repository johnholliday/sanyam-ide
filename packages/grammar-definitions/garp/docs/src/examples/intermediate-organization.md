---
layout: base.njk
title: Organization with Policies
order: 4
---

# Organization with Policies

Link multiple policies to an organization to build a comprehensive governance model.

## Example

```garp
// Intermediate Example: Organization with multiple policies
// Demonstrates policy references and requirements within policies

// Define policies first so they can be referenced
policy DataProtectionPolicy {
    description "Policy for protecting sensitive data and PII"
    principle Protection
    status Active
    owner "Information Security Officer"
    effective "2023-06-01"

    requirement EncryptionAtRest {
        description "All sensitive data must be encrypted at rest"
        mandatory true
    }

    requirement EncryptionInTransit {
        description "All data transfers must use TLS 1.2 or higher"
        mandatory true
    }

    requirement AccessControl {
        description "Role-based access control must be implemented"
        mandatory true
    }
}

policy AccountabilityPolicy {
    description "Defines roles and responsibilities for records management"
    principle Accountability
    status Active
    owner "Chief Compliance Officer"
    effective "2023-01-15"

    requirement DesignatedOfficer {
        description "A Records Management Officer must be designated"
        mandatory true
    }

    requirement AnnualReview {
        description "Policies must be reviewed annually"
    }
}

// Organization references the policies
organization TechStartupInc {
    description "A technology startup with strong data governance practices"
    maturity Proactive
    uses policy DataProtectionPolicy
    uses policy AccountabilityPolicy
}
```

## Explanation

### Policy Definition Order

Define policies **before** the organization so they can be referenced:

```garp
// 1. Define policies first
policy MyPolicy { ... }

// 2. Reference in organization
organization MyOrg {
    uses policy MyPolicy
}
```

### Multiple Policies

An organization can reference multiple policies:

```garp
organization MyOrg {
    uses policy DataProtectionPolicy
    uses policy AccountabilityPolicy
    uses policy RetentionPolicy
    uses policy CompliancePolicy
}
```

### Addressing Multiple Principles

A mature information governance program typically has policies addressing all 8 GARP principles:

| Principle | Example Policy |
|-----------|---------------|
| Accountability | Roles & Responsibilities Policy |
| Integrity | Data Quality & Audit Policy |
| Protection | Information Security Policy |
| Compliance | Regulatory Compliance Policy |
| Availability | Information Access Policy |
| Retention | Records Retention Policy |
| Disposition | Records Disposition Policy |
| Transparency | IG Communications Policy |

## Building a Policy Framework

Here's how multiple policies work together:

```garp
// Protection: Security controls
policy SecurityPolicy {
    principle Protection
    status Active
    // ... requirements
}

// Compliance: Regulatory adherence
policy CompliancePolicy {
    principle Compliance
    status Active
    // ... requirements
}

// Retention: How long to keep records
policy RetentionPolicy {
    principle Retention
    status Active
    // ... requirements
}

// Organization uses all policies
organization Enterprise {
    maturity Proactive
    uses policy SecurityPolicy
    uses policy CompliancePolicy
    uses policy RetentionPolicy
}
```

## Next Steps

- Add [assessments](/examples/intermediate-assessment/) to measure maturity
- Define [retention schedules](/examples/basic-retention/) for specific record types
- See the [Complete GARP Program](/examples/advanced-complete/) for a full model
