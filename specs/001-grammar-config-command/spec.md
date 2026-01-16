# Feature Specification: Grammar Config Command

**Feature Branch**: `001-grammar-config-command`
**Created**: 2026-01-15
**Status**: Draft
**Input**: User description: "Create a new .claude command '/grammar-config <grammarName | grammarName.langium>' that searches for or creates Langium grammar files and generates grammar packages with GrammarManifest exports for the SANYAM platform"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Grammar Package from Existing Langium File (Priority: P1)

A developer wants to add a new domain-specific language to their SANYAM platform project. They already have a Langium grammar file (`.langium`) and need to generate the corresponding grammar package with a GrammarManifest that defines file types, diagram support, and tool palette items.

**Why this priority**: This is the core value proposition - transforming existing grammar definitions into platform-ready packages. Without this capability, developers would need to manually create manifest configurations, which is error-prone and time-consuming.

**Independent Test**: Can be fully tested by running `/grammar-config MyGrammar` with an existing `grammars/MyGrammar/MyGrammar.langium` file and verifying a complete GrammarManifest is generated with file type definitions, root types, and diagram configurations.

**Acceptance Scenarios**:

1. **Given** a Langium grammar file exists at `grammars/spdevkit/spdevkit.langium`, **When** user runs `/grammar-config spdevkit`, **Then** the system generates a grammar package at `grammars/spdevkit/` containing a manifest file that exports a `GrammarManifest` constant with languageId, displayName, fileExtension, rootTypes, and diagram configurations derived from the grammar.

2. **Given** a Langium grammar file exists at `grammars/workflow/workflow.langium`, **When** user runs `/grammar-config workflow.langium`, **Then** the system generates the same package as if called with just `workflow`, accepting both formats.

3. **Given** the grammar defines AST types like `Application`, `Workflow`, `Entity`, **When** the manifest is generated, **Then** each AST type becomes a rootType entry with appropriate displayName, fileSuffix, folder, icon, template, and diagramNode configuration.

---

### User Story 2 - Create New Grammar from Scratch (Priority: P2)

A developer wants to create a completely new domain-specific language but hasn't written any grammar yet. They invoke the command with a grammar name that doesn't exist, and the system creates a simple starter workflow grammar as a foundation.

**Why this priority**: Enables rapid prototyping of new DSLs without requiring upfront grammar expertise. The starter template accelerates onboarding and learning.

**Independent Test**: Can be fully tested by running `/grammar-config NewLanguage` where no `grammars/NewLanguage/` directory exists, and verifying both a starter `.langium` file and corresponding `GrammarManifest` are created.

**Acceptance Scenarios**:

1. **Given** no grammar exists at `grammars/taskflow/`, **When** user runs `/grammar-config taskflow`, **Then** the system creates `grammars/taskflow/taskflow.langium` with a simple workflow grammar template AND generates the corresponding manifest package.

2. **Given** the starter grammar is created, **When** user examines the `.langium` file, **Then** it contains a syntactically valid Langium grammar with basic entry rules, at least one root type definition, and comments guiding further customization.

---

### User Story 3 - Create Grammar from Natural Language Description (Priority: P2)

A developer provides a natural language description (either as a quoted string or reference to a text file) of what their DSL should model. The system uses AI to generate an appropriate Langium grammar, then proceeds to generate the manifest package.

**Why this priority**: Removes the barrier of learning Langium syntax for new users. AI-assisted grammar generation democratizes DSL creation.

**Independent Test**: Can be fully tested by running `/grammar-config "A language for defining REST API endpoints with resources, methods, and authentication"` and verifying a contextually appropriate `.langium` grammar and manifest are generated.

**Acceptance Scenarios**:

1. **Given** user provides a quoted description `/grammar-config "A language for modeling state machines with states, transitions, and guards"`, **When** the command executes, **Then** the system uses AI to generate a `.langium` grammar that models states, transitions, and guards, then generates the corresponding manifest.

2. **Given** user provides a path to a text file `/grammar-config requirements.txt` where `requirements.txt` contains a detailed DSL description, **When** the command executes, **Then** the system reads the file content, uses AI to generate an appropriate `.langium` grammar, and generates the manifest.

3. **Given** the AI generates a grammar, **When** the manifest is created, **Then** the rootTypes, diagram configurations, and tool palette items reflect the concepts from the natural language description.

---

### User Story 4 - Manifest Integration with Platform (Priority: P3)

After generating a grammar package, the developer needs to integrate it with the SANYAM platform by adding it as a dependency. The manifest export should follow a consistent pattern that the platform can consume.

**Why this priority**: Without platform integration, the generated packages have no practical use. This story ensures the output is immediately consumable.

**Independent Test**: Can be fully tested by importing the generated manifest into a platform configuration and verifying all expected metadata (file types, icons, templates, diagram support) is accessible.

**Acceptance Scenarios**:

1. **Given** a grammar package is generated, **When** the manifest is exported, **Then** it exports a named constant following the pattern `{GRAMMAR_NAME}_MANIFEST` (e.g., `SPDEVKIT_MANIFEST`) typed as `GrammarManifest` from `@sanyam/types`.

2. **Given** the manifest includes diagrammingEnabled as true, **When** the platform processes the manifest, **Then** it can extract diagramTypes with node types, edge types, and tool palette groups to configure the diagram editor.

---

### Edge Cases

- What happens when the grammar name contains invalid characters (spaces, special chars)?
  - System normalizes the name (convert to lowercase, replace invalid chars with hyphens) or rejects with a clear error message.

- How does the system handle a corrupted or syntactically invalid existing `.langium` file?
  - System reports the parsing error with line/column information and suggests fixing the grammar before regenerating.

- What happens if the grammars directory doesn't exist?
  - System creates the `grammars/` directory structure automatically.

- How does the system handle grammar names that conflict with reserved words or existing packages?
  - System warns if the name conflicts with common package names and suggests alternatives.

- What happens when AI grammar generation fails or produces invalid output?
  - System retries once with a refined prompt, then falls back to the starter template if unsuccessful, notifying the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept grammar name in formats: `grammarName`, `grammarName.langium`, quoted string description, or path to text file.

- **FR-002**: System MUST search for existing grammar files at `grammars/{grammarName}/{grammarName}.langium` before creating new ones.

- **FR-003**: System MUST create a starter workflow grammar template when no existing grammar is found and input is a simple name (not quoted string or text file path).

- **FR-004**: System MUST use AI to generate Langium grammar when input is a quoted string description or reference to a non-.langium text file.

- **FR-005**: System MUST generate a grammar package directory at `grammars/{grammarName}/` containing manifest file with `GrammarManifest` export.

- **FR-006**: System MUST analyze the Langium grammar to extract AST types and generate corresponding rootTypes in the manifest with displayName, fileSuffix, folder, icon, template, templateInputs, and diagramNode configurations.

- **FR-007**: System MUST generate diagram configurations including nodeTypes, edgeTypes, and toolPalette groups based on grammar analysis.

- **FR-008**: System MUST export the manifest as a named constant following `{GRAMMAR_NAME_UPPERCASE}_MANIFEST` pattern typed as `GrammarManifest`.

- **FR-009**: System MUST import the `GrammarManifest` type from `@sanyam/types` package.

- **FR-010**: System MUST handle grammar names with invalid characters by normalizing or rejecting with clear error message.

- **FR-011**: System MUST provide informative error messages when grammar parsing fails, including location information.

- **FR-012**: System MUST create the `grammars/` directory structure if it doesn't exist.

### Key Entities

- **Grammar**: The Langium grammar definition (`.langium` file) that defines the DSL syntax and AST structure.

- **GrammarManifest**: The configuration object that describes how the grammar integrates with the SANYAM platform, including file types, diagram support, and tool palette items.

- **RootType**: A top-level AST type that can be instantiated as a separate file, with associated metadata (displayName, fileSuffix, folder, icon, template, diagramNode).

- **DiagramType**: Configuration for a specific diagram view, including available node types, edge types, and tool palette groups.

- **ToolPaletteGroup**: A grouping of related tools in the diagram editor palette, containing items that create nodes or edges.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a complete grammar package with manifest in under 30 seconds for existing Langium grammars.

- **SC-002**: Generated manifests are syntactically valid and can be imported without errors by consuming packages.

- **SC-003**: AI-generated grammars from natural language descriptions are syntactically valid Langium in at least 90% of attempts.

- **SC-004**: 100% of AST types defined in a Langium grammar are represented in the generated manifest's rootTypes array with appropriate metadata.

- **SC-005**: Generated starter templates enable users to have a working (compilable) grammar within 5 minutes of running the command.

- **SC-006**: Users can go from natural language description to working diagram editor configuration in a single command invocation.

## Assumptions

- The `@sanyam/types` package exists and exports the `GrammarManifest` type with the structure shown in the example.
- The SANYAM platform has an established convention for grammar package locations (`grammars/{name}/`).
- Icon names (like `server`, `globe`, `symbol-class`) reference a known icon set available in the platform.
- The starter workflow grammar template follows Langium 3.x+ syntax conventions.
- AI generation for Langium grammars is performed using the available AI capabilities in Claude Code.
- Diagram node shapes default to `rectangle` unless grammar metadata suggests otherwise.
- Default diagram node sizes follow a reasonable hierarchy (larger for container types, smaller for leaf types).
