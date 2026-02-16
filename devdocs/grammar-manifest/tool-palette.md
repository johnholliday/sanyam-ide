---
title: "Tool Palette"
description: "ToolPaletteConfig — tool groups, items, and creation actions"
layout: layouts/doc.njk
eleventyNavigation:
  key: Tool Palette
  parent: Grammar Manifest
  order: 3
---

The tool palette configuration defines the sidebar tools available in the diagram editor. Tools are organized into groups and each item triggers a creation action.

## ToolPaletteConfig

```typescript
interface ToolPaletteConfig {
  readonly groups: readonly ToolPaletteGroup[];
}
```

## ToolPaletteGroup

Groups organize related tools under a collapsible header.

```typescript
interface ToolPaletteGroup {
  readonly id: string;                          // Unique group identifier
  readonly label: string;                       // Display label
  readonly items: readonly ToolPaletteItem[];   // Tools in this group
}
```

## ToolPaletteItem

Each item represents a creatable element in the diagram.

```typescript
interface ToolPaletteItem {
  readonly id: string;           // Unique identifier
  readonly label: string;        // Display label
  readonly icon: string;         // VS Code Codicon name
  readonly action: ToolAction;   // Creation action
}
```

## ToolAction

```typescript
interface ToolAction {
  readonly type: ActionType;   // 'create-node' | 'create-edge'
  readonly glspType: string;   // GLSP type to create
}
```

The `type` field determines the creation mode:

- `create-node` — Click on the canvas to place a new node
- `create-edge` — Click a source node, then a target node to draw an edge

The `glspType` must match a type declared in the diagram type's `nodeTypes` or `edgeTypes`.

## Example

Here is the complete tool palette configuration from ECML's overview diagram:

```typescript
toolPalette: {
  groups: [
    {
      id: 'actors',
      label: 'Actors',
      items: [
        {
          id: 'create-actor',
          label: 'Actor',
          icon: 'person',
          action: { type: 'create-node', glspType: 'node:actor' },
        },
      ],
    },
    {
      id: 'activities',
      label: 'Activities & Tasks',
      items: [
        {
          id: 'create-activity',
          label: 'Activity',
          icon: 'checklist',
          action: { type: 'create-node', glspType: 'node:activity' },
        },
        {
          id: 'create-task',
          label: 'Task',
          icon: 'tasklist',
          action: { type: 'create-node', glspType: 'node:task' },
        },
      ],
    },
    {
      id: 'content',
      label: 'Content',
      items: [
        {
          id: 'create-content',
          label: 'Content',
          icon: 'file',
          action: { type: 'create-node', glspType: 'node:content' },
        },
      ],
    },
    {
      id: 'security',
      label: 'Security & Compliance',
      items: [
        {
          id: 'create-securitygroup',
          label: 'Security Group',
          icon: 'shield',
          action: { type: 'create-node', glspType: 'node:securitygroup' },
        },
        {
          id: 'create-permission',
          label: 'Permission',
          icon: 'key',
          action: { type: 'create-node', glspType: 'node:permission' },
        },
        {
          id: 'create-retentionlabel',
          label: 'Retention Label',
          icon: 'retention-label',
          action: { type: 'create-node', glspType: 'node:retentionlabel' },
        },
        {
          id: 'create-sensitivitylabel',
          label: 'Sensitivity Label',
          icon: 'sensitivity-label',
          action: { type: 'create-node', glspType: 'node:sensitivitylabel' },
        },
      ],
    },
    {
      id: 'workflows',
      label: 'Workflows',
      items: [
        {
          id: 'create-workflow',
          label: 'Workflow',
          icon: 'workflow',
          action: { type: 'create-node', glspType: 'node:workflow' },
        },
      ],
    },
    {
      id: 'edges',
      label: 'Connections',
      items: [
        {
          id: 'create-flow',
          label: 'Content Flow',
          icon: 'arrow-right',
          action: { type: 'create-edge', glspType: 'edge:flow' },
        },
        {
          id: 'create-assignment',
          label: 'Assignment',
          icon: 'link',
          action: { type: 'create-edge', glspType: 'edge:assignment' },
        },
        {
          id: 'create-reference',
          label: 'Reference',
          icon: 'references',
          action: { type: 'create-edge', glspType: 'edge:reference' },
        },
      ],
    },
  ],
}
```

## Best Practices

- **Group logically**: Put related elements together (e.g., all security-related nodes in one group).
- **Order groups by workflow**: Place the most commonly used groups first.
- **Separate nodes and edges**: Keep creation edges in their own "Connections" group at the bottom.
- **Use descriptive labels**: Labels should be clear enough that users don't need tooltips.
- **Match icons**: Use the same `icon` value as the corresponding root type's `icon` field for consistency.
- **Unique IDs**: Both group `id` and item `id` must be unique within the palette.
