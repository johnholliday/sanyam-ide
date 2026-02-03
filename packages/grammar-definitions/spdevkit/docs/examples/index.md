---
title: "Examples"
description: "Real-world SPDevKit examples from basic to advanced"
layout: layouts/doc.njk
eleventyNavigation:
  key: Examples
  order: 4
---

# SPDevKit Examples

Learn SPDevKit through practical examples, organized from basic to advanced.

## Basic Examples

Start here if you're new to SPDevKit.

### [Simple Entity](/examples/basic-simple-entity/)
A minimal entity definition with primitive types.

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
    active: boolean
}
```

### [Simple Service](/examples/basic-simple-service/)
A service with basic CRUD operations.

```spdevkit
service CustomerService {
    description "Service for managing customer data"
    operation findById(id: number) -> string
    operation create(name: string email: string) -> number
    operation delete(id: number)
}
```

### [Simple Workflow](/examples/basic-simple-workflow/)
A sequential workflow with three steps.

```spdevkit
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

---

## Intermediate Examples

Build on the basics with relationships and more complex patterns.

### [Entity Relationships](/examples/intermediate-entity-relationships/)
Multiple entities with references and default values.

```spdevkit
entity Address {
    street: string
    city: string
    zipCode: string
    country: string = "USA"
}

entity Customer {
    id: number
    firstName: string
    lastName: string
    billingAddress: Address
    shippingAddress: Address
}
```

### [Service Operations](/examples/intermediate-service-operations/)
Services with entity type parameters and returns.

```spdevkit
service InventoryService {
    description "Manages product inventory and stock levels"
    operation findProduct(productId: number) -> Product
    operation updateStock(productId: number quantity: number) -> boolean
    operation checkAvailability(productId: number) -> boolean
}
```

---

## Advanced Examples

### [Complete Application](/examples/advanced-complete-application/)
A full e-commerce system demonstrating all SPDevKit constructs working together:
- 5 interconnected entities
- 4 business services
- 2 process workflows
- Application definition

---

## Example File Locations

All examples are available in the workspace:

| Example | File |
|---------|------|
| Simple Entity | `workspace/spdevkit/basic-simple-entity.spdevkit` |
| Simple Service | `workspace/spdevkit/basic-simple-service.spdevkit` |
| Simple Workflow | `workspace/spdevkit/basic-simple-workflow.spdevkit` |
| Entity Relationships | `workspace/spdevkit/intermediate-entity-relationships.spdevkit` |
| Service Operations | `workspace/spdevkit/intermediate-service-operations.spdevkit` |
| Complete Application | `workspace/spdevkit/advanced-complete-application.spdevkit` |

## Creating New Files

Use the template at `workspace/spdevkit/templates/new-file.spdevkit` as a starting point for new SPDevKit files.

