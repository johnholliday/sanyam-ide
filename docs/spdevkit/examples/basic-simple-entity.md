---
title: "Simple Entity"
description: "A minimal entity definition with primitive types"
layout: layouts/doc.njk
eleventyNavigation:
  key: Simple Entity
  parent: Examples
  order: 1
---

# Simple Entity

A minimal entity definition demonstrating the basic Entity construct with primitive type properties.

## The Code

```spdevkit
// Basic Example: A simple entity definition
// Demonstrates the Entity construct with primitive type properties

entity Customer {
    id: number
    name: string
    email: string
    active: boolean
}
```

## What This Demonstrates

### Entity Declaration

The `entity` keyword declares a new data type:

```spdevkit
entity Customer {
    // properties go here
}
```

### Primitive Types

This example uses all four primitive types:

| Property | Type | Purpose |
|----------|------|---------|
| `id` | `number` | Numeric identifier |
| `name` | `string` | Text value |
| `email` | `string` | Text value |
| `active` | `boolean` | True/false flag |

### Property Syntax

Each property follows the pattern:

```
propertyName: type
```

## Common Patterns

### Adding More Properties

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
    phone: string
    active: boolean
    createdAt: date
}
```

### Adding Default Values

```spdevkit
entity Customer {
    id: number
    name: string
    email: string
    active: boolean = "true"
}
```

## Next Steps

- [Simple Service](/examples/basic-simple-service/) - Add operations for this entity
- [Entity Relationships](/examples/intermediate-entity-relationships/) - Connect multiple entities

