# Research: Diagram Editor UX Polish

**Feature**: 004-diagram-ux-polish
**Date**: 2026-01-25

## Overview

This document consolidates research findings for the diagram editor UX improvements.

---

## R1: Layout Restore Without Flicker

### Problem

When opening a diagram or refreshing, nodes first appear at default positions then visibly jump to their correct layout positions. This creates an unprofessional, jarring experience.

### Existing Implementation Analysis

**File**: `packages/theia-extensions/glsp/src/browser/diagram-widget.ts`

Current flow:
1. `loadModel()` called (line 597)
2. Shows loading state (line 607)
3. Loads saved layout from storage (lines 610-615)
4. Requests model from server (line 617)
5. Applies saved positions to state (lines 631-638)
6. Calls `setModel()` (line 642)
7. In `setModel()`:
   - If no saved layout: adds `layout-pending` class (lines 674-678)
   - Calls `convertToSprottyModel()` with positions (line 681)
   - If saved layout exists: skips auto-layout (lines 685-691)
   - If no saved layout: requests auto-layout (lines 693-696)
8. `onLayoutComplete()` reveals diagram with fade-in (lines 712-731)

**Issue identified**: The `layout-pending` class is only added when `!hasSavedLayout` (line 674). But the diagram is still visible before `setModel()` completes. The positions are applied but Sprotty may still show initial render positions briefly.

### Decision

**Approach**: Always hide diagram during initial model setup, apply positions BEFORE Sprotty renders

1. Add `layout-pending` class immediately when `setModel()` is called (not conditionally)
2. Ensure positions are included in the SprottyModel BEFORE `sprottyManager.setModel()` is called
3. Remove the conditional - always use the reveal mechanism
4. When saved layout exists, call `revealDiagramAfterLayout()` directly after `fitToScreen()`

### Implementation Notes

```typescript
// In setModel():
// Always hide during setup
if (this.svgContainer) {
  this.layoutPending = true;
  this.svgContainer.classList.add('layout-pending');
}

// Convert with positions already applied
const sprottyModel = this.convertToSprottyModel(gModel); // Positions embedded

// Set model (renders but hidden)
await this.sprottyManager.setModel(sprottyModel);

if (hasSavedLayout) {
  // No auto-layout needed - positions already correct
  await this.sprottyManager.fitToScreen();
  this.revealDiagramAfterLayout(); // Fade in
} else {
  // Auto-layout will call onLayoutComplete which reveals
  await this.sprottyManager.requestLayout();
}
```

### Alternatives Rejected

1. **Off-screen canvas**: Complex, requires managing two DOM trees
2. **Virtual pre-render**: Sprotty doesn't easily support this
3. **Server-side pre-layout**: Would require serializing layout in model response

---

## R2: Marquee Selection Trigger

### Problem

Users expect Ctrl+Drag on empty canvas to create a selection rectangle, but currently marquee selection requires explicit tool activation.

### Existing Implementation Analysis

**File**: `packages/theia-extensions/glsp/src/browser/ui-extensions/selection/marquee-selection-tool.ts`

Current implementation:
- `MarqueeSelectionTool` extends `AbstractUIExtension`
- Activation via `enableMarqueeMode()` method
- Uses `EnableMarqueeSelectAction` to trigger
- Mouse listeners: `onMarqueeMouseDown`, `onMarqueeMouseMove`, `onMarqueeMouseUp`
- Selection logic in `completeSelection()` properly handles bounds intersection

**Gap**: No automatic activation on Ctrl+Drag

### Decision

**Approach**: Add a mouse listener to the Sprotty canvas that detects Ctrl+mousedown on empty space

1. Create a new mouse listener that binds to the SVG container
2. On `mousedown`:
   - Check if Ctrl is pressed
   - Check if click target is the canvas background (not a node)
   - If both: call `enableMarqueeMode()` and start selection
3. Let existing marquee tool logic handle the rest

### Implementation Notes

```typescript
// New: Canvas mouse listener in SprottyDiagramManager or separate file
protected setupMarqueeActivation(): void {
  const svg = this.getSvgContainer();
  if (!svg) return;

  svg.addEventListener('mousedown', (event: MouseEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;

    // Check if clicked on empty space (not a node)
    const target = event.target as Element;
    if (this.isNodeElement(target)) return;

    // Activate marquee mode
    const marquee = this.uiExtensionRegistry.get(MARQUEE_SELECTION_ID);
    if (marquee instanceof MarqueeSelectionTool) {
      marquee.enableMarqueeMode();
      // The mousedown will be captured by marquee's listener
    }
  });
}

protected isNodeElement(element: Element): boolean {
  return element.closest('.sprotty-node') !== null;
}
```

### Alternatives Rejected

1. **Dedicated toolbar button**: Less discoverable, extra click required
2. **Shift+Drag**: Conflicts with Shift-click extend selection in most apps
3. **Always-on marquee**: Would interfere with pan/scroll gestures

---

## R3: Properties Panel Architecture

### Problem

Need a properties panel that displays editable properties for selected diagram elements, distinguishing between scalar properties and child nodes.

### Existing Implementation Analysis

**Theia widget patterns**: See `@theia/core/lib/browser/widgets/widget.ts`
- Widgets extend `BaseWidget`
- Contributions registered via `WidgetContribution` interface
- React components used for complex UIs

**Property classification requirement** (from spec clarification):
- Default: scalar types (string, number, boolean, enum) → properties
- Object/array types → children (shown hierarchically)
- Manifest can override per field

### Decision

**Approach**: Create a Theia widget with React form, server-side property extraction

**Components**:
1. `PropertiesPanelWidget` - Theia widget container
2. `PropertiesPanelContribution` - Registers with Theia
3. `PropertyForm` - React component for rendering/editing
4. `PropertyProvider` - Server-side property extraction from AST

**Data flow**:
1. Selection changed in diagram → event fired
2. Widget receives selection IDs
3. Requests properties from server via `diagramLanguageClient.getProperties(uri, elementIds)`
4. Server extracts properties from AST nodes, applies classification rules
5. Widget renders form with property fields
6. User edits → sends `PropertyUpdateRequest` to server
7. Server updates AST text → bidirectional sync updates diagram

### Implementation Notes

```typescript
// PropertyDescriptor classification logic (server-side)
function classifyField(
  fieldName: string,
  fieldValue: unknown,
  overrides: PropertyOverride[]
): 'property' | 'child' {
  // Check for manifest override
  const override = overrides.find(o => o.property === fieldName);
  if (override) {
    return override.classification;
  }

  // Default heuristic
  if (fieldValue === null || fieldValue === undefined) {
    return 'property'; // Treat null/undefined as empty property
  }

  const type = typeof fieldValue;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return 'property';
  }

  if (Array.isArray(fieldValue)) {
    return 'child'; // Arrays are child collections
  }

  if (type === 'object') {
    // Check if it's a reference (has $ref or $refText)
    if ('$ref' in fieldValue || '$refText' in fieldValue) {
      return 'property'; // References are editable properties
    }
    return 'child'; // Nested objects are children
  }

  return 'property';
}
```

**Multi-select handling** (from spec clarification):
- Show only properties common to ALL selected elements
- Edit updates all selected elements

### Alternatives Rejected

1. **Web Components**: Less ecosystem support, React already used
2. **Monaco-based**: Overkill for simple property forms
3. **Client-side property extraction**: Would require shipping AST to frontend

---

## R4: Document Outline Integration

### Problem

Need to synchronize document outline selection with diagram and text editor.

### Existing Implementation Analysis

**File**: `packages/language-server/src/lsp/providers/document-symbol-provider.ts`

- Already provides `DocumentSymbol[]` for outline view
- Uses Langium AST traversal via `streamAllContents`
- Maps AST nodes to hierarchical symbols
- Returns proper `range` and `selectionRange`

**Theia outline**: Uses LSP `textDocument/documentSymbol` - already integrated

**Gap**: No diagram ↔ outline selection sync

### Decision

**Approach**: Bidirectional selection sync via events

1. **Outline → Diagram/Text**:
   - Theia outline already navigates to text position on click
   - Need to ALSO select corresponding diagram element
   - Add listener to outline selection that triggers diagram selection

2. **Diagram → Outline**:
   - On diagram selection change, highlight corresponding outline item
   - Use Theia's outline API to reveal and highlight item

**Key insight**: Element IDs in diagram correspond to AST node paths. Need to map between them.

### Implementation Notes

```typescript
// In composite-editor-widget.ts or new sync service

// Outline → Diagram
onOutlineSelectionChanged(symbol: DocumentSymbol): void {
  // Find element in diagram by matching position/name
  const elementId = this.findDiagramElementBySymbol(symbol);
  if (elementId) {
    this.diagramWidget.selectElement(elementId);
    // Text selection is handled by Theia's default outline behavior
  }
}

// Diagram → Outline
onDiagramSelectionChanged(elementIds: string[]): void {
  if (elementIds.length === 1) {
    const elementId = elementIds[0];
    // Find symbol in outline
    const symbol = this.findSymbolByElementId(elementId);
    if (symbol) {
      this.outlineView.reveal(symbol);
    }
  }
}
```

### Alternatives Rejected

1. **Custom outline view**: Duplicates LSP functionality
2. **GLSP-specific outline**: Breaks text/diagram unity

---

## R5: Snap-to-Grid Implementation

### Problem

Need toggle-able snap-to-grid functionality for precise element positioning.

### Existing Implementation Analysis

**Sprotty support**: `ISnapper` interface in `sprotty/lib/features/move/snap`

```typescript
interface ISnapper {
  snap(position: Point, element: SModelElementImpl): Point;
}
```

**Current state**: No snapping implemented in Sanyam IDE

### Decision

**Approach**: Implement `GridSnapper` and integrate with Theia preferences

1. Create `GridSnapper` implementing `ISnapper`
2. Add toolbar toggle button with grid icon
3. Persist preference in Theia settings
4. Bind snapper in Sprotty DI config when enabled

### Implementation Notes

```typescript
// GridSnapper
@injectable()
export class GridSnapper implements ISnapper {
  constructor(protected config: SnapGridConfig) {}

  snap(position: Point, element: SModelElementImpl): Point {
    if (!this.config.enabled) {
      return position;
    }

    const gridSize = this.config.gridSize;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }
}

// Toolbar contribution
const SNAP_TO_GRID_COMMAND: Command = {
  id: 'diagram.snapToGrid.toggle',
  label: 'Toggle Snap to Grid',
  iconClass: 'codicon codicon-layout',
};
```

### Alternatives Rejected

1. **Post-move adjustment**: Janky UX - element visibly jumps
2. **Always-on grid**: Less flexible for freeform positioning

---

## R6: Grammar-Driven Tool Palette

### Problem

Tool palette currently shows hardcoded defaults ("Node", "Entity", "Component") instead of grammar-specific types.

### Existing Implementation Analysis

**File**: `packages/language-server/src/glsp/providers/tool-palette-provider.ts`

Current behavior:
- Checks for `manifest?.diagram?.toolPalette` (explicit config)
- Falls back to `generateFromTypes()` which reads `manifest?.diagram?.nodeTypes`
- If neither, shows hardcoded defaults (lines 159-178)

**Gap**: `generateFromTypes()` doesn't read from `rootTypes[].diagramNode`

### Decision

**Approach**: Enhance `generateFromTypes()` to read all node types from manifest

1. Iterate `manifest.rootTypes` and extract `diagramNode` configs
2. Use `diagramNode.glspType` for tool creation
3. Preserve type hierarchy if present in grammar
4. Only show types marked as `creatable` in `diagramTypes.nodeTypes`

### Implementation Notes

```typescript
// Enhanced generateFromTypes
generateFromTypes(context: GlspContext): ToolPalette {
  const manifest = (context as any).manifest as GrammarManifest;
  const groups: ToolGroup[] = [];

  // Create nodes group from rootTypes
  const nodesGroup: ToolGroup = {
    id: 'nodes',
    label: 'Nodes',
    icon: 'symbol-structure',
    children: [],
  };

  // Find active diagram type
  const diagramType = manifest.diagramTypes?.find(dt =>
    dt.fileType === (context as any).fileType
  );

  // Get creatable node types
  const creatableTypes = new Set(
    diagramType?.nodeTypes
      .filter(nt => nt.creatable)
      .map(nt => nt.glspType) ?? []
  );

  // Add tools for each rootType with diagramNode config
  for (const rootType of manifest.rootTypes) {
    if (!rootType.diagramNode) continue;

    const glspType = rootType.diagramNode.glspType;

    // Skip if not creatable
    if (creatableTypes.size > 0 && !creatableTypes.has(glspType)) {
      continue;
    }

    nodesGroup.children.push({
      id: `create-${rootType.astType.toLowerCase()}`,
      label: rootType.displayName,
      icon: rootType.icon,
      action: {
        kind: 'create-node',
        elementTypeId: glspType,
        args: { astType: rootType.astType },
      },
    });
  }

  groups.push(nodesGroup);
  // ... edges group similar ...
}
```

### Alternatives Rejected

1. **Static palette per grammar**: Violates grammar-agnostic principle
2. **Client-side palette generation**: Duplicates logic, harder to maintain

---

## R7: Port-Based Connections

### Problem

Some node types need designated connection ports with grammar-defined connection rules.

### Existing Implementation Analysis

**Sprotty support**: `SPort` class in `sprotty/lib/base/model/smodel`
- Ports are child elements of nodes
- Edges connect to ports via `sourceId`/`targetId` pointing to port IDs

**Current state**: No port support in manifest or rendering

### Decision

**Approach**: Extend manifest with port definitions, create Sprotty port views

1. Add `ports` field to `DiagramNodeConfig`
2. Add `connectionRules` field to `DiagramTypeConfig`
3. Create `PortView` for rendering
4. Validate connections against rules during edge creation

### Implementation Notes

```typescript
// Port model extension
interface SanyamPort extends SPort {
  portConfig: PortConfig;
}

// Port view
@injectable()
export class PortView implements IView {
  render(port: SanyamPort, context: RenderingContext): VNode {
    const config = port.portConfig;
    const style = config.style ?? 'circle';

    // Render based on style
    switch (style) {
      case 'circle':
        return <circle cx="0" cy="0" r="5" class="sanyam-port" />;
      case 'square':
        return <rect x="-4" y="-4" width="8" height="8" class="sanyam-port" />;
      case 'diamond':
        return <polygon points="0,-5 5,0 0,5 -5,0" class="sanyam-port" />;
    }
  }
}

// Connection validation
function validateConnection(
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  rules: ConnectionRule[]
): boolean {
  for (const rule of rules) {
    if (rule.sourceType !== sourceType) continue;
    if (rule.targetType !== targetType) continue;

    const sourceMatch = !rule.sourcePort ||
      rule.sourcePort === '*' ||
      rule.sourcePort === sourcePort;
    const targetMatch = !rule.targetPort ||
      rule.targetPort === '*' ||
      rule.targetPort === targetPort;

    if (sourceMatch && targetMatch) {
      return true;
    }
  }
  return false;
}
```

### Alternatives Rejected

1. **Edge routing to node boundaries**: Less semantic, no named ports
2. **Client-only connection rules**: Rules should be defined in grammar

---

## References

- Sprotty documentation: https://github.com/eclipse/sprotty
- GLSP documentation: https://www.eclipse.org/glsp/documentation/
- Theia widget API: https://theia-ide.org/docs/widgets/
- Langium 4.x API: https://langium.org/docs/
