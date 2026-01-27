# Quickstart: Diagram Editor UX Polish

**Feature**: 004-diagram-ux-polish
**Date**: 2026-01-25

This guide helps developers get started with the diagram UX improvements.

---

## Prerequisites

1. Build the project:
   ```bash
   pnpm install && pnpm build:dev
   ```

2. Start the Electron app:
   ```bash
   pnpm electron start
   ```

3. Open a grammar-enabled file (e.g., `.ecml`)

---

## Feature Testing Guide

### 1. Layout Restore (P1)

**What it does**: Diagrams open without visible repositioning.

**How to test**:
1. Open a diagram file
2. Manually position some nodes (drag them around)
3. Close the diagram tab
4. Reopen the same file
5. **Expected**: Nodes appear directly in their saved positions - no jumping

**What to look for**:
- No visible "flash" of default positions
- Smooth fade-in after layout is ready
- Positions match exactly what you saved

### 2. Layout Persistence (P1)

**What it does**: Element positions are automatically saved.

**How to test**:
1. Move a node to a new position
2. Wait 1 second (debounced save)
3. Check browser DevTools → Application → Local Storage
4. Look for key starting with `sanyam.diagram.layout:`
5. **Expected**: Layout data exists with your positions

**What to look for**:
- Layout saved automatically (no manual save required)
- Positions survive app restart

### 3. Marquee Selection (P2)

**What it does**: Ctrl+Drag creates a selection rectangle.

**How to test**:
1. Open a diagram with multiple nodes
2. Hold **Ctrl** (or **Cmd** on Mac)
3. Click on empty canvas space (not on a node)
4. Drag to create a rectangle around some nodes
5. Release mouse
6. **Expected**: All nodes within rectangle are selected

**What to look for**:
- Blue selection rectangle visible while dragging
- Partial overlap selects the element
- Release clears marquee UI
- Selection is reflected in properties panel

### 4. Properties Panel (P2)

**What it does**: Shows editable properties for selected elements.

**How to test**:
1. Open View menu → Properties (or use command palette: "View: Properties")
2. Select a diagram element
3. **Expected**: Properties panel shows fields like "name", "type", etc.
4. Edit a value and press Enter or blur the field
5. **Expected**: Diagram and text editor update

**Multi-select test**:
1. Select multiple elements (Ctrl+click or marquee)
2. **Expected**: Only common properties shown
3. Edit a property
4. **Expected**: All selected elements update

### 5. Document Outline Sync (P2)

**What it does**: Outline selection syncs with diagram and text.

**How to test**:
1. Open View menu → Outline
2. Click an item in the outline
3. **Expected**: Element selected in BOTH diagram AND text editor
4. Now select an element in the diagram
5. **Expected**: Outline item is highlighted/revealed

### 6. Snap-to-Grid (P3)

**What it does**: Elements snap to grid when moved.

**How to test**:
1. Look for grid icon in diagram toolbar (grid-like icon)
2. Click to enable snap-to-grid
3. Drag a node
4. **Expected**: Node snaps to grid intersections (20px default)
5. Toggle off and drag again
6. **Expected**: Free movement

**Preference test**:
1. Enable snap-to-grid
2. Close and reopen diagram
3. **Expected**: Snap-to-grid state preserved

### 7. Grammar-Driven Tool Palette (P3)

**What it does**: Tool palette shows all types from grammar.

**How to test**:
1. Open the tool palette (left side of diagram)
2. Expand "Nodes" group
3. **Expected**: All node types from grammar appear (not just generic "Node", "Entity", "Component")
4. Check edge types match grammar too

**Verify with ECML grammar**:
- Should see: Actor, Content, Policy, etc.
- Icons should match grammar manifest

### 8. Port-Based Connections (P3)

**What it does**: Nodes have connection ports with rules.

**How to test**:
1. Open a diagram with port-enabled node types
2. Look for small circles/squares on node edges (ports)
3. Start creating an edge from a port
4. **Expected**: Only valid target ports highlight
5. Try connecting to an invalid target
6. **Expected**: Connection prevented

---

## Common Issues & Solutions

### Layout not saving
- Check browser console for storage errors
- Verify Theia StorageService is working
- Try clearing local storage and reopening

### Marquee not activating
- Ensure you're clicking on empty space (not a node)
- Check that Ctrl key is detected (try Cmd on Mac)
- Check browser console for mouse event logs

### Properties panel empty
- Ensure an element is selected (check selection state)
- Verify the element type has properties defined
- Check server logs for property extraction errors

### Outline sync not working
- Both diagram and text editor must be open
- Check that element IDs map correctly to AST nodes
- Verify DocumentSymbol provider is returning symbols

### Grid snap not snapping
- Ensure toggle is enabled (check toolbar state)
- Grid size might be too small - try larger value
- Check that snapper is registered in Sprotty DI

---

## Development Workflow

### Running tests
```bash
pnpm test
```

### Building after changes
```bash
pnpm build:dev
```

### Debugging

1. **Frontend debugging**:
   - Use VS Code launch config "Attach to Electron Frontend"
   - Or open DevTools in Electron app (Ctrl+Shift+I)

2. **Backend debugging**:
   - Use VS Code launch config "Launch Electron Backend"
   - Breakpoints in language server code

3. **Console logging**:
   - Search for `[DiagramWidget]`, `[MarqueeSelectionTool]`, etc.

---

## API Examples

### Programmatically select elements
```typescript
const diagramWidget = /* get widget reference */;
await diagramWidget.selectElement('element-id');
```

### Get current selection
```typescript
const selection = diagramWidget.getSelection();
console.log('Selected:', selection);
```

### Toggle snap-to-grid
```typescript
preferenceService.set(SnapGridPreferences.ENABLED, true);
```

### Request properties for selection
```typescript
const result = await diagramLanguageClient.getProperties(uri, selectedIds);
console.log('Properties:', result.properties);
```

---

## Related Documentation

- [Specification](./spec.md) - Feature requirements
- [Implementation Plan](./plan.md) - Technical design
- [Data Model](./data-model.md) - Type definitions
- [Research](./research.md) - Design decisions
