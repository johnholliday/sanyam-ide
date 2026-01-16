# Implementation Plan: Grammar Config Command

**Branch**: `001-grammar-config-command` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-grammar-config-command/spec.md`

## Summary

Create a Claude Code command `/grammar-config <grammarName>` that:
1. Searches for or creates Langium grammar files (`.langium`)
2. Generates grammar packages with `GrammarManifest` exports for the SANYAM platform
3. Supports AI-assisted grammar generation from natural language descriptions

The command will be implemented as a Claude Code skill (`.claude/commands/grammar-config.md`) that orchestrates file creation, grammar parsing, and manifest generation.

## Technical Context

**Language/Version**: TypeScript 5.x (per constitution)
**Primary Dependencies**: Langium 4.x (grammar parsing), Claude Code (AI generation)
**Storage**: File system (grammars/{name}/ directory structure)
**Testing**: Vitest (existing monorepo pattern)
**Target Platform**: Claude Code CLI (cross-platform)
**Project Type**: CLI command (single project within monorepo)
**Performance Goals**: Manifest generation < 30 seconds (from SC-001)
**Constraints**: Must follow grammar-agnostic platform principles, no hard-coded grammar types
**Scale/Scope**: Single command, generates packages for individual grammars

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Verification |
|-----------|--------|--------------|
| **Grammar Agnosticism** | ✅ PASS | Command generates grammar-specific packages but platform code remains agnostic. Manifests declare grammar specifics. |
| **Backward Compatibility** | ✅ PASS | New command, no existing functionality to regress |
| **Declarative Over Imperative** | ✅ PASS | GrammarManifest is declarative JSON/TS configuration |
| **Extension Over Modification** | ✅ PASS | Grammar packages extend platform via registry, not modification |
| **TypeScript 5.x Required** | ✅ PASS | All generated code will be TypeScript |
| **Langium 4.x Required** | ✅ PASS | Grammar parsing uses Langium 4.x |
| **No Python** | ✅ PASS | All tooling in TypeScript/Markdown |
| **No `any` without justification** | ✅ PASS | Generated manifests use explicit types |
| **No circular dependencies** | ✅ PASS | Grammar packages peerDepend on platform, not vice versa |

**Gate Result**: PASS - No violations. Proceed to Phase 0.

### Post-Design Constitution Re-Check (Phase 1)

| Principle | Status | Verification |
|-----------|--------|--------------|
| **Grammar Agnosticism** | ✅ PASS | Types in `@sanyam/types` are generic interfaces. No grammar-specific code in platform packages. |
| **Declarative Over Imperative** | ✅ PASS | GrammarManifest is pure declarative config with no executable code. |
| **TypeScript Explicit Types** | ✅ PASS | All interfaces have explicit types, no `any`, readonly for immutability. |
| **JSDoc on Public APIs** | ✅ PASS | All exported types documented with JSDoc comments. |
| **Validation at Boundaries** | ✅ PASS | `validateManifest()` function validates input before processing. |

**Post-Design Gate Result**: PASS - Design artifacts comply with constitution.

## Project Structure

### Documentation (this feature)

```text
specs/001-grammar-config-command/
├── plan.md              # This file
├── research.md          # Phase 0: Langium parsing, manifest structure
├── data-model.md        # Phase 1: GrammarManifest type definition
├── quickstart.md        # Phase 1: Integration guide
├── contracts/           # Phase 1: Type interfaces
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
.claude/commands/
└── grammar-config.md            # Claude Code command definition (CREATE)

packages/
└── types/                       # @sanyam/types package (CREATE)
    ├── package.json
    ├── src/
    │   └── grammar-manifest.ts  # GrammarManifest type definition
    └── tsconfig.json

grammars/                        # Grammar packages directory (exists, empty)
└── {grammarName}/               # Generated per grammar
    ├── {grammarName}.langium    # Grammar definition
    ├── manifest.ts              # GrammarManifest export
    └── package.json             # Package configuration

.claude/templates/               # Command templates (CREATE)
├── starter-grammar.langium      # Default workflow grammar template
└── manifest-template.ts         # Manifest generation template
```

**Structure Decision**: This is a CLI command that generates packages. The command itself lives in `.claude/commands/`. Generated outputs go to `grammars/` and the shared types go to `packages/types/`. This follows the existing monorepo workspace configuration.

## Complexity Tracking

No violations to justify.

---

## Phase 0: Research Topics

The following topics require research before Phase 1 design:

### R1: Langium Grammar Parsing

**Question**: How to parse `.langium` files and extract AST type definitions?

**Research Tasks**:
- Understand Langium 4.x grammar syntax and structure
- Identify APIs for programmatic grammar analysis
- Determine how to extract parser rules and inferred types

### R2: Claude Code Command Structure

**Question**: What is the exact format for Claude Code skill/command files?

**Research Tasks**:
- Analyze existing commands in `.claude/commands/`
- Understand YAML frontmatter schema
- Document execution flow and tool access

### R3: GrammarManifest Type Design

**Question**: What is the complete type definition for GrammarManifest?

**Research Tasks**:
- Analyze the example manifest in the spec
- Identify all required and optional fields
- Design type hierarchy (RootType, DiagramType, ToolPaletteGroup, etc.)

### R4: AI Grammar Generation Strategy

**Question**: How to generate valid Langium grammars from natural language?

**Research Tasks**:
- Design prompt strategy for grammar generation
- Define validation approach for generated grammars
- Plan fallback to starter template on failure

### R5: Icon Mapping Strategy

**Question**: How to map AST types to appropriate VS Code icons?

**Research Tasks**:
- Identify available VS Code icon set
- Design heuristic for automatic icon assignment
- Allow manual override in grammar or manifest

---

## Implementation Phases Overview

### Phase 1: Foundation (Types & Command)
- Create `@sanyam/types` package with GrammarManifest interface
- Create `/grammar-config` command skeleton
- Create starter grammar template

### Phase 2: Core Functionality (P1 Story)
- Implement grammar file detection
- Implement Langium grammar parsing
- Implement manifest generation from parsed grammar

### Phase 3: Starter Generation (P2 Story)
- Implement starter grammar creation for missing grammars
- Add grammar validation

### Phase 4: AI Generation (P2 Story)
- Implement natural language to grammar generation
- Add retry/fallback logic
- Handle text file input

### Phase 5: Polish & Integration (P3 Story)
- Platform integration documentation
- Error handling improvements
- Edge case handling (invalid names, parse errors)
