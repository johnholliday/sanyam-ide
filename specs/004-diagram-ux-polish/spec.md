# Feature Specification: Diagram Editor UX Polish

**Feature Branch**: `004-diagram-ux-polish`
**Created**: 2026-01-25
**Status**: Draft
**Input**: User description: "Diagramming adjustments including layout restoration, marquee selection, properties panel, snap-to-grid, grammar-driven tool palette, and port-based connections"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth Diagram Opening (Priority: P1)

As a user, I want diagrams to open without jarring visual repositioning so that the experience feels polished and professional. When I open or refresh a diagram, elements should appear in their correct positions immediately rather than visibly jumping from default positions to their final layout.

**Why this priority**: This is the most critical UX issue - visible layout jumping on every diagram open creates an unprofessional impression and disrupts the user's mental model of their diagram.

**Independent Test**: Can be fully tested by opening any saved diagram and verifying no visible position changes occur after the diagram becomes visible.

**Acceptance Scenarios**:

1. **Given** a diagram with a previously saved layout, **When** the user opens or refreshes the diagram, **Then** elements appear directly in their saved positions without any visible repositioning
2. **Given** a diagram with no saved layout, **When** the user opens the diagram for the first time, **Then** elements appear in auto-layout positions without visible repositioning from default positions
3. **Given** a diagram is being loaded, **When** layout calculations are in progress, **Then** the diagram content remains hidden until positioning is complete

---

### User Story 2 - Layout Persistence (Priority: P1)

As a user, I want my diagram layout to be automatically saved and restored so that I don't lose my carefully arranged elements when I close and reopen diagrams.

**Why this priority**: Layout persistence is foundational - without it, users waste time re-arranging diagrams every session, and Story 1 cannot function properly.

**Independent Test**: Can be fully tested by arranging elements, closing the diagram, reopening it, and verifying positions match.

**Acceptance Scenarios**:

1. **Given** a user has arranged elements in a diagram, **When** the user closes and reopens the diagram, **Then** all elements appear in their previously saved positions
2. **Given** a user moves an element to a new position, **When** the diagram is saved or closed, **Then** the new position is persisted automatically
3. **Given** a layout cache exists for a diagram, **When** the source model changes (elements added/removed), **Then** existing element positions are preserved and new elements receive auto-layout positions

---

### User Story 3 - Marquee Selection (Priority: P2)

As a user, I want to select multiple diagram elements by drawing a rectangle around them so that I can efficiently manipulate groups of elements.

**Why this priority**: Multi-element selection is essential for productivity when working with complex diagrams but builds on the core viewing experience.

**Independent Test**: Can be fully tested by Ctrl+dragging across multiple elements and verifying all enclosed elements are selected.

**Acceptance Scenarios**:

1. **Given** a diagram with multiple elements, **When** the user holds Ctrl and drags to draw a rectangle, **Then** a visible selection marquee appears following the cursor
2. **Given** a selection marquee is being drawn, **When** the user releases the mouse button, **Then** all elements fully or partially within the rectangle are selected
3. **Given** elements are selected via marquee, **When** the user performs a group operation (move, delete), **Then** all selected elements are affected

---

### User Story 4 - Properties Panel (Priority: P2)

As a user, I want to view and edit properties of selected diagram elements in a dedicated panel so that I can modify element attributes without navigating to the text editor.

**Why this priority**: Property editing is a core interaction pattern that significantly improves productivity for element configuration.

**Independent Test**: Can be fully tested by selecting a diagram element and verifying its properties appear in a dockable panel with editable fields.

**Acceptance Scenarios**:

1. **Given** a diagram element is selected, **When** the properties panel is visible, **Then** the panel displays all editable properties of the selected element
2. **Given** a property value is modified in the panel, **When** the user commits the change, **Then** the underlying model is updated and the diagram reflects the change
3. **Given** multiple contexts exist (diagram selection, text editor selection, explorer selection), **When** the user selects an item in any context, **Then** the properties panel updates to show properties of the currently focused selection
4. **Given** the properties panel, **When** the user docks/undocks/moves the panel, **Then** the panel behaves as a standard Theia dockable panel
5. **Given** multiple elements are selected (e.g., via marquee), **When** the properties panel is visible, **Then** only properties common to all selected elements are shown, and editing a property updates all selected elements

---

### User Story 5 - Document Outline (Priority: P2)

As a user, I want to see a hierarchical outline of my model in the document outline panel so that I can navigate complex models easily.

**Why this priority**: Outline navigation is essential for large models and leverages existing Theia infrastructure.

**Independent Test**: Can be fully tested by opening a model and verifying the outline panel shows a navigable tree structure.

**Acceptance Scenarios**:

1. **Given** a model document is open, **When** the outline panel is visible, **Then** it displays the hierarchical structure of the model
2. **Given** the outline panel shows model structure, **When** the user clicks an outline item, **Then** the corresponding element is selected in both the diagram and text editor
3. **Given** a hierarchical model with parent-child relationships, **When** displayed in the outline, **Then** child elements appear nested under their parents

---

### User Story 6 - Snap to Grid (Priority: P3)

As a user, I want to toggle snap-to-grid functionality so that I can align elements precisely when desired.

**Why this priority**: Grid snapping improves diagram aesthetics but is an enhancement over core functionality.

**Independent Test**: Can be fully tested by enabling snap-to-grid and verifying dragged elements align to grid intersections.

**Acceptance Scenarios**:

1. **Given** the diagram editor toolbar, **When** the user views available tools, **Then** a snap-to-grid toggle button with icon is visible
2. **Given** snap-to-grid is enabled, **When** the user drags an element, **Then** the element snaps to the nearest grid intersection
3. **Given** snap-to-grid is disabled, **When** the user drags an element, **Then** the element moves freely without constraint
4. **Given** snap-to-grid state is changed, **When** the user creates a new diagram or reopens an existing one, **Then** the snap-to-grid preference is remembered

---

### User Story 7 - Grammar-Driven Tool Palette (Priority: P3)

As a user, I want the tool palette to show all available node and connection types from my grammar so that I can create any element my language supports.

**Why this priority**: Dynamic tooling enables full language capability but requires the core diagram infrastructure to be stable first.

**Independent Test**: Can be fully tested by loading different grammars and verifying the tool palette reflects each grammar's available types.

**Acceptance Scenarios**:

1. **Given** a grammar with multiple node types, **When** the tool palette is displayed, **Then** all node types from the grammar manifest appear in the Nodes section (not just "Node", "Entity", "Component")
2. **Given** a grammar with multiple connection types, **When** the tool palette is displayed, **Then** all connection types from the grammar manifest appear in the Connections section
3. **Given** a hierarchical type structure in the grammar, **When** displayed in the palette, **Then** the hierarchy is visually represented (grouping or nesting)

---

### User Story 8 - Port-Based Connections (Priority: P3)

As a user, I want certain node types to have designated connection ports so that I can create structured connections according to my grammar's rules.

**Why this priority**: Port-based connections enable sophisticated diagram semantics but require stable core connection handling first.

**Independent Test**: Can be fully tested by creating connections between port-enabled nodes and verifying connections attach to ports.

**Acceptance Scenarios**:

1. **Given** a grammar defines port-enabled entity types, **When** those entities appear in the diagram, **Then** ports are visually displayed on the nodes
2. **Given** a node with ports, **When** the user initiates a connection, **Then** connection endpoints snap to valid ports
3. **Given** grammar-specific connection rules, **When** the user attempts to create a connection, **Then** only valid source-target port combinations are allowed

---

### Edge Cases

- What happens when a cached layout references elements that no longer exist in the model? (Answer: Stale positions are ignored, remaining elements keep their positions)
- How does the system handle layout cache for renamed model files? (Answer: Layout is associated with file path; renamed files start fresh unless a migration mechanism is implemented)
- What happens when marquee selection crosses element boundaries partially? (Answer: Elements partially within the marquee are included in selection)
- How does the properties panel handle elements with no editable properties? (Answer: Panel displays a message indicating no properties available)
- What happens when a grammar defines no custom node types? (Answer: Tool palette shows default types or an empty section with guidance)
- How does snap-to-grid interact with layout restoration? (Answer: Restored positions are exact from cache; grid only affects new movements)

## Requirements *(mandatory)*

### Functional Requirements

**Layout & Rendering**

- **FR-001**: System MUST hide diagram content during initial layout calculation to prevent visible repositioning
- **FR-002**: System MUST restore previously saved element positions when opening a diagram with cached layout
- **FR-003**: System MUST apply auto-layout for diagrams without cached layout before making content visible
- **FR-004**: System MUST automatically persist element positions when elements are moved or when the diagram is saved/closed
- **FR-005**: System MUST preserve existing element positions when new elements are added to a model with cached layout

**Selection**

- **FR-006**: System MUST support marquee selection triggered by Ctrl+Drag gesture
- **FR-007**: System MUST display a visible selection rectangle while marquee selection is in progress
- **FR-008**: System MUST select all elements within the marquee bounds when the gesture completes

**Properties Panel**

- **FR-009**: System MUST provide a dockable properties panel in the Theia workbench
- **FR-010**: System MUST display editable properties for the currently selected element; when multiple elements are selected, system MUST show only properties common to all selected elements and apply edits to all
- **FR-011**: System MUST distinguish between node properties and child nodes using a hybrid approach: by default, scalar types (string, number, boolean, enum) are treated as properties (displayed in properties panel) and object/array types as children (displayed hierarchically); grammar manifests MAY override this default for any field
- **FR-012**: System MUST update the underlying model when property values are changed in the panel
- **FR-013**: System MUST support context-aware property display for diagram selections, text editor selections, and explorer selections

**Document Outline**

- **FR-014**: System MUST provide a document outline contribution showing hierarchical model structure
- **FR-015**: System MUST synchronize outline selection with diagram and text editor selection; clicking an outline item MUST select the corresponding element in both the diagram view and text editor simultaneously
- **FR-016**: System MUST display parent-child relationships as nested items in the outline

**Grid & Alignment**

- **FR-017**: System MUST provide a snap-to-grid toggle in the diagram editor toolbar with a recognizable icon
- **FR-018**: System MUST snap element positions to grid intersections when snap-to-grid is enabled
- **FR-019**: System MUST persist snap-to-grid preference across sessions

**Grammar-Driven Tooling**

- **FR-020**: System MUST populate the tool palette Nodes section from the grammar manifest's available node types
- **FR-021**: System MUST populate the tool palette Connections section from the grammar manifest's available connection types
- **FR-022**: System MUST reflect type hierarchies from the grammar in the tool palette organization

**Port-Based Connections**

- **FR-023**: System MUST render ports on node types that are defined as port-enabled in the grammar
- **FR-024**: System MUST enforce grammar-defined connection rules between ports
- **FR-025**: System MUST provide visual feedback during connection creation showing valid port targets

### Key Entities

- **Diagram Layout Cache**: Stores element positions (node ID to x,y coordinates) associated with a diagram file; supports versioning for model changes
- **Grammar Manifest**: Contains definitions of available node types, connection types, port configurations, and connection rules for a language
- **Element Properties**: Classification uses hybrid heuristic: scalar types (string, number, boolean, enum) default to properties (editable in properties panel); object/array types default to children (hierarchical relationships); grammar manifest can override classification per field
- **Port Definition**: Specifies port type, position, and allowed connection types for port-enabled nodes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diagrams open with no visible element repositioning in 100% of cases where layout cache exists
- **SC-002**: Users can complete a marquee selection operation within 1 second of initiating the gesture
- **SC-003**: Property changes made in the properties panel are reflected in the model within 500ms
- **SC-004**: Tool palette displays 100% of grammar-defined node and connection types for all registered grammars
- **SC-005**: Diagram content becomes visible within 100ms of layout completion with no intermediate visual states showing incorrect positions
- **SC-006**: Layout is preserved across 100% of close/reopen cycles for unchanged models
- **SC-007**: Outline navigation successfully selects the corresponding diagram element in 100% of clicks

## Clarifications

### Session 2026-01-25

- Q: How should the system determine whether a grammar element is a property (shown in properties panel) vs a child node (shown in outline/diagram)? → A: Hybrid approach - default to type-based heuristic (scalar types = properties, object/array types = children) with grammar manifest overrides for explicit control
- Q: When multiple diagram elements are selected, what should the properties panel display? → A: Common properties only - show properties shared by all selected elements; editing a property updates all selected elements
- Q: When the user clicks an outline item, should selection occur in both views simultaneously, or only in the currently focused view? → A: Both views - clicking outline selects element in both diagram and text editor simultaneously

## Assumptions

- The existing GLSP infrastructure supports hiding/showing diagram content programmatically
- Layout cache will be stored using Theia's storage mechanisms (file-based or workspace storage)
- Grammar manifests are already structured to include node type hierarchies
- The properties panel will integrate with Theia's existing property view infrastructure where available
- Connection rules in the grammar manifest follow a declarative format specifying valid source-target type pairs
