---
title: "Tutorial"
description: "Build a complete NIST CSF implementation step by step"
layout: layouts/doc.njk
eleventyNavigation:
  key: Tutorial
  parent: Language
  order: 3
---

# Tutorial: Building a Complete CSF Implementation

In this tutorial, you'll build a complete NIST Cybersecurity Framework implementation for a fictional enterprise organization. By the end, you'll understand how to use all NIST CSF constructs together.

## What We'll Build

A cybersecurity framework implementation with:
- External standard references
- Security controls
- Complete CSF structure (Functions, Categories, Subcategories)
- Implementation profile with maturity assessments

## Step 1: Define External References

Start by defining references to external standards you'll map to. Create a new file called `enterprise-csf.nist-csf`.

```nist-csf
// External standard references
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}

reference CIS_Controls {
    standard "CIS Critical Security Controls v8"
    section "Safeguards"
    url "https://www.cisecurity.org/controls"
}

reference ISO_27001 {
    standard "ISO/IEC 27001:2022"
    section "Information Security Management"
}
```

These references can be nested inside subcategories to show alignment.

## Step 2: Define Security Controls

Add security controls from NIST SP 800-53 that you'll implement:

```nist-csf
// Access Control family
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

// Configuration Management family
control CM_8 {
    id "CM-8"
    family "Configuration Management"
    description "System component inventory"
    baseline Moderate
}

// Incident Response family
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
```

Each control specifies:
- `id` - The NIST control identifier
- `family` - The control family grouping
- `description` - What the control accomplishes
- `baseline` - Minimum impact level (Low, Moderate, High)

## Step 3: Build the CSF Structure

Now create the framework with functions, categories, and subcategories:

```nist-csf
framework EnterpriseCSF {
    description "Enterprise Cybersecurity Framework Implementation"
    version "1.0"

    function Govern {
        description "Establish and monitor cybersecurity risk management strategy"

        category OrganizationalContext {
            id "GV.OC"
            description "Organizational mission and context"

            subcategory OC_01 {
                id "GV.OC-01"
                description "Organizational mission is understood and informs risk management"
            }
        }

        category RiskManagementStrategy {
            id "GV.RM"
            description "Risk management priorities and tolerances"

            subcategory RM_01 {
                id "GV.RM-01"
                description "Risk management objectives are established"
            }
        }
    }

    function Identify {
        description "Develop organizational understanding to manage cybersecurity risk"

        category AssetManagement {
            id "ID.AM"
            description "Assets that enable business purposes are identified"

            subcategory AM_01 {
                id "ID.AM-01"
                description "Hardware managed by the organization is inventoried"

                reference CIS_Controls {
                    standard "CIS Controls"
                    section "Control 1: Inventory of Enterprise Assets"
                }
            }

            subcategory AM_02 {
                id "ID.AM-02"
                description "Software managed by the organization is inventoried"

                reference CIS_Controls {
                    standard "CIS Controls"
                    section "Control 2: Inventory of Software Assets"
                }
            }
        }

        category RiskAssessment {
            id "ID.RA"
            description "Organization understands cybersecurity risk"

            subcategory RA_01 {
                id "ID.RA-01"
                description "Vulnerabilities are identified and documented"
            }
        }
    }

    function Protect {
        description "Implement appropriate safeguards"

        category IdentityManagement {
            id "PR.AA"
            description "Access to assets is limited to authorized users"

            subcategory AA_01 {
                id "PR.AA-01"
                description "Identities and credentials are managed"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "AC-2 Account Management"
                }
            }
        }
    }

    function Detect {
        description "Implement activities to identify cybersecurity events"

        category ContinuousMonitoring {
            id "DE.CM"
            description "Assets are monitored for anomalies"

            subcategory CM_01 {
                id "DE.CM-01"
                description "Networks are monitored for adverse events"
            }
        }
    }

    function Respond {
        description "Take action regarding detected incidents"

        category IncidentManagement {
            id "RS.MA"
            description "Responses to incidents are managed"

            subcategory MA_01 {
                id "RS.MA-01"
                description "Incident response plan is executed"

                reference NIST_800_53 {
                    standard "NIST 800-53"
                    section "IR-4 Incident Handling"
                }
            }
        }
    }

    function Recover {
        description "Maintain plans for resilience"

        category IncidentRecoveryPlanExecution {
            id "RC.RP"
            description "Restoration activities are performed"

            subcategory RP_01 {
                id "RC.RP-01"
                description "Recovery plan is executed"
            }
        }
    }
}
```

## Step 4: Create Standalone Subcategories for Profiling

Profile mappings reference subcategories by name. Create standalone subcategories for your profile:

```nist-csf
// Standalone subcategories for profile mapping
subcategory Profile_AM_01 {
    id "ID.AM-01"
    description "Hardware inventory maintained"
}

subcategory Profile_AM_02 {
    id "ID.AM-02"
    description "Software inventory maintained"
}

subcategory Profile_AA_01 {
    id "PR.AA-01"
    description "Identity management implemented"
}

subcategory Profile_CM_01 {
    id "DE.CM-01"
    description "Network monitoring active"
}

subcategory Profile_MA_01 {
    id "RS.MA-01"
    description "Incident response plan executed"
}

subcategory Profile_RP_01 {
    id "RC.RP-01"
    description "Recovery plan executed"
}
```

## Step 5: Create the Implementation Profile

Now create a profile that maps your current implementation to maturity tiers:

```nist-csf
profile EnterpriseBaseline {
    description "Enterprise-wide CSF implementation baseline"
    target "Large Enterprise Organizations"

    mapping Profile_AM_01 -> Repeatable
        notes "Automated hardware discovery using network scanning tools"

    mapping Profile_AM_02 -> Repeatable
        notes "Software inventory automated with endpoint management"

    mapping Profile_AA_01 -> Adaptive
        notes "Zero trust identity management fully implemented"

    mapping Profile_CM_01 -> RiskInformed
        notes "SIEM deployed with baseline alerting rules"

    mapping Profile_MA_01 -> Repeatable
        notes "IR plan tested quarterly with tabletop exercises"

    mapping Profile_RP_01 -> Partial
        notes "Recovery procedures documented but not fully tested"
}
```

The four tiers represent maturity levels:

| Tier | Meaning |
|------|---------|
| `Partial` | Ad hoc, reactive |
| `RiskInformed` | Approved but not organization-wide |
| `Repeatable` | Formal policies, consistent practice |
| `Adaptive` | Continuous improvement, predictive |

## Complete Model

Here's the complete `enterprise-csf.nist-csf` file:

```nist-csf
// ============================================================================
// Enterprise CSF Implementation
// ============================================================================

// External standard references
reference NIST_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}

reference CIS_Controls {
    standard "CIS Critical Security Controls v8"
    section "Safeguards"
    url "https://www.cisecurity.org/controls"
}

// Security controls
control AC_2 {
    id "AC-2"
    family "Access Control"
    description "Account management procedures"
    baseline Moderate
}

control CM_8 {
    id "CM-8"
    family "Configuration Management"
    description "System component inventory"
    baseline Moderate
}

control IR_4 {
    id "IR-4"
    family "Incident Response"
    description "Incident handling procedures"
    baseline Moderate
}

// Framework definition
framework EnterpriseCSF {
    description "Enterprise Cybersecurity Framework Implementation"
    version "1.0"

    function Identify {
        description "Understand organizational context"

        category AssetManagement {
            id "ID.AM"
            description "Asset identification and management"

            subcategory AM_01 {
                id "ID.AM-01"
                description "Hardware is inventoried"

                reference CIS_Controls {
                    standard "CIS Controls"
                    section "Control 1"
                }
            }
        }
    }

    function Protect {
        description "Implement safeguards"

        category IdentityManagement {
            id "PR.AA"
            description "Access management"

            subcategory AA_01 {
                id "PR.AA-01"
                description "Identities are managed"
            }
        }
    }

    function Detect {
        description "Identify cybersecurity events"

        category ContinuousMonitoring {
            id "DE.CM"
            description "Asset monitoring"

            subcategory CM_01 {
                id "DE.CM-01"
                description "Networks are monitored"
            }
        }
    }

    function Respond {
        description "Take action on incidents"

        category IncidentManagement {
            id "RS.MA"
            description "Incident management"

            subcategory MA_01 {
                id "RS.MA-01"
                description "IR plan is executed"
            }
        }
    }

    function Recover {
        description "Maintain resilience"

        category IncidentRecoveryPlanExecution {
            id "RC.RP"
            description "Recovery execution"

            subcategory RP_01 {
                id "RC.RP-01"
                description "Recovery plan executed"
            }
        }
    }
}

// Standalone subcategories for profile
subcategory Profile_AM_01 {
    id "ID.AM-01"
    description "Hardware inventory"
}

subcategory Profile_AA_01 {
    id "PR.AA-01"
    description "Identity management"
}

subcategory Profile_CM_01 {
    id "DE.CM-01"
    description "Network monitoring"
}

subcategory Profile_MA_01 {
    id "RS.MA-01"
    description "Incident response"
}

subcategory Profile_RP_01 {
    id "RC.RP-01"
    description "Recovery execution"
}

// Implementation profile
profile EnterpriseBaseline {
    description "Enterprise baseline assessment"
    target "Large Organizations"

    mapping Profile_AM_01 -> Repeatable
        notes "Automated hardware discovery"

    mapping Profile_AA_01 -> Adaptive
        notes "Zero trust implemented"

    mapping Profile_CM_01 -> RiskInformed
        notes "SIEM with baseline alerts"

    mapping Profile_MA_01 -> Repeatable
        notes "Quarterly tabletop exercises"

    mapping Profile_RP_01 -> Partial
        notes "Procedures documented, not tested"
}
```

## Key Takeaways

1. **Start with references** - Define external standards first
2. **Add controls** - Document security controls you implement
3. **Build the framework** - Structure with functions, categories, subcategories
4. **Link to standards** - Nest references in subcategories
5. **Create profiles** - Map implementation to maturity tiers

## Next Steps

- Explore the [Examples](/examples/) for more patterns
- Read the [Complete Reference](/language/reference/) for all syntax details
- Use the [Quick Reference](/language/quick-reference/) as a handy cheatsheet
