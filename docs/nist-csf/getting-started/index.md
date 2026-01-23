---
title: "Getting Started"
description: "Learn the basics of NIST CSF DSL and create your first cybersecurity framework model"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---

# Getting Started with NIST CSF

This guide walks you through creating your first NIST CSF model, from simple controls to a complete framework implementation.

## Prerequisites

- A text editor with NIST CSF support
- Basic understanding of the NIST Cybersecurity Framework

## Your First Control

Create a new file with the `.nist-csf` extension. Let's start with a simple security control:

```nist-csf
control AccessControlPolicy {
    id "AC-1"
    family "Access Control"
    description "Develop, document, and disseminate access control policy"
    baseline Moderate
}
```

This defines an access control policy with:
- `id` - The control identifier from NIST SP 800-53
- `family` - The control family grouping
- `description` - What the control accomplishes
- `baseline` - The minimum impact level (Low, Moderate, or High)

## Control Baselines

NIST CSF supports three baseline impact levels:

| Baseline | Description | Example |
|----------|-------------|---------|
| `Low` | Minimal adverse effect | Basic documentation controls |
| `Moderate` | Serious adverse effect | Access management controls |
| `High` | Severe/catastrophic effect | Critical infrastructure controls |

## Creating a Function

Functions represent the six core CSF pillars:

```nist-csf
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"
}
```

### The Six Functions

| Function | Purpose |
|----------|---------|
| `Govern` | Establish risk management strategy |
| `Identify` | Understand context and assets |
| `Protect` | Implement safeguards |
| `Detect` | Identify cybersecurity events |
| `Respond` | Take action on incidents |
| `Recover` | Maintain resilience |

## Adding Categories

Categories group related outcomes within a function:

```nist-csf
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Data, personnel, devices, and systems are identified and managed"
    }

    category RiskAssessment {
        id "ID.RA"
        description "The organization understands cybersecurity risk"
    }
}
```

## Adding Subcategories

Subcategories define specific outcome statements:

```nist-csf
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Assets that enable the organization to achieve business purposes"

        subcategory PhysicalDevices {
            id "ID.AM-1"
            description "Physical devices and systems within the organization are inventoried"
        }

        subcategory SoftwarePlatforms {
            id "ID.AM-2"
            description "Software platforms and applications are inventoried"
        }
    }
}
```

## Informative References

Link subcategories to external standards:

```nist-csf
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "AC-1 Access Control Policy"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}

subcategory AccessManagement {
    id "PR.AA-1"
    description "Identities and credentials are managed"

    reference NIST_800_53 {
        standard "NIST 800-53"
        section "AC-2 Account Management"
    }
}
```

## Creating a Profile

Profiles map your organization's implementation to CSF outcomes:

```nist-csf
// First define the subcategories
subcategory PhysicalDevices {
    id "ID.AM-1"
    description "Physical devices are inventoried"
}

subcategory SoftwarePlatforms {
    id "ID.AM-2"
    description "Software platforms are inventoried"
}

// Then create the profile with mappings
profile ManufacturingBaseline {
    description "Manufacturing sector CSF implementation"
    target "Manufacturing Organizations"

    mapping PhysicalDevices -> Repeatable
        notes "Automated hardware discovery deployed"

    mapping SoftwarePlatforms -> RiskInformed
        notes "Manual software inventory process"
}
```

### Implementation Tiers

Profile mappings use four maturity levels:

| Tier | Description |
|------|-------------|
| `Partial` | Ad hoc, reactive |
| `RiskInformed` | Approved but not organization-wide |
| `Repeatable` | Formal policies, regular updates |
| `Adaptive` | Continuous improvement, predictive |

## Creating a Framework

Bundle everything into a complete framework:

```nist-csf
framework NIST_CSF_v2 {
    description "NIST Cybersecurity Framework Version 2.0"
    version "2.0"

    function Identify {
        description "Understand context to manage risk"

        category AssetManagement {
            id "ID.AM"
            description "Assets are identified and managed"

            subcategory PhysicalDevices {
                id "ID.AM-1"
                description "Physical devices are inventoried"
            }
        }
    }

    function Protect {
        description "Implement safeguards"
    }
}
```

## Complete Example

Here's a complete NIST CSF model:

```nist-csf
// External References
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}

// Security Controls
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Access control policy and procedures"
    baseline Moderate
}

// Framework Definition
framework EnterpriseCSF {
    description "Enterprise Cybersecurity Framework"
    version "1.0"

    function Identify {
        description "Understand organizational context"

        category AssetManagement {
            id "ID.AM"
            description "Asset identification and management"

            subcategory HardwareInventory {
                id "ID.AM-1"
                description "Hardware assets are inventoried"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "CM-8 System Component Inventory"
                }
            }
        }
    }
}

// Standalone subcategory for profile mapping
subcategory HardwareInventory_Profile {
    id "ID.AM-1"
    description "Hardware inventory for profile"
}

// Implementation Profile
profile EnterpriseBaseline {
    description "Enterprise baseline implementation"
    target "Large Organizations"

    mapping HardwareInventory_Profile -> Repeatable
        notes "Automated discovery and CMDB integration"
}
```

## Comments

NIST CSF supports single-line and multi-line comments:

```nist-csf
// This is a single-line comment

/*
 * This is a multi-line comment
 * spanning multiple lines
 */
control Example {
    id "EX-1"
    description "Example control"  // Inline comment
}
```

## Next Steps

- Explore the [Language Reference](/language/) for complete syntax documentation
- See [Examples](/examples/) for real-world patterns
- Try the [Tutorial](/language/tutorial/) for a guided learning path
