---
title: "Simple Service"
description: "A service with basic CRUD operations"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Service
  parent: Examples
  order: 2
---

# Simple Service

A service definition demonstrating operations with parameters and return types.

## The Code

```spdevkit
// Basic Example: A simple service definition
// Demonstrates the Service construct with operations

service CustomerService {
    description "Service for managing customer data"
    operation findById(id: number) -> string
    operation create(name: string email: string) -> number
    operation delete(id: number)
}
```

## What This Demonstrates

### Service Declaration

The `service` keyword declares a business logic component:

```spdevkit
service CustomerService {
    // description and operations go here
}
```

### Description

Services can have an optional description string:

```spdevkit
description "Service for managing customer data"
```

### Operations

Operations define callable methods with various signatures:

| Operation | Parameters | Return Type |
|-----------|------------|-------------|
| `findById` | `id: number` | `string` |
| `create` | `name: string`, `email: string` | `number` |
| `delete` | `id: number` | (none) |

### Operation Syntax Patterns

**With return type:**
```spdevkit
operation findById(id: number) -> string
```

**With multiple parameters:**
```spdevkit
operation create(name: string email: string) -> number
```

**Without return type (void):**
```spdevkit
operation delete(id: number)
```

## Common Patterns

### CRUD Operations

```spdevkit
service CustomerService {
    description "Customer CRUD operations"
    operation create(name: string email: string) -> number
    operation findById(id: number) -> Customer
    operation findAll() -> Customer
    operation update(id: number name: string email: string) -> boolean
    operation delete(id: number) -> boolean
}
```

### Entity Return Types

Return entity types instead of primitives:

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
}

service CustomerService {
    description "Customer management"
    operation findById(id: number) -> Customer
    operation create(name: string email: string) -> Customer
}
```

## Next Steps

- [Simple Workflow](/examples/basic-simple-workflow/) - Model a process
- [Service Operations](/examples/intermediate-service-operations/) - More complex service patterns

