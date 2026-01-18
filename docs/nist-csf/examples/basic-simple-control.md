---
title: "Simple Control"
description: "A security control with all properties"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Control
  parent: Examples
  order: 2
---

# Simple Control

A security control definition demonstrating all Control properties.

## The Code

```nist-csf
// Basic Example: A simple security control definition
// Demonstrates the Control construct with all properties

control AccessControlPolicy {
    id "AC-1"
    family "Access Control"
    description "Establish access control policy and procedures"
    baseline Moderate
}
```

## What This Demonstrates

### Control Declaration

The `control` keyword declares a security control:

```nist-csf
control AccessControlPolicy {
    // control properties
}
```

### Control Properties

| Property | Purpose |
|----------|---------|
| `id` | Official control identifier (e.g., "AC-1") |
| `family` | Control family grouping |
| `description` | What the control accomplishes |
| `baseline` | Minimum impact level |

### Baseline Values

Controls specify impact levels:

| Baseline | Description |
|----------|-------------|
| `Low` | Limited adverse effect |
| `Moderate` | Serious adverse effect |
| `High` | Severe or catastrophic effect |

## Common Patterns

### Controls by Family

```nist-csf
// Access Control family
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Access control policy and procedures"
    baseline Low
}

control AC_2 {
    id "AC-2"
    family "Access Control"
    description "Account management"
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
    description "Incident handling"
    baseline Moderate
}

// System Protection family
control SC_7 {
    id "SC-7"
    family "System and Communications Protection"
    description "Boundary protection"
    baseline High
}
```

## Next Steps

- [Simple Reference](/examples/basic-simple-reference/) - Link to external standards
- [Complete Framework](/examples/advanced-complete-framework/) - See controls in context
