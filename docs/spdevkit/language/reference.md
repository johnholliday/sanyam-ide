---
title: "Complete Reference"
description: "Detailed syntax documentation for all SPDevKit language constructs"
layout: layouts/doc.njk
eleventyNavigation:
  key: Reference
  parent: Language
  order: 1
---

# Complete Language Reference

This page documents every construct in the SPDevKit language with detailed syntax and examples.

## Entity

Entities define data models with typed properties.

### Syntax

```
entity <Name> {
    <property>: <type>
    <property>: <type> = <default>
    ...
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `entity` | Yes | Keyword to declare an entity |
| `Name` | Yes | PascalCase identifier |
| Properties | No | Zero or more property declarations |

### Property Types

Properties support these type specifications:

| Type | Syntax | Description |
|------|--------|-------------|
| Primitive | `string`, `number`, `boolean`, `date` | Built-in types |
| Reference | `EntityName` | Reference to another entity |
| Array | `type[]` | Array of any type |

### Default Values

Properties can have default values:

```spdevkit
entity Configuration {
    maxRetries: number = "3"
    timeout: number = "30000"
    enabled: boolean = "true"
    environment: string = "production"
}
```

### Examples

**Simple Entity:**

```spdevkit
entity User {
    id: number
    username: string
    email: string
    active: boolean
}
```

**Entity with References:**

```spdevkit
entity Address {
    street: string
    city: string
    country: string
    zipCode: string
}

entity Customer {
    id: number
    name: string
    email: string
    billingAddress: Address
    shippingAddress: Address
    orders: Order[]
}
```

**Entity with Defaults:**

```spdevkit
entity Task {
    id: number
    title: string
    status: string = "pending"
    priority: number = "1"
    completed: boolean = "false"
}
```

---

## Service

Services define business logic components with operations.

### Syntax

```
service <Name> {
    description "<text>"
    operation <name>(<params>) -> <returnType>
    operation <name>(<params>)
    ...
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `service` | Yes | Keyword to declare a service |
| `Name` | Yes | PascalCase identifier, typically ending in "Service" |
| `description` | No | Optional description string |
| Operations | No | Zero or more operation declarations |

### Operation Syntax

Operations define callable methods:

```
operation <name>(<parameters>) -> <returnType>
operation <name>(<parameters>)  // void return
```

**Parameters:**

- Zero or more parameters
- Each parameter: `name: type`
- Multiple parameters separated by spaces (no commas)

**Return Types:**

- Optional, specified with `->`
- Can be primitive, entity reference, or array

### Examples

**Simple Service:**

```spdevkit
service UserService {
    description "Manages user accounts"
    operation findById(id: number) -> User
    operation findByEmail(email: string) -> User
    operation create(username: string email: string) -> User
    operation delete(id: number)
}
```

**Service with Complex Operations:**

```spdevkit
service OrderService {
    description "Handles order processing"
    operation createOrder(customerId: number items: OrderItem[]) -> Order
    operation getOrdersByCustomer(customerId: number) -> Order[]
    operation updateStatus(orderId: number status: string) -> boolean
    operation calculateTotal(orderId: number) -> number
    operation cancelOrder(orderId: number)
}
```

**Minimal Service:**

```spdevkit
service HealthService {
    operation ping() -> boolean
}
```

---

## Workflow

Workflows model sequential multi-step processes.

### Syntax

```
workflow <Name> {
    description "<text>"

    step <StepName> {
        action "<description>"
        next <NextStepName>
    }

    step <FinalStepName> {
        action "<description>"
    }
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `workflow` | Yes | Keyword to declare a workflow |
| `Name` | Yes | PascalCase identifier |
| `description` | No | Optional workflow description |
| Steps | Yes | One or more step declarations |

### Step Syntax

Steps define individual stages in the workflow:

| Component | Required | Description |
|-----------|----------|-------------|
| `step` | Yes | Keyword to declare a step |
| `StepName` | Yes | PascalCase identifier |
| `action` | Yes | Description string of what happens |
| `next` | No | Reference to next step (omit for final step) |

### Examples

**Simple Workflow:**

```spdevkit
workflow UserRegistration {
    description "New user signup process"

    step CreateAccount {
        action "Create user account with credentials"
        next VerifyEmail
    }

    step VerifyEmail {
        action "Send verification email and wait for confirmation"
        next Welcome
    }

    step Welcome {
        action "Send welcome message and complete onboarding"
    }
}
```

**Complex Workflow:**

```spdevkit
workflow OrderFulfillment {
    description "End-to-end order processing workflow"

    step ValidateOrder {
        action "Validate order details and inventory availability"
        next ProcessPayment
    }

    step ProcessPayment {
        action "Charge payment method and create transaction record"
        next PrepareShipment
    }

    step PrepareShipment {
        action "Pick, pack, and prepare items for shipping"
        next Ship
    }

    step Ship {
        action "Hand off to carrier and generate tracking number"
        next NotifyCustomer
    }

    step NotifyCustomer {
        action "Send shipping confirmation with tracking details"
    }
}
```

**Minimal Workflow:**

```spdevkit
workflow SimpleTask {
    step Execute {
        action "Perform the task"
    }
}
```

---

## Application

Applications bundle related entities, services, and metadata.

### Syntax

```
application <Name> {
    description "<text>"
    version "<semver>"
}
```

### Components

| Component | Required | Description |
|-----------|----------|-------------|
| `application` | Yes | Keyword to declare an application |
| `Name` | Yes | PascalCase identifier |
| `description` | No | Optional application description |
| `version` | No | Semantic version string |

### Examples

**Simple Application:**

```spdevkit
application CustomerPortal {
    description "Self-service customer portal"
    version "1.0.0"
}
```

**Minimal Application:**

```spdevkit
application MyApp {
    version "0.1.0"
}
```

**Application with Full Model:**

```spdevkit
// Data layer
entity User {
    id: number
    name: string
    email: string
}

// Business layer
service UserService {
    description "User management"
    operation findById(id: number) -> User
    operation create(name: string email: string) -> User
}

// Process layer
workflow UserOnboarding {
    step Register {
        action "Create user account"
        next Verify
    }
    step Verify {
        action "Verify email address"
    }
}

// Application definition
application UserManagement {
    description "Complete user management system"
    version "2.1.0"
}
```

---

## Comments

SPDevKit supports single-line and multi-line comments.

### Single-Line Comments

```spdevkit
// This is a single-line comment
entity Example {
    field: string  // Inline comment
}
```

### Multi-Line Comments

```spdevkit
/*
 * This is a multi-line comment.
 * It can span multiple lines.
 * Useful for detailed documentation.
 */
entity Documented {
    field: string
}
```

---

## Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| Entity | PascalCase noun | `Customer`, `OrderItem`, `UserProfile` |
| Service | PascalCase with "Service" | `CustomerService`, `OrderService` |
| Workflow | PascalCase descriptive | `OrderProcessing`, `UserOnboarding` |
| Application | PascalCase | `CustomerPortal`, `AdminDashboard` |
| Property | camelCase | `firstName`, `orderDate`, `isActive` |
| Operation | camelCase verb | `findById`, `createOrder`, `updateStatus` |
| Step | PascalCase action | `ValidateInput`, `ProcessPayment`, `SendNotification` |

---

## Reserved Words

The following words are reserved and cannot be used as identifiers:

- `entity`
- `service`
- `workflow`
- `application`
- `operation`
- `step`
- `description`
- `version`
- `action`
- `next`
- `string`
- `number`
- `boolean`
- `date`

