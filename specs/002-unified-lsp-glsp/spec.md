# Feature Specification: Unified LSP/GLSP Language Server

**Feature Branch**: `002-unified-lsp-glsp`
**Created**: 2026-01-16
**Status**: Draft
**Input**: User description: "Unified LSP and GLSP Language Server Implementation for Sanyam IDE"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit Domain-Specific Language Files with IDE Support (Priority: P1)

As a language author working with domain-specific languages (DSLs) in Sanyam IDE, I want full IDE editing support including code completion, hover information, go-to-definition, and syntax validation so that I can efficiently write and maintain DSL files without consulting documentation constantly.

**Why this priority**: This is the foundational capability. Without LSP support, users cannot effectively edit DSL files, making the IDE unusable for its core purpose.

**Independent Test**: Can be fully tested by opening a grammar file (e.g., `.ecml`), typing code, and verifying that completions appear, errors are highlighted, and definitions can be navigated to.

**Acceptance Scenarios**:

1. **Given** a user has opened an ECML file in the IDE, **When** they type the beginning of an element name, **Then** the system displays contextually relevant code completions.

2. **Given** a user hovers over a symbol in a DSL file, **When** the symbol is a defined entity, **Then** the system displays documentation or type information for that symbol.

3. **Given** a user right-clicks on a symbol reference, **When** they select "Go to Definition", **Then** the cursor navigates to the symbol's declaration location.

4. **Given** a user has a syntax error in their DSL file, **When** the file is saved or after a brief pause, **Then** the system highlights the error location and displays a descriptive error message.

---

### User Story 2 - View and Edit Domain Models as Visual Diagrams (Priority: P2)

As a language author or domain expert, I want to view and edit my domain models as visual diagrams (e.g., component diagrams, workflow diagrams) so that I can understand complex relationships at a glance and make structural changes visually.

**Why this priority**: Visual editing is a key differentiator for Sanyam IDE. While text editing provides functionality, diagram editing makes the IDE significantly more valuable for non-programmers and complex domain modeling.

**Independent Test**: Can be fully tested by opening a DSL file, switching to diagram view, observing nodes and edges rendered from the model, and dragging a node to verify the underlying model updates.

**Acceptance Scenarios**:

1. **Given** a user has opened a DSL file with diagrammable elements, **When** they open the diagram view for that file, **Then** the system displays a visual representation with nodes and edges corresponding to the model structure.

2. **Given** a user is viewing a diagram, **When** they drag a node to a new position, **Then** the node moves visually and the underlying model is updated with the new position data.

3. **Given** a user is viewing a diagram, **When** they use the tool palette to add a new element, **Then** a new node appears on the canvas and a corresponding element is added to the model.

4. **Given** a user modifies the text representation of a DSL file, **When** they view the diagram, **Then** the diagram reflects the changes made in the text editor.

---

### User Story 3 - Add New Grammar Support Without Server Changes (Priority: P3)

As a platform administrator or advanced user, I want to add support for new domain-specific languages by simply creating a grammar package without modifying the core language server, so that I can extend the platform's language support independently.

**Why this priority**: Extensibility enables growth of the platform ecosystem. Once core functionality works, this capability allows the community and enterprise users to add custom languages.

**Independent Test**: Can be fully tested by creating a new grammar package following the template, adding it to the workspace, rebuilding, and verifying the new language appears with LSP and GLSP support.

**Acceptance Scenarios**:

1. **Given** a developer has created a new grammar package with the required structure, **When** they add it to the workspace dependencies and rebuild, **Then** the system automatically discovers and registers the new language.

2. **Given** a grammar package includes custom LSP feature overrides, **When** the language is used, **Then** the custom behaviors are applied while defaults handle un-overridden features.

3. **Given** a grammar package includes a manifest with diagram configuration, **When** a user opens the diagram view, **Then** the tool palette and element types reflect the manifest configuration.

---

### User Story 4 - Customize Language Features Per Grammar (Priority: P4)

As a language designer, I want to provide custom implementations for specific LSP or GLSP features (e.g., custom hover content, specialized code actions, custom diagram layouts) while relying on sensible defaults for features I don't need to customize, so that I can create polished language experiences with minimal effort.

**Why this priority**: Customization enables professional-quality language tooling. While defaults work, language authors need control for production-grade experiences.

**Independent Test**: Can be fully tested by implementing a custom hover provider in a grammar package, rebuilding, and verifying the custom hover content appears when hovering over relevant elements.

**Acceptance Scenarios**:

1. **Given** a grammar package provides a custom hover implementation, **When** a user hovers over an element, **Then** the custom hover content is displayed instead of the default.

2. **Given** a grammar package provides custom GLSP node creation logic, **When** a user adds an element via the diagram, **Then** the custom logic executes and the element is created according to the custom rules.

3. **Given** a grammar package disables a specific feature (e.g., inlay hints), **When** using that language, **Then** the disabled feature is not available for that language.

---

### User Story 5 - Access Model Data Programmatically (Priority: P5)

As a form/view developer building custom editors in Sanyam IDE, I want to access model data through a structured API and receive notifications when models change, so that I can build synchronized custom views that stay in sync with the underlying model.

**Why this priority**: This enables advanced integrations like custom form editors. It's valuable but builds on top of the core LSP/GLSP functionality.

**Independent Test**: Can be fully tested by subscribing to model changes via the API, modifying a DSL file, and verifying the subscriber receives the change notification with updated model data.

**Acceptance Scenarios**:

1. **Given** a client has subscribed to a document via the Model API, **When** the document's model changes, **Then** the client receives a notification with the updated model representation.

2. **Given** a client requests the current model state, **When** the document exists and is parsed, **Then** the client receives a structured representation of the model.

3. **Given** multiple clients are subscribed to the same document, **When** one client makes a change, **Then** all subscribed clients receive the change notification.

---

### Edge Cases

- What happens when a grammar package is missing required exports? The system logs a warning and skips the invalid package.
- How does the system handle malformed grammar files that fail to parse? The system displays parsing errors in the problems panel and continues operating for other files.
- What happens when two grammar packages claim the same file extension? The first discovered package takes precedence; a warning is logged.
- How does the diagram view handle models with circular references? The layout algorithm handles cycles gracefully, preventing infinite loops.
- What happens when a user attempts diagram operations on a file with validation errors? Basic operations (view, navigate) work; modifying operations show a warning about validation errors.

## Requirements *(mandatory)*

### Functional Requirements

#### Grammar Discovery and Registration

- **FR-001**: System MUST automatically discover grammar packages from workspace dependencies at build time.
- **FR-002**: System MUST register discovered languages with their file extensions for editor association.
- **FR-003**: System MUST load grammar manifests to configure UI and diagram features.
- **FR-004**: System MUST support grammar packages that provide only required exports (modules, manifest) without custom overrides.

#### LSP Features

- **FR-005**: System MUST provide default implementations for all LSP 3.17 specification features.
- **FR-006**: System MUST support code completion with contextually relevant suggestions based on grammar rules.
- **FR-007**: System MUST provide hover information for symbols, displaying documentation and type information.
- **FR-008**: System MUST support go-to-definition navigation from references to declarations.
- **FR-009**: System MUST support find-all-references functionality.
- **FR-010**: System MUST provide document symbols for outline views.
- **FR-011**: System MUST support rename refactoring across files.
- **FR-012**: System MUST report validation errors and warnings as diagnostics.
- **FR-013**: System MUST provide code folding for collapsible blocks.
- **FR-014**: System MUST support semantic token highlighting.

#### GLSP Features

- **FR-015**: System MUST convert model structures to visual graph representations based on grammar manifests.
- **FR-016**: System MUST provide a tool palette with element types derived from the grammar manifest.
- **FR-017**: System MUST support creating new elements via the diagram.
- **FR-018**: System MUST support deleting elements from the diagram.
- **FR-019**: System MUST support moving/repositioning elements on the diagram.
- **FR-020**: System MUST support creating and modifying edges (relationships) between elements.
- **FR-021**: System MUST keep the text model and diagram view synchronized bidirectionally.

#### Customization

- **FR-022**: System MUST allow grammar packages to override specific LSP feature implementations.
- **FR-023**: System MUST allow grammar packages to override specific GLSP feature implementations.
- **FR-024**: System MUST allow grammar packages to disable specific features.
- **FR-025**: System MUST merge custom implementations with defaults, using customs where provided.

#### Model API

- **FR-026**: System MUST provide a programmatic API to retrieve current model state.
- **FR-027**: System MUST support client subscriptions for model change notifications.
- **FR-028**: System MUST notify all subscribers when a model changes.

#### Deployment

- **FR-029**: System MUST package all language support into a single VS Code extension (VSIX).
- **FR-030**: System MUST run LSP, GLSP, and Model API services within a single server process.

### Key Entities

- **Grammar Package**: A self-contained language implementation containing grammar definition, generated code, manifest, and optional custom providers.
- **Language Contribution**: The registration interface a grammar package exports to be discovered and loaded by the server.
- **Grammar Manifest**: Configuration describing UI presentation, diagram types, element mappings, and visual properties for a language.
- **LSP Feature Provider**: An interface for implementing specific LSP capabilities (completion, hover, definition, etc.).
- **GLSP Feature Provider**: An interface for implementing diagram-specific capabilities (model conversion, layout, tool palette).
- **Language Registry**: The runtime registry tracking all loaded languages and their services.
- **Document**: A parsed file with its abstract syntax tree (AST) managed by the document store.
- **GModel**: The graph model representation used for diagram visualization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see code completion suggestions within 1 second of typing in any supported DSL file.
- **SC-002**: Users can navigate from a symbol reference to its definition in under 2 seconds.
- **SC-003**: Validation errors appear in the problems panel within 2 seconds of saving a file.
- **SC-004**: The diagram view renders for files with up to 200 elements within 3 seconds.
- **SC-005**: Changes made in text editor reflect in the diagram view within 1 second.
- **SC-006**: Changes made in the diagram view reflect in the text file within 1 second.
- **SC-007**: Adding a new grammar package requires no changes to the core server code—only workspace configuration.
- **SC-008**: 90% of LSP features work out-of-the-box for new grammars without custom implementations.
- **SC-009**: Model API change notifications are delivered to subscribers within 500ms of the change.
- **SC-010**: The single VSIX extension successfully loads and operates in both browser and desktop versions of the IDE.

## Assumptions

- Langium 4.x will be used as the grammar/parsing framework and its generated modules will follow the expected structure.
- GLSP (Eclipse Graphical Language Server Platform) will be used for diagram functionality with its standard protocols.
- The IDE will be built on Eclipse Theia with Monaco editor support.
- Grammar packages will follow the pnpm workspace convention for dependency management.
- All supported languages will use text-based file formats (not binary).
- Initial deployment targets both Electron desktop and browser-based versions of the IDE.

## Dependencies

- Langium framework for grammar parsing and LSP foundation.
- GLSP framework for diagram server capabilities.
- Eclipse Theia as the IDE platform.
- pnpm workspace for monorepo package management.
- VS Code extension API compatibility for VSIX packaging.
