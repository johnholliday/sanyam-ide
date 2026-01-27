# Data Model: Diagram Editor UX Polish

**Feature**: 004-diagram-ux-polish
**Date**: 2026-01-25

## Overview

This document defines the data model extensions required for the diagram editor UX improvements. All types follow the constitution's TypeScript standards (explicit types, readonly where appropriate, JSDoc documentation).

---

## 1. Layout Cache (Existing)

The layout cache schema already exists in `layout-storage-service.ts`. No changes required.

```typescript
/**
 * Stored layout for a diagram.
 * Version 1 schema.
 */
export interface DiagramLayout {
  /** Schema version */
  readonly version: 1;
  /** Document URI this layout belongs to */
  readonly uri: string;
  /** Timestamp of last modification */
  readonly timestamp: number;
  /** Element positions keyed by element ID */
  readonly elements: Record<string, ElementLayout>;
}

/**
 * Position and optional size for a single element.
 */
export interface ElementLayout {
  /** Element position in diagram coordinates */
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
  /** Optional element size */
  readonly size?: {
    readonly width: number;
    readonly height: number;
  };
}
```

---

## 2. GrammarManifest Extensions

New types to add to `@sanyam/types/grammar-manifest.ts`:

### 2.1 Port Configuration

```typescript
/**
 * Position of a port on a node boundary.
 */
export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Visual style for port rendering.
 */
export type PortStyle = 'circle' | 'square' | 'diamond';

/**
 * Configuration for a connection port on a diagram node.
 *
 * Ports provide named connection points that edges can attach to,
 * enabling structured connections with grammar-defined rules.
 *
 * @example
 * ```typescript
 * const inputPort: PortConfig = {
 *   id: 'input',
 *   label: 'Input',
 *   position: 'left',
 *   offset: 0.5,
 *   style: 'circle',
 *   allowedConnections: ['edge:data-flow'],
 * };
 * ```
 */
export interface PortConfig {
  /**
   * Unique identifier for this port within the node.
   * Used to reference the port in connection rules.
   */
  readonly id: string;

  /**
   * Display label shown on hover.
   * If not provided, uses the id.
   */
  readonly label?: string;

  /**
   * Which edge of the node the port appears on.
   */
  readonly position: PortPosition;

  /**
   * Position along the edge as a fraction (0-1).
   * 0 = start of edge, 0.5 = center (default), 1 = end.
   */
  readonly offset?: number;

  /**
   * Visual shape of the port.
   * Defaults to 'circle'.
   */
  readonly style?: PortStyle;

  /**
   * Edge types that can connect to this port.
   * If not specified, any edge type is allowed.
   */
  readonly allowedConnections?: readonly string[];
}
```

### 2.2 Connection Rules

```typescript
/**
 * Rule defining valid connections between node types and ports.
 *
 * Connection rules are evaluated during edge creation to determine
 * if a connection is allowed. Multiple rules can match; if any rule
 * matches, the connection is valid.
 *
 * @example
 * ```typescript
 * const dataFlowRule: ConnectionRule = {
 *   sourceType: 'node:process',
 *   sourcePort: 'output',
 *   targetType: 'node:storage',
 *   targetPort: 'input',
 *   edgeType: 'edge:data-flow',
 * };
 * ```
 */
export interface ConnectionRule {
  /**
   * GLSP type of the source node.
   * Use '*' to match any node type.
   */
  readonly sourceType: string;

  /**
   * Port ID on the source node.
   * Use '*' to match any port, or omit for edge-of-node connections.
   */
  readonly sourcePort?: string;

  /**
   * GLSP type of the target node.
   * Use '*' to match any node type.
   */
  readonly targetType: string;

  /**
   * Port ID on the target node.
   * Use '*' to match any port, or omit for edge-of-node connections.
   */
  readonly targetPort?: string;

  /**
   * GLSP type of edge to create for this connection.
   */
  readonly edgeType: string;
}
```

### 2.3 Property Classification Override

```typescript
/**
 * Classification of an AST field for properties panel display.
 */
export type FieldClassification = 'property' | 'child';

/**
 * Override for automatic property/child classification.
 *
 * By default, scalar types (string, number, boolean, enum) are treated
 * as properties and shown in the properties panel, while object/array
 * types are treated as children and shown hierarchically.
 *
 * Use this to override the default heuristic for specific fields.
 *
 * @example
 * ```typescript
 * // Treat 'metadata' object as a property (editable in panel)
 * const metadataOverride: PropertyOverride = {
 *   property: 'metadata',
 *   classification: 'property',
 * };
 * ```
 */
export interface PropertyOverride {
  /**
   * Name of the AST property to override.
   */
  readonly property: string;

  /**
   * How to classify this property.
   */
  readonly classification: FieldClassification;
}
```

### 2.4 Extended Interfaces

```typescript
// Add to existing DiagramNodeConfig
export interface DiagramNodeConfig {
  // ... existing fields ...

  /**
   * Port definitions for this node type.
   * If not specified, edges connect to the node boundary.
   */
  readonly ports?: readonly PortConfig[];
}

// Add to existing DiagramTypeConfig
export interface DiagramTypeConfig {
  // ... existing fields ...

  /**
   * Connection rules for this diagram type.
   * Defines which node types can connect and via which ports.
   */
  readonly connectionRules?: readonly ConnectionRule[];

  /**
   * Property classification overrides for the properties panel.
   */
  readonly propertyOverrides?: readonly PropertyOverride[];
}
```

---

## 3. Properties Panel Types

New file: `@sanyam/types/properties-service.ts`

```typescript
/**
 * @sanyam/types - Properties Panel Service Types
 *
 * Types for the diagram properties panel feature.
 *
 * @packageDocumentation
 */

/**
 * Type of a property value.
 */
export type PropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'reference';

/**
 * Validation rules for a property.
 */
export interface PropertyValidation {
  /** Whether the property is required */
  readonly required?: boolean;
  /** Regex pattern for string validation */
  readonly pattern?: string;
  /** Minimum value for numbers */
  readonly min?: number;
  /** Maximum value for numbers */
  readonly max?: number;
  /** Minimum length for strings */
  readonly minLength?: number;
  /** Maximum length for strings */
  readonly maxLength?: number;
}

/**
 * Descriptor for a property displayed in the properties panel.
 *
 * @example
 * ```typescript
 * const nameProperty: PropertyDescriptor = {
 *   name: 'name',
 *   label: 'Name',
 *   type: 'string',
 *   value: 'MyEntity',
 *   validation: { required: true, minLength: 1 },
 * };
 * ```
 */
export interface PropertyDescriptor {
  /** Property name (AST field name) */
  readonly name: string;

  /** Display label for the property */
  readonly label: string;

  /** Value type */
  readonly type: PropertyType;

  /** Current value */
  readonly value: unknown;

  /** For enum type: available options */
  readonly options?: readonly string[];

  /** For reference type: valid target types */
  readonly referenceTypes?: readonly string[];

  /** Whether property is read-only */
  readonly readOnly?: boolean;

  /** Validation rules */
  readonly validation?: PropertyValidation;

  /** Help text / description */
  readonly description?: string;
}

/**
 * Result of property extraction for selected elements.
 */
export interface PropertiesResult {
  /** Element ID(s) being inspected */
  readonly elementIds: readonly string[];

  /** Available properties (common to all selected if multi-select) */
  readonly properties: readonly PropertyDescriptor[];

  /** Type label for display (e.g., "Entity" or "3 Entities") */
  readonly typeLabel: string;

  /** Whether multiple elements are selected */
  readonly isMultiSelect: boolean;
}

/**
 * Request to update a property value.
 */
export interface PropertyUpdateRequest {
  /** Document URI */
  readonly uri: string;

  /** Element ID(s) to update */
  readonly elementIds: readonly string[];

  /** Property name to update */
  readonly property: string;

  /** New value */
  readonly value: unknown;
}

/**
 * Result of a property update operation.
 */
export interface PropertyUpdateResult {
  /** Whether update succeeded */
  readonly success: boolean;

  /** Error message if failed */
  readonly error?: string;

  /** Updated property descriptors */
  readonly properties?: readonly PropertyDescriptor[];
}
```

---

## 4. Snap-to-Grid Types

New file: `packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-types.ts`

```typescript
/**
 * Configuration for snap-to-grid behavior.
 */
export interface SnapGridConfig {
  /** Whether snapping is enabled */
  enabled: boolean;

  /** Grid cell size in pixels */
  gridSize: number;

  /** Whether to show visual grid overlay */
  showGrid: boolean;
}

/**
 * Default snap-to-grid configuration.
 */
export const DEFAULT_SNAP_GRID_CONFIG: SnapGridConfig = {
  enabled: false,
  gridSize: 20,
  showGrid: false,
};

/**
 * Snap-to-grid preference IDs.
 */
export const SnapGridPreferences = {
  ENABLED: 'diagram.snapToGrid.enabled',
  GRID_SIZE: 'diagram.snapToGrid.gridSize',
  SHOW_GRID: 'diagram.snapToGrid.showGrid',
} as const;
```

---

## 5. Selection Types

Enhancement to existing selection types in `diagram-widget.ts`:

```typescript
/**
 * Extended selection state with source information.
 */
export interface SelectionState {
  /** IDs of selected elements */
  selectedIds: string[];

  /** ID of hovered element (if any) */
  hoveredId?: string;

  /** Source of the selection (for sync purposes) */
  source?: 'diagram' | 'outline' | 'text-editor' | 'properties-panel';
}

/**
 * Selection change event with source tracking.
 */
export interface SelectionChangeEvent {
  /** New selection state */
  selection: SelectionState;

  /** Whether to propagate to other views */
  propagate: boolean;
}
```

---

## 6. Outline Sync Types

Types for bidirectional outline synchronization:

```typescript
/**
 * Mapping between diagram element IDs and document symbols.
 */
export interface ElementSymbolMapping {
  /** Diagram element ID */
  readonly elementId: string;

  /** Document symbol path (parent > child > ...) */
  readonly symbolPath: readonly string[];

  /** Document range for the symbol */
  readonly range: {
    readonly start: { line: number; character: number };
    readonly end: { line: number; character: number };
  };
}

/**
 * Outline synchronization configuration.
 */
export interface OutlineSyncConfig {
  /** Whether to sync diagram selection to outline */
  syncDiagramToOutline: boolean;

  /** Whether to sync outline selection to diagram */
  syncOutlineToDiagram: boolean;

  /** Whether to sync outline selection to text editor */
  syncOutlineToText: boolean;
}

/**
 * Default outline sync configuration.
 */
export const DEFAULT_OUTLINE_SYNC_CONFIG: OutlineSyncConfig = {
  syncDiagramToOutline: true,
  syncOutlineToDiagram: true,
  syncOutlineToText: true,
};
```

---

## Entity Relationships

```
┌─────────────────┐     ┌──────────────────┐
│ GrammarManifest │────▶│  DiagramTypeConfig│
└─────────────────┘     └──────────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        │               │  ConnectionRule  │
        │               └──────────────────┘
        │                        │
        ▼                        │
┌─────────────────┐              │
│  RootTypeConfig │              │
└─────────────────┘              │
        │                        │
        ▼                        │
┌─────────────────┐              │
│DiagramNodeConfig│◀─────────────┘
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   PortConfig    │
└─────────────────┘

┌─────────────────┐     ┌──────────────────┐
│  DiagramLayout  │────▶│  ElementLayout   │
└─────────────────┘     └──────────────────┘

┌─────────────────┐     ┌──────────────────┐
│PropertiesResult │────▶│PropertyDescriptor│
└─────────────────┘     └──────────────────┘
```

---

## Validation Rules

### Port Configuration

- `id` must be unique within node
- `offset` must be between 0 and 1
- `allowedConnections` must reference valid edge types

### Connection Rules

- `sourceType` must be valid GLSP node type or '*'
- `targetType` must be valid GLSP node type or '*'
- `edgeType` must be valid GLSP edge type
- Circular references are allowed (self-connections)

### Property Descriptors

- `name` must match AST property name
- `type` determines which form control is rendered
- `validation` rules are enforced on edit
