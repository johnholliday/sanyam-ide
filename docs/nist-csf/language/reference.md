---
title: "Complete Reference"
description: "Detailed syntax documentation for all NIST CSF language constructs"
layout: layouts/doc.njk
eleventyNavigation:
  key: Reference
  parent: Language
  order: 1
---

# Complete Language Reference

This page documents every construct in the NIST CSF language with detailed syntax and examples.

## Framework

Frameworks are top-level containers for complete CSF implementations.

### Syntax

```
framework <Name> {
    description "<text>"
    version "<semver>"
    <function>*
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `framework` | Yes | Keyword to declare a framework |
| `Name` | Yes | Identifier for the framework |
| `description` | No | Optional description string |
| `version` | No | Optional version string |
| `function*` | No | Zero or more nested functions |

### Examples

```nist-csf
framework NIST_CSF_v2 {
    description "NIST Cybersecurity Framework Version 2.0"
    version "2.0"

    function Identify {
        description "Asset and risk identification"
    }

    function Protect {
        description "Safeguard implementation"
    }
}
```

---

## Function

Functions represent the six core CSF pillars.

### Syntax

```
function <FunctionName> {
    description "<text>"
    <category>*
}
```

### Function Names

Only these six names are valid:

| Name | Purpose |
|------|---------|
| `Govern` | Establish risk management strategy |
| `Identify` | Understand organizational context |
| `Protect` | Implement safeguards |
| `Detect` | Identify cybersecurity events |
| `Respond` | Take action on incidents |
| `Recover` | Maintain resilience |

### Examples

```nist-csf
function Govern {
    description "Establish and monitor cybersecurity risk management strategy"

    category OrganizationalContext {
        id "GV.OC"
        description "Organizational context for risk management"
    }
}

function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Assets are identified and managed"
    }

    category RiskAssessment {
        id "ID.RA"
        description "Risk is understood"
    }
}
```

---

## Category

Categories group related outcomes within a function.

### Syntax

```
category <Name> {
    id "<category-id>"
    description "<text>"
    <subcategory>*
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `category` | Yes | Keyword to declare a category |
| `Name` | Yes | Identifier for the category |
| `id` | No | Official CSF category ID (e.g., "ID.AM") |
| `description` | No | Category description |
| `subcategory*` | No | Zero or more nested subcategories |

### Examples

```nist-csf
category AssetManagement {
    id "ID.AM"
    description "Data, personnel, devices, systems, and facilities are identified and managed"

    subcategory PhysicalDevices {
        id "ID.AM-1"
        description "Physical devices and systems are inventoried"
    }

    subcategory SoftwarePlatforms {
        id "ID.AM-2"
        description "Software platforms and applications are inventoried"
    }

    subcategory DataFlows {
        id "ID.AM-3"
        description "Organizational communication and data flows are mapped"
    }
}
```

---

## Subcategory

Subcategories define specific outcome statements.

### Syntax

```
subcategory <Name> {
    id "<subcategory-id>"
    description "<text>"
    <reference>*
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `subcategory` | Yes | Keyword to declare a subcategory |
| `Name` | Yes | Identifier for the subcategory |
| `id` | No | Official CSF subcategory ID (e.g., "ID.AM-1") |
| `description` | No | Outcome statement |
| `reference*` | No | Zero or more informative references |

### Examples

```nist-csf
subcategory PhysicalDevices {
    id "ID.AM-1"
    description "Physical devices and systems within the organization are inventoried"

    reference CIS_Control_1 {
        standard "CIS Controls v8"
        section "Control 1: Inventory and Control of Enterprise Assets"
    }

    reference NIST_800_53_CM8 {
        standard "NIST SP 800-53"
        section "CM-8 System Component Inventory"
    }
}
```

---

## Profile

Profiles map organizational implementations to CSF outcomes.

### Syntax

```
profile <Name> {
    description "<text>"
    target "<target-description>"
    <mapping>*
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `profile` | Yes | Keyword to declare a profile |
| `Name` | Yes | Identifier for the profile |
| `description` | No | Profile description |
| `target` | No | Target organization type |
| `mapping*` | No | Zero or more profile mappings |

### Mapping Syntax

```
mapping <SubcategoryRef> -> <Tier> notes "<text>"
```

Where `<Tier>` is one of:

| Tier | Description |
|------|-------------|
| `Partial` | Risk management is ad hoc and reactive |
| `RiskInformed` | Practices approved but may not be organization-wide |
| `Repeatable` | Formal policies exist, regularly updated |
| `Adaptive` | Continuous improvement based on lessons learned |

### Examples

```nist-csf
// Define subcategories first
subcategory HardwareInventory {
    id "ID.AM-1"
    description "Hardware assets are inventoried"
}

subcategory SoftwareInventory {
    id "ID.AM-2"
    description "Software assets are inventoried"
}

subcategory NetworkMonitoring {
    id "DE.CM-1"
    description "Networks are monitored"
}

// Create profile with mappings
profile EnterpriseBaseline {
    description "Enterprise-wide CSF implementation baseline"
    target "Large Enterprise Organizations"

    mapping HardwareInventory -> Repeatable
        notes "Automated hardware discovery using network scanning"

    mapping SoftwareInventory -> RiskInformed
        notes "Manual software inventory process, quarterly updates"

    mapping NetworkMonitoring -> Adaptive
        notes "SIEM deployed with ML-based anomaly detection"
}
```

---

## Control

Controls define security controls from NIST SP 800-53 or other standards.

### Syntax

```
control <Name> {
    id "<control-id>"
    family "<family-name>"
    description "<text>"
    baseline <Baseline>
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `control` | Yes | Keyword to declare a control |
| `Name` | Yes | Identifier for the control |
| `id` | No | Official control ID (e.g., "AC-1") |
| `family` | No | Control family name |
| `description` | No | Control description |
| `baseline` | No | Minimum baseline impact level |

### Baseline Values

| Baseline | Description |
|----------|-------------|
| `Low` | Limited adverse effect on operations |
| `Moderate` | Serious adverse effect on operations |
| `High` | Severe or catastrophic effect |

### Examples

```nist-csf
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Develop, document, and disseminate access control policy"
    baseline Low
}

control AC_2 {
    id "AC-2"
    family "Access Control"
    description "Account management procedures"
    baseline Moderate
}

control SC_7 {
    id "SC-7"
    family "System and Communications Protection"
    description "Boundary protection mechanisms"
    baseline High
}
```

---

## InformativeReference

Informative references link CSF elements to external standards.

### Syntax

```
reference <Name> {
    standard "<standard-name>"
    section "<section-reference>"
    url "<url>"
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `reference` | Yes | Keyword to declare a reference |
| `Name` | Yes | Identifier for the reference |
| `standard` | No | Name of the external standard |
| `section` | No | Section or control reference |
| `url` | No | URL to the standard |

### Examples

```nist-csf
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

reference COBIT {
    standard "COBIT 2019"
    section "Governance and Management Objectives"
}
```

---

## Comments

NIST CSF supports single-line and multi-line comments.

### Single-Line Comments

```nist-csf
// This is a single-line comment
control Example {
    id "EX-1"  // Inline comment
}
```

### Multi-Line Comments

```nist-csf
/*
 * This is a multi-line comment.
 * It can span multiple lines.
 * Useful for detailed documentation.
 */
control Documented {
    description "Well-documented control"
}
```

---

## Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| Framework | PascalCase | `NIST_CSF_v2`, `EnterpriseCSF` |
| Function | Fixed names | `Govern`, `Identify`, `Protect` |
| Category | PascalCase | `AssetManagement`, `RiskAssessment` |
| Subcategory | PascalCase | `PhysicalDevices`, `SoftwarePlatforms` |
| Profile | PascalCase | `EnterpriseBaseline`, `ManufacturingProfile` |
| Control | UPPER_CASE or PascalCase | `AC_1`, `AccessControlPolicy` |
| Reference | PascalCase or UPPER_CASE | `NIST_800_53`, `CIS_Controls` |

---

## Reserved Words

The following words are reserved:

- `framework`, `profile`, `function`, `category`, `subcategory`
- `control`, `reference`, `mapping`
- `description`, `version`, `target`, `id`, `family`, `baseline`
- `standard`, `section`, `url`, `notes`
- `Govern`, `Identify`, `Protect`, `Detect`, `Respond`, `Recover`
- `Partial`, `RiskInformed`, `Repeatable`, `Adaptive`
- `Low`, `Moderate`, `High`
