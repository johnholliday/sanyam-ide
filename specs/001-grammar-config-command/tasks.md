# Tasks: Grammar Config Command

**Input**: Design documents from `/specs/001-grammar-config-command/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:

- Types package: `packages/types/`
- Command: `.claude/commands/`
- Templates: `.claude/templates/`
- Grammar output: `grammars/{name}/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure

- [x] T001 Create `packages/types/` directory structure with `src/` subdirectory
- [x] T002 [P] Create `packages/types/package.json` with name `@sanyam/types`, TypeScript dependencies, and exports configuration
- [x] T003 [P] Create `packages/types/tsconfig.json` with strict TypeScript settings per constitution
- [x] T004 Create `.claude/templates/` directory for command templates

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `packages/types/src/grammar-manifest.ts` with all type definitions from contracts/grammar-manifest.ts
- [x] T006 Create `packages/types/src/index.ts` to export all types from grammar-manifest.ts
- [x] T007 [P] Create `.claude/templates/starter-grammar.langium` with default workflow grammar template from research.md
- [x] T008 Run `pnpm install` to link the new `@sanyam/types` workspace package
- [x] T009 Verify types compile with `pnpm -C packages/types build` (or tsc)

**Checkpoint**: Foundation ready - `@sanyam/types` package exists and exports `GrammarManifest` type. User story implementation can now begin.

---

## Phase 3: User Story 1 - Create Grammar Package from Existing Langium File (Priority: P1)

**Goal**: Generate a complete GrammarManifest from an existing `.langium` file

**Independent Test**: Run `/grammar-config testgrammar` with a pre-existing `grammars/testgrammar/testgrammar.langium` file and verify manifest.ts is generated with correct rootTypes

### Implementation for User Story 1

- [x] T010 [US1] Create `.claude/commands/grammar-config.md` with YAML frontmatter (description, handoffs) per research.md R2
- [x] T011 [US1] Add User Input section with `$ARGUMENTS` placeholder in `.claude/commands/grammar-config.md`
- [x] T012 [US1] Add Outline section Step 1: Parse arguments to detect input mode (name, name.langium) in `.claude/commands/grammar-config.md`
- [x] T013 [US1] Add Outline section Step 2: Check for existing grammar at `grammars/{name}/{name}.langium` in `.claude/commands/grammar-config.md`
- [x] T014 [US1] Add Outline section Step 3: Read and parse `.langium` file to extract grammar name, entry rules, and parser rules in `.claude/commands/grammar-config.md`
- [x] T015 [US1] Add Outline section Step 4: Generate rootTypes from parser rules with icon mapping heuristics from research.md R5 in `.claude/commands/grammar-config.md`
- [x] T016 [US1] Add Outline section Step 5: Generate diagramTypes, nodeTypes, edgeTypes, and toolPalette from extracted types in `.claude/commands/grammar-config.md`
- [x] T017 [US1] Add Outline section Step 6: Generate `grammars/{name}/manifest.ts` with `{NAME}_MANIFEST` export typed as `GrammarManifest` in `.claude/commands/grammar-config.md`
- [x] T018 [US1] Add Outline section Step 7: Generate `grammars/{name}/package.json` with package configuration in `.claude/commands/grammar-config.md`
- [x] T019 [US1] Add Outline section Step 8: Report completion with file paths in `.claude/commands/grammar-config.md`
- [x] T020 [US1] Add error handling for invalid grammar names (FR-010) with normalization logic in `.claude/commands/grammar-config.md`
- [x] T021 [US1] Add error handling for grammar parse failures (FR-011) with line/column information in `.claude/commands/grammar-config.md`
- [x] T022 [US1] Add logic to create `grammars/` directory if missing (FR-012) in `.claude/commands/grammar-config.md`

**Checkpoint**: User Story 1 complete. Can generate manifest from existing grammar file.

---

## Phase 4: User Story 2 - Create New Grammar from Scratch (Priority: P2)

**Goal**: Create a starter workflow grammar when no grammar exists

**Independent Test**: Run `/grammar-config newlanguage` where no `grammars/newlanguage/` exists and verify both `.langium` file and manifest.ts are created

### Implementation for User Story 2

- [x] T023 [US2] Add condition in Outline Step 3 to detect when grammar file doesn't exist in `.claude/commands/grammar-config.md`
- [x] T024 [US2] Add Outline branch: If grammar doesn't exist and input is simple name, create directory `grammars/{name}/` in `.claude/commands/grammar-config.md`
- [x] T025 [US2] Add Outline branch: Copy starter template from `.claude/templates/starter-grammar.langium` to `grammars/{name}/{name}.langium` with name substitution in `.claude/commands/grammar-config.md`
- [x] T026 [US2] Add Outline branch: Continue to manifest generation using the newly created starter grammar in `.claude/commands/grammar-config.md`
- [x] T027 [US2] Add user notification that starter template was created with guidance for customization in `.claude/commands/grammar-config.md`

**Checkpoint**: User Story 2 complete. Can create new grammar from scratch with starter template.

---

## Phase 5: User Story 3 - Create Grammar from Natural Language Description (Priority: P2)

**Goal**: Use AI to generate Langium grammar from natural language description

**Independent Test**: Run `/grammar-config "A language for state machines with states and transitions"` and verify AI generates valid `.langium` grammar and manifest

### Implementation for User Story 3

- [x] T028 [US3] Add argument detection for quoted string (natural language description) in Outline Step 1 in `.claude/commands/grammar-config.md`
- [x] T029 [US3] Add argument detection for text file path (non-.langium file) in Outline Step 1 in `.claude/commands/grammar-config.md`
- [x] T030 [US3] Add Outline branch: If quoted string detected, extract description and derive grammar name from keywords in `.claude/commands/grammar-config.md`
- [x] T031 [US3] Add Outline branch: If text file detected, read file content as description in `.claude/commands/grammar-config.md`
- [x] T032 [US3] Add AI prompt section with structured prompt for Langium grammar generation per research.md R4 in `.claude/commands/grammar-config.md`
- [x] T033 [US3] Add grammar validation checks (grammar declaration, entry rule, terminal rules) in `.claude/commands/grammar-config.md`
- [x] T034 [US3] Add retry logic: If validation fails, retry with refined prompt (max 2 attempts) in `.claude/commands/grammar-config.md`
- [x] T035 [US3] Add fallback logic: If retry fails, use starter template and include description as comment in `.claude/commands/grammar-config.md`
- [x] T036 [US3] Add user notification distinguishing AI-generated vs fallback grammar in `.claude/commands/grammar-config.md`

**Checkpoint**: User Story 3 complete. Can generate grammar from natural language description.

---

## Phase 6: User Story 4 - Manifest Integration with Platform (Priority: P3)

**Goal**: Ensure generated manifests follow platform integration patterns

**Independent Test**: Import generated manifest into a test file and verify all GrammarManifest fields are accessible and correctly typed

### Implementation for User Story 4

- [x] T037 [US4] Add validation of generated manifest using `validateManifest()` function before writing in `.claude/commands/grammar-config.md`
- [x] T038 [US4] Ensure manifest export follows `{GRAMMAR_NAME_UPPERCASE}_MANIFEST` naming pattern (FR-008) in `.claude/commands/grammar-config.md`
- [x] T039 [US4] Ensure manifest imports `GrammarManifest` type from `@sanyam/types` (FR-009) in `.claude/commands/grammar-config.md`
- [x] T040 [US4] Add platform integration instructions to command output (reference to quickstart.md) in `.claude/commands/grammar-config.md`

**Checkpoint**: User Story 4 complete. Generated manifests are platform-ready.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [x] T041 [P] Add comprehensive error messages with actionable guidance for all failure modes in `.claude/commands/grammar-config.md`
- [x] T042 [P] Add progress indicators during long operations (AI generation) in `.claude/commands/grammar-config.md`
- [x] T043 Add handoffs section with follow-up commands (e.g., speckit.plan) in `.claude/commands/grammar-config.md`
- [x] T044 Validate command works end-to-end with sample grammar from specs (SPDevKit example)
- [x] T045 Update CLAUDE.md with new `/grammar-config` command documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1) should complete first as others build on it
  - US2 and US3 (both P2) can proceed after US1
  - US4 (P3) can proceed after US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Builds on US1 command structure but adds independent functionality
- **User Story 3 (P2)**: Builds on US1 command structure but adds independent functionality
- **User Story 4 (P3)**: Builds on US1 manifest generation but adds validation/integration

### Within Each User Story

- Command structure tasks before logic tasks
- Core parsing/generation before error handling
- Implementation before notifications/polish

### Parallel Opportunities

- T002, T003 can run in parallel (different files)
- T007 can run in parallel with T005, T006 (different directories)
- T041, T042 can run in parallel (different concerns)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch setup tasks in parallel:
Task: "Create packages/types/package.json"
Task: "Create packages/types/tsconfig.json"
```

---

## Parallel Example: Phase 2 Foundational

```bash
# After T005, T006 complete, these can run in parallel:
Task: "Create .claude/templates/starter-grammar.langium"
Task: "Run pnpm install to link workspace package"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test `/grammar-config` with existing grammar
5. Deploy/demo if ready - delivers core value proposition

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test with existing grammar → Usable! (MVP)
3. Add User Story 2 → Test with new grammar name → Creates starter grammars
4. Add User Story 3 → Test with quoted description → AI-assisted grammar creation
5. Add User Story 4 → Verify platform integration → Production-ready

### Task Count Summary

| Phase | Task Count | Parallel Tasks |
|-------|------------|----------------|
| Phase 1: Setup | 4 | 2 |
| Phase 2: Foundational | 5 | 1 |
| Phase 3: US1 (P1) | 13 | 0 |
| Phase 4: US2 (P2) | 5 | 0 |
| Phase 5: US3 (P2) | 9 | 0 |
| Phase 6: US4 (P3) | 4 | 0 |
| Phase 7: Polish | 5 | 2 |
| **Total** | **45** | **5** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The `/grammar-config` command is a Claude Code skill (markdown), not TypeScript code
- All implementation happens within `.claude/commands/grammar-config.md` outline sections
