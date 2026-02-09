---
title: "Profile with Mappings"
description: "Implementation profile with maturity tier mappings"
layout: layouts/doc.njk
eleventyNavigation:
  key: Profile with Mappings
  parent: Examples
  order: 5
---

# Profile with Mappings

An implementation profile demonstrating maturity tier mappings to subcategories.

## The Code

```nist-csf
// Intermediate Example: Profile with subcategory mappings to implementation tiers
// Demonstrates the Profile and ProfileMapping constructs

// First define the subcategories that will be referenced
subcategory PhysicalDevices {
    id "ID.AM-1"
    description "Physical devices and systems within the organization are inventoried"
}

subcategory SoftwarePlatforms {
    id "ID.AM-2"
    description "Software platforms and applications within the organization are inventoried"
}

subcategory IncidentResponse {
    id "RS.RP-1"
    description "Response plan is executed during or after an incident"
}

// Profile with mappings to the defined subcategories
profile ManufacturingBaseline {
    description "Manufacturing sector CSF implementation profile"
    target "Manufacturing Organizations"

    mapping PhysicalDevices -> Repeatable
        notes "Critical for OT/IT asset visibility"

    mapping SoftwarePlatforms -> RiskInformed
        notes "Software inventory process established"

    mapping IncidentResponse -> Adaptive
        notes "Mature incident response capability"
}
```

## What This Demonstrates

### Profile Declaration

The `profile` keyword declares an implementation profile:

```nist-csf
profile ManufacturingBaseline {
    description "..."
    target "..."
}
```

### Profile Properties

| Property | Purpose |
|----------|---------|
| `description` | What this profile represents |
| `target` | Intended audience or sector |

### Profile Mappings

Mappings connect subcategories to implementation tiers:

```nist-csf
mapping PhysicalDevices -> Repeatable
    notes "Critical for OT/IT asset visibility"
```

### Cross-References

Mappings reference subcategories by name. The subcategory must be defined elsewhere in the file:

```nist-csf
// Define the subcategory first
subcategory PhysicalDevices {
    id "ID.AM-1"
    description "..."
}

// Then reference it in the mapping
profile MyProfile {
    mapping PhysicalDevices -> Repeatable
}
```

### Implementation Tiers

The four maturity tiers represent organizational capability:

| Tier | Name | Description |
|------|------|-------------|
| 1 | `Partial` | Ad hoc, reactive responses |
| 2 | `RiskInformed` | Approved but not organization-wide |
| 3 | `Repeatable` | Formal policies, consistent practice |
| 4 | `Adaptive` | Continuous improvement, predictive |

## Common Patterns

### Sector-Specific Profile

```nist-csf
// Healthcare sector subcategories
subcategory PatientDataProtection {
    id "PR.DS-01"
    description "Protected health information is secured"
}

subcategory AccessControls {
    id "PR.AA-01"
    description "Access to patient systems is managed"
}

subcategory IncidentReporting {
    id "RS.MA-01"
    description "Breach notification procedures are followed"
}

profile HealthcareBaseline {
    description "Healthcare sector CSF profile for HIPAA compliance"
    target "Healthcare Organizations"

    mapping PatientDataProtection -> Adaptive
        notes "HIPAA requires strong PHI protection"

    mapping AccessControls -> Repeatable
        notes "Role-based access implemented"

    mapping IncidentReporting -> Repeatable
        notes "60-day breach notification process"
}
```

### Current vs Target Profile

```nist-csf
subcategory AssetInventory {
    id "ID.AM-01"
    description "Hardware inventory maintained"
}

subcategory NetworkMonitoring {
    id "DE.CM-01"
    description "Networks are monitored"
}

// Current state assessment
profile CurrentState {
    description "Current organizational maturity assessment"
    target "Internal Assessment"

    mapping AssetInventory -> RiskInformed
        notes "Partial automation in place"

    mapping NetworkMonitoring -> Partial
        notes "Basic logging only"
}

// Target state for improvement
profile TargetState {
    description "Target maturity for next fiscal year"
    target "Internal Planning"

    mapping AssetInventory -> Repeatable
        notes "Full automation planned"

    mapping NetworkMonitoring -> RiskInformed
        notes "SIEM deployment scheduled"
}
```

### Gap Analysis Pattern

Use two profiles to identify gaps:

```nist-csf
subcategory IdentityManagement {
    id "PR.AA-01"
    description "Identities are managed"
}

profile Current {
    description "Current state"
    target "Assessment"

    mapping IdentityManagement -> Partial
        notes "Manual provisioning"
}

profile Target {
    description "Target state"
    target "Planning"

    mapping IdentityManagement -> Adaptive
        notes "Zero trust implementation"
}

// Gap: Partial -> Adaptive (3 tier improvement needed)
```

## Next Steps

- [Complete Framework](/examples/advanced-complete-framework/) - See profiles in context with full framework
- [Tutorial](/language/tutorial/) - Build a complete implementation step by step
