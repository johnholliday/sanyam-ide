---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Show Your Work — Assumptions Audit**: Before generating the technical plan, list ALL assumptions you are making about the architecture, technology choices, and project constraints. For each assumption, state:
   - What you are assuming
   - Why you believe it is correct (evidence from spec, constitution, or codebase)
   - What would change if the assumption is wrong

   This list MUST appear in your output before proceeding to plan generation.

4. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

5. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using the **Architectural Decision Record** format for each decision:

   ```markdown
   ### ADR-[N]: [Decision Title]

   **Decision**: [What was decided]
   **Context**: [What problem or requirement drove this]
   **Rationale**: [WHY this option — concrete evidence, not "it's best"]
   **Alternatives considered**:
   | Alternative | Why Rejected |
   |------------|-------------|
   | [Option A] | [Concrete reason — performance, complexity, compatibility, etc.] |
   | [Option B] | [Concrete reason] |
   **Consequences**: [What this enables and what it constrains going forward]
   ```

   **CRITICAL (Constitution §5a-b)**: Every non-trivial decision MUST list at least 2 alternatives considered with reasons for rejection. A decision with no alternatives listed is presumed unexamined and MUST be flagged for review.

**Output**: research.md with all NEEDS CLARIFICATION resolved and all decisions in ADR format

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable
   - **For each non-trivial data model choice** (e.g., normalization level, relationship type, field type): document the decision using ADR format with at least 2 alternatives considered

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`
   - **For each pattern choice** (REST vs GraphQL, pagination strategy, auth scheme, error format): document the decision using ADR format with at least 2 alternatives considered

3. **Compile Architectural Decisions** into the plan.md `## Architectural Decisions` section:
   - Gather all ADRs from research.md and from design work in this phase
   - Each decision MUST follow the ADR format defined in Constitution §5a
   - Each decision MUST list at least 2 alternatives considered (Constitution §5b)

4. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Phase Gate Protocol (from Constitution)

**MANDATORY** — These gates are non-negotiable:

1. **NEVER advance to the next phase without explicit user approval.** After completing Phase 0 (research), STOP and present the Phase 0 Checkpoint for review. After completing Phase 1 (design), STOP and present the Phase 1 Checkpoint for review. Do NOT chain phases automatically.

2. **At each phase checkpoint, present your reasoning and assumptions as a numbered list for review before proceeding.** Use the checkpoint format defined in the constitution's Phase Gate Protocol section.

3. **Surface all architectural trade-offs as explicit questions — do not resolve ambiguity autonomously.** When you encounter multiple valid approaches during research or design, present them as labeled options with pros/cons. Let the user decide.

4. **Phase outputs are immutable once approved.** If Phase 1 design reveals a problem with Phase 0 research, flag it as a "Phase 0 Revision Request" — do not silently change research.md.

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
