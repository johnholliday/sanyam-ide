---
title: "Examples"
description: "Real-world NIST CSF examples from basic to advanced"
layout: layouts/doc.njk
eleventyNavigation:
  key: Examples
  order: 4
---

# NIST CSF Examples

Learn NIST CSF through practical examples, organized from basic to advanced.

## Basic Examples

Start here if you're new to NIST CSF.

### [Simple Function](/examples/basic-simple-function/)
A minimal CSF function definition.

```nist-csf
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"
}
```

### [Simple Control](/examples/basic-simple-control/)
A security control with all properties.

```nist-csf
control AccessControlPolicy {
    id "AC-1"
    family "Access Control"
    description "Establish access control policy and procedures"
    baseline Moderate
}
```

### [Simple Reference](/examples/basic-simple-reference/)
An informative reference to an external standard.

```nist-csf
reference NIST_SP_800_53 {
    standard "NIST SP 800-53 Rev 5"
    section "Security and Privacy Controls"
    url "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
}
```

---

## Intermediate Examples

Build on the basics with hierarchical structures and profiles.

### [Function with Categories](/examples/intermediate-function-with-categories/)
Nested categories and subcategories within a function.

```nist-csf
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Assets that enable the organization to achieve business purposes"

        subcategory PhysicalDevices {
            id "ID.AM-1"
            description "Physical devices and systems are inventoried"
        }
    }
}
```

### [Profile with Mappings](/examples/intermediate-profile-with-mappings/)
Implementation profile with maturity tier mappings.

```nist-csf
profile ManufacturingBaseline {
    description "Manufacturing sector CSF implementation profile"
    target "Manufacturing Organizations"

    mapping PhysicalDevices -> Repeatable
        notes "Critical for OT/IT asset visibility"
}
```

---

## Advanced Examples

### [Complete Framework](/examples/advanced-complete-framework/)
A full NIST CSF 2.0 implementation demonstrating all constructs:
- 3 informative references
- 4 security controls
- Complete framework with all 6 functions
- Implementation profile with maturity mappings

---

## Example File Locations

All examples are available in the workspace:

| Example | File |
|---------|------|
| Simple Function | `workspace/nist-csf/basic-simple-function.nist-csf` |
| Simple Control | `workspace/nist-csf/basic-simple-control.nist-csf` |
| Simple Reference | `workspace/nist-csf/basic-simple-reference.nist-csf` |
| Function with Categories | `workspace/nist-csf/intermediate-function-with-categories.nist-csf` |
| Profile with Mappings | `workspace/nist-csf/intermediate-profile-with-mappings.nist-csf` |
| Complete Framework | `workspace/nist-csf/advanced-complete-framework.nist-csf` |

## Creating New Files

Use the template at `workspace/nist-csf/templates/new-file.nist-csf` as a starting point for new NIST CSF files.
