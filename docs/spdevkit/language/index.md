---
title: "Language Reference"
description: "Complete documentation for the SPDevKit domain-specific language"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language
  order: 3
---

# SPDevKit Language Reference

SPDevKit is a domain-specific language for modeling application architectures. This section provides comprehensive documentation for all language constructs.

## Language Overview

SPDevKit models consist of four primary element types:

| Element | Purpose | Example Use Case |
|---------|---------|------------------|
| **Entity** | Define data models | Customer, Order, Product |
| **Service** | Define business operations | CustomerService, OrderProcessor |
| **Workflow** | Model multi-step processes | OrderFulfillment, UserOnboarding |
| **Application** | Bundle components | CustomerPortal, AdminDashboard |

## File Structure

SPDevKit files use the `.spdevkit` extension and contain one or more elements:

```spdevkit
// Comments describe the model
entity Customer {
    id: number
    name: string
}

service CustomerService {
    description "Customer operations"
    operation findById(id: number) -> Customer
}

workflow Onboarding {
    step Register {
        action "Create account"
    }
}

application CustomerApp {
    description "Customer management"
    version "1.0.0"
}
```

## Documentation Sections

### [Quick Reference](/language/quick-reference/)
A compact cheatsheet with all syntax patterns on a single page.

### [Complete Reference](/language/reference/)
Detailed documentation of every language construct with examples.

### [Tutorial](/language/tutorial/)
A guided walkthrough building a complete application model.

## Grammar Rules

SPDevKit follows these fundamental rules:

1. **Elements are top-level** - Entities, services, workflows, and applications are declared at the root level
2. **Curly braces define scope** - All element bodies are enclosed in `{}`
3. **Properties have types** - Entity properties must specify a type
4. **Names are identifiers** - Element and property names follow standard identifier rules (letters, numbers, underscores)

## Type System

### Primitive Types

SPDevKit provides four built-in primitive types:

- `string` - Text values
- `number` - Numeric values (integers and decimals)
- `boolean` - True/false values
- `date` - Date and timestamp values

### Entity References

Properties can reference other entities by name:

```spdevkit
entity Address {
    street: string
    city: string
}

entity Customer {
    name: string
    address: Address  // Reference to Address entity
}
```

### Arrays

Use `[]` suffix to indicate array types:

```spdevkit
entity Order {
    items: OrderItem[]  // Array of OrderItem entities
}
```

## Comments

SPDevKit supports both comment styles:

```spdevkit
// Single-line comment

/*
 * Multi-line comment
 * spanning multiple lines
 */

entity Example {
    field: string  // Inline comment
}
```

## Best Practices

1. **Name entities as nouns** - `Customer`, `Order`, `Product`
2. **Name services with Service suffix** - `CustomerService`, `OrderService`
3. **Name workflows descriptively** - `CustomerOnboarding`, `OrderProcessing`
4. **Use camelCase for properties** - `firstName`, `orderDate`, `isActive`
5. **Add descriptions** - Document services and workflows with description strings

