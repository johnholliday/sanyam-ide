---
title: "Tutorial"
description: "Build a complete e-commerce model step by step"
layout: layouts/doc.njk
eleventyNavigation:
  key: Tutorial
  parent: Language
  order: 3
---

# Tutorial: Building an E-Commerce Model

In this tutorial, you'll build a complete e-commerce application model from scratch. By the end, you'll understand how to use all SPDevKit constructs together.

## What We'll Build

An e-commerce system with:
- Product catalog management
- Customer accounts
- Order processing
- Fulfillment workflow

## Step 1: Define the Data Model

Start with the core entities. Create a new file called `ecommerce.spdevkit`.

### Products

```spdevkit
entity Product {
    id: number
    name: string
    description: string
    price: number
    inStock: boolean
    category: string
}
```

This defines a product with essential fields. The `inStock` boolean tracks availability.

### Categories

Let's add a proper category entity:

```spdevkit
entity Category {
    id: number
    name: string
    description: string
}

entity Product {
    id: number
    name: string
    description: string
    price: number
    inStock: boolean
    category: Category  // Now references Category entity
}
```

### Customers

```spdevkit
entity Address {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
}

entity Customer {
    id: number
    firstName: string
    lastName: string
    email: string
    phone: string
    billingAddress: Address
    shippingAddress: Address
    createdAt: date
}
```

Notice how `Customer` references `Address` twice - for billing and shipping.

### Orders

```spdevkit
entity OrderItem {
    product: Product
    quantity: number
    unitPrice: number
}

entity Order {
    id: number
    customer: Customer
    items: OrderItem[]
    subtotal: number
    tax: number
    total: number
    status: string = "pending"
    createdAt: date
}
```

The `Order` entity ties everything together with:
- A reference to `Customer`
- An array of `OrderItem` entities
- A default status of "pending"

## Step 2: Add Business Services

Now define the operations your system needs.

### Product Service

```spdevkit
service ProductService {
    description "Manages product catalog"

    operation findById(id: number) -> Product
    operation findByCategory(categoryId: number) -> Product[]
    operation search(query: string) -> Product[]
    operation create(name: string price: number categoryId: number) -> Product
    operation updatePrice(id: number price: number) -> Product
    operation updateStock(id: number inStock: boolean) -> boolean
}
```

### Customer Service

```spdevkit
service CustomerService {
    description "Manages customer accounts"

    operation findById(id: number) -> Customer
    operation findByEmail(email: string) -> Customer
    operation register(firstName: string lastName: string email: string) -> Customer
    operation updateAddress(id: number address: Address) -> Customer
    operation deactivate(id: number) -> boolean
}
```

### Order Service

```spdevkit
service OrderService {
    description "Handles order operations"

    operation create(customerId: number items: OrderItem[]) -> Order
    operation findById(id: number) -> Order
    operation findByCustomer(customerId: number) -> Order[]
    operation updateStatus(id: number status: string) -> Order
    operation calculateTotal(id: number) -> number
    operation cancel(id: number) -> boolean
}
```

## Step 3: Model the Order Workflow

Define the steps an order goes through:

```spdevkit
workflow OrderFulfillment {
    description "Complete order processing from placement to delivery"

    step ValidateOrder {
        action "Verify order details, check inventory, validate payment method"
        next ProcessPayment
    }

    step ProcessPayment {
        action "Charge customer payment method, create transaction record"
        next AllocateInventory
    }

    step AllocateInventory {
        action "Reserve inventory items, update stock levels"
        next PrepareShipment
    }

    step PrepareShipment {
        action "Pick items, pack order, generate shipping label"
        next Ship
    }

    step Ship {
        action "Hand off to carrier, record tracking number"
        next NotifyCustomer
    }

    step NotifyCustomer {
        action "Send shipping confirmation email with tracking details"
    }
}
```

Each step:
- Has a clear `action` description
- Points to the `next` step (except the final step)

## Step 4: Add a Customer Workflow

```spdevkit
workflow CustomerRegistration {
    description "New customer onboarding process"

    step CreateAccount {
        action "Create customer record with provided information"
        next SendVerification
    }

    step SendVerification {
        action "Send email verification link to customer"
        next AwaitVerification
    }

    step AwaitVerification {
        action "Wait for customer to click verification link"
        next ActivateAccount
    }

    step ActivateAccount {
        action "Mark account as verified and active"
        next SendWelcome
    }

    step SendWelcome {
        action "Send welcome email with getting started guide"
    }
}
```

## Step 5: Define the Application

Bundle everything into an application:

```spdevkit
application ECommerceStore {
    description "Full-featured e-commerce platform"
    version "1.0.0"
}
```

## Complete Model

Here's the complete `ecommerce.spdevkit` file:

```spdevkit
// ===========================================
// E-Commerce Application Model
// ===========================================

// ---------------------
// Data Entities
// ---------------------

entity Category {
    id: number
    name: string
    description: string
}

entity Product {
    id: number
    name: string
    description: string
    price: number
    inStock: boolean
    category: Category
}

entity Address {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
}

entity Customer {
    id: number
    firstName: string
    lastName: string
    email: string
    phone: string
    billingAddress: Address
    shippingAddress: Address
    createdAt: date
}

entity OrderItem {
    product: Product
    quantity: number
    unitPrice: number
}

entity Order {
    id: number
    customer: Customer
    items: OrderItem[]
    subtotal: number
    tax: number
    total: number
    status: string = "pending"
    createdAt: date
}

// ---------------------
// Business Services
// ---------------------

service ProductService {
    description "Manages product catalog"
    operation findById(id: number) -> Product
    operation findByCategory(categoryId: number) -> Product[]
    operation search(query: string) -> Product[]
    operation create(name: string price: number categoryId: number) -> Product
    operation updatePrice(id: number price: number) -> Product
    operation updateStock(id: number inStock: boolean) -> boolean
}

service CustomerService {
    description "Manages customer accounts"
    operation findById(id: number) -> Customer
    operation findByEmail(email: string) -> Customer
    operation register(firstName: string lastName: string email: string) -> Customer
    operation updateAddress(id: number address: Address) -> Customer
    operation deactivate(id: number) -> boolean
}

service OrderService {
    description "Handles order operations"
    operation create(customerId: number items: OrderItem[]) -> Order
    operation findById(id: number) -> Order
    operation findByCustomer(customerId: number) -> Order[]
    operation updateStatus(id: number status: string) -> Order
    operation calculateTotal(id: number) -> number
    operation cancel(id: number) -> boolean
}

// ---------------------
// Process Workflows
// ---------------------

workflow OrderFulfillment {
    description "Complete order processing from placement to delivery"

    step ValidateOrder {
        action "Verify order details, check inventory, validate payment method"
        next ProcessPayment
    }

    step ProcessPayment {
        action "Charge customer payment method, create transaction record"
        next AllocateInventory
    }

    step AllocateInventory {
        action "Reserve inventory items, update stock levels"
        next PrepareShipment
    }

    step PrepareShipment {
        action "Pick items, pack order, generate shipping label"
        next Ship
    }

    step Ship {
        action "Hand off to carrier, record tracking number"
        next NotifyCustomer
    }

    step NotifyCustomer {
        action "Send shipping confirmation email with tracking details"
    }
}

workflow CustomerRegistration {
    description "New customer onboarding process"

    step CreateAccount {
        action "Create customer record with provided information"
        next SendVerification
    }

    step SendVerification {
        action "Send email verification link to customer"
        next AwaitVerification
    }

    step AwaitVerification {
        action "Wait for customer to click verification link"
        next ActivateAccount
    }

    step ActivateAccount {
        action "Mark account as verified and active"
        next SendWelcome
    }

    step SendWelcome {
        action "Send welcome email with getting started guide"
    }
}

// ---------------------
// Application
// ---------------------

application ECommerceStore {
    description "Full-featured e-commerce platform"
    version "1.0.0"
}
```

## Key Takeaways

1. **Start with entities** - Define your data model first
2. **Use references** - Connect entities through typed references
3. **Add services** - Define operations that work with your entities
4. **Model workflows** - Capture multi-step processes explicitly
5. **Bundle in application** - Wrap everything with metadata

## Next Steps

- Explore the [Examples](/examples/) for more patterns
- Read the [Complete Reference](/language/reference/) for all syntax details
- Use the [Quick Reference](/language/quick-reference/) as a handy cheatsheet

