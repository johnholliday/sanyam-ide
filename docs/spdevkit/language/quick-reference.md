---
title: "Quick Reference"
description: "SPDevKit syntax cheatsheet - all patterns at a glance"
layout: layouts/doc.njk
eleventyNavigation:
  key: Quick Reference
  parent: Language
  order: 2
---

# Quick Reference

A compact reference for SPDevKit syntax patterns.

## Entity

```spdevkit
entity EntityName {
    property: type
    property: type = "default"
}
```

**Primitive Types:** `string`, `number`, `boolean`, `date`

**Reference Types:** `EntityName`, `EntityName[]`

## Service

```spdevkit
service ServiceName {
    description "Description text"
    operation name(param: type) -> ReturnType
    operation name(param: type param2: type)
}
```

## Workflow

```spdevkit
workflow WorkflowName {
    description "Description text"

    step StepName {
        action "What this step does"
        next NextStep
    }

    step FinalStep {
        action "Final action"
    }
}
```

## Application

```spdevkit
application AppName {
    description "Description text"
    version "1.0.0"
}
```

## Comments

```spdevkit
// Single-line comment

/* Multi-line
   comment */

entity E {
    f: string  // Inline comment
}
```

## Complete Example

```spdevkit
// Domain model
entity Customer {
    id: number
    name: string
    email: string
    active: boolean = "true"
    orders: Order[]
}

entity Order {
    orderId: number
    total: number
    status: string = "pending"
}

// Business logic
service CustomerService {
    description "Customer operations"
    operation findById(id: number) -> Customer
    operation create(name: string email: string) -> Customer
    operation getOrders(customerId: number) -> Order[]
    operation deactivate(id: number) -> boolean
}

// Process flow
workflow CustomerOnboarding {
    description "New customer registration"

    step Register {
        action "Create customer account"
        next Verify
    }

    step Verify {
        action "Verify email address"
        next Welcome
    }

    step Welcome {
        action "Send welcome email"
    }
}

// Application bundle
application CustomerPortal {
    description "Customer self-service portal"
    version "1.0.0"
}
```

## Naming Conventions

| Element | Style | Example |
|---------|-------|---------|
| Entity | PascalCase | `Customer`, `OrderItem` |
| Service | PascalCase + "Service" | `CustomerService` |
| Workflow | PascalCase | `OrderProcessing` |
| Application | PascalCase | `CustomerPortal` |
| Property | camelCase | `firstName`, `orderDate` |
| Operation | camelCase | `findById`, `createOrder` |
| Step | PascalCase | `ProcessPayment` |

## File Extension

`.spdevkit`

