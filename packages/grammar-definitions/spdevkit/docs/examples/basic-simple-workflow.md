---
title: "Simple Workflow"
description: "A sequential workflow with three steps"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Workflow
  parent: Examples
  order: 3
---

# Simple Workflow

A workflow definition demonstrating sequential steps in a business process.

## The Code

```spdevkit
// Basic Example: A simple workflow definition
// Demonstrates the Workflow construct with sequential steps

workflow OrderApproval {
    description "Basic order approval workflow"

    step SubmitOrder {
        action "Submit the order for review"
        next ReviewOrder
    }

    step ReviewOrder {
        action "Manager reviews the order"
        next ApproveOrder
    }

    step ApproveOrder {
        action "Approve and finalize the order"
    }
}
```

## What This Demonstrates

### Workflow Declaration

The `workflow` keyword declares a process:

```spdevkit
workflow OrderApproval {
    // description and steps go here
}
```

### Description

Workflows can have an optional description:

```spdevkit
description "Basic order approval workflow"
```

### Steps

Each step defines a stage in the process:

```spdevkit
step SubmitOrder {
    action "Submit the order for review"
    next ReviewOrder
}
```

### Step Components

| Component | Required | Purpose |
|-----------|----------|---------|
| `step` | Yes | Keyword followed by step name |
| `action` | Yes | Description of what happens |
| `next` | No | Reference to the next step |

### Flow Sequence

This workflow follows a linear path:

```
SubmitOrder → ReviewOrder → ApproveOrder
```

The final step (`ApproveOrder`) has no `next` reference, indicating the workflow ends there.

## Common Patterns

### Longer Workflows

```spdevkit
workflow OrderProcessing {
    description "Full order processing workflow"

    step Receive {
        action "Receive customer order"
        next Validate
    }

    step Validate {
        action "Validate order details"
        next Process
    }

    step Process {
        action "Process payment"
        next Ship
    }

    step Ship {
        action "Ship products"
        next Notify
    }

    step Notify {
        action "Send confirmation to customer"
    }
}
```

### Minimal Workflow

```spdevkit
workflow SimpleTask {
    step Execute {
        action "Perform the task"
    }
}
```

## Next Steps

- [Entity Relationships](/examples/intermediate-entity-relationships/) - Build a data model
- [Complete Application](/examples/advanced-complete-application/) - See workflows in a full system

