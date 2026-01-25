# Data Model: GLSP Backend Integration

**Feature**: 003-glsp-backend-integration
**Date**: 2026-01-23

## Entities

### SanyamGlspService (Interface)

The RPC service interface defining all GLSP operations.

```typescript
export const SanyamGlspServicePath = '/services/sanyam-glsp';
export const SanyamGlspService = Symbol('SanyamGlspService');

export interface SanyamGlspService {
    // Model operations
    loadModel(uri: string): Promise<LoadModelResponse>;
    saveModel(uri: string): Promise<SaveModelResponse>;

    // Diagram operations
    executeOperation(uri: string, operation: DiagramOperation): Promise<ExecuteOperationResponse>;
    requestLayout(uri: string, options?: LayoutOptions): Promise<LayoutResponse>;

    // UI operations
    getToolPalette(uri: string): Promise<ToolPaletteResponse>;
    getContextMenu(uri: string, selectedIds: string[], position?: Point): Promise<ContextMenuResponse>;

    // Validation
    validate(uri: string): Promise<ValidationResponse>;

    // Document sync
    syncDocument(uri: string, content: string, version: number): Promise<void>;

    // Capabilities
    getSupportedOperations(): Promise<{ operations: string[] }>;
}
```

### Response Types

```typescript
export interface LoadModelResponse {
    success: boolean;
    gModel?: GModelRoot;
    metadata?: ModelMetadata;
    error?: string;
}

export interface SaveModelResponse {
    success: boolean;
    error?: string;
}

export interface ExecuteOperationResponse {
    success: boolean;
    error?: string;
    edits?: TextEdit[];
    updatedModel?: GModelRoot;
}

export interface LayoutResponse {
    positions: Record<string, Point>;
    sizes: Record<string, Dimension>;
    routingPoints: Record<string, Point[]>;
    bounds: { width: number; height: number };
    error?: string;
}

export interface ToolPaletteResponse {
    groups: ToolPaletteGroup[];
    error?: string;
}

export interface ToolPaletteGroup {
    id: string;
    label: string;
    icon?: string;
    items: ToolPaletteItem[];
}

export interface ToolPaletteItem {
    id: string;
    label: string;
    icon?: string;
    sortString?: string;
    actions: any[]; // GLSP action types
}

export interface ContextMenuResponse {
    items: ContextMenuItem[];
    error?: string;
}

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    enabled: boolean;
    children?: ContextMenuItem[];
}

export interface ValidationResponse {
    markers: ValidationMarker[];
    isValid: boolean;
    errorCount: number;
    warningCount: number;
}

export interface ValidationMarker {
    elementId: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    source?: string;
}
```

### DiagramOperation

Represents a user action in the diagram that triggers backend processing.

```typescript
export type DiagramOperation =
    | CreateNodeOperation
    | DeleteElementOperation
    | ChangeBoundsOperation
    | CreateEdgeOperation
    | ReconnectEdgeOperation
    | EditLabelOperation;

export interface CreateNodeOperation {
    kind: 'createNode';
    elementTypeId: string;
    location?: Point;
    containerId?: string;
    args?: Record<string, unknown>;
}

export interface DeleteElementOperation {
    kind: 'deleteElement';
    elementIds: string[];
}

export interface ChangeBoundsOperation {
    kind: 'changeBounds';
    newBounds: Array<{
        elementId: string;
        newPosition?: Point;
        newSize?: Dimension;
    }>;
}

export interface CreateEdgeOperation {
    kind: 'createEdge';
    elementTypeId: string;
    sourceElementId: string;
    targetElementId: string;
    args?: Record<string, unknown>;
}

export interface ReconnectEdgeOperation {
    kind: 'reconnectEdge';
    edgeId: string;
    sourceElementId?: string;
    targetElementId?: string;
}

export interface EditLabelOperation {
    kind: 'editLabel';
    labelId: string;
    text: string;
}
```

### DiagramLayout (Persistence)

Persisted layout data stored in user profile.

```typescript
export interface DiagramLayout {
    version: 1;
    fileUri: string;
    timestamp: number;
    positions: Record<string, Point>;
    sizes: Record<string, Dimension>;
    routingPoints?: Record<string, Point[]>;
    viewport?: ViewportState;
}

export interface ViewportState {
    scroll: Point;
    zoom: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Dimension {
    width: number;
    height: number;
}
```

### LayoutOptions

Options for layout computation.

```typescript
export interface LayoutOptions {
    algorithm?: 'layered' | 'force' | 'radial' | 'stress' | 'tree' | 'grid';
    direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
    spacing?: number;
    preserveExisting?: boolean; // Keep positions for nodes that have saved positions
}
```

## State Transitions

### Backend Service Initialization

```
UNINITIALIZED ──(startup)──> INITIALIZING ──(grammar load)──> READY
                                   │
                                   └──(error)──> FAILED
```

### Diagram Session Lifecycle

```
CLOSED ──(open file)──> LOADING ──(model loaded)──> ACTIVE
                            │                          │
                            └──(error)──> ERROR        │
                                                       │
ACTIVE ──(text edit)──> SYNCING_TEXT ──────────────────┘
   │                                                   │
   └──(diagram edit)──> SYNCING_DIAGRAM ───────────────┘
   │
   └──(close)──> SAVING ──(saved)──> CLOSED
```

### Layout Persistence States

```
NO_SAVED_LAYOUT ──(user moves nodes)──> DIRTY
       │                                   │
       └──(auto layout applied)────────────┤
                                           │
DIRTY ──(debounce timeout)──> SAVING ──(saved)──> CLEAN
   │                                               │
   └──(more edits during save)─────────────────────┘

CLEAN ──(user moves nodes)──> DIRTY
   │
   └──(reset layout action)──> NO_SAVED_LAYOUT
```

## Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        @sanyam/types                            │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ SanyamGlspService│    │ DiagramOperation │                   │
│  │ (interface)      │    │ (union type)     │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                             │
│  ┌────────┴─────────┐    ┌────────┴─────────┐                   │
│  │ Response Types   │    │ DiagramLayout    │                   │
│  └──────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                    ▲                       ▲
                    │                       │
        ┌───────────┴───────────┐ ┌────────┴────────────┐
        │   Backend (node/)     │ │  Frontend (browser/)│
        │                       │ │                     │
        │ SanyamGlspBackend     │ │ SanyamLanguage      │
        │ ServiceImpl           │ │ ClientProvider      │
        │         │             │ │        │            │
        │         ▼             │ │        ▼            │
        │ LanguageServer        │ │ DiagramWidget       │
        │ (Langium + GLSP)      │ │        │            │
        │                       │ │        ▼            │
        │                       │ │ LayoutStorage       │
        │                       │ │ Service             │
        └───────────────────────┘ └─────────────────────┘
                    │                       │
                    └───────────────────────┘
                          JSON-RPC over
                          WebSocket
```

## Validation Rules

### Service Interface

| Field | Rule |
|-------|------|
| uri | Must be valid file URI (file://) |
| operation.kind | Must match supported operation types |
| operation.elementIds | Must reference existing elements |
| operation.location | Must have positive x, y coordinates |

### DiagramLayout

| Field | Rule |
|-------|------|
| version | Must equal 1 (current schema version) |
| fileUri | Must match stored key |
| timestamp | Must be valid Unix timestamp |
| positions[id].x | Must be finite number |
| positions[id].y | Must be finite number |
| sizes[id].width | Must be positive number |
| sizes[id].height | Must be positive number |
| viewport.zoom | Must be between 0.1 and 10.0 |

### Operation Constraints

| Operation | Constraint |
|-----------|------------|
| createNode | containerId must exist if specified |
| deleteElement | Cannot delete root element |
| changeBounds | All elementIds must exist |
| createEdge | Source and target must be compatible |
| reconnectEdge | Edge must exist, new endpoint must be valid |
| editLabel | Label must be editable |

## Storage Keys

| Data | Storage Type | Key Format |
|------|--------------|------------|
| Layout (user profile) | Theia StorageService | `sanyam.diagram.layout.${encodeURIComponent(fileUri)}` |
| Layout (sidecar) | File system | `${documentPath}.layout.json` |
| Preferences | Theia PreferenceService | `sanyam.diagram.*` |
