# Tasks: Diagram Editor UX Polish

**Input**: Design documents from `/specs/004-diagram-ux-polish/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **GLSP Frontend**: `packages/theia-extensions/glsp/src/browser/`
- **Language Server**: `packages/language-server/src/`
- **Types**: `packages/types/src/`
- **IDE Product**: `packages/ide/product/src/browser/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and shared infrastructure that all user stories depend on

- [ ] T001 [P] Add PortConfig and ConnectionRule types to packages/types/src/grammar-manifest.ts
- [ ] T002 [P] Add PropertyOverride type to packages/types/src/grammar-manifest.ts
- [ ] T003 [P] Create properties-service.ts types in packages/types/src/properties-service.ts
- [ ] T004 [P] Export new types from packages/types/src/index.ts
- [ ] T005 Verify build succeeds after type additions with `pnpm build:dev`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Add SelectionState and SelectionChangeEvent interfaces to packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T007 [P] Create outline sync types (ElementSymbolMapping, OutlineSyncConfig) in packages/theia-extensions/glsp/src/browser/outline/outline-sync-types.ts
- [ ] T008 [P] Create snap-to-grid types in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-types.ts
- [ ] T009 Add glsp-service getProperties and updateProperty method signatures to packages/types/src/glsp-service.ts
- [ ] T010 Verify all type changes build successfully with `pnpm build:dev`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Smooth Diagram Opening (Priority: P1)

**Goal**: Diagrams open without jarring visual repositioning; elements appear in their correct positions immediately

**Independent Test**: Open any saved diagram and verify no visible position changes occur after the diagram becomes visible

### Implementation for User Story 1

- [ ] T011 [US1] Add layout-pending class immediately on setModel() entry in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T012 [US1] Modify loadModel() to load saved layout BEFORE calling server in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T013 [US1] Update convertToSprottyModel() to apply cached positions during GModel conversion in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T014 [US1] Skip auto-layout request when saved positions exist for all elements in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T015 [US1] Call revealDiagramAfterLayout() after fitToScreen() when using saved layout in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T016 [US1] Add CSS transition for smooth fade-in reveal in packages/theia-extensions/glsp/src/browser/style/diagram-widget.css

**Checkpoint**: Diagrams with saved layouts now open without visible repositioning

---

## Phase 4: User Story 2 - Layout Persistence (Priority: P1)

**Goal**: Element positions are automatically saved and restored across sessions

**Independent Test**: Arrange elements, close diagram, reopen and verify positions match

### Implementation for User Story 2

- [ ] T017 [US2] Ensure layout-storage-service.ts saves on element move (verify existing debounce) in packages/theia-extensions/glsp/src/browser/layout-storage-service.ts
- [ ] T018 [US2] Add save on diagram close/dispose in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T019 [US2] Handle stale layout entries (elements removed from model) in packages/theia-extensions/glsp/src/browser/layout-storage-service.ts
- [ ] T020 [US2] Preserve existing positions when new elements added (merge strategy) in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T021 [US2] Add layout cache versioning check for schema migrations in packages/theia-extensions/glsp/src/browser/layout-storage-service.ts

**Checkpoint**: Layout persists across all close/reopen cycles for unchanged models

---

## Phase 5: User Story 3 - Marquee Selection (Priority: P2)

**Goal**: Users can select multiple elements by Ctrl+Drag on empty canvas

**Independent Test**: Ctrl+drag across multiple elements, verify all enclosed elements are selected

### Implementation for User Story 3

- [ ] T022 [US3] Add canvas mousedown listener detecting Ctrl+empty-space in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T023 [US3] Call enableMarqueeMode() from MarqueeSelectionTool on Ctrl+mousedown detection in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T024 [US3] Add isNodeElement() helper to check if click target is a node in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T025 [US3] Verify marquee rectangle CSS styling in packages/theia-extensions/glsp/src/browser/ui-extensions/selection/marquee-selection-tool.css
- [ ] T026 [US3] Test marquee with selection modes (replace, add via Ctrl+Ctrl, toggle via Shift) in packages/theia-extensions/glsp/src/browser/ui-extensions/selection/marquee-selection-tool.ts

**Checkpoint**: Marquee selection works with Ctrl+Drag on empty canvas

---

## Phase 6: User Story 4 - Properties Panel (Priority: P2)

**Goal**: Dockable panel shows editable properties for selected diagram elements

**Independent Test**: Select element, verify properties panel shows editable fields, edit a value and verify model updates

### Implementation for User Story 4

- [ ] T027 [P] [US4] Create property-provider.ts for AST property extraction in packages/language-server/src/glsp/providers/property-provider.ts
- [ ] T028 [P] [US4] Implement classifyField() using hybrid heuristic + manifest overrides in packages/language-server/src/glsp/providers/property-provider.ts
- [ ] T029 [P] [US4] Create property-utils.ts with classification helpers in packages/theia-extensions/glsp/src/browser/properties/property-utils.ts
- [ ] T030 [US4] Implement getProperties() in GLSP server to extract properties from AST in packages/language-server/src/glsp/glsp-server.ts
- [ ] T031 [US4] Implement updateProperty() in GLSP server to modify AST text in packages/language-server/src/glsp/glsp-server.ts
- [ ] T032 [P] [US4] Create properties-panel-widget.ts Theia widget container in packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts
- [ ] T033 [P] [US4] Create property-form.tsx React component for rendering/editing properties in packages/theia-extensions/glsp/src/browser/properties/property-form.tsx
- [ ] T034 [US4] Create properties-panel-contribution.ts for Theia registration in packages/theia-extensions/glsp/src/browser/properties/properties-panel-contribution.ts
- [ ] T035 [US4] Add selection change listener to update properties panel in packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts
- [ ] T036 [US4] Implement multi-select: find common properties, update all on edit in packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts
- [ ] T037 [US4] Register properties panel in glsp-frontend-module.ts in packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts
- [ ] T038 [US4] Create index.ts barrel export for properties module in packages/theia-extensions/glsp/src/browser/properties/index.ts
- [ ] T039 [US4] Add Properties Panel to View menu via command contribution in packages/theia-extensions/glsp/src/browser/properties/properties-panel-contribution.ts
- [ ] T039a [US4] Add explorer selection listener to update properties panel in packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts

**Checkpoint**: Properties panel shows and edits properties for single and multi-select, responds to explorer selection

---

## Phase 7: User Story 5 - Document Outline (Priority: P2)

**Goal**: Bidirectional selection sync between outline, diagram, and text editor

**Independent Test**: Click outline item, verify element selected in both diagram and text editor

### Implementation for User Story 5

- [ ] T040 [P] [US5] Create outline-sync-service.ts for selection coordination in packages/theia-extensions/glsp/src/browser/outline/outline-sync-service.ts
- [ ] T041 [P] [US5] Create element-symbol-mapper.ts to map element IDs to DocumentSymbols in packages/theia-extensions/glsp/src/browser/outline/element-symbol-mapper.ts
- [ ] T042 [US5] Add outline → diagram selection sync (on outline click, select in diagram) in packages/theia-extensions/glsp/src/browser/outline/outline-sync-service.ts
- [ ] T043 [US5] Add outline → text editor selection sync (navigate to symbol range) in packages/theia-extensions/glsp/src/browser/outline/outline-sync-service.ts
- [ ] T044 [US5] Add diagram → outline sync (highlight outline item on diagram select) in packages/theia-extensions/glsp/src/browser/outline/outline-sync-service.ts
- [ ] T045 [US5] Register outline sync service in glsp-frontend-module.ts in packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts
- [ ] T046 [US5] Create index.ts barrel export for outline module in packages/theia-extensions/glsp/src/browser/outline/index.ts

**Checkpoint**: Clicking outline item selects in both diagram and text editor

---

## Phase 8: User Story 6 - Snap to Grid (Priority: P3)

**Goal**: Toggle-able snap-to-grid for precise element alignment

**Independent Test**: Enable snap-to-grid, drag node, verify it snaps to grid intersections

### Implementation for User Story 6

- [ ] T047 [P] [US6] Create snap-grid-actions.ts with ToggleSnapGridAction in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-actions.ts
- [ ] T048 [P] [US6] Create grid-snapper.ts implementing ISnapper interface in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/grid-snapper.ts
- [ ] T049 [US6] Create snap-grid-tool.ts UI extension with toolbar toggle in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-tool.ts
- [ ] T050 [US6] Add snap-to-grid preferences schema (enabled, gridSize, showGrid) in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-preferences.ts
- [ ] T051 [US6] Register GridSnapper in Sprotty DI container when enabled in packages/theia-extensions/glsp/src/browser/di/sprotty-di-config.ts
- [ ] T052 [US6] Add toolbar icon for snap-to-grid toggle in packages/theia-extensions/glsp/src/browser/glsp-toolbar-contribution.ts
- [ ] T053 [US6] Create index.ts barrel export for snap-to-grid module in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/index.ts
- [ ] T054 [US6] Persist snap-to-grid preference across sessions via Theia preferences in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-tool.ts

**Checkpoint**: Snap-to-grid toggles and persists correctly

---

## Phase 9: User Story 7 - Grammar-Driven Tool Palette (Priority: P3)

**Goal**: Tool palette shows all node/edge types from grammar manifest

**Independent Test**: Load grammar, verify tool palette shows all manifest-defined types (not hardcoded defaults)

### Implementation for User Story 7

- [ ] T055 [US7] Enhance generateFromTypes() to read rootTypes[].diagramNode in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T056 [US7] Read diagramTypes[].nodeTypes for creatable node filtering in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T057 [US7] Read diagramTypes[].edgeTypes for connection tools in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T058 [US7] Implement type hierarchy grouping from manifest structure in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T059 [US7] Remove hardcoded default tool items (Entity, Property, etc.) in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T060 [US7] Add fallback message when no node types defined in manifest in packages/language-server/src/glsp/providers/tool-palette-provider.ts

**Checkpoint**: Tool palette reflects grammar manifest completely

---

## Phase 10: User Story 8 - Port-Based Connections (Priority: P3)

**Goal**: Node types with port definitions show connection ports with grammar-defined rules

**Independent Test**: Create connection between port-enabled nodes, verify connections attach to ports and rules enforced

### Implementation for User Story 8

- [ ] T061 [P] [US8] Create port-view.ts Sprotty view for rendering ports in packages/theia-extensions/glsp/src/browser/ports/port-view.ts
- [ ] T062 [P] [US8] Create port-connection-rules.ts for validation logic in packages/theia-extensions/glsp/src/browser/ports/port-connection-rules.ts
- [ ] T063 [US8] Update ast-to-gmodel-provider.ts to generate SPort elements from manifest in packages/language-server/src/glsp/providers/ast-to-gmodel-provider.ts
- [ ] T064 [US8] Calculate port positions using calculatePortPosition() in packages/language-server/src/glsp/providers/ast-to-gmodel-provider.ts
- [ ] T065 [US8] Register PortView in Sprotty DI config in packages/theia-extensions/glsp/src/browser/di/sprotty-di-config.ts
- [ ] T066 [US8] Add connection rule validation in edge creation handler in packages/language-server/src/glsp/handlers/create-edge-handler.ts
- [ ] T067 [US8] Add visual feedback for valid/invalid port targets during connection in packages/theia-extensions/glsp/src/browser/ports/port-view.ts
- [ ] T068 [US8] Create port CSS styles (sanyam-port, sanyam-port-valid-target, etc.) in packages/theia-extensions/glsp/src/browser/ports/port-styles.css
- [ ] T069 [US8] Create index.ts barrel export for ports module in packages/theia-extensions/glsp/src/browser/ports/index.ts

**Checkpoint**: Port-enabled nodes display ports with connection rule enforcement

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T070 [P] Add aria-labels to all form inputs in properties panel in packages/theia-extensions/glsp/src/browser/properties/property-form.tsx
- [ ] T070a [US4] Implement keyboard navigation (Tab between fields, Enter to commit, Escape to cancel) in packages/theia-extensions/glsp/src/browser/properties/property-form.tsx
- [ ] T070b [US4] Add focus management (auto-focus first field on selection change) in packages/theia-extensions/glsp/src/browser/properties/property-form.tsx
- [ ] T071 [P] Add aria-labels to snap-to-grid toggle in packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-tool.ts
- [ ] T072 Code cleanup: remove unused imports across all new files
- [ ] T073 Verify all JSDoc comments are present per constitution
- [ ] T074 Run `pnpm lint:fix` to fix any linting issues
- [ ] T075 Run `pnpm build` for full production build verification
- [ ] T075a [P] Add performance logging for layout restore timing (<100ms target) in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T075b [P] Add performance logging for tool palette generation (<50ms target) in packages/language-server/src/glsp/providers/tool-palette-provider.ts
- [ ] T075c [P] Add performance logging for properties panel render (<100ms target) in packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts
- [ ] T076 Run quickstart.md validation scenarios manually
- [ ] T077 Update CLAUDE.md Active Technologies section if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; integrates with US1 layout loading
- **User Story 3 (Phase 5)**: Depends on Foundational
- **User Story 4 (Phase 6)**: Depends on Foundational
- **User Story 5 (Phase 7)**: Depends on Foundational
- **User Story 6 (Phase 8)**: Depends on Foundational
- **User Story 7 (Phase 9)**: Depends on Foundational
- **User Story 8 (Phase 10)**: Depends on Foundational; benefits from US7 manifest enhancements
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Can Start After | Notes |
|-------|----------|-----------------|-------|
| US1 - Smooth Opening | P1 | Foundational | No story dependencies |
| US2 - Layout Persistence | P1 | Foundational | Integrates with US1 |
| US3 - Marquee Selection | P2 | Foundational | No story dependencies |
| US4 - Properties Panel | P2 | Foundational | No story dependencies |
| US5 - Document Outline | P2 | Foundational | No story dependencies |
| US6 - Snap to Grid | P3 | Foundational | No story dependencies |
| US7 - Tool Palette | P3 | Foundational | No story dependencies |
| US8 - Port Connections | P3 | Foundational | Benefits from US7 |

### Parallel Opportunities

**Within Setup (Phase 1)**:
- T001, T002, T003, T004 can all run in parallel

**Within Foundational (Phase 2)**:
- T006, T007, T008 can all run in parallel

**After Foundational**:
- US1 and US3 can run in parallel (different files)
- US4 and US5 can run in parallel (different modules)
- US6, US7 can run in parallel (different modules)

**Within User Story 4**:
- T027, T028, T029 can run in parallel (different files)
- T032, T033 can run in parallel (different files)

**Within User Story 8**:
- T061, T062 can run in parallel (different files)

---

## Parallel Example: User Story 4 (Properties Panel)

```bash
# Launch parallel model/utility tasks:
Task: "Create property-provider.ts" (packages/language-server/src/glsp/providers/property-provider.ts)
Task: "Implement classifyField()" (same file)
Task: "Create property-utils.ts" (packages/theia-extensions/glsp/src/browser/properties/property-utils.ts)

# Then launch parallel UI tasks:
Task: "Create properties-panel-widget.ts" (packages/theia-extensions/glsp/src/browser/properties/properties-panel-widget.ts)
Task: "Create property-form.tsx" (packages/theia-extensions/glsp/src/browser/properties/property-form.tsx)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (infrastructure)
3. Complete Phase 3: User Story 1 (smooth opening)
4. Complete Phase 4: User Story 2 (layout persistence)
5. **STOP and VALIDATE**: Test layout restore independently
6. Deploy/demo - core layout UX is polished

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1 + US2 | Smooth, persistent diagram layouts |
| +Selection | +US3 | Multi-element manipulation |
| +Editing | +US4 + US5 | Property editing, outline navigation |
| +Polish | +US6 + US7 + US8 | Grid snap, full grammar support, ports |

### Single Developer Strategy

1. Complete Setup + Foundational
2. US1 → US2 (P1 stories, tightly coupled)
3. US3 (P2, standalone)
4. US4 → US5 (P2, both involve selection)
5. US6 → US7 → US8 (P3 enhancements)
6. Polish phase

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- All user stories can be independently tested after Foundational phase
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: editing same file in parallel tasks, cross-story dependencies
