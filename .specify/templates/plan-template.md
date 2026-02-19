# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Assumptions

<!--
  SHOW YOUR WORK: Before filling in the Technical Context, list every assumption
  you are making about the architecture, technology choices, and project constraints.
  For each assumption, state:
  - What you are assuming
  - Why you believe it is correct (cite spec, constitution, or codebase evidence)
  - What would change if the assumption is wrong

  This section forces explicit reasoning and prevents silent misinterpretations.
-->

| # | Assumption | Evidence | Impact If Wrong |
|---|-----------|----------|-----------------|
| 1 | [e.g., PostgreSQL is the storage layer] | [constitution §storage, spec §NFR-2] | [would need different migration strategy] |

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Phase Gate Protocol**: NEVER advance to the next phase without explicit user approval. At each phase checkpoint, present assumptions as a numbered list. Surface all architectural trade-offs as explicit questions. See constitution §Phase Gate Protocol for the full checkpoint format.

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Architectural Decisions

<!--
  REQUIRED (Constitution §5a-b): Every non-trivial architectural decision MUST be
  recorded here in ADR format. A decision with no alternatives listed is presumed
  unexamined and will be flagged at review.

  "Non-trivial" includes: technology choices, data model shapes, API patterns,
  package boundaries, DI strategies, state management, auth schemes, error handling
  patterns, and anything where 2+ valid approaches exist.
-->

### ADR-1: [Decision Title]

**Decision**: [What was decided]
**Context**: [What problem or requirement drove this]
**Rationale**: [WHY this option — concrete evidence, not "it's best"]
**Alternatives considered**:

| Alternative | Why Rejected |
|------------|-------------|
| [Option A] | [Concrete reason — performance, complexity, compatibility, etc.] |
| [Option B] | [Concrete reason] |

**Consequences**: [What this enables and what it constrains going forward]

<!--
  Repeat ADR block for each decision. Number sequentially: ADR-1, ADR-2, ADR-3...
  Cross-reference from research.md where applicable.
-->

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
