# Feature Specification: Complete GLSP Backend Integration

**Feature Branch**: `003-glsp-backend-integration`
**Created**: 2026-01-23
**Status**: Draft
**Input**: User description: "Complete GLSP integration so diagram frontend receives real data from the unified language server instead of falling back to mock data"

## Clarifications

### Session 2026-01-23

- Q: Should diagram-to-text synchronization (currently out of scope) be added to this feature? → A: Yes, add as P2 user story, making bidirectional sync a core feature.
- Q: How should conflicts be handled when text and diagram are edited simultaneously? → A: Last edit wins - most recent edit overwrites without conflict UI.
- Q: Should diagram layout persistence (save/restore node positions per file) be added? → A: Yes, add as P5 user story - save positions per file to user storage.
- Q: What identifier should be used for per-file layout storage? → A: File URI (path-based) - layout lost if file moves/renames.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Diagram for Grammar File (Priority: P1)

A developer opens a grammar-specific file (e.g., `.spdk` for spdevkit) and views its diagram representation. The diagram shows actual nodes and edges derived from the file's AST, not mock placeholder data.

**Why this priority**: This is the core value proposition - connecting the existing diagram UI to real language server data. Without this, the GLSP integration provides no user value.

**Independent Test**: Can be fully tested by opening any grammar file with diagram support and verifying that diagram elements correspond to actual file content. Delivers immediate visual representation of structured documents.

**Acceptance Scenarios**:

1. **Given** a user has a `.spdk` file open with an `application` and `entity` declarations, **When** they open the diagram view (Ctrl+Shift+D), **Then** they see diagram nodes representing the application and entity with correct labels.

2. **Given** a user has an empty grammar file open, **When** they open the diagram view, **Then** they see an empty diagram canvas (not mock data or error).

3. **Given** a user has a file with syntax errors, **When** they open the diagram view, **Then** they see a partial diagram for valid elements with visual indication of errors.

---

### User Story 2 - Live Text Updates on Diagram Edit (Priority: P2)

When a developer edits the diagram (moves nodes, adds elements, deletes elements, edits properties), the underlying text file updates automatically to reflect those changes.

**Why this priority**: Bidirectional sync (diagram → text) transforms the diagram from a passive view into an active editing surface, enabling visual programming workflows.

**Independent Test**: Can be tested by manipulating diagram elements and verifying the source text file updates correctly. Delivers true graphical editing capability.

**Acceptance Scenarios**:

1. **Given** a diagram is open for a grammar file, **When** the user adds a new node via the tool palette, **Then** the corresponding declaration appears in the text file.

2. **Given** a diagram is open for a grammar file, **When** the user deletes a node from the diagram, **Then** the corresponding declaration is removed from the text file.

3. **Given** a diagram is open for a grammar file, **When** the user edits a node's label or properties in the diagram, **Then** the corresponding text in the source file updates.

4. **Given** a diagram is open for a grammar file, **When** the user creates an edge between two nodes, **Then** the appropriate relationship/reference appears in the text file.

---

### User Story 3 - Live Diagram Updates on Text Edit (Priority: P3)

When a developer edits the text file, the diagram view updates automatically to reflect the changes without requiring manual refresh.

**Why this priority**: Bidirectional awareness (text → diagram) is essential for the diagram to be useful during active development. Depends on P1 being complete.

**Independent Test**: Can be tested by editing text while diagram is open and observing automatic updates. Delivers live synchronization feedback.

**Acceptance Scenarios**:

1. **Given** a diagram is open for a grammar file, **When** the user adds a new entity in the text editor, **Then** a new node appears in the diagram within 500ms.

2. **Given** a diagram is open for a grammar file, **When** the user renames an element in the text editor, **Then** the corresponding diagram node label updates automatically.

3. **Given** a diagram is open for a grammar file, **When** the user deletes an element from the text, **Then** the corresponding diagram node disappears.

---

### User Story 4 - Multi-Grammar Support (Priority: P4)

The system automatically discovers and loads grammar contributions at runtime, allowing any grammar package with GLSP providers to display diagrams without code changes.

**Why this priority**: Enables extensibility for future grammars. Core functionality (P1, P2, P3) must work first before extending to multiple grammars.

**Independent Test**: Can be tested by adding a new grammar package with GLSP providers and verifying diagrams work without modifying backend code. Delivers grammar extensibility.

**Acceptance Scenarios**:

1. **Given** a new grammar package is installed with proper GLSP provider exports, **When** a user opens a file of that grammar type, **Then** the diagram view shows nodes using that grammar's conversion rules.

2. **Given** multiple grammar packages are installed, **When** the user opens files of different types, **Then** each file's diagram uses its corresponding grammar's GLSP providers.

---

### User Story 5 - Diagram Layout Persistence (Priority: P5)

When a user arranges diagram nodes (positions, possibly sizes), those layout preferences are saved and restored when the same file is reopened.

**Why this priority**: Layout persistence improves usability by eliminating repetitive manual arrangement. Lower priority than core sync functionality but essential for a polished experience.

**Independent Test**: Can be tested by positioning nodes, closing the diagram, reopening, and verifying positions are restored. Delivers persistent visual organization.

**Acceptance Scenarios**:

1. **Given** a user has arranged nodes in a diagram, **When** they close and reopen the diagram for the same file, **Then** the node positions are restored to their previous arrangement.

2. **Given** a user opens a file for the first time (no saved layout), **When** the diagram view opens, **Then** the system applies automatic layout (grammar-provided or default).

3. **Given** a user has saved layout for a file, **When** the underlying text adds new elements, **Then** existing nodes retain their positions and new nodes are placed using automatic layout.

4. **Given** a user wants to reset layout, **When** they invoke a "Reset Layout" action, **Then** all nodes are repositioned using automatic layout and saved positions are cleared.

---

### Edge Cases

- What happens when the language server is not yet initialized? System should queue requests and respond once ready.
- How does the system handle files with no GLSP provider defined for their grammar? Show informative message that diagram view is not available for this file type.
- What happens if the backend service crashes or becomes unresponsive? Frontend should show error state and allow retry.
- How does the system handle very large files with hundreds of diagram elements? Performance should remain acceptable with lazy loading or virtualization.
- What happens during concurrent text and diagram edits? Last edit wins - the most recent edit (text or diagram) overwrites the other without prompting the user.
- What happens if layout storage is unavailable or corrupted? System falls back to automatic layout without error; layout is re-saved on next position change.
- What happens when a file is moved or renamed? Saved layout is associated with the old URI; the file at new URI starts with automatic layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an RPC service that forwards diagram requests from the browser frontend to the Node.js backend.
- **FR-002**: System MUST implement a backend service that hosts the unified language server and processes GLSP requests.
- **FR-003**: System MUST support the `loadModel` operation to convert AST to GModel for diagram rendering.
- **FR-004**: System MUST support the `executeOperation` operation to process diagram editing commands.
- **FR-005**: System MUST support the `getToolPalette` operation to provide context-aware editing tools.
- **FR-006**: System MUST support the `validate` operation to return validation markers for diagram elements.
- **FR-007**: System MUST support document synchronization between frontend and backend for real-time updates.
- **FR-008**: System MUST discover grammar contributions dynamically at runtime without hardcoded references.
- **FR-009**: System MUST provide the service interface in a shared types package accessible to both frontend and backend.
- **FR-010**: System MUST gracefully handle initialization delays, returning appropriate error responses until ready.
- **FR-011**: System MUST convert diagram operations (add node, delete node, edit properties, add edge) into corresponding text edits.
- **FR-012**: System MUST apply diagram-initiated text edits to the source document while preserving formatting and comments where possible.
- **FR-013**: System MUST prevent edit loops when synchronizing between text and diagram views.
- **FR-014**: System MUST use "last edit wins" conflict resolution - the most recent edit overwrites without user prompts.
- **FR-015**: System MUST persist diagram node positions to user profile storage, keyed by file URI (path-based).
- **FR-016**: System MUST restore saved node positions when reopening a diagram for a previously viewed file.
- **FR-017**: System MUST apply automatic layout for new nodes that have no saved position.
- **FR-018**: System MUST provide a "Reset Layout" action that clears saved positions and re-applies automatic layout.

### Key Entities

- **SanyamGlspService**: The RPC service interface defining all GLSP operations (loadModel, executeOperation, validate, etc.)
- **SanyamGlspBackendService**: Backend implementation that hosts the language server and processes requests
- **SanyamLanguageClientProvider**: Frontend provider that creates proxies to the backend service
- **LoadModelResponse**: Response containing GModel root, layout metadata, or error information
- **GrammarContribution**: Dynamically discovered grammar packages with GLSP provider exports
- **DiagramOperation**: Represents a user action in the diagram (create, delete, move, edit) that triggers text updates
- **DiagramLayout**: Persisted layout data containing node positions (and optionally sizes) keyed by element identifier, stored per file URI in user profile storage

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view a diagram representation of any supported grammar file within 2 seconds of opening the diagram view.
- **SC-002**: Diagram updates appear within 500ms of text changes for files under 1000 lines.
- **SC-003**: System successfully loads and displays diagrams for 100% of grammar packages that export valid GLSP providers.
- **SC-004**: Zero mock/placeholder data appears in the diagram view when a valid GLSP provider exists for the file type.
- **SC-005**: Backend service initializes and becomes ready within 5 seconds of application startup.
- **SC-006**: System handles files with 500+ diagram elements without UI freezing or unresponsiveness.
- **SC-007**: Text file updates appear within 500ms of diagram edits for files under 1000 lines.
- **SC-008**: Diagram-initiated text edits preserve existing code formatting and comments in 95% of cases.
- **SC-009**: Saved diagram layouts are restored within 200ms of opening the diagram view.
- **SC-010**: Layout persistence works correctly for 100% of reopened files that had previously saved positions.

## Assumptions

- The unified language server (`@sanyam/language-server`) already implements GLSP server capabilities and AST-to-GModel conversion.
- Grammar packages follow the established pattern with `sanyam.contribution` exports in package.json.
- The Theia framework's `JsonRpcConnectionHandler` and `WebSocketConnectionProvider` are available for RPC communication.
- The `@sanyam/grammar-scanner` package can discover grammar packages at runtime.
- Frontend `DiagramLanguageClient` already handles mock fallback and will use real data when available.
- Grammar contributions can provide GModel-to-text conversion rules for diagram-to-text sync.
- Theia's user profile storage service is available for persisting layout data per file.

## Out of Scope

- Custom layout algorithms - system uses default or grammar-provided layouts.
- Collaborative editing of diagrams - single-user only for this feature.
- Undo/redo for diagram operations - handled separately.
