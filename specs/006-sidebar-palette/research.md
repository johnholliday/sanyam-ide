# Research: Sidebar Element Palette

**Branch**: `006-sidebar-palette` | **Date**: 2026-02-05

## Research Questions

### RQ-001: How does Theia support sidebar views with custom content?

**Decision**: Use Theia's `AbstractViewContribution` with a custom React-based widget.

**Rationale**: Theia provides `AbstractViewContribution<T extends Widget>` for registering sidebar views. A custom widget extending `ReactWidget` can render the categorized element list with full control over drag-and-drop behavior. This pattern is used throughout Theia for custom views (file explorer, outline, etc.).

**Alternatives Considered**:
- TreeWidget: Too rigid for the visual design needed (thumbnails, rich items)
- Webview: Overkill and introduces iframe complexity for what's fundamentally a tree with drag-and-drop
- Pure HTML widget: Works but loses React benefits for state management

**Implementation Details**:
```typescript
@injectable()
export class ElementPaletteViewContribution extends AbstractViewContribution<ElementPaletteWidget> {
    constructor() {
        super({
            widgetId: 'element-palette',
            widgetName: 'Element Palette',
            defaultWidgetOptions: { area: 'left', rank: 200 },
            toggleCommandId: 'element-palette:toggle'
        });
    }
}
```

### RQ-002: How to implement drag-and-drop from sidebar to Sprotty canvas?

**Decision**: Use HTML5 Drag-and-Drop API with DataTransfer to pass element type, then handle drop in a custom Sprotty tool.

**Rationale**: The sidebar (Theia widget) and diagram (Sprotty canvas) are in separate DOM contexts. HTML5 DnD provides cross-container drag with DataTransfer for type data. Sprotty's tool system can intercept the drop event on the canvas.

**Alternatives Considered**:
- Sprotty-internal drag: Only works within Sprotty container, not from external widgets
- React DnD: Would require both contexts to share a DnD backend, complex setup
- Custom mouse tracking: Fragile, doesn't get native drag visual feedback

**Implementation Details**:
1. Sidebar item sets `draggable="true"` and `ondragstart` stores `elementTypeId` in DataTransfer
2. Sprotty canvas registers `ondragover` (prevent default to allow drop) and `ondrop` handler
3. Drop handler extracts `elementTypeId`, converts screen coordinates to model coordinates, dispatches `CreateElementAction`

```typescript
// Sidebar item
element.draggable = true;
element.ondragstart = (e) => {
    e.dataTransfer.setData('application/sanyam-element', JSON.stringify({
        elementTypeId: item.glspType,
        label: item.displayName
    }));
    e.dataTransfer.effectAllowed = 'copy';
};

// Canvas drop handler (in custom tool)
svgContainer.ondrop = (e) => {
    const data = e.dataTransfer.getData('application/sanyam-element');
    const { elementTypeId } = JSON.parse(data);
    const position = this.getModelPosition(e.clientX, e.clientY);
    this.actionDispatcher.dispatch(CreateElementAction.createNode(elementTypeId, position));
};
```

### RQ-003: How to detect double-click on empty canvas vs. on elements?

**Decision**: Register a Sprotty `MouseTool` that checks if the click target is the root graph element or an existing node/edge.

**Rationale**: Sprotty's `findParentByFeature` and element type checking allows determining what was clicked. Double-click on the SVG background (SGraph root) triggers the quick menu; double-click on a node triggers existing behavior (e.g., edit label).

**Alternatives Considered**:
- CSS pointer-events tricks: Unreliable with complex SVG structure
- Global document listener: Misses coordinate transformations, harder to integrate with Sprotty lifecycle

**Implementation Details**:
```typescript
@injectable()
export class CanvasDoubleClickTool extends MouseTool {
    doubleClick(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (target.type === 'graph' || target.id === 'graph') {
            // Empty canvas - show quick menu
            const position = this.getModelPosition(event);
            return [ShowQuickMenuAction.create(position, { x: event.clientX, y: event.clientY })];
        }
        // Let other handlers process element double-click
        return [];
    }
}
```

### RQ-004: How to render a positioned quick-pick menu on the canvas?

**Decision**: Extend `AbstractUIExtension` (same pattern as existing tool palette) with absolute positioning relative to the diagram container.

**Rationale**: The existing `AbstractUIExtension` provides the infrastructure for overlay UI on the diagram canvas. Position can be set via CSS `left`/`top` based on the click coordinates.

**Alternatives Considered**:
- Theia QuickPick service: Global, not positioned at click location
- Native HTML `<dialog>`: Doesn't integrate with Sprotty container layering
- Sprotty popup: For model-attached popups, not arbitrary position

**Implementation Details**:
```typescript
@injectable()
export class QuickMenuUIExtension extends AbstractUIExtension {
    protected position: { x: number; y: number } = { x: 0, y: 0 };

    show(root: SModelRootImpl, options: ShowUIExtensionOptions & { position: Point }): void {
        this.position = options.position;
        super.show(root, options);
    }

    protected initializeContents(container: HTMLElement): void {
        container.style.left = `${this.position.x}px`;
        container.style.top = `${this.position.y}px`;
        // Render searchable element list...
    }
}
```

### RQ-005: How to disable/remove the default floating tool palette?

**Decision**: Unbind `ToolPaletteUIExtension` from the Sprotty container DI configuration.

**Rationale**: The existing tool palette is registered via DI binding in `sprotty-di-config.ts`. Removing or skipping that binding prevents the palette from appearing.

**Implementation Details**:
In `createSanyamDiagramContainer()`, add an option to disable the built-in palette:
```typescript
if (!options.uiExtensions?.enableToolPalette) {
    // Don't bind ToolPaletteUIExtension
}
```

### RQ-006: Where does element type data come from for the sidebar?

**Decision**: Reuse existing `RequestToolPaletteAction` → `getToolPalette()` flow, which fetches categorized tools from the language server based on the grammar manifest.

**Rationale**: The language server's `tool-palette-provider.ts` already generates the complete element type list with categories from `GrammarManifest.rootTypes[].diagramNode` and `diagramTypes[].nodeTypes`. No need to duplicate this logic.

**Key Flow**:
1. When a diagram becomes active, sidebar widget requests palette via existing action
2. Language server returns `ToolPalette` with groups containing `ToolItem[]`
3. Sidebar renders groups as collapsible categories, items as draggable elements

### RQ-007: How to generate element thumbnails?

**Decision**: Use SVG-based thumbnails generated from element shape configuration, with fallback to icons.

**Rationale**: Grammar manifests define `diagramNode.shape` and CSS classes. A thumbnail renderer can produce a small SVG preview based on the shape (rect, ellipse, diamond, etc.) with appropriate coloring.

**Implementation Details**:
```typescript
function renderThumbnail(config: DiagramNodeConfig): string {
    const { shape, cssClass, defaultSize } = config;
    const width = 32, height = 24;
    switch (shape) {
        case 'rect': return `<svg width="${width}" height="${height}"><rect class="${cssClass}" width="100%" height="100%"/></svg>`;
        case 'ellipse': return `<svg width="${width}" height="${height}"><ellipse class="${cssClass}" cx="50%" cy="50%" rx="45%" ry="45%"/></svg>`;
        // ...
    }
}
```

For Phase 1, icons (codicons) can serve as fallback until thumbnail generation is implemented.

## Technology Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Sidebar Widget | `AbstractViewContribution` + `ReactWidget` | Full control, React state management |
| Drag-and-Drop | HTML5 DnD with DataTransfer | Cross-container support, native visual feedback |
| Quick Menu | `AbstractUIExtension` overlay | Consistent with existing GLSP UI pattern |
| Element Data | Reuse `RequestToolPaletteAction` | Avoids duplication, grammar-agnostic |
| Thumbnails | SVG from shape config | Consistent with diagram styling |
| Keyboard Nav | Focus management + keyboard events | Standard accessibility pattern |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Drag visual feedback not showing element preview | Medium | Use DataTransfer.setDragImage() with rendered thumbnail |
| Drop position inaccurate with zoom/pan | High | Reuse existing `getModelPosition()` from CreationToolMouseListener |
| Quick menu keyboard focus conflicts with diagram shortcuts | Medium | Trap focus in menu when open, restore on close |
| Performance with many element types | Low | Virtualize list if >100 items, otherwise not a concern |
