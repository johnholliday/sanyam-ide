---
title: "Quick Reference"
description: "NIST CSF syntax cheatsheet - all patterns at a glance"
layout: layouts/doc.njk
eleventyNavigation:
  key: Quick Reference
  parent: Language
  order: 2
---

# Quick Reference

A compact reference for NIST CSF syntax patterns.

## Framework

```nist-csf
framework FrameworkName {
    description "Framework description"
    version "2.0"
    // nested functions go here
}
```

## Function

```nist-csf
function Identify {
    description "Function description"
    // nested categories go here
}
```

**Valid function names:** `Govern`, `Identify`, `Protect`, `Detect`, `Respond`, `Recover`

## Category

```nist-csf
category CategoryName {
    id "ID.AM"
    description "Category description"
    // nested subcategories go here
}
```

## Subcategory

```nist-csf
subcategory SubcategoryName {
    id "ID.AM-1"
    description "Outcome statement"
    // nested references go here
}
```

## Profile

```nist-csf
profile ProfileName {
    description "Profile description"
    target "Target organization"

    mapping SubcategoryName -> Tier
        notes "Implementation notes"
}
```

**Valid tiers:** `Partial`, `RiskInformed`, `Repeatable`, `Adaptive`

## Control

```nist-csf
control ControlName {
    id "AC-1"
    family "Control Family"
    description "Control description"
    baseline Moderate
}
```

**Valid baselines:** `Low`, `Moderate`, `High`

## Informative Reference

```nist-csf
reference ReferenceName {
    standard "Standard Name"
    section "Section Reference"
    url "https://example.com"
}
```

## Comments

```nist-csf
// Single-line comment

/* Multi-line
   comment */

control C {
    id "C-1"  // Inline comment
}
```

## Complete Example

```nist-csf
// External standard reference
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security Controls"
    url "https://csrc.nist.gov"
}

// Security control
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Access control policy"
    baseline Moderate
}

// Framework with nested structure
framework EnterpriseCSF {
    description "Enterprise CSF Implementation"
    version "1.0"

    function Identify {
        description "Understand organizational context"

        category AssetManagement {
            id "ID.AM"
            description "Asset identification and management"

            subcategory HardwareInventory {
                id "ID.AM-1"
                description "Hardware is inventoried"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "CM-8"
                }
            }
        }
    }

    function Protect {
        description "Implement safeguards"
    }
}

// Standalone subcategory for profile
subcategory HW_Inventory {
    id "ID.AM-1"
    description "Hardware inventory"
}

// Implementation profile
profile Baseline {
    description "Baseline implementation"
    target "Enterprise"

    mapping HW_Inventory -> Repeatable
        notes "Automated discovery deployed"
}
```

## Implementation Tiers

| Tier | Description |
|------|-------------|
| `Partial` | Ad hoc, reactive |
| `RiskInformed` | Approved but limited |
| `Repeatable` | Formal, consistent |
| `Adaptive` | Continuous improvement |

## Control Baselines

| Baseline | Impact Level |
|----------|--------------|
| `Low` | Minimal adverse effect |
| `Moderate` | Serious adverse effect |
| `High` | Severe/catastrophic effect |

## File Extension

`.nist-csf`
