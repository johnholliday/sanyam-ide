---
title: "SPDevKit"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---

# SPDevKit

**SPDevKit** is a domain-specific language for modeling application architectures, including data entities, business services, and process workflows.

## Key Features

- **Entities** - Define data models with typed properties and relationships
- **Services** - Create business logic components with operations
- **Workflows** - Model process orchestration with sequential steps
- **Applications** - Bundle entities and services into deployable units

## Quick Example

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
    active: boolean
}

service CustomerService {
    description "Manages customer data"
    operation findById(id: number) -> Customer
    operation create(name: string email: string) -> Customer
}

workflow OnboardingWorkflow {
    description "New customer onboarding process"

    step CreateAccount {
        action "Create customer account"
        next VerifyEmail
    }

    step VerifyEmail {
        action "Send verification email"
        next Welcome
    }

    step Welcome {
        action "Send welcome message"
    }
}
```

## Getting Started

Ready to build your first SPDevKit application?

1. [Getting Started Guide](/getting-started/) - Learn the basics
2. [Language Reference](/language/) - Complete syntax documentation
3. [Examples](/examples/) - Real-world usage patterns

## Core Concepts

### Entities

Entities define your data model. Each entity has a name and properties with types:

```spdevkit
entity Product {
    productId: number
    name: string
    price: number
    inStock: boolean
}
```

### Services

Services contain your business logic as operations:

```spdevkit
service InventoryService {
    description "Manages product inventory"
    operation checkStock(productId: number) -> boolean
    operation updateQuantity(productId: number qty: number)
}
```

### Workflows

Workflows model multi-step processes:

```spdevkit
workflow OrderProcessing {
    step Validate {
        action "Validate order"
        next Process
    }

    step Process {
        action "Process payment"
    }
}
```

## File Extension

SPDevKit files use the `.spdevkit` extension.
