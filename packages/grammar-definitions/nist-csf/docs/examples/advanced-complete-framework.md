---
title: "Complete Framework"
description: "A full NIST CSF 2.0 implementation demonstrating all constructs"
layout: layouts/doc.njk
eleventyNavigation:
  key: Complete Framework
  parent: Examples
  order: 6
---

# Complete Framework

A comprehensive NIST CSF 2.0 implementation demonstrating all language constructs working together.

## The Code

```nist-csf
// Advanced Example: Complete NIST CSF 2.0 Framework implementation
// Demonstrates all constructs working together

// ============================================================================
// INFORMATIVE REFERENCES - External standard mappings
// ============================================================================

reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}

reference ISO_27001 {
    standard "ISO/IEC 27001:2022"
    section "Information Security Management"
    url "https://www.iso.org/standard/27001"
}

reference CIS_Controls {
    standard "CIS Critical Security Controls v8"
    section "Safeguards"
    url "https://www.cisecurity.org/controls"
}

// ============================================================================
// SECURITY CONTROLS - From NIST SP 800-53
// ============================================================================

control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Policy and procedures for access control"
    baseline Low
}

control AC_2 {
    id "AC-2"
    family "Access Control"
    description "Account management procedures"
    baseline Moderate
}

control IR_1 {
    id "IR-1"
    family "Incident Response"
    description "Incident response policy and procedures"
    baseline Low
}

control IR_4 {
    id "IR-4"
    family "Incident Response"
    description "Incident handling procedures"
    baseline Moderate
}

// ============================================================================
// CSF FRAMEWORK - Core functions with categories and subcategories
// ============================================================================

framework NIST_CSF_v2 {
    description "NIST Cybersecurity Framework Version 2.0"
    version "2.0"

    function Govern {
        description "Establish and monitor the organization's cybersecurity risk management strategy"

        category OrganizationalContext {
            id "GV.OC"
            description "Circumstances surrounding the organization's cybersecurity risk management"

            subcategory OC_1 {
                id "GV.OC-01"
                description "The organizational mission is understood and informs cybersecurity risk management"

                reference ISO_27001 {
                    standard "ISO 27001"
                    section "4.1 Understanding the organization"
                }
            }
        }

        category RiskManagementStrategy {
            id "GV.RM"
            description "The organization's priorities, constraints, risk tolerances, and assumptions"

            subcategory RM_1 {
                id "GV.RM-01"
                description "Risk management objectives are established and agreed to by organizational stakeholders"
            }
        }
    }

    function Identify {
        description "Develop organizational understanding to manage cybersecurity risk"

        category AssetManagement {
            id "ID.AM"
            description "Assets that enable the organization to achieve business purposes"

            subcategory AM_1 {
                id "ID.AM-01"
                description "Inventories of hardware managed by the organization are maintained"

                reference CIS_Controls {
                    standard "CIS Controls"
                    section "Control 1: Inventory of Enterprise Assets"
                }
            }

            subcategory AM_2 {
                id "ID.AM-02"
                description "Inventories of software managed by the organization are maintained"

                reference CIS_Controls {
                    standard "CIS Controls"
                    section "Control 2: Inventory of Software Assets"
                }
            }
        }
    }

    function Protect {
        description "Implement appropriate safeguards to ensure delivery of critical services"

        category IdentityManagement {
            id "PR.AA"
            description "Access to assets is limited to authorized users"

            subcategory AA_1 {
                id "PR.AA-01"
                description "Identities and credentials for authorized users are managed"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "AC-2 Account Management"
                }
            }
        }
    }

    function Detect {
        description "Implement appropriate activities to identify cybersecurity events"

        category ContinuousMonitoring {
            id "DE.CM"
            description "Assets are monitored to find anomalies and indicators of compromise"

            subcategory CM_1 {
                id "DE.CM-01"
                description "Networks and network services are monitored for potential adverse events"
            }
        }
    }

    function Respond {
        description "Take action regarding a detected cybersecurity incident"

        category IncidentManagement {
            id "RS.MA"
            description "Responses to detected incidents are managed"

            subcategory MA_1 {
                id "RS.MA-01"
                description "The incident response plan is executed in coordination with relevant third parties"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "IR-4 Incident Handling"
                }
            }
        }
    }

    function Recover {
        description "Maintain plans for resilience and restore capabilities"

        category IncidentRecoveryPlanExecution {
            id "RC.RP"
            description "Restoration activities are performed"

            subcategory RP_1 {
                id "RC.RP-01"
                description "The recovery portion of the incident response plan is executed"
            }
        }
    }
}

// ============================================================================
// IMPLEMENTATION PROFILE - Organization-specific maturity mapping
// ============================================================================

// Standalone subcategories for profile mapping
subcategory Profile_AM_1 {
    id "ID.AM-01"
    description "Hardware inventory maintained"
}

subcategory Profile_AM_2 {
    id "ID.AM-02"
    description "Software inventory maintained"
}

subcategory Profile_AA_1 {
    id "PR.AA-01"
    description "Identity management implemented"
}

subcategory Profile_CM_1 {
    id "DE.CM-01"
    description "Network monitoring active"
}

subcategory Profile_MA_1 {
    id "RS.MA-01"
    description "Incident response plan executed"
}

subcategory Profile_RP_1 {
    id "RC.RP-01"
    description "Recovery plan executed"
}

profile EnterpriseBaseline {
    description "Enterprise-wide CSF implementation baseline"
    target "Large Enterprise Organizations"

    mapping Profile_AM_1 -> Repeatable
        notes "Hardware asset management is automated and regularly updated"

    mapping Profile_AM_2 -> Repeatable
        notes "Software inventory is automated using discovery tools"

    mapping Profile_AA_1 -> Adaptive
        notes "Zero trust identity management fully implemented"

    mapping Profile_CM_1 -> RiskInformed
        notes "SIEM deployed with baseline alerting"

    mapping Profile_MA_1 -> Repeatable
        notes "IR plan tested quarterly with tabletop exercises"

    mapping Profile_RP_1 -> Partial
        notes "Recovery procedures documented but not fully tested"
}
```

## What This Demonstrates

### Complete Structure

This example shows how all NIST CSF constructs work together:

```
Informative References (external standards)
    ↓
Security Controls (from NIST 800-53)
    ↓
Framework
    └── Functions (6 core functions)
        └── Categories (organizational groups)
            └── Subcategories (specific outcomes)
                └── Embedded References (mappings)
    ↓
Implementation Profile (maturity assessment)
    └── Mappings (subcategory → tier)
```

### Construct Summary

| Construct | Count | Purpose |
|-----------|-------|---------|
| References | 3 | External standard links |
| Controls | 4 | NIST 800-53 controls |
| Framework | 1 | Container for CSF structure |
| Functions | 6 | Core CSF functions |
| Categories | 7 | Organizational groupings |
| Subcategories | 8 | Specific outcomes (nested) |
| Profile | 1 | Maturity assessment |
| Mappings | 6 | Tier assignments |

### Reference Nesting

References can be embedded inside subcategories:

```nist-csf
subcategory AM_1 {
    id "ID.AM-01"
    description "Hardware managed by the organization is inventoried"

    reference CIS_Controls {
        standard "CIS Controls"
        section "Control 1: Inventory of Enterprise Assets"
    }
}
```

### Profile Mapping Pattern

Profiles require standalone subcategories for cross-referencing:

```nist-csf
// 1. Define standalone subcategory
subcategory Profile_AM_1 {
    id "ID.AM-01"
    description "Hardware inventory maintained"
}

// 2. Reference in profile mapping
profile EnterpriseBaseline {
    mapping Profile_AM_1 -> Repeatable
        notes "Hardware asset management is automated"
}
```

## Key Patterns

### Standard Organization

Organize your CSF file in this order:

1. **Informative References** - External standards first
2. **Security Controls** - Control definitions
3. **Framework** - Core CSF structure with functions
4. **Standalone Subcategories** - For profile mappings
5. **Profiles** - Maturity assessments

### Comment Sections

Use comment headers to organize large files:

```nist-csf
// ============================================================================
// SECTION NAME
// ============================================================================
```

### Maturity Distribution

A typical enterprise profile might show:

| Tier | Count | Percentage |
|------|-------|------------|
| Partial | 1 | 17% |
| RiskInformed | 1 | 17% |
| Repeatable | 3 | 50% |
| Adaptive | 1 | 17% |

## Building Your Own

### Step 1: Start with References

```nist-csf
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}
```

### Step 2: Add Relevant Controls

```nist-csf
control AC_2 {
    id "AC-2"
    family "Access Control"
    description "Account management procedures"
    baseline Moderate
}
```

### Step 3: Build Framework Structure

```nist-csf
framework MyOrg_CSF {
    description "Organization cybersecurity framework"
    version "1.0"

    function Identify {
        // Add categories and subcategories
    }
    // Add other functions
}
```

### Step 4: Create Profile Subcategories

```nist-csf
subcategory Profile_AM_1 {
    id "ID.AM-01"
    description "Hardware inventory"
}
```

### Step 5: Add Implementation Profile

```nist-csf
profile CurrentState {
    description "Current maturity assessment"
    target "Internal"

    mapping Profile_AM_1 -> Repeatable
        notes "Automated discovery in place"
}
```

## Next Steps

- [Tutorial](/language/tutorial/) - Step-by-step guide to building your own implementation
- [Quick Reference](/language/quick-reference/) - Syntax cheatsheet
- [Language Reference](/language/reference/) - Complete grammar documentation
