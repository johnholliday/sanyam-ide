# Tasks: Unified LSP/GLSP Language Server

**Input**: Design documents from `/specs/002-unified-lsp-glsp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included for core functionality to ensure reliability of the unified server.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **packages/types/src/**: Type definitions and contracts (@sanyam/types)
- **packages/language-server/src/**: Unified language server (@sanyam/language-server)
- **grammars/*/**: Grammar packages with contribution exports
- **theia-extensions/glsp/**: GLSP frontend integration
- **tests/**: Unit, integration, and E2E tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure

- [x] T001 Create package directory structure at packages/language-server/ per plan.md
- [x] T002 [P] Initialize packages/language-server/package.json with dependencies (langium 4.x, @eclipse-glsp/server-node 2.x, inversify 6.x, vscode-languageserver)
- [x] T003 [P] Create packages/language-server/tsconfig.json extending configs/base.tsconfig.json
- [x] T004 [P] Create packages/language-server/esbuild.mjs build configuration
- [x] T005 [P] Create theia-extensions/glsp/package.json for GLSP frontend
- [x] T006 [P] Create theia-extensions/glsp/tsconfig.json configuration
- [x] T007 Update root pnpm-workspace.yaml to include packages/language-server and theia-extensions/glsp
- [x] T008 [P] Add workspace dependencies to applications/electron/package.json for @sanyam/language-server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Type Contracts (packages/types)

- [x] T009 Copy contracts/language-contribution.ts to packages/types/src/language-contribution.ts
- [x] T010 [P] Copy contracts/lsp-providers.ts to packages/types/src/lsp-providers.ts
- [x] T011 [P] Copy contracts/glsp-providers.ts to packages/types/src/glsp-providers.ts
- [x] T012 Update packages/types/src/index.ts to export all new types (LanguageContribution, LspFeatureProviders, GlspFeatureProviders, LspContext, GlspContext)

### Language Registry

- [x] T013 Implement LanguageRegistry class in packages/language-server/src/language-registry.ts (register, getByLanguageId, getByExtension, getByUri, getAllLanguageIds)
- [x] T014 Unit test for LanguageRegistry in tests/unit/grammar-scanner/language-registry.spec.ts

### Grammar Discovery

- [x] T015 Implement GrammarScanner (build-time) in packages/language-server/src/grammar-scanner/grammar-scanner.ts (parse pnpm-workspace.yaml, find grammar packages by sanyam field or @sanyam-grammar/* naming)
- [x] T016 [P] Implement ContributionLoader (runtime) in packages/language-server/src/grammar-scanner/contribution-loader.ts (load LanguageContribution from grammar packages)
- [x] T017 Create code generator for packages/language-server/src/generated/grammar-registry.ts (auto-generate static imports from discovered packages)
- [x] T018 Unit test for GrammarScanner in tests/unit/grammar-scanner/grammar-scanner.spec.ts

### Server Entry Point

- [x] T019 Implement main server entry in packages/language-server/src/main.ts (create connection, initialize shared services, register all discovered languages)
- [x] T020 [P] Implement VS Code client extension in packages/language-server/src/extension.ts (activate, start language client)

### Langium Integration

- [x] T021 Implement Langium service creation helper in packages/language-server/src/lsp/langium-integration.ts (compose modules using inject(), register with ServiceRegistry per research.md)
- [x] T022 [P] Implement LspContext factory in packages/language-server/src/lsp/lsp-context-factory.ts (create context from document, services, token)

### VSIX Configuration

- [x] T023 Create VSIX manifest template generator in packages/language-server/scripts/generate-vsix-manifest.ts (generate language and grammar contributions from discovered packages)
- [x] T024 [P] Add build script to packages/language-server/package.json ("build", "build:extension", "package:vsix")

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Edit DSL Files with IDE Support (Priority: P1)

**Goal**: Provide full LSP editing support for DSL files including completion, hover, go-to-definition, and diagnostics

**Independent Test**: Open any grammar file (.ecml, .story), type code, verify completions appear, errors highlight, definitions navigate

### Tests for User Story 1

- [x] T025 [P] [US1] Integration test for code completion in tests/integration/lsp/completion.spec.ts
- [x] T026 [P] [US1] Integration test for hover in tests/integration/lsp/hover.spec.ts
- [x] T027 [P] [US1] Integration test for go-to-definition in tests/integration/lsp/definition.spec.ts
- [x] T028 [P] [US1] Integration test for diagnostics in tests/integration/lsp/diagnostics.spec.ts
- [x] T028a [P] [US1] Integration test for find-all-references in tests/integration/lsp/references.spec.ts
- [x] T028b [P] [US1] Integration test for rename refactoring in tests/integration/lsp/rename.spec.ts
- [x] T028c [P] [US1] Integration test for code folding in tests/integration/lsp/folding.spec.ts
- [x] T028d [P] [US1] Integration test for semantic tokens in tests/integration/lsp/semantic-tokens.spec.ts

### LSP Default Providers Implementation

- [x] T029 [P] [US1] Implement default CompletionProvider in packages/language-server/src/lsp/providers/completion-provider.ts (delegate to Langium's CompletionProvider)
- [x] T030 [P] [US1] Implement default HoverProvider in packages/language-server/src/lsp/providers/hover-provider.ts (show AST node name, type, documentation)
- [x] T031 [P] [US1] Implement default DefinitionProvider in packages/language-server/src/lsp/providers/definition-provider.ts (use Langium's reference resolution)
- [x] T032 [P] [US1] Implement default ReferencesProvider in packages/language-server/src/lsp/providers/references-provider.ts (use Langium's ReferenceFinder)
- [x] T033 [P] [US1] Implement default DocumentSymbolProvider in packages/language-server/src/lsp/providers/document-symbol-provider.ts (map AST to hierarchical symbols)
- [x] T034 [P] [US1] Implement default RenameProvider in packages/language-server/src/lsp/providers/rename-provider.ts (use Langium's RenameProvider)
- [x] T035 [P] [US1] Implement default DiagnosticsProvider in packages/language-server/src/lsp/providers/diagnostics-provider.ts (report validation errors)
- [x] T036 [P] [US1] Implement default FoldingRangeProvider in packages/language-server/src/lsp/providers/folding-range-provider.ts
- [x] T037 [P] [US1] Implement default SemanticTokensProvider in packages/language-server/src/lsp/providers/semantic-tokens-provider.ts
- [x] T038 [P] [US1] Implement default SignatureHelpProvider in packages/language-server/src/lsp/providers/signature-help-provider.ts

### Additional LSP Providers (Navigation & Hierarchy)

- [x] T039 [P] [US1] Implement default DeclarationProvider in packages/language-server/src/lsp/providers/declaration-provider.ts
- [x] T040 [P] [US1] Implement default TypeDefinitionProvider in packages/language-server/src/lsp/providers/type-definition-provider.ts
- [x] T041 [P] [US1] Implement default ImplementationProvider in packages/language-server/src/lsp/providers/implementation-provider.ts
- [x] T042 [P] [US1] Implement default DocumentHighlightProvider in packages/language-server/src/lsp/providers/document-highlight-provider.ts
- [x] T043 [P] [US1] Implement default CallHierarchyProvider in packages/language-server/src/lsp/providers/call-hierarchy-provider.ts
- [x] T044 [P] [US1] Implement default TypeHierarchyProvider in packages/language-server/src/lsp/providers/type-hierarchy-provider.ts

### Additional LSP Providers (Editing & Hints)

- [x] T045 [P] [US1] Implement default CodeActionProvider in packages/language-server/src/lsp/providers/code-action-provider.ts
- [x] T046 [P] [US1] Implement default CodeLensProvider in packages/language-server/src/lsp/providers/code-lens-provider.ts
- [x] T047 [P] [US1] Implement default FormattingProvider in packages/language-server/src/lsp/providers/formatting-provider.ts
- [x] T048 [P] [US1] Implement default SelectionRangeProvider in packages/language-server/src/lsp/providers/selection-range-provider.ts
- [x] T049 [P] [US1] Implement default LinkedEditingRangeProvider in packages/language-server/src/lsp/providers/linked-editing-range-provider.ts
- [x] T050 [P] [US1] Implement default InlayHintProvider in packages/language-server/src/lsp/providers/inlay-hint-provider.ts

### LSP Handler and Utilities

- [x] T051 [US1] Create DefaultProviders barrel export in packages/language-server/src/lsp/default-providers.ts (export all default provider implementations)
- [x] T052 [US1] Implement LspHandler in packages/language-server/src/lsp/lsp-handler.ts (route LSP messages to appropriate provider based on document language)
- [x] T053 [P] [US1] Create AST utility helpers in packages/language-server/src/lsp/helpers/ast-utils.ts
- [x] T054 [P] [US1] Create position utility helpers in packages/language-server/src/lsp/helpers/position-utils.ts
- [x] T055 [P] [US1] Create reference utility helpers in packages/language-server/src/lsp/helpers/reference-utils.ts
- [x] T056 [P] [US1] Create symbol utility helpers in packages/language-server/src/lsp/helpers/symbol-utils.ts

### Unit Tests for Default Providers

- [x] T057 [P] [US1] Unit test for CompletionProvider in tests/unit/lsp/completion-provider.spec.ts
- [x] T058 [P] [US1] Unit test for HoverProvider in tests/unit/lsp/hover-provider.spec.ts
- [x] T059 [P] [US1] Unit test for DefinitionProvider in tests/unit/lsp/definition-provider.spec.ts
- [x] T060 [P] [US1] Unit test for DiagnosticsProvider in tests/unit/lsp/diagnostics-provider.spec.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - LSP editing works for any discovered grammar

---

## Phase 4: User Story 2 - View and Edit as Visual Diagrams (Priority: P2)

**Goal**: Enable visual diagram editing synchronized with text models using GLSP

**Independent Test**: Open DSL file, open diagram view, see nodes/edges rendered, drag node, verify model updates

### Tests for User Story 2

- [x] T061 [P] [US2] Integration test for AST to GModel conversion in tests/integration/glsp/ast-to-gmodel.spec.ts
- [x] T062 [P] [US2] Integration test for diagram operations in tests/integration/glsp/operations.spec.ts
- [x] T063 [P] [US2] Integration test for bidirectional sync in tests/integration/glsp/sync.spec.ts

### GLSP Core Components

- [x] T064 [US2] Implement GlspContext factory in packages/language-server/src/glsp/glsp-context-factory.ts
- [x] T065 [US2] Implement LangiumModelState (extends DefaultGModelState) in packages/language-server/src/glsp/langium-model-state.ts (wrap LangiumDocument as source model)
- [x] T066 [US2] Implement LangiumSourceModelStorage in packages/language-server/src/glsp/langium-source-model-storage.ts (load/save via Langium documents)
- [x] T067 [US2] Implement ManifestDrivenGModelFactory in packages/language-server/src/glsp/manifest-converter.ts (convert AST to GModel using manifest configuration)
- [x] T068 [US2] Implement ConversionContext and ConversionResult types in packages/language-server/src/glsp/conversion-types.ts

### GLSP Default Providers

- [x] T069 [P] [US2] Implement default AstToGModelProvider in packages/language-server/src/glsp/providers/ast-to-gmodel-provider.ts (convert, createNode, createEdge, getLabel, getPosition, getSize)
- [x] T070 [P] [US2] Implement default GModelToAstProvider in packages/language-server/src/glsp/providers/gmodel-to-ast-provider.ts (applyPosition, applySize, createNode, createEdge)
- [x] T071 [P] [US2] Implement default ToolPaletteProvider in packages/language-server/src/glsp/providers/tool-palette-provider.ts (generate palette from manifest)
- [x] T072 [P] [US2] Implement default DiagramValidationProvider in packages/language-server/src/glsp/providers/diagram-validation-provider.ts
- [x] T073 [P] [US2] Implement default LayoutProvider in packages/language-server/src/glsp/providers/layout-provider.ts (include cycle detection for circular references per edge case)
- [x] T074 [P] [US2] Implement default ContextMenuProvider in packages/language-server/src/glsp/providers/context-menu-provider.ts

### GLSP Operation Handlers

- [x] T075 [P] [US2] Implement CreateNodeHandler in packages/language-server/src/glsp/handlers/create-node-handler.ts (create AST node, regenerate GModel)
- [x] T076 [P] [US2] Implement DeleteElementHandler in packages/language-server/src/glsp/handlers/delete-element-handler.ts (remove from AST, regenerate GModel)
- [x] T077 [P] [US2] Implement ChangeBoundsHandler in packages/language-server/src/glsp/handlers/change-bounds-handler.ts (update position/size in AST)
- [x] T078 [P] [US2] Implement ReconnectEdgeHandler in packages/language-server/src/glsp/handlers/reconnect-edge-handler.ts (update relationship in AST)
- [x] T079 [P] [US2] Implement CreateEdgeHandler in packages/language-server/src/glsp/handlers/create-edge-handler.ts

### GLSP Server Module

- [x] T080 [US2] Implement GlspServerModule (Inversify) in packages/language-server/src/glsp/glsp-server-module.ts (bind all GLSP services)
- [x] T081 [US2] Implement GlspServer initialization in packages/language-server/src/glsp/glsp-server.ts (create server, register handlers)
- [x] T082 [US2] Integrate GLSP server into main.ts startup sequence

### GLSP Frontend (Theia Extension)

- [x] T083 [US2] Implement GlspFrontendModule in theia-extensions/glsp/src/browser/glsp-frontend-module.ts
- [x] T084 [P] [US2] Implement DiagramWidget in theia-extensions/glsp/src/browser/diagram-widget.ts (render diagram, handle user interactions)
- [x] T085 [P] [US2] Implement GlspContribution in theia-extensions/glsp/src/common/glsp-contribution.ts (register diagram type)
- [x] T086 [US2] Create "Open Diagram View" command contribution

### Bidirectional Synchronization

- [x] T087 [US2] Implement text-to-diagram sync listener in packages/language-server/src/glsp/sync/text-to-diagram-sync.ts (listen to LangiumDocument changes, regenerate GModel)
- [x] T088 [US2] Implement diagram-to-text sync in packages/language-server/src/glsp/sync/diagram-to-text-sync.ts (operation handlers serialize AST changes back to text)

### Unit Tests for GLSP

- [x] T089 [P] [US2] Unit test for ManifestDrivenGModelFactory in tests/unit/glsp/manifest-converter.spec.ts
- [x] T090 [P] [US2] Unit test for LangiumModelState in tests/unit/glsp/langium-model-state.spec.ts
- [x] T091 [P] [US2] Unit test for CreateNodeHandler in tests/unit/glsp/create-node-handler.spec.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - text editing AND diagram editing

---

## Phase 5: User Story 3 - Add New Grammar Support Without Server Changes (Priority: P3)

**Goal**: Enable adding new grammar packages via workspace configuration without modifying server code

**Independent Test**: Create new grammar package, add to workspace, rebuild, verify new language appears with LSP/GLSP support

### Tests for User Story 3

- [x] T092 [P] [US3] Integration test for grammar discovery in tests/integration/grammar-scanner/grammar-scanner.spec.ts
- [x] T093 [P] [US3] Integration test for new language registration in tests/integration/grammar-scanner/language-registration.spec.ts

### Feature Provider Merger

- [x] T094 [US3] Implement FeatureMerger in packages/language-server/src/lsp/feature-merger.ts (merge custom providers with defaults, respect disabledFeatures)
- [x] T095 [P] [US3] Implement GlspFeatureMerger in packages/language-server/src/glsp/feature-merger.ts (merge custom GLSP providers with defaults)
- [x] T096 Unit test for FeatureMerger in tests/unit/lsp/feature-merger.spec.ts

### Grammar Package Template

- [x] T097 [US3] Create grammar package template at templates/grammar-package/ (package.json, langium-config.json, manifest.ts, contribution.ts)
- [x] T098 [P] [US3] Document grammar package structure in quickstart.md (update existing quickstart with any refinements)
- [x] T099 [P] [US3] Create example minimal grammar package at grammars/example-minimal/ for reference

### Grammar Package Migration (ECML)

- [x] T100 [US3] Migrate grammars/ecml/ - create langium-config.json
- [x] T101 [P] [US3] Migrate grammars/ecml/ - update package.json with sanyam field
- [x] T102 [US3] Migrate grammars/ecml/ - create src/contribution.ts exporting LanguageContribution
- [ ] T103 [US3] Verify ECML grammar works with unified server (manual test)

### Build-Time Discovery Integration

- [x] T104 [US3] Add grammar discovery to packages/language-server build script (run grammar-scanner.ts during build)
- [x] T105 [US3] Generate packages/language-server/src/generated/grammar-registry.ts during build
- [x] T106 [US3] Update packages/language-server/src/main.ts to load from generated grammar-registry.ts

**Checkpoint**: At this point, new grammars can be added via workspace configuration

---

## Phase 6: User Story 4 - Customize Language Features Per Grammar (Priority: P4)

**Goal**: Allow grammar packages to override specific LSP/GLSP features while using defaults for others

**Independent Test**: Implement custom hover in a grammar package, rebuild, verify custom content appears

### Tests for User Story 4

- [x] T107 [P] [US4] Integration test for custom LSP provider override in tests/integration/customization/lsp-override.spec.ts
- [x] T108 [P] [US4] Integration test for custom GLSP provider override in tests/integration/customization/glsp-override.spec.ts
- [x] T109 [P] [US4] Integration test for disabled features in tests/integration/customization/disabled-features.spec.ts

### Custom Provider Infrastructure

- [x] T110 [US4] Implement provider override resolution in packages/language-server/src/lsp/provider-resolver.ts (check for custom, fall back to default)
- [x] T111 [P] [US4] Implement GLSP provider override resolution in packages/language-server/src/glsp/provider-resolver.ts
- [x] T112 [US4] Update LspHandler to use provider resolver for all requests
- [x] T113 [US4] Update GlspServer to use GLSP provider resolver

### Example Custom Providers

- [x] T114 [US4] Create example custom HoverProvider in grammars/ecml/src/lsp-overrides.ts
- [x] T115 [P] [US4] Create example custom AstToGModelProvider.getLabel in grammars/ecml/src/glsp-overrides.ts
- [x] T116 [US4] Update grammars/ecml/src/contribution.ts to include custom providers

### Feature Disable Support

- [x] T117 [US4] Implement disabled feature handling in FeatureMerger (return null for disabled features)
- [x] T118 [US4] Test disabled feature returns appropriate LSP error
- [x] T119 [US4] Document feature customization in specs/002-unified-lsp-glsp/feature-customization-guide.md

**Checkpoint**: At this point, grammar packages can fully customize their LSP/GLSP behavior

---

## Phase 7: User Story 5 - Access Model Data Programmatically (Priority: P5)

**Goal**: Provide programmatic Model API for custom editors and views with change notifications

**Independent Test**: Subscribe to model via API, modify DSL file, verify subscriber receives notification

### Tests for User Story 5

- [x] T120 [P] [US5] Integration test for model retrieval in tests/integration/model-api/model-retrieval.spec.ts
- [x] T121 [P] [US5] Integration test for subscriptions in tests/integration/model-api/subscriptions.spec.ts
- [x] T122 [P] [US5] Integration test for change notifications in tests/integration/model-api/change-notifications.spec.ts

### Model API Server

- [x] T123 [US5] Implement ModelConverter in packages/language-server/src/model/model-converter.ts (AST to JSON serialization)
- [x] T124 [US5] Implement SubscriptionService in packages/language-server/src/model/subscription-service.ts (manage client subscriptions, notify on changes)
- [x] T125 [US5] Implement AstServer in packages/language-server/src/model/ast-server.ts (getModel, subscribe, unsubscribe endpoints)
- [x] T126 [US5] Integrate Model API into main.ts server startup

### Change Notification

- [x] T127 [US5] Hook SubscriptionService into LangiumDocument change events
- [x] T128 [US5] Implement notification throttling/debouncing in SubscriptionService (500ms delivery target per SC-009)
- [x] T129 [US5] Add unsubscribe cleanup on client disconnect

### Unit Tests for Model API

- [x] T130 [P] [US5] Unit test for ModelConverter in tests/unit/model/model-converter.spec.ts
- [x] T131 [P] [US5] Unit test for SubscriptionService in tests/unit/model/subscription-service.spec.ts

**Checkpoint**: At this point, all 5 user stories are complete and testable

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, documentation, and deployment

### Additional Grammar Migrations

- [x] T132 [P] Migrate grammars/actone/ to new contribution format
- [x] T133 [P] Migrate grammars/iso-42001/ to new contribution format
- [x] T134 [P] Migrate grammars/spdevkit/ to new contribution format

### VSIX Packaging

- [x] T135 Generate TextMate grammars from Langium grammars during build (langium generate with textmate output)
- [x] T136 Generate complete VSIX manifest with all discovered languages in packages/language-server/package.json
- [x] T137 Create VSIX build script in packages/language-server/scripts/build-vsix.ts
- [ ] T138 Test VSIX installation in clean VS Code/Theia environment (manual test)

### E2E Tests

- [x] T139 [P] E2E test for text editing workflow in tests/e2e/text-editing.spec.ts
- [x] T140 [P] E2E test for diagram editing workflow in tests/e2e/diagram-editing.spec.ts
- [x] T141 [P] E2E test for text-diagram synchronization in tests/e2e/sync.spec.ts

### Performance Validation

- [x] T142 Performance test: completion <1s (SC-001)
- [x] T143 Performance test: go-to-definition <2s (SC-002)
- [x] T144 Performance test: diagram render 200 elements <3s (SC-004)
- [x] T145 Performance test: sync <1s (SC-005, SC-006)

### Documentation

- [x] T146 [P] Update README.md with unified server documentation
- [x] T147 [P] Update CLAUDE.md with new packages and build commands
- [x] T148 Review and finalize quickstart.md
- [ ] T149 Run quickstart.md validation (manual walkthrough)

### Code Quality

- [ ] T150 Run linting on all new packages (pnpm lint) - manual verification
- [x] T151 [P] Add JSDoc comments to all public API exports
- [ ] T152 Verify no circular dependencies between packages - manual verification

**Note**: See [testplan.md](./testplan.md) for detailed manual verification procedures for T138, T149, T150, and T152.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - May reuse US1 utilities but independently testable
- **User Story 3 (P3)**: Can start after Foundational - Uses US1/US2 components but tests discovery independently
- **User Story 4 (P4)**: Depends on US3 (needs merger infrastructure) - Tests customization
- **User Story 5 (P5)**: Can start after Foundational - Independent of US2/US3/US4

### Within Each User Story

- Tests can be written and verified to fail before implementation
- Providers before handlers
- Core components before integration
- Unit tests parallel with implementation
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1, US2, US3, and US5 can start in parallel
- All provider implementations marked [P] can run in parallel
- All test tasks marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (LSP editing)
4. **STOP and VALIDATE**: Test LSP features independently
5. Deploy/demo if ready (users can edit DSL files with full IDE support)

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (LSP) → Test → Deploy (MVP - text editing works!)
3. Add US2 (GLSP) → Test → Deploy (visual diagrams available!)
4. Add US3 (Discovery) → Test → Deploy (extensibility unlocked!)
5. Add US4 (Customization) → Test → Deploy (professional customization!)
6. Add US5 (Model API) → Test → Deploy (programmatic access!)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (LSP providers)
   - Developer B: User Story 2 (GLSP integration)
   - Developer C: User Story 5 (Model API)
3. After US1 + US2 complete:
   - Developer A: User Story 3 (Discovery/migration)
   - Developer B: User Story 4 (Customization)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Contract files in specs/002-unified-lsp-glsp/contracts/ should be copied to packages/types/src/ during foundational phase
