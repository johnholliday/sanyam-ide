---
title: "Language Reference"
description: "Complete documentation for the NIST CSF domain-specific language"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language
  order: 3
---

# NIST CSF Language Reference

NIST CSF is a domain-specific language for modeling cybersecurity frameworks based on the NIST Cybersecurity Framework 2.0. This section provides comprehensive documentation for all language constructs.

## Language Overview

NIST CSF models consist of seven primary element types:

| Element | Purpose | Example Use Case |
|---------|---------|------------------|
| **Framework** | Top-level container | Complete CSF implementation |
| **Function** | Core CSF pillars | Govern, Identify, Protect, etc. |
| **Category** | Outcome groupings | Asset Management, Risk Assessment |
| **Subcategory** | Specific outcomes | ID.AM-1, PR.AA-1 |
| **Profile** | Implementation mapping | Industry-specific profiles |
| **Control** | Security controls | NIST SP 800-53 controls |
| **InformativeReference** | External standards | Links to guidance |

## File Structure

NIST CSF files use the `.nist-csf` extension and contain one or more elements:

```nist-csf
// External standard reference
reference CIS_Controls {
    standard "CIS Critical Security Controls v8"
    section "Control 1: Inventory"
}

// Security control
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Access control policy"
    baseline Moderate
}

// Framework with nested structure
framework MyCSF {
    description "Organization CSF Implementation"
    version "1.0"

    function Identify {
        description "Understand context"

        category AssetManagement {
            id "ID.AM"
            description "Asset management outcomes"
        }
    }
}

// Implementation profile
profile Baseline {
    description "Baseline profile"
    target "Enterprise"
}
```

## Documentation Sections

### [Quick Reference](/language/quick-reference/)
A compact cheatsheet with all syntax patterns on a single page.

### [Complete Reference](/language/reference/)
Detailed documentation of every language construct with examples.

### [Tutorial](/language/tutorial/)
A guided walkthrough building a complete CSF implementation.

## Grammar Rules

NIST CSF follows these fundamental rules:

1. **Elements are top-level** - All constructs are declared at the root level
2. **Curly braces define scope** - All element bodies are enclosed in `{}`
3. **Properties are optional** - Most properties can be omitted
4. **Function names are fixed** - Only six valid function names exist
5. **Tiers and baselines are enums** - Specific values must be used

## Type System

### Primitive Types

NIST CSF uses these terminal types:

- `ID` - Identifiers (letters, digits, underscores, hyphens)
- `STRING` - Quoted text values

### Function Names

Only these six function names are valid:

- `Govern` - Organizational governance
- `Identify` - Asset and risk identification
- `Protect` - Safeguard implementation
- `Detect` - Event detection
- `Respond` - Incident response
- `Recover` - Recovery planning

### Implementation Tiers

Profile mappings use these tiers:

- `Partial` - Ad hoc, reactive
- `RiskInformed` - Approved but limited
- `Repeatable` - Formal, consistent
- `Adaptive` - Continuous improvement

### Control Baselines

Controls use these impact levels:

- `Low` - Minimal impact
- `Moderate` - Serious impact
- `High` - Severe impact

## Cross-References

Profile mappings reference subcategories by name:

```nist-csf
subcategory HardwareInventory {
    id "ID.AM-1"
    description "Hardware is inventoried"
}

profile Baseline {
    description "Baseline implementation"
    target "Enterprise"

    mapping HardwareInventory -> Repeatable  // References subcategory by name
        notes "Automated inventory deployed"
}
```

## Comments

NIST CSF supports both comment styles:

```nist-csf
// Single-line comment

/*
 * Multi-line comment
 * spanning multiple lines
 */

control Example {
    id "EX-1"  // Inline comment
}
```

## Best Practices

1. **Use meaningful IDs** - Follow NIST naming conventions (ID.AM-1, PR.AA-1)
2. **Add descriptions** - Document all elements
3. **Group related elements** - Keep controls with their references
4. **Use profiles for assessment** - Map current state to tiers
5. **Reference external standards** - Link to authoritative sources
