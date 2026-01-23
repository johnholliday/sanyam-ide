---
title: "Simple Function"
description: "A minimal CSF function definition"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Function
  parent: Examples
  order: 1
---

# Simple Function

A minimal CSF function definition demonstrating the Function construct.

## The Code

```nist-csf
// Basic Example: A simple CSF function definition
// Demonstrates the Function construct with description

function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"
}
```

## What This Demonstrates

### Function Declaration

The `function` keyword declares a CSF function:

```nist-csf
function Identify {
    // function body
}
```

### Function Names

Only six function names are valid in NIST CSF:

| Function | Purpose |
|----------|---------|
| `Govern` | Establish risk management strategy |
| `Identify` | Understand organizational context |
| `Protect` | Implement safeguards |
| `Detect` | Identify cybersecurity events |
| `Respond` | Take action on incidents |
| `Recover` | Maintain resilience |

### Description Property

The optional `description` provides context:

```nist-csf
description "Develop organizational understanding to manage cybersecurity risk"
```

## Common Patterns

### All Six Functions

```nist-csf
function Govern {
    description "Establish and monitor cybersecurity risk management strategy"
}

function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"
}

function Protect {
    description "Implement appropriate safeguards"
}

function Detect {
    description "Identify the occurrence of cybersecurity events"
}

function Respond {
    description "Take action regarding detected cybersecurity incidents"
}

function Recover {
    description "Maintain plans for resilience and restore capabilities"
}
```

## Next Steps

- [Simple Control](/examples/basic-simple-control/) - Define security controls
- [Function with Categories](/examples/intermediate-function-with-categories/) - Add nested structure
