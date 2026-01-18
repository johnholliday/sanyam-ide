---
layout: base.njk
title: Simple Policy
order: 2
---

# Simple Policy

Define a recordkeeping policy with requirements that address a GARP principle.

## Example

```garp
// Basic Example: A simple policy with requirements
// Demonstrates policy structure and nested requirements

policy DataRetentionPolicy {
    description "Basic policy governing data retention practices"
    principle Retention
    status Active
    owner "Records Manager"
    effective "2024-01-01"

    requirement MinimumRetention {
        description "All business records must be retained for minimum 3 years"
        mandatory true
    }

    requirement DocumentedSchedules {
        description "Retention schedules must be documented and approved"
    }
}
```

## Explanation

### Policy Attributes

- **`description`** - Explains the policy's purpose
- **`principle`** - Links to one of the 8 GARP principles (here: `Retention`)
- **`status`** - Current state: `Draft`, `Active`, `UnderReview`, or `Retired`
- **`owner`** - Person or role responsible for the policy
- **`effective`** - Date the policy took effect

### Requirements

Requirements are nested within policies:
- Each requirement has a `name` identifier
- The `description` explains what must be done
- `mandatory true` marks requirements that must be met for compliance

## The 8 GARP Principles

Choose the principle that best matches your policy's focus:

| Principle | Focus Area |
|-----------|------------|
| `Accountability` | Executive oversight, roles & responsibilities |
| `Integrity` | Authenticity, accuracy, audit trails |
| `Protection` | Security, access control, privacy |
| `Compliance` | Laws, regulations, standards |
| `Availability` | Search, retrieval, accessibility |
| `Retention` | How long to keep records |
| `Disposition` | How to dispose of records |
| `Transparency` | Documentation, communication |

## Policy Status Workflow

Policies typically follow this lifecycle:

1. `Draft` - Being written and reviewed
2. `Active` - Approved and in effect
3. `UnderReview` - Being updated or revised
4. `Retired` - No longer applicable

## Next Steps

Connect this policy to an organization:

```garp
organization MyCompany {
    description "My company"
    maturity Essential
    uses policy DataRetentionPolicy
}
```

See the [Organization with Policies](/examples/intermediate-organization/) example for a complete model.
