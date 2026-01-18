---
title: "Service Operations"
description: "Services with entity type parameters and returns"
layout: layouts/doc.njk
eleventyNavigation:
  key: Service Operations
  parent: Examples
  order: 5
---

# Service Operations

Demonstrates services with entity types in operation signatures.

## The Code

```spdevkit
// Intermediate Example: Service with complex operations
// Demonstrates services with multiple operations and entity type references

entity Product {
    productId: number
    name: string
    price: number
    inStock: boolean
}

entity CartItem {
    product: Product
    quantity: number
}

service InventoryService {
    description "Manages product inventory and stock levels"
    operation findProduct(productId: number) -> Product
    operation updateStock(productId: number quantity: number) -> boolean
    operation checkAvailability(productId: number) -> boolean
}

service CartService {
    description "Shopping cart management service"
    operation addToCart(product: Product quantity: number) -> CartItem
    operation removeFromCart(productId: number)
    operation getCartTotal() -> number
    operation clearCart()
}
```

## What This Demonstrates

### Entity Return Types

Operations can return entity types:

```spdevkit
operation findProduct(productId: number) -> Product
```

### Entity Parameters

Operations can accept entity types as parameters:

```spdevkit
operation addToCart(product: Product quantity: number) -> CartItem
```

### Multiple Services

A model can have multiple related services:

| Service | Purpose |
|---------|---------|
| `InventoryService` | Manages product inventory |
| `CartService` | Handles shopping cart |

### Operation Categories

**Query Operations** - Return data without side effects:
```spdevkit
operation findProduct(productId: number) -> Product
operation checkAvailability(productId: number) -> boolean
operation getCartTotal() -> number
```

**Command Operations** - Modify state:
```spdevkit
operation updateStock(productId: number quantity: number) -> boolean
operation addToCart(product: Product quantity: number) -> CartItem
operation removeFromCart(productId: number)
operation clearCart()
```

### No Parameters

Operations can have no parameters:

```spdevkit
operation getCartTotal() -> number
operation clearCart()
```

## Service Design Patterns

### Repository Pattern

```spdevkit
service ProductRepository {
    description "Data access for products"
    operation findById(id: number) -> Product
    operation findAll() -> Product[]
    operation save(product: Product) -> Product
    operation delete(id: number) -> boolean
}
```

### Facade Pattern

```spdevkit
service ShoppingFacade {
    description "Simplified shopping interface"
    operation browse(category: string) -> Product[]
    operation addToCart(productId: number) -> boolean
    operation checkout() -> Order
}
```

### Domain Service

```spdevkit
service PricingService {
    description "Calculates prices and discounts"
    operation calculateSubtotal(items: CartItem[]) -> number
    operation applyDiscount(subtotal: number code: string) -> number
    operation calculateTax(amount: number region: string) -> number
    operation calculateTotal(subtotal: number tax: number) -> number
}
```

## Combining with Entities

A complete module with entities and services:

```spdevkit
entity Product {
    id: number
    name: string
    price: number
    stock: number
}

entity OrderItem {
    product: Product
    quantity: number
    subtotal: number
}

entity Order {
    orderId: number
    items: OrderItem[]
    total: number
    status: string
}

service OrderService {
    description "Order management"
    operation createOrder(items: OrderItem[]) -> Order
    operation getOrder(orderId: number) -> Order
    operation cancelOrder(orderId: number) -> boolean
}

service InventoryService {
    description "Inventory management"
    operation checkStock(productId: number) -> number
    operation reserveStock(productId: number quantity: number) -> boolean
    operation releaseStock(productId: number quantity: number) -> boolean
}
```

## Next Steps

- [Complete Application](/examples/advanced-complete-application/) - See services in a full system

