---
title: "Getting Started"
description: "Learn the basics of SPDevKit and create your first application model"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---

# Getting Started with SPDevKit

This guide walks you through creating your first SPDevKit model, from simple entities to a complete application.

## Prerequisites

- A text editor with SPDevKit support
- Basic understanding of data modeling concepts

## Your First Entity

Create a new file with the `.spdevkit` extension. Let's start with a simple entity:

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
    active: boolean
}
```

This defines a `Customer` entity with four properties:
- `id` - A numeric identifier
- `name` - The customer's name (text)
- `email` - Email address (text)
- `active` - Whether the customer is active (true/false)

## Primitive Types

SPDevKit supports four primitive types:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | `"Hello"` |
| `number` | Numeric values | `42`, `3.14` |
| `boolean` | True/false values | `true`, `false` |
| `date` | Date values | Timestamps |

## Entity Relationships

Entities can reference other entities:

```spdevkit
entity Address {
    street: string
    city: string
    zipCode: string
}

entity Customer {
    id: number
    name: string
    billingAddress: Address
    shippingAddress: Address
}
```

Here, `Customer` has two properties that reference the `Address` entity.

## Default Values

Properties can have default values:

```spdevkit
entity Order {
    orderId: number
    status: string = "pending"
    priority: number = "1"
}
```

## Creating a Service

Services contain business logic operations:

```spdevkit
service CustomerService {
    description "Manages customer accounts"

    operation findById(id: number) -> Customer
    operation findByEmail(email: string) -> Customer
    operation create(name: string email: string) -> Customer
    operation update(id: number name: string) -> boolean
    operation delete(id: number)
}
```

### Operation Syntax

Operations follow this pattern:

```
operation <name>(<parameters>) -> <returnType>
```

- **Parameters**: Zero or more `name: type` pairs
- **Return type**: Optional, specified with `->`

## Creating a Workflow

Workflows model sequential processes:

```spdevkit
workflow CustomerOnboarding {
    description "New customer registration workflow"

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
```

### Workflow Steps

Each step has:
- **action**: Description of what happens in this step
- **next**: Reference to the next step (optional for final step)

## Defining an Application

Bundle everything into an application:

```spdevkit
application CustomerPortal {
    description "Customer self-service portal"
    version "1.0.0"
}
```

## Complete Example

Here's a complete SPDevKit model:

```spdevkit
// Data Model
entity Customer {
    id: number
    name: string
    email: string
    active: boolean
}

// Business Logic
service CustomerService {
    description "Customer management service"
    operation findById(id: number) -> Customer
    operation create(name: string email: string) -> Customer
}

// Process Flow
workflow Registration {
    description "Customer registration process"

    step Create {
        action "Create customer record"
        next Notify
    }

    step Notify {
        action "Send confirmation"
    }
}

// Application Definition
application CustomerApp {
    description "Customer management application"
    version "1.0.0"
}
```

## Comments

SPDevKit supports single-line and multi-line comments:

```spdevkit
// This is a single-line comment

/*
 * This is a multi-line comment
 * spanning multiple lines
 */
entity Example {
    field: string  // Inline comment
}
```

## Next Steps

- Explore the [Language Reference](/language/) for complete syntax documentation
- See [Examples](/examples/) for real-world patterns
- Try the [Tutorial](/language/tutorial/) for a guided learning path
