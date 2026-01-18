---
title: "Complete Application"
description: "A full e-commerce system demonstrating all SPDevKit constructs"
layout: layouts/doc.njk
eleventyNavigation:
  key: Complete Application
  parent: Examples
  order: 6
---

# Complete Application

A comprehensive e-commerce system demonstrating all SPDevKit constructs working together.

## Overview

This example includes:
- **5 Entities** - User, Product, Order, OrderItem, Payment
- **4 Services** - User, Product, Order, Payment services
- **2 Workflows** - Checkout and Order Fulfillment
- **1 Application** - The main application definition

## The Code

```spdevkit
// Advanced Example: A complete e-commerce application
// Demonstrates all SPDevKit constructs working together:
// entities, services, workflows, and application definition

// ============================================================================
// ENTITIES - Data model definitions
// ============================================================================

entity User {
    userId: number
    username: string
    email: string
    passwordHash: string
    active: boolean
    createdAt: date
}

entity Product {
    productId: number
    sku: string
    name: string
    price: number
    stockQuantity: number
    active: boolean
}

entity Order {
    orderId: number
    orderDate: date
    customer: User
    status: string = "pending"
    totalAmount: number
}

entity OrderItem {
    product: Product
    quantity: number
    unitPrice: number
}

entity Payment {
    paymentId: number
    order: Order
    amount: number
    method: string
    transactionDate: date
    successful: boolean
}

// ============================================================================
// SERVICES - Business logic components
// ============================================================================

service UserService {
    description "Handles user authentication and profile management"
    operation register(username: string email: string password: string) -> User
    operation authenticate(username: string password: string) -> boolean
    operation findById(userId: number) -> User
    operation updateProfile(userId: number email: string) -> boolean
    operation deactivate(userId: number) -> boolean
}

service ProductService {
    description "Manages product catalog and inventory"
    operation findAll() -> Product
    operation findById(productId: number) -> Product
    operation findBySku(sku: string) -> Product
    operation updateStock(productId: number quantity: number) -> boolean
    operation checkAvailability(productId: number quantity: number) -> boolean
}

service OrderService {
    description "Handles order creation and management"
    operation createOrder(customer: User) -> Order
    operation addItem(orderId: number product: Product quantity: number) -> OrderItem
    operation calculateTotal(orderId: number) -> number
    operation updateStatus(orderId: number status: string) -> boolean
    operation findByCustomer(customerId: number) -> Order
}

service PaymentService {
    description "Processes payments and refunds"
    operation processPayment(order: Order amount: number method: string) -> Payment
    operation verifyPayment(paymentId: number) -> boolean
    operation refund(paymentId: number amount: number) -> boolean
}

// ============================================================================
// WORKFLOWS - Process orchestration
// ============================================================================

workflow CheckoutWorkflow {
    description "Handles the complete checkout process"

    step ValidateCart {
        action "Verify all items are in stock"
        next CalculateTotal
    }

    step CalculateTotal {
        action "Calculate order total with taxes"
        next ProcessPayment
    }

    step ProcessPayment {
        action "Process customer payment"
        next ConfirmOrder
    }

    step ConfirmOrder {
        action "Confirm order and update inventory"
        next SendNotification
    }

    step SendNotification {
        action "Send order confirmation email"
    }
}

workflow OrderFulfillment {
    description "Manages order fulfillment from warehouse to delivery"

    step ReceiveOrder {
        action "Receive order from checkout"
        next PickItems
    }

    step PickItems {
        action "Pick items from warehouse"
        next PackOrder
    }

    step PackOrder {
        action "Pack items for shipping"
        next ShipOrder
    }

    step ShipOrder {
        action "Hand off to shipping carrier"
        next TrackDelivery
    }

    step TrackDelivery {
        action "Monitor delivery status"
        next CompleteOrder
    }

    step CompleteOrder {
        action "Mark order as delivered"
    }
}

// ============================================================================
// APPLICATION - Main deployable unit
// ============================================================================

application ECommerceApp {
    description "Complete e-commerce platform"
    version "1.0.0"
}
```

## Architecture Breakdown

### Data Layer (Entities)

The entity relationships form this structure:

```
┌─────────────┐     ┌─────────────┐
│   Payment   │────▶│    Order    │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    User     │     │   Product   │
                    └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  OrderItem  │
                                        └─────────────┘
```

### Business Layer (Services)

| Service | Responsibility | Key Operations |
|---------|---------------|----------------|
| `UserService` | Authentication & profiles | register, authenticate, updateProfile |
| `ProductService` | Catalog & inventory | findById, checkAvailability, updateStock |
| `OrderService` | Order management | createOrder, addItem, calculateTotal |
| `PaymentService` | Payment processing | processPayment, verifyPayment, refund |

### Process Layer (Workflows)

**CheckoutWorkflow** - Customer-facing checkout:
```
ValidateCart → CalculateTotal → ProcessPayment → ConfirmOrder → SendNotification
```

**OrderFulfillment** - Backend fulfillment:
```
ReceiveOrder → PickItems → PackOrder → ShipOrder → TrackDelivery → CompleteOrder
```

## Design Patterns Used

### Layered Architecture

The model separates concerns into layers:
1. **Data Layer** - Entities define the domain model
2. **Business Layer** - Services encapsulate operations
3. **Process Layer** - Workflows orchestrate sequences

### Single Responsibility

Each service has one clear purpose:
- `UserService` - Only user-related operations
- `ProductService` - Only product-related operations
- `OrderService` - Only order-related operations
- `PaymentService` - Only payment-related operations

### Entity Relationships

Entities reference each other to form a connected domain model:
- `Order.customer` → `User`
- `OrderItem.product` → `Product`
- `Payment.order` → `Order`

## Extending the Model

### Adding a Review System

```spdevkit
entity Review {
    reviewId: number
    product: Product
    user: User
    rating: number
    comment: string
    createdAt: date
}

service ReviewService {
    description "Manages product reviews"
    operation addReview(product: Product user: User rating: number comment: string) -> Review
    operation getProductReviews(productId: number) -> Review[]
    operation getAverageRating(productId: number) -> number
}
```

### Adding a Shipping System

```spdevkit
entity Shipment {
    shipmentId: number
    order: Order
    carrier: string
    trackingNumber: string
    status: string
    estimatedDelivery: date
}

service ShippingService {
    description "Manages order shipping"
    operation createShipment(order: Order carrier: string) -> Shipment
    operation updateTracking(shipmentId: number trackingNumber: string) -> boolean
    operation getStatus(shipmentId: number) -> string
}
```

## Key Takeaways

1. **Organize by layer** - Separate data, business logic, and processes
2. **Keep services focused** - One responsibility per service
3. **Connect entities** - Use references to model relationships
4. **Document workflows** - Capture important business processes
5. **Bundle with application** - Wrap everything with metadata

