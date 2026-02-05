# Data Model: Sidebar Element Palette

**Branch**: `006-sidebar-palette` | **Date**: 2026-02-05

## Entities

### ElementPaletteState

State managed by the Element Palette sidebar widget.

```typescript
interface ElementPaletteState {
    /** Current groups of element types (from server) */
    groups: ElementCategory[];
    /** Currently expanded category IDs */
    expandedCategories: Set<string>;
    /** Current search filter query */
    searchQuery: string;
    /** Active diagram URI (determines which grammar's elements to show) */
    activeDiagramUri: string | null;
    /** Loading state */
    isLoading: boolean;
    /** Error message if palette load failed */
    errorMessage: string | null;
}
```

### ElementCategory

A grouping of related element types (maps to existing `ToolPaletteGroup`).

```typescript
interface ElementCategory {
    /** Unique category identifier */
    id: string;
    /** Display name for category header */
    label: string;
    /** Optional icon class (codicon) */
    icon?: string;
    /** Element types in this category */
    items: ElementTypeItem[];
    /** Sort order */
    sortString?: string;
}
```

### ElementTypeItem

A single creatable element type (maps to existing `ToolPaletteItem`).

```typescript
interface ElementTypeItem {
    /** Unique element type identifier (e.g., "node:igprogram") */
    id: string;
    /** Display name shown in palette */
    label: string;
    /** Icon class for fallback display */
    icon?: string;
    /** SVG thumbnail preview (generated from shape config) */
    thumbnail?: string;
    /** Description shown in tooltip */
    description?: string;
    /** Creation action details */
    action: ElementCreationAction;
    /** Sort order within category */
    sortString?: string;
}
```

### ElementCreationAction

Action data for creating an element (maps to existing `ToolAction`).

```typescript
interface ElementCreationAction {
    /** Action type */
    kind: 'createNode' | 'createEdge';
    /** GLSP element type ID */
    elementTypeId: string;
    /** Additional creation parameters */
    args?: Record<string, unknown>;
}
```

### QuickMenuState

State for the canvas double-click quick menu.

```typescript
interface QuickMenuState {
    /** Whether menu is visible */
    isVisible: boolean;
    /** Screen position for menu rendering */
    screenPosition: { x: number; y: number };
    /** Model position where element will be created */
    modelPosition: { x: number; y: number };
    /** Available element types (from palette) */
    items: ElementTypeItem[];
    /** Current search/filter query */
    filterQuery: string;
    /** Currently highlighted item index */
    selectedIndex: number;
}
```

### DragState

State for tracking drag-and-drop operations.

```typescript
interface DragState {
    /** Whether a drag is in progress */
    isDragging: boolean;
    /** Element type being dragged */
    elementTypeId: string | null;
    /** Display label for drag feedback */
    label: string | null;
}
```

## State Transitions

### ElementPaletteState

```
INITIAL → LOADING (diagram opened)
LOADING → LOADED (palette received)
LOADING → ERROR (request failed)
LOADED → LOADING (different diagram activated)
LOADED → FILTERED (search query entered)
FILTERED → LOADED (search cleared)
```

### QuickMenuState

```
HIDDEN → VISIBLE (double-click on empty canvas)
VISIBLE → HIDDEN (Escape pressed)
VISIBLE → HIDDEN (click outside menu)
VISIBLE → CREATING (item selected)
CREATING → HIDDEN (element created)
```

## Data Flow

### Element Type Discovery

```
1. User opens diagram (CompositeEditorWidget activated)
2. Sidebar widget detects active widget change
3. Sidebar dispatches RequestToolPaletteAction
4. Language server fetches manifest for diagram's grammar
5. Server generates ToolPalette from manifest.rootTypes[].diagramNode
6. SetToolPaletteAction returns groups to frontend
7. Sidebar updates ElementPaletteState.groups
8. React renders categories and items
```

### Drag-and-Drop Creation

```
1. User starts dragging element item
2. DragState.isDragging = true, elementTypeId set
3. DataTransfer stores element type JSON
4. User drags over canvas (ondragover allows drop)
5. User drops on canvas
6. Drop handler extracts elementTypeId from DataTransfer
7. Handler converts screen coords → model coords
8. Handler dispatches CreateElementAction.createNode()
9. CreateElementActionHandler adds node to model
10. Sprotty re-renders with new element
```

### Quick Menu Creation

```
1. User double-clicks on empty canvas area
2. CanvasDoubleClickTool detects target is graph root
3. Tool dispatches ShowQuickMenuAction with positions
4. QuickMenuUIExtension becomes visible at screen position
5. User types to filter or uses arrow keys
6. User presses Enter or clicks item
7. Menu dispatches CreateElementAction with model position
8. Menu hides (QuickMenuState.isVisible = false)
9. CreateElementActionHandler adds node to model
```

## Relationship to Existing Types

| New Type | Maps To | Notes |
|----------|---------|-------|
| ElementCategory | ToolPaletteGroup | Rename for clarity in sidebar context |
| ElementTypeItem | ToolPaletteItem | Added thumbnail, description fields |
| ElementCreationAction | ToolAction | Subset (only createNode/createEdge) |

The sidebar palette reuses the existing server-side `ToolPalette` response structure. No schema changes are required on the server.

## Validation Rules

1. **ElementCategory.id**: Must be unique within the palette
2. **ElementTypeItem.id**: Must match a valid GLSP element type (e.g., "node:xxx")
3. **ElementTypeItem.action.elementTypeId**: Must match an item with `creatable: true` in the grammar manifest
4. **QuickMenuState.modelPosition**: Must be within valid diagram bounds
5. **DragState**: Only one drag operation active at a time
