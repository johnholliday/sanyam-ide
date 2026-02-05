# Tasks: Sidebar Element Palette

**Input**: Design documents from `/specs/006-sidebar-palette/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - manual testing via quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

All paths relative to `packages/theia-extensions/glsp/src/browser/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and shared types

- [x] T001 Create element-palette directory at `packages/theia-extensions/glsp/src/browser/element-palette/`
- [x] T002 Create quick-menu directory at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/`
- [x] T003 [P] Create element-palette.css stylesheet at `packages/theia-extensions/glsp/src/browser/style/element-palette.css`
- [x] T004 [P] Create quick-menu.css stylesheet at `packages/theia-extensions/glsp/src/browser/style/quick-menu.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create quick-menu-actions.ts with ShowQuickMenuAction, HideQuickMenuAction, FilterQuickMenuAction, NavigateQuickMenuAction, SelectQuickMenuItemAction at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-actions.ts`
- [x] T006 [P] Create drag-drop-actions.ts with StartDragFromPaletteAction, DragEnterCanvasAction, DragLeaveCanvasAction, DropOnCanvasAction at `packages/theia-extensions/glsp/src/browser/element-palette/drag-drop-actions.ts`
- [x] T007 [P] Create element-palette-types.ts with ElementPaletteState, ElementCategory, ElementTypeItem interfaces at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-types.ts`
- [x] T008 Create element-palette-service.ts with state management, RequestToolPaletteAction dispatch, active widget tracking at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-service.ts`
- [x] T009 Add enableToolPalette option to UIExtensionsModuleOptions in `packages/theia-extensions/glsp/src/browser/ui-extensions/index.ts`
- [x] T010 Add condition to skip ToolPaletteUIExtension binding when enableToolPalette=false in `packages/theia-extensions/glsp/src/browser/ui-extensions/index.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Sidebar Drag-and-Drop (Priority: P1) 🎯 MVP

**Goal**: Users can drag element types from sidebar to create elements on canvas

**Independent Test**: Open diagram → Open Element Palette sidebar → Drag element type to canvas → Verify element created at drop position

### Implementation for User Story 1

- [x] T011 [US1] Create ElementPaletteWidget extending ReactWidget with basic render method at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-widget.tsx`
- [x] T012 [US1] Create ElementPaletteViewContribution extending AbstractViewContribution at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-contribution.ts`
- [x] T013 [US1] Create element-item.tsx React component with draggable=true and onDragStart handler at `packages/theia-extensions/glsp/src/browser/element-palette/element-item.tsx`
- [x] T014 [US1] Add DataTransfer encoding with ELEMENT_PALETTE_DRAG_MIME_TYPE in element-item.tsx at `packages/theia-extensions/glsp/src/browser/element-palette/element-item.tsx`
- [x] T015 [US1] Create canvas-drop-handler.ts with ondragover/ondrop event listeners at `packages/theia-extensions/glsp/src/browser/element-palette/canvas-drop-handler.ts`
- [x] T016 [US1] Implement getModelPosition() in canvas-drop-handler.ts for coordinate transformation at `packages/theia-extensions/glsp/src/browser/element-palette/canvas-drop-handler.ts`
- [x] T017 [US1] Dispatch CreateElementAction.createNode() on drop in canvas-drop-handler.ts at `packages/theia-extensions/glsp/src/browser/element-palette/canvas-drop-handler.ts`
- [x] T018 [US1] Register ElementPaletteViewContribution and WidgetFactory in glsp-frontend-module.ts at `packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts`
- [x] T019 [US1] CanvasDropHandler initialized from CompositeEditorWidget after diagram model loads at `packages/theia-extensions/glsp/src/browser/composite-editor-widget.ts`
- [x] T020 [US1] Create index.ts exports for element-palette module at `packages/theia-extensions/glsp/src/browser/element-palette/index.ts`
- [x] T021 [US1] Style element-item with hover states and drag cursor in element-palette.css at `packages/theia-extensions/glsp/src/browser/style/element-palette.css`
- [x] T022 [US1] Add drop preview visual indicator styling in element-palette.css at `packages/theia-extensions/glsp/src/browser/style/element-palette.css`

**Checkpoint**: User Story 1 complete - drag-and-drop element creation works independently

---

## Phase 4: User Story 2 - Double-Click Quick Menu (Priority: P1)

**Goal**: Users can double-click on empty canvas to open quick menu and create elements

**Independent Test**: Open diagram → Double-click on empty canvas → Quick menu appears → Select element → Element created at click position

### Implementation for User Story 2

- [x] T023 [US2] Create canvas-double-click-tool.ts extending MouseTool at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/canvas-double-click-tool.ts`
- [x] T024 [US2] Implement doubleClick() method to detect clicks on graph root vs elements at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/canvas-double-click-tool.ts`
- [x] T025 [US2] Create quick-menu-ui-extension.ts extending AbstractUIExtension at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T026 [US2] Implement positioned rendering with CSS left/top based on screenPosition at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T027 [US2] Render element list in quick-menu-ui-extension.ts with click handlers at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T028 [US2] Create quick-menu-action-handler.ts for ShowQuickMenuAction and HideQuickMenuAction at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-action-handler.ts`
- [x] T029 [US2] Implement SelectQuickMenuItemAction handler to dispatch CreateElementAction at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-action-handler.ts`
- [x] T030 [US2] Add Escape key handler to close quick menu at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T031 [US2] Add click-outside detection to close quick menu at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T032 [US2] Register CanvasDoubleClickTool via ui-extensions/index.ts createUIExtensionsModule
- [x] T033 [US2] Register QuickMenuUIExtension and QuickMenuActionHandler via ui-extensions/index.ts
- [x] T034 [US2] Configure action handlers for quick menu actions via ui-extensions/index.ts
- [x] T035 [US2] Create index.ts exports for quick-menu module at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/index.ts`
- [x] T036 [US2] Style quick-menu container with shadow, border-radius, max-height in quick-menu.css at `packages/theia-extensions/glsp/src/browser/style/quick-menu.css`
- [x] T037 [US2] Style quick-menu items with hover and selected states in quick-menu.css at `packages/theia-extensions/glsp/src/browser/style/quick-menu.css`

**Checkpoint**: User Story 2 complete - double-click quick menu works independently

---

## Phase 5: User Story 3 - Browse Categories (Priority: P2)

**Goal**: Users can browse elements organized by collapsible categories with tooltips

**Independent Test**: Open Element Palette → Click category headers to expand/collapse → Hover items to see tooltips

### Implementation for User Story 3

- [x] T038 [US3] Create element-category.tsx React component with expand/collapse state at `packages/theia-extensions/glsp/src/browser/element-palette/element-category.tsx`
- [x] T039 [US3] Add chevron icon toggle in element-category.tsx header at `packages/theia-extensions/glsp/src/browser/element-palette/element-category.tsx`
- [x] T040 [US3] Track expandedCategories in ElementPaletteService state at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-service.ts`
- [x] T041 [US3] Update ElementPaletteWidget to render categories using element-category.tsx at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-widget.tsx`
- [x] T042 [US3] Add tooltip with description on element-item hover at `packages/theia-extensions/glsp/src/browser/element-palette/element-item.tsx`
- [x] T043 [US3] Style category headers with icons and collapse animation in element-palette.css at `packages/theia-extensions/glsp/src/browser/style/element-palette.css`

**Checkpoint**: User Story 3 complete - category browsing works independently

---

## Phase 6: User Story 4 - Search Elements (Priority: P2)

**Goal**: Users can search/filter elements across all categories

**Independent Test**: Open Element Palette → Type in search box → List filters to matching elements → Clear search restores full list

### Implementation for User Story 4

- [x] T044 [US4] Add search input to ElementPaletteWidget header at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-widget.tsx`
- [x] T045 [US4] Implement setSearchFilter() in ElementPaletteService at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-service.ts`
- [x] T046 [US4] Add filteredGroups computed property in ElementPaletteService at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-service.ts`
- [x] T047 [US4] Update ElementPaletteWidget to render filteredGroups instead of groups at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-widget.tsx`
- [x] T048 [US4] Add empty state message when no elements match search at `packages/theia-extensions/glsp/src/browser/element-palette/element-palette-widget.tsx`
- [x] T049 [US4] Style search input with clear button in element-palette.css at `packages/theia-extensions/glsp/src/browser/style/element-palette.css`

**Checkpoint**: User Story 4 complete - search filtering works independently

---

## Phase 7: User Story 5 - Quick Menu Keyboard Navigation (Priority: P3)

**Goal**: Users can navigate quick menu using keyboard (arrows, type-to-filter, Enter)

**Independent Test**: Open quick menu → Use arrow keys to move selection → Type to filter → Press Enter to create element

### Implementation for User Story 5

- [x] T050 [US5] Add selectedIndex state to QuickMenuUIExtension at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T051 [US5] Implement ArrowUp/ArrowDown key handlers to navigate selection at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T052 [US5] Add search input to quick menu with type-to-filter behavior at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [x] T053 [US5] FilterQuickMenuAction handled directly in QuickMenuUIExtension
- [x] T054 [US5] NavigateQuickMenuAction handled directly in QuickMenuUIExtension
- [x] T055 [US5] Add Enter key handler to select highlighted item at `packages/theia-extensions/glsp/src/browser/ui-extensions/quick-menu/quick-menu-ui-extension.ts`
- [ ] T056 [US5] Add focus trap to keep focus in quick menu when open (deferred - basic focus works)
- [x] T057 [US5] Style selected item highlight in quick-menu.css at `packages/theia-extensions/glsp/src/browser/style/quick-menu.css`
- [ ] T058 [US5] Add aria-labels for accessibility in quick-menu-ui-extension.ts (deferred - enhancement)

**Checkpoint**: User Story 5 complete - keyboard navigation works independently

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Disable floating palette and final cleanup

- [ ] T059 Set enableToolPalette: false in default UIExtensionsModuleOptions at `packages/theia-extensions/glsp/src/browser/di/sprotty-di-config.ts`
- [x] T060 [P] JSDoc comments included in element-palette module
- [x] T061 [P] JSDoc comments included in quick-menu module
- [x] T062 Import element-palette.css in glsp-frontend-module.ts at `packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts`
- [x] T063 Import quick-menu.css in glsp-frontend-module.ts at `packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts`
- [ ] T064 Run quickstart.md validation checklist manually
- [x] T065 Build and verify no TypeScript errors with `pnpm --filter @sanyam-ide/glsp build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority and can run in parallel
  - US3 and US4 are P2 priority and can run after US1/US2 (or in parallel)
  - US5 is P3 priority, depends on US2 (quick menu) being complete
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Parallel With |
|-------|----------|------------|-------------------|
| US1 (Sidebar DnD) | P1 | Foundational | US2 |
| US2 (Quick Menu) | P1 | Foundational | US1 |
| US3 (Categories) | P2 | US1 (sidebar widget exists) | US4 |
| US4 (Search) | P2 | US1 (sidebar widget exists) | US3 |
| US5 (Keyboard Nav) | P3 | US2 (quick menu exists) | - |

### Within Each User Story

- Create component files before handlers/integrations
- Register in DI config after component is complete
- Add styles as final step in each story

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# All can run in parallel:
T001 + T002 + T003 + T004
```

**Phase 2 (Foundational)**:
```bash
# Can run in parallel:
T005 + T006 + T007
# Then T008, T009, T010 sequentially
```

**Phase 3-4 (P1 Stories) - Can run in parallel with different developers**:
```bash
# Developer A: User Story 1
T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022

# Developer B: User Story 2
T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037
```

**Phase 5-6 (P2 Stories) - Can run in parallel**:
```bash
# Developer A: User Story 3
T038 → T039 → T040 → T041 → T042 → T043

# Developer B: User Story 4
T044 → T045 → T046 → T047 → T048 → T049
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Sidebar Drag-and-Drop)
4. **STOP and VALIDATE**: Test drag-and-drop independently
5. Deploy/demo if ready - users can create elements via sidebar

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Sidebar) → Test independently → MVP with sidebar!
3. Add User Story 2 (Quick Menu) → Test independently → Two creation methods!
4. Add User Story 3 (Categories) → Test independently → Better browsing!
5. Add User Story 4 (Search) → Test independently → Faster element finding!
6. Add User Story 5 (Keyboard) → Test independently → Full accessibility!
7. Complete Polish → Floating palette removed, docs complete

### Parallel Team Strategy

With 2 developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 → User Story 3
   - Developer B: User Story 2 → User Story 4 → User Story 5
3. Team completes Polish together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 and US2 are both P1 - either can serve as MVP
- Floating palette disabled in Polish phase after all features work
