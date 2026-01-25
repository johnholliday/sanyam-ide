# Tasks: Complete GLSP Backend Integration

**Input**: Design documents from `/specs/003-glsp-backend-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual E2E testing only (no automated test tasks)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

```text
packages/
├── types/src/                          # Shared types (@sanyam/types)
├── theia-extensions/glsp/src/browser/  # Frontend code
├── theia-extensions/glsp/src/node/     # Backend code
└── language-server/src/glsp/           # Language server GLSP code
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define shared service interface in types package

- [x] T001 [P] Create SanyamGlspService interface in packages/types/src/glsp-service.ts
- [x] T002 [P] Create response types (LoadModelResponse, ExecuteOperationResponse, etc.) in packages/types/src/glsp-service.ts
- [x] T003 [P] Create DiagramOperation union type in packages/types/src/glsp-service.ts
- [x] T004 [P] Create DiagramLayout persistence types in packages/types/src/glsp-service.ts
- [x] T005 Export all new types from packages/types/src/index.ts

---

## Phase 2: Foundational (Backend Service Core)

**Purpose**: Core backend service that MUST be complete before ANY user story can function

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create SanyamGlspBackendServiceImpl class skeleton in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [x] T007 Implement lazy initialization with request queuing in SanyamGlspBackendServiceImpl
- [x] T008 Implement grammar contribution loading via @sanyam/grammar-scanner in SanyamGlspBackendServiceImpl
- [x] T009 Bind SanyamGlspBackendServiceImpl and register JsonRpcConnectionHandler in packages/theia-extensions/glsp/src/node/glsp-backend-module.ts
- [x] T010 Create service proxy via WebSocketConnectionProvider in packages/theia-extensions/glsp/src/browser/glsp-frontend-module.ts
- [x] T011 Update SanyamLanguageClientProvider to use injected service proxy in packages/theia-extensions/glsp/src/browser/sanyam-language-client-provider.ts

**Checkpoint**: Backend service skeleton ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Diagram for Grammar File (Priority: P1) 🎯 MVP

**Goal**: Display real diagram data from language server instead of mock data

**Independent Test**: Open a .spdk file, press Ctrl+Shift+D, verify nodes show actual entities from file

### Implementation for User Story 1

- [x] T012 [US1] Implement loadModel() in SanyamGlspBackendServiceImpl to call GLSP server's AST-to-GModel conversion in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [x] T013 [US1] Implement getToolPalette() in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [x] T014 [US1] Implement validate() in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [x] T015 [US1] Implement getSupportedOperations() in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [x] T016 [US1] Update sendRequest() in SanyamLanguageClientProvider to route loadModel to service proxy in packages/theia-extensions/glsp/src/browser/sanyam-language-client-provider.ts
- [x] T017 [US1] Update sendRequest() to route getToolPalette and validate to service proxy in packages/theia-extensions/glsp/src/browser/sanyam-language-client-provider.ts
- [x] T018 [US1] Add error handling for uninitialized server state (return pending response)
- [x] T019 [US1] Add logging for model load operations (debug level)

**Checkpoint**: User Story 1 complete - diagram shows real data from language server

---

## Phase 4: User Story 2 - Live Text Updates on Diagram Edit (Priority: P2)

**Goal**: Editing diagram (add node, delete, edit label) updates the text file

**Independent Test**: Add a node via tool palette, verify declaration appears in text file

### Implementation for User Story 2

- [ ] T020 [US2] Implement executeOperation() for CreateNodeOperation in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T021 [US2] Implement executeOperation() for DeleteElementOperation in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T022 [US2] Implement executeOperation() for EditLabelOperation in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T023 [US2] Implement executeOperation() for CreateEdgeOperation in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T024 [US2] Implement executeOperation() for ChangeBoundsOperation (position only, no text change) in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T025 [US2] Update sendRequest() to route executeOperation to service proxy in packages/theia-extensions/glsp/src/browser/sanyam-language-client-provider.ts
- [ ] T026 [US2] Integrate GModel-to-AST conversion from language server's gmodel-to-ast-provider.ts
- [ ] T027 [US2] Add formatting preservation logic when applying text edits

**Checkpoint**: User Story 2 complete - diagram edits update text file

---

## Phase 5: User Story 3 - Live Diagram Updates on Text Edit (Priority: P3)

**Goal**: Text file edits automatically update the diagram view

**Independent Test**: Edit text to add entity, verify node appears in diagram within 500ms

### Implementation for User Story 3

- [ ] T028 [US3] Implement syncDocument() in SanyamGlspBackendServiceImpl in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T029 [US3] Add document change listener to regenerate GModel on text change in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T030 [US3] Implement notification emission for model updates (glsp/modelUpdated) in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T031 [US3] Update frontend to subscribe to modelUpdated notifications in packages/theia-extensions/glsp/src/browser/diagram-language-client.ts
- [ ] T032 [US3] Add debouncing (300ms) to prevent excessive updates during typing
- [ ] T033 [US3] Implement edit loop prevention with version tracking (FR-013)
- [ ] T034 [US3] Implement last-edit-wins conflict resolution (FR-014)

**Checkpoint**: User Story 3 complete - bidirectional text ↔ diagram sync working

---

## Phase 6: User Story 4 - Multi-Grammar Support (Priority: P4)

**Goal**: Dynamic grammar discovery at runtime for any grammar package

**Independent Test**: Install new grammar package with GLSP providers, verify diagrams work without code changes

### Implementation for User Story 4

- [ ] T035 [US4] Refactor grammar contribution loading to use registry pattern in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T036 [US4] Implement per-grammar provider resolution based on file URI in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T037 [US4] Add fallback to default providers when grammar-specific providers not found
- [ ] T038 [US4] Add graceful error handling for grammars without GLSP support (show "Diagram view not available" message)
- [ ] T039 [US4] Add logging for grammar contribution discovery

**Checkpoint**: User Story 4 complete - any grammar with GLSP providers works automatically

---

## Phase 7: User Story 5 - Diagram Layout Persistence (Priority: P5)

**Goal**: Save and restore diagram node positions per file

**Independent Test**: Arrange nodes, close diagram, reopen, verify positions restored

### Implementation for User Story 5

- [ ] T040 [P] [US5] Create LayoutStorageService in packages/theia-extensions/glsp/src/browser/layout-storage-service.ts
- [ ] T041 [US5] Implement saveLayout() using Theia StorageService keyed by file URI in layout-storage-service.ts
- [ ] T042 [US5] Implement loadLayout() to retrieve saved positions from storage in layout-storage-service.ts
- [ ] T043 [US5] Implement clearLayout() for reset functionality in layout-storage-service.ts
- [ ] T044 [US5] Integrate LayoutStorageService into DiagramWidget onClose/onDispose hooks in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T045 [US5] Load saved layout on diagram open and merge with model metadata in packages/theia-extensions/glsp/src/browser/diagram-widget.ts
- [ ] T046 [US5] Add debounced auto-save on position change (500ms debounce)
- [ ] T047 [US5] Implement requestLayout() in SanyamGlspBackendServiceImpl with preserveExisting option in packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts
- [ ] T048 [US5] Add "Reset Layout" command and keybinding in packages/theia-extensions/glsp/src/browser/glsp-commands.ts
- [ ] T049 [US5] Handle layout for new nodes (apply auto-layout, preserve existing positions)

**Checkpoint**: User Story 5 complete - layout persists across sessions

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T050 [P] Add JSDoc documentation to all public APIs in glsp-service.ts
- [ ] T051 [P] Add JSDoc documentation to SanyamGlspBackendServiceImpl public methods
- [ ] T052 Update README.md in packages/theia-extensions/glsp/ with new architecture
- [ ] T053 Performance optimization: add caching for grammar contribution lookups
- [ ] T054 Add error boundary handling in DiagramWidget for service failures
- [ ] T055 Verify all success criteria (SC-001 through SC-010) pass
- [ ] T056 Run quickstart.md validation with test.spdk file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (P1) | Foundational | Phase 2 complete |
| US2 (P2) | US1 | US1 complete (needs loadModel working) |
| US3 (P3) | US1 | US1 complete (needs loadModel working) |
| US4 (P4) | US2, US3 | US2 and US3 complete (needs full sync) |
| US5 (P5) | US1 | US1 complete (independent of sync) |

### Parallel Opportunities

**After Phase 2 (Foundational) completes:**
- US1 must complete first (core dependency)

**After US1 completes:**
- US2 and US3 can proceed in parallel
- US5 can proceed in parallel with US2/US3

**After US2 and US3 complete:**
- US4 can proceed
- US5 continues if not done

---

## Parallel Example: Phase 1 (Setup)

```bash
# All type definitions can be created in parallel:
Task: "Create SanyamGlspService interface in packages/types/src/glsp-service.ts"
Task: "Create response types in packages/types/src/glsp-service.ts"
Task: "Create DiagramOperation union type in packages/types/src/glsp-service.ts"
Task: "Create DiagramLayout persistence types in packages/types/src/glsp-service.ts"
```

---

## Parallel Example: After US1 Completes

```bash
# US2, US3, and US5 can all start in parallel:
# Developer A: US2 (Diagram → Text)
Task: "Implement executeOperation() for CreateNodeOperation..."

# Developer B: US3 (Text → Diagram)
Task: "Implement syncDocument() in SanyamGlspBackendServiceImpl..."

# Developer C: US5 (Layout Persistence)
Task: "Create LayoutStorageService in packages/theia-extensions/glsp/src/browser/layout-storage-service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (backend service skeleton)
3. Complete Phase 3: User Story 1 (view real diagram)
4. **STOP and VALIDATE**: Open .spdk file, verify real nodes appear
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Backend service ready
2. Add US1 → View real diagrams (MVP!)
3. Add US2 → Diagram edits update text
4. Add US3 → Text edits update diagram (full bidirectional sync!)
5. Add US4 → Multi-grammar support
6. Add US5 → Layout persistence (polish)
7. Each story adds value without breaking previous stories

### Success Criteria Mapping

| Success Criteria | User Story | Verification |
|------------------|------------|--------------|
| SC-001: <2s diagram load | US1 | Time diagram open |
| SC-002: <500ms text→diagram | US3 | Time edit to update |
| SC-003: 100% grammar support | US4 | Test multiple grammars |
| SC-004: Zero mock data | US1 | Verify real nodes |
| SC-005: <5s backend init | US1 | Time startup |
| SC-006: 500+ elements | US1 | Load large file |
| SC-007: <500ms diagram→text | US2 | Time edit to update |
| SC-008: 95% format preserved | US2 | Check formatting |
| SC-009: <200ms layout restore | US5 | Time reopen |
| SC-010: 100% layout works | US5 | Reopen multiple files |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies
