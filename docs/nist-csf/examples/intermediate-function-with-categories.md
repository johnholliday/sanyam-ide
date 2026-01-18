---
title: "Function with Categories"
description: "Nested categories and subcategories within a function"
layout: layouts/doc.njk
eleventyNavigation:
  key: Function with Categories
  parent: Examples
  order: 4
---

# Function with Categories

A function with nested categories and subcategories demonstrating the hierarchical CSF structure.

## The Code

```nist-csf
// Intermediate Example: Function with nested categories and subcategories
// Demonstrates the hierarchical CSF structure

function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Data, personnel, devices, systems, and facilities that enable the organization to achieve business purposes"

        subcategory PhysicalDevices {
            id "ID.AM-1"
            description "Physical devices and systems within the organization are inventoried"
        }

        subcategory SoftwarePlatforms {
            id "ID.AM-2"
            description "Software platforms and applications within the organization are inventoried"
        }
    }

    category RiskAssessment {
        id "ID.RA"
        description "The organization understands the cybersecurity risk to organizational operations"

        subcategory VulnerabilityIdentification {
            id "ID.RA-1"
            description "Asset vulnerabilities are identified and documented"
        }
    }
}
```

## What This Demonstrates

### Hierarchical Structure

CSF uses a three-level hierarchy:

```
Function
└── Category
    └── Subcategory
```

### Categories Inside Functions

Categories are nested directly inside function bodies:

```nist-csf
function Identify {
    category AssetManagement {
        // category content
    }
    category RiskAssessment {
        // category content
    }
}
```

### Subcategories Inside Categories

Subcategories nest inside categories:

```nist-csf
category AssetManagement {
    subcategory PhysicalDevices {
        // subcategory content
    }
    subcategory SoftwarePlatforms {
        // subcategory content
    }
}
```

### ID Naming Convention

NIST CSF uses a standard ID format:

| Level | Format | Example |
|-------|--------|---------|
| Category | `{FN}.{CA}` | `ID.AM` |
| Subcategory | `{FN}.{CA}-{N}` | `ID.AM-1` |

Where:
- `FN` = Function abbreviation (ID, PR, DE, RS, RC, GV)
- `CA` = Category abbreviation
- `N` = Subcategory number

## Common Patterns

### Multiple Categories per Function

```nist-csf
function Protect {
    description "Implement appropriate safeguards"

    category IdentityManagement {
        id "PR.AA"
        description "Access to assets is limited to authorized users"

        subcategory CredentialManagement {
            id "PR.AA-01"
            description "Identities and credentials are managed"
        }
    }

    category AwarenessTraining {
        id "PR.AT"
        description "Personnel are trained in cybersecurity"

        subcategory SecurityAwareness {
            id "PR.AT-01"
            description "Personnel understand roles and responsibilities"
        }
    }

    category DataSecurity {
        id "PR.DS"
        description "Information and data are protected"

        subcategory DataAtRest {
            id "PR.DS-01"
            description "Data-at-rest is protected"
        }
    }
}
```

### Complete Function Example

```nist-csf
function Detect {
    description "Identify the occurrence of cybersecurity events"

    category ContinuousMonitoring {
        id "DE.CM"
        description "Assets are monitored for anomalies"

        subcategory NetworkMonitoring {
            id "DE.CM-01"
            description "Networks are monitored for adverse events"
        }

        subcategory PersonnelActivity {
            id "DE.CM-03"
            description "Personnel activity is monitored"
        }
    }

    category AdverseEventAnalysis {
        id "DE.AE"
        description "Anomalies are analyzed to understand attack targets"

        subcategory AnomalyCorrelation {
            id "DE.AE-03"
            description "Event data are correlated from multiple sources"
        }
    }
}
```

## Next Steps

- [Profile with Mappings](/examples/intermediate-profile-with-mappings/) - Map subcategories to maturity tiers
- [Complete Framework](/examples/advanced-complete-framework/) - See the full CSF structure
