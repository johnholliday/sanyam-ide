---
title: "Entity Relationships"
description: "Multiple entities with references and default values"
layout: layouts/doc.njk
eleventyNavigation:
  key: Entity Relationships
  parent: Examples
  order: 4
---

# Entity Relationships

Demonstrates how entities can reference each other and use default values.

## The Code

```spdevkit
// Intermediate Example: Entities with relationships
// Demonstrates entity references and default values

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
    email: string
    active: boolean
    registrationDate: date
    billingAddress: Address
    shippingAddress: Address
}

entity Order {
    orderId: number
    orderDate: date
    customer: Customer
    total: number
    status: string = "pending"
}
```

## What This Demonstrates

### Entity References

Entities can reference other entities as property types:

```spdevkit
entity Customer {
    billingAddress: Address   // References Address entity
    shippingAddress: Address  // Another reference to Address
}
```

### Multiple References

A single entity can have multiple references to the same type:

| Property | Type | Description |
|----------|------|-------------|
| `billingAddress` | `Address` | Customer's billing address |
| `shippingAddress` | `Address` | Customer's shipping address |

### Chained References

Entities can reference entities that reference other entities:

```spdevkit
entity Order {
    customer: Customer  // Customer has Address references
}
```

This creates a relationship chain: `Order → Customer → Address`

### Default Values

Properties can have default values:

```spdevkit
entity Address {
    country: string = "USA"  // Defaults to "USA"
}

entity Order {
    status: string = "pending"  // Defaults to "pending"
}
```

### The `date` Type

The `date` type is used for timestamps:

```spdevkit
entity Customer {
    registrationDate: date
}

entity Order {
    orderDate: date
}
```

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Order     │────▶│   Customer   │────▶│   Address    │
│              │     │              │     │              │
│ orderId      │     │ id           │     │ street       │
│ orderDate    │     │ firstName    │     │ city         │
│ customer ────┼─────│ lastName     │     │ zipCode      │
│ total        │     │ email        │     │ country      │
│ status       │     │ active       │     └──────────────┘
└──────────────┘     │ registrationDate   ▲
                     │ billingAddress ────┘
                     │ shippingAddress ───┘
                     └──────────────┘
```

## Common Patterns

### Self-Referencing Entities

```spdevkit
entity Employee {
    id: number
    name: string
    manager: Employee  // References itself
}
```

### One-to-Many with Arrays

```spdevkit
entity Customer {
    id: number
    name: string
    orders: Order[]  // Array of Order entities
}
```

### Composition Pattern

```spdevkit
entity LineItem {
    product: string
    quantity: number
    price: number
}

entity Invoice {
    invoiceNumber: number
    items: LineItem[]
    subtotal: number
    tax: number
    total: number
}
```

## Next Steps

- [Service Operations](/examples/intermediate-service-operations/) - Add business logic
- [Complete Application](/examples/advanced-complete-application/) - Full system example

