---
title: "Simple Reference"
description: "An informative reference to an external standard"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Reference
  parent: Examples
  order: 3
---

# Simple Reference

An informative reference demonstrating links to external standards.

## The Code

```nist-csf
// Basic Example: An informative reference to external standard
// Demonstrates the InformativeReference construct

reference NIST_SP_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}
```

## What This Demonstrates

### Reference Declaration

The `reference` keyword declares an informative reference:

```nist-csf
reference NIST_SP_800_53 {
    // reference properties
}
```

### Reference Properties

| Property | Purpose |
|----------|---------|
| `standard` | Name of the external standard |
| `section` | Specific section or control reference |
| `url` | Link to the authoritative source |

## Common Patterns

### Common Standards

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

reference PCI_DSS {
    standard "PCI DSS v4.0"
    section "Payment Card Industry Data Security Standard"
    url "https://www.pcisecuritystandards.org"
}
```

### Embedded References

References can be nested inside subcategories:

```nist-csf
subcategory HardwareInventory {
    id "ID.AM-1"
    description "Physical devices are inventoried"

    reference CIS_Control_1 {
        standard "CIS Controls v8"
        section "Control 1: Inventory of Enterprise Assets"
    }

    reference NIST_CM_8 {
        standard "NIST SP 800-53"
        section "CM-8 System Component Inventory"
    }
}
```

## Next Steps

- [Function with Categories](/examples/intermediate-function-with-categories/) - Build nested structures
- [Complete Framework](/examples/advanced-complete-framework/) - See references in context
