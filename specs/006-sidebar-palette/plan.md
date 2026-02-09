# Implementation Plan: Sidebar Element Palette

**Branch**: `006-sidebar-palette` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-sidebar-palette/spec.md`

## Summary

Replace the floating overlay tool palette with a dedicated Theia sidebar view for element browsing and drag-and-drop creation, plus a double-click quick menu for rapid element creation (Miro/FigJam style). This separates element discovery (sidebar) from rapid creation (quick menu) while completely removing the floating palette.

**Technical Approach**:
- Sidebar: `AbstractViewContribution` + `ReactWidget` for Theia integration
- Drag-and-Drop: HTML5 DnD API with DataTransfer for cross-container drag
- Quick Menu: `AbstractUIExtension` overlay positioned at click location
- Element Data: Reuse existing `RequestToolPaletteAction` → server palette generation

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Theia 1.67.0, GLSP 2.5.0, Sprotty 1.4.0, React 18.x, Inversify 6.x
**Storage**: N/A (no persistence required beyond existing preferences)
**Testing**: Vitest/Jest for unit tests, manual integration testing
**Target Platform**: Browser (Electron support via same codebase)
**Project Type**: Monorepo package extension
**Performance Goals**: Quick menu appears <200ms, drag preview <100ms, element creation <50ms
**Constraints**: Must integrate with existing GLSP action dispatcher, grammar-agnostic
**Scale/Scope**: Handles grammars with up to 100+ element types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Grammar Agnosticism | ✅ PASS | Sidebar reads from existing ToolPalette API, no grammar-specific code |
| Backward Compatibility | ✅ PASS | Old floating palette disabled via config flag, not removed |
| Declarative Over Imperative | ✅ PASS | Element types flow from manifest → palette, no hardcoding |
| Extension Over Modification | ✅ PASS | New components extend AbstractViewContribution, AbstractUIExtension |
| TypeScript Required | ✅ PASS | All new code in TypeScript |
| No `any` Without Justification | ✅ PASS | Strict typing in contracts |
| Injectable Services | ✅ PASS | All services use Inversify DI |
| JSDoc on Public APIs | ✅ PASS | Contract files fully documented |
| Accessibility (WCAG 2.1 AA) | ✅ PASS | Keyboard nav in quick menu, aria-labels planned |

**Post-Design Re-Check**: All gates remain PASS. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-sidebar-palette/
├── plan.md              # This file
├── research.md          # Phase 0 output - research findings
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - developer guide
├── contracts/           # Phase 1 output - API contracts
│   ├── actions.ts       # Sprotty action interfaces
│   ├── widget-api.ts    # Sidebar widget interfaces
│   └── quick-menu-api.ts # Quick menu interfaces
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/theia-extensions/glsp/src/browser/
├── element-palette/                    # NEW: Sidebar widget
│   ├── element-palette-widget.tsx      # React widget component
│   ├── element-palette-contribution.ts # Theia view contribution
│   ├── element-palette-service.ts      # State management
│   ├── element-category.tsx            # Category component
│   ├── element-item.tsx                # Draggable item component
│   ├── canvas-drop-handler.ts          # Drop handler for canvas
│   └── index.ts
│
├── ui-extensions/
│   ├── quick-menu/                     # NEW: Quick menu extension
│   │   ├── quick-menu-ui-extension.ts  # UI extension
│   │   ├── quick-menu-action-handler.ts
│   │   ├── quick-menu-actions.ts
│   │   ├── canvas-double-click-tool.ts # Mouse tool for detection
│   │   └── index.ts
│   │
│   └── tool-palette/                   # MODIFY: Disable flag
│       └── ... (existing files)
│
├── di/
│   └── sprotty-di-config.ts            # MODIFY: Register new components
│
├── glsp-frontend-module.ts             # MODIFY: Register sidebar widget
│
└── style/
    ├── element-palette.css             # NEW: Sidebar styles
    └── quick-menu.css                  # NEW: Quick menu styles
```

**Structure Decision**: Extends the existing `packages/theia-extensions/glsp/src/browser/` structure. New components follow the established patterns:
- Sidebar widget in `element-palette/` (similar to `outline/` pattern)
- Quick menu in `ui-extensions/quick-menu/` (follows `tool-palette/` pattern)

## Complexity Tracking

No constitution violations requiring justification. The implementation uses standard Theia/GLSP patterns with no unnecessary complexity.

## Phase 0 Output

See [research.md](./research.md) for:
- RQ-001: Theia sidebar view implementation
- RQ-002: Drag-and-drop from sidebar to canvas
- RQ-003: Double-click detection on empty canvas
- RQ-004: Positioned quick-pick menu rendering
- RQ-005: Disabling the floating palette
- RQ-006: Element type data source
- RQ-007: Thumbnail generation approach

## Phase 1 Output

See:
- [data-model.md](./data-model.md) - Entity definitions and state transitions
- [quickstart.md](./quickstart.md) - Developer implementation guide
- [contracts/](./contracts/) - TypeScript API contracts

## Implementation Phases

### Phase A: Foundation (P1 Stories)

1. Create `ElementPaletteWidget` with basic structure
2. Register as Theia sidebar view
3. Connect to existing `RequestToolPaletteAction` for data
4. Implement drag-and-drop from sidebar to canvas
5. Create `QuickMenuUIExtension` with positioning
6. Implement `CanvasDoubleClickTool` for trigger detection
7. Wire up element creation via existing `CreateElementAction`

### Phase B: Polish (P2 Stories)

8. Add collapsible categories in sidebar
9. Implement search/filter in sidebar
10. Add item tooltips with descriptions
11. Style sidebar items with icons (thumbnails deferred)

### Phase C: Accessibility (P3 Stories)

12. Implement keyboard navigation in quick menu
13. Add aria-labels and focus management
14. Test with screen readers

### Phase D: Cleanup

15. Add configuration option to disable floating palette
16. Remove floating palette from default configuration
17. Update documentation

## Next Steps

Run `/speckit.tasks` to generate actionable tasks from this plan.
