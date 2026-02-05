# Quickstart: Sidebar Element Palette

**Branch**: `006-sidebar-palette` | **Date**: 2026-02-05

## Overview

This feature replaces the floating overlay tool palette with:
1. **Sidebar Element Palette** - A Theia sidebar view for browsing and dragging element types
2. **Quick Menu** - A double-click-triggered popup for rapid element creation (Miro/FigJam style)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Theia Application                               │
├─────────────────┬───────────────────────────────────────────────────────────┤
│  Element        │                   Diagram Editor                          │
│  Palette        │  ┌─────────────────────────────────────────────────────┐  │
│  (Sidebar)      │  │                 Sprotty Canvas                       │  │
│  ┌───────────┐  │  │                                                     │  │
│  │ Search    │  │  │   ┌─────────────────┐                               │  │
│  ├───────────┤  │  │   │   Quick Menu    │  (double-click popup)         │  │
│  │ Nodes     │──┼──│──►│   ○ Node A      │                               │  │
│  │  ○ Node A │  │  │   │   ○ Node B      │                               │  │
│  │  ○ Node B │  │  │   │   ○ Edge        │                               │  │
│  ├───────────┤  │  │   └─────────────────┘                               │  │
│  │ Edges     │  │  │                                                     │  │
│  │  ○ Connect│  │  │     [Diagram Elements]                              │  │
│  └───────────┘  │  │                                                     │  │
│                 │  └─────────────────────────────────────────────────────┘  │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Element Palette Widget

**Location**: `packages/theia-extensions/glsp/src/browser/element-palette/`

```
element-palette/
├── element-palette-widget.tsx       # React widget component
├── element-palette-contribution.ts  # Theia view contribution
├── element-palette-service.ts       # Data fetching & state management
├── element-category.tsx             # Collapsible category component
├── element-item.tsx                 # Draggable element item component
└── index.ts                         # Exports
```

**Key Classes**:
- `ElementPaletteWidget extends ReactWidget` - Main sidebar widget
- `ElementPaletteViewContribution extends AbstractViewContribution` - Registers with Theia
- `ElementPaletteService` - Fetches element types, manages state

### 2. Quick Menu Extension

**Location**: `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/`

```
quick-menu/
├── quick-menu-ui-extension.ts       # Sprotty UI extension
├── quick-menu-action-handler.ts     # Action handler
├── quick-menu-actions.ts            # Action definitions
├── canvas-double-click-tool.ts      # Double-click detection tool
└── index.ts                         # Exports
```

**Key Classes**:
- `QuickMenuUIExtension extends AbstractUIExtension` - Positioned popup UI
- `CanvasDoubleClickTool extends MouseTool` - Detects double-clicks on canvas
- `QuickMenuActionHandler` - Handles show/hide/select actions

### 3. Drop Handler Integration

**Location**: `packages/theia-extensions/glsp/src/browser/element-palette/`

```
├── canvas-drop-handler.ts           # Handles drops from sidebar
```

**Key Classes**:
- `CanvasDropHandler` - Listens for drop events, dispatches CreateElementAction

## Data Flow

### Element Type Discovery

```typescript
// 1. Sidebar listens for active widget changes
@inject(ApplicationShell)
protected shell: ApplicationShell;

this.shell.onDidChangeCurrentWidget(widget => {
    if (widget instanceof CompositeEditorWidget) {
        this.loadPalette(widget.diagramUri);
    }
});

// 2. Request palette from server (reuses existing flow)
async loadPalette(uri: string): Promise<void> {
    const palette = await this.languageClientProvider.getToolPalette(uri);
    this.setState({ groups: palette.groups });
}
```

### Drag-and-Drop

```typescript
// Sidebar item
<div
    draggable={true}
    onDragStart={(e) => {
        e.dataTransfer.setData(ELEMENT_PALETTE_DRAG_MIME_TYPE, encodeDragData({
            elementTypeId: item.action.elementTypeId,
            label: item.label
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }}
>
    {item.label}
</div>

// Canvas drop handler
svgContainer.addEventListener('drop', (e) => {
    const data = decodeDragData(e.dataTransfer.getData(ELEMENT_PALETTE_DRAG_MIME_TYPE));
    if (data) {
        const position = this.getModelPosition(e.clientX, e.clientY);
        this.actionDispatcher.dispatch(CreateElementAction.createNode(data.elementTypeId, position));
    }
});
```

### Quick Menu

```typescript
// Double-click detection
@injectable()
export class CanvasDoubleClickTool extends MouseTool {
    doubleClick(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (target.type === 'graph') {
            return [ShowQuickMenuAction.create(
                this.getModelPosition(event),
                { x: event.clientX, y: event.clientY }
            )];
        }
        return [];
    }
}

// Quick menu selection
handleSelectItem(elementTypeId: string): void {
    this.actionDispatcher.dispatch(
        CreateElementAction.createNode(elementTypeId, this.state.modelPosition)
    );
    this.hide();
}
```

## Configuration

### Disable Floating Palette

In `createSanyamDiagramContainer()`:

```typescript
const uiExtensionsOptions: UIExtensionsModuleOptions = {
    // ...existing options...
    enableToolPalette: false,  // NEW: Disable floating palette
};
```

### Register Sidebar Widget

In `glsp-frontend-module.ts`:

```typescript
import { ElementPaletteViewContribution, ElementPaletteWidget, ElementPaletteService } from './element-palette';

bind(ElementPaletteService).toSelf().inSingletonScope();
bind(ElementPaletteWidget).toSelf();
bindViewContribution(bind, ElementPaletteViewContribution);
bind(WidgetFactory).toDynamicValue(ctx => ({
    id: 'element-palette',
    createWidget: () => ctx.container.get(ElementPaletteWidget)
})).inSingletonScope();
```

### Register Quick Menu & Drop Handler

In `sprotty-di-config.ts`:

```typescript
import { QuickMenuUIExtension, QuickMenuActionHandler, CanvasDoubleClickTool, CanvasDropHandler } from '../ui-extensions/quick-menu';

// In createUIExtensionsModule():
bind(QuickMenuUIExtension).toSelf().inSingletonScope();
bind(QuickMenuActionHandler).toSelf().inSingletonScope();
bind(CanvasDoubleClickTool).toSelf().inSingletonScope();
bind(CanvasDropHandler).toSelf().inSingletonScope();

configureActionHandler(context, ShowQuickMenuAction.KIND, QuickMenuActionHandler);
configureActionHandler(context, HideQuickMenuAction.KIND, QuickMenuActionHandler);
```

## Testing

### Manual Testing Checklist

1. **Sidebar Palette**
   - [ ] Opens in left sidebar when View > Element Palette selected
   - [ ] Shows categories from active diagram's grammar
   - [ ] Categories expand/collapse on click
   - [ ] Search filters items across all categories
   - [ ] Items show icons and labels

2. **Drag-and-Drop**
   - [ ] Items are draggable (cursor changes)
   - [ ] Dragging over canvas shows drop indicator
   - [ ] Dropping creates element at drop position
   - [ ] Dropping outside canvas cancels operation

3. **Quick Menu**
   - [ ] Double-click on empty canvas shows menu
   - [ ] Menu appears at click position
   - [ ] Typing filters menu items
   - [ ] Arrow keys navigate selection
   - [ ] Enter creates selected element
   - [ ] Escape closes menu
   - [ ] Double-click on element does NOT show menu

4. **Floating Palette**
   - [ ] No longer appears when diagram opens

## Troubleshooting

### Sidebar not showing

1. Check `View > Element Palette` menu item exists
2. Verify `ElementPaletteViewContribution` is bound in frontend module
3. Check browser console for widget creation errors

### Drag not working

1. Verify `draggable="true"` attribute on items
2. Check DataTransfer MIME type matches
3. Ensure canvas has drop event listeners registered

### Quick menu not appearing

1. Verify double-click target detection (check `target.type === 'graph'`)
2. Check `ShowQuickMenuAction` is dispatched (add logging)
3. Verify `QuickMenuActionHandler` is registered for action kind

### Elements created at wrong position

1. Check `getModelPosition()` coordinate transformation
2. Verify SVG viewBox and transform matrix handling
3. Test with zoom at 100% first, then with zoom/pan
