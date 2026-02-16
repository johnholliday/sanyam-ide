---
title: "Ports & Connections"
description: "PortConfig and ConnectionRule for node connection points"
layout: layouts/doc.njk
eleventyNavigation:
  key: Ports & Connections
  parent: Grammar Manifest
  order: 4
---

Ports are named connection points on diagram nodes. Connection rules define which edges can connect between which ports and node types. Together they provide fine-grained control over diagram connectivity.

## PortConfig

Ports appear as small shapes on node boundaries. They serve as anchor points for edges and can restrict which edge types may connect.

```typescript
interface PortConfig {
  readonly id: string;
  readonly label?: string;
  readonly position: PortPosition;
  readonly offset?: number;
  readonly style?: PortStyle;
  readonly allowedConnections?: readonly string[];
}
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | — | Unique identifier within the node. Referenced in connection rules. |
| `label` | `string` | `id` | Display label shown on hover. |
| `position` | `PortPosition` | — | Which edge of the node: `'top'`, `'bottom'`, `'left'`, or `'right'`. |
| `offset` | `number` | `0.5` | Position along the edge as a fraction (0-1). 0 = start, 0.5 = center, 1 = end. |
| `style` | `PortStyle` | `'circle'` | Visual shape: `'circle'`, `'square'`, or `'diamond'`. |
| `allowedConnections` | `string[]` | all | Edge types that can connect to this port. If omitted, any edge type is allowed. |

### Example

```typescript
diagramNode: {
  glspType: 'node:process',
  shape: 'rectangle',
  cssClass: 'MyLang.Process',
  defaultSize: { width: 160, height: 80 },
  ports: [
    {
      id: 'input',
      label: 'Data Input',
      position: 'left',
      offset: 0.5,
      style: 'circle',
      allowedConnections: ['edge:data-flow'],
    },
    {
      id: 'output',
      label: 'Data Output',
      position: 'right',
      offset: 0.5,
      style: 'circle',
      allowedConnections: ['edge:data-flow'],
    },
    {
      id: 'control',
      label: 'Control Signal',
      position: 'top',
      offset: 0.5,
      style: 'diamond',
      allowedConnections: ['edge:control-flow'],
    },
  ],
}
```

### Port Positioning

Ports are positioned along the node boundary based on `position` and `offset`:

```
              top (offset 0→1)
         ┌────────────────────┐
         │  0.0   0.5   1.0  │
 left    │                    │   right
(offset  │ 0.0          0.0  │  (offset
 0→1)    │ 0.5          0.5  │   0→1)
         │ 1.0          1.0  │
         └────────────────────┘
             bottom (offset 0→1)
```

For `position: 'left'` and `position: 'right'`, `offset` runs top-to-bottom. For `position: 'top'` and `position: 'bottom'`, `offset` runs left-to-right.

## ConnectionRule

Connection rules validate edge creation between nodes. When a user attempts to draw an edge, the platform checks all applicable rules. A connection is allowed if at least one rule matches.

```typescript
interface ConnectionRule {
  readonly sourceType: string;
  readonly sourcePort?: string;
  readonly targetType: string;
  readonly targetPort?: string;
  readonly edgeType: string;
  readonly allowSelfConnection?: boolean;
}
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `sourceType` | `string` | — | GLSP type of the source node. Use `'*'` to match any type. |
| `sourcePort` | `string` | any | Port ID on the source. Omit or use `'*'` to match any port. |
| `targetType` | `string` | — | GLSP type of the target node. Use `'*'` to match any type. |
| `targetPort` | `string` | any | Port ID on the target. Omit or use `'*'` to match any port. |
| `edgeType` | `string` | — | GLSP type of the edge to create. |
| `allowSelfConnection` | `boolean` | `false` | Whether source and target can be the same node. |

### Matching Logic

All specified fields must match for a rule to apply (AND logic). Omitted optional fields match anything. At least one rule must match for a connection to be allowed.

### Examples

```typescript
// Data can flow from Process output to Storage input
{
  sourceType: 'node:process',
  sourcePort: 'output',
  targetType: 'node:storage',
  targetPort: 'input',
  edgeType: 'edge:data-flow',
}

// Any node can reference any other node
{
  sourceType: '*',
  targetType: '*',
  edgeType: 'edge:reference',
}

// Control flow between any nodes via control ports
{
  sourceType: '*',
  sourcePort: 'control',
  targetType: '*',
  targetPort: 'control',
  edgeType: 'edge:control-flow',
}

// Allow self-loops for feedback connections
{
  sourceType: 'node:process',
  targetType: 'node:process',
  edgeType: 'edge:feedback',
  allowSelfConnection: true,
}
```

## Configuring in DiagramTypeConfig

Connection rules are specified at the diagram type level:

```typescript
{
  id: 'my-lang-diagram',
  displayName: 'My Diagram',
  fileType: 'Model',
  nodeTypes: [
    { glspType: 'node:process', creatable: true, showable: true },
    { glspType: 'node:storage', creatable: true, showable: true },
  ],
  edgeTypes: [
    { glspType: 'edge:data-flow', creatable: true, showable: true },
    { glspType: 'edge:reference', creatable: true, showable: true },
  ],
  connectionRules: [
    {
      sourceType: 'node:process',
      sourcePort: 'output',
      targetType: 'node:storage',
      targetPort: 'input',
      edgeType: 'edge:data-flow',
    },
    {
      sourceType: '*',
      targetType: '*',
      edgeType: 'edge:reference',
    },
  ],
  toolPalette: { /* ... */ },
}
```

## No Rules Defined

If `connectionRules` is omitted or empty, all connections are allowed between any nodes. This is the default behavior and works well for simple grammars.
