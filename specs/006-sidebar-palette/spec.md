# Feature Specification: Sidebar Element Palette

**Feature Branch**: `006-sidebar-palette`
**Created**: 2026-02-05
**Status**: Draft
**Input**: User description: "Instead of an overlay palette, implement element creation as a Theia sidebar view or VS Code webview panel that lives in the IDE's panel system. This separates the palette from the canvas entirely, avoids the overlay confusion, and allows richer UI (thumbnails, categories, drag-and-drop onto the editor). Wire up a canvas double-click handler that opens a quick-pick or mini-menu at the click position. This is how tools like Miro and FigJam work — very low friction. Ditch the default floating palette entirely"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Element via Sidebar Drag-and-Drop (Priority: P1)

A diagram author wants to add a new element to their diagram. They browse the element palette in the sidebar, find the element type they need (organized by category with thumbnails), and drag it onto the diagram canvas. The element is created at the drop location.

**Why this priority**: This is the primary interaction pattern replacing the overlay palette. It provides discoverability, rich previews, and familiar IDE workflow. Users spend significant time browsing available elements, so a dedicated sidebar panel improves this experience dramatically.

**Independent Test**: Can be fully tested by opening a diagram, dragging an element type from the sidebar, and verifying it appears at the drop position. Delivers immediate value for element creation workflow.

**Acceptance Scenarios**:

1. **Given** a diagram is open in the editor, **When** the user opens the Element Palette sidebar view, **Then** they see categorized element types with visual thumbnails
2. **Given** the Element Palette sidebar is visible, **When** the user drags an element type onto the diagram canvas, **Then** a new element of that type is created at the drop position
3. **Given** the user is dragging an element from the sidebar, **When** they hover over the canvas, **Then** they see a visual preview indicating where the element will be placed
4. **Given** the user drops an element on an invalid area (outside canvas bounds), **When** the drop completes, **Then** no element is created and the user sees appropriate feedback

---

### User Story 2 - Create Element via Double-Click Quick Menu (Priority: P1)

A diagram author working on the canvas wants to quickly add an element without leaving their current view. They double-click on an empty area of the canvas, and a contextual quick-pick menu appears at that position showing available element types. They select an element type and it's created at that location.

**Why this priority**: This is the low-friction creation method inspired by Miro/FigJam. It keeps users in their flow state without requiring them to shift focus to a sidebar. Equal priority to sidebar because it serves different use cases (quick vs. browsing).

**Independent Test**: Can be fully tested by double-clicking on canvas, selecting from the menu, and verifying element creation. Delivers immediate value for rapid element creation.

**Acceptance Scenarios**:

1. **Given** a diagram is open and focused, **When** the user double-clicks on an empty area of the canvas, **Then** a quick-pick menu appears at the click position showing available element types
2. **Given** the quick-pick menu is open, **When** the user selects an element type, **Then** a new element of that type is created at the click position and the menu closes
3. **Given** the quick-pick menu is open, **When** the user presses Escape or clicks outside the menu, **Then** the menu closes without creating an element
4. **Given** the user double-clicks on an existing element, **When** the click is detected, **Then** no quick-pick menu appears (element-specific behavior takes precedence)

---

### User Story 3 - Browse Elements by Category (Priority: P2)

A diagram author is learning what elements are available in their grammar. They open the Element Palette sidebar and explore different categories (nodes, connections, containers, etc.). Each category can be expanded/collapsed, and elements show thumbnails and descriptions.

**Why this priority**: Supports discoverability and learning. Less critical than creation itself but important for new users and complex grammars with many element types.

**Independent Test**: Can be fully tested by opening the sidebar and navigating through categories. Delivers value for learning and exploration.

**Acceptance Scenarios**:

1. **Given** the Element Palette sidebar is open, **When** the user views the panel, **Then** they see elements organized into collapsible categories
2. **Given** a category is collapsed, **When** the user clicks the category header, **Then** it expands to show its element types
3. **Given** an element type is visible, **When** the user hovers over it, **Then** they see a tooltip with the element's description

---

### User Story 4 - Search Elements in Sidebar (Priority: P2)

A diagram author knows roughly what element they want but can't remember its exact name or category. They type in the search box at the top of the Element Palette sidebar, and the list filters to show matching elements across all categories.

**Why this priority**: Improves efficiency for users familiar with element names. Secondary to visual browsing but valuable for power users.

**Independent Test**: Can be fully tested by typing a search term and verifying filtered results. Delivers value for quick element lookup.

**Acceptance Scenarios**:

1. **Given** the Element Palette sidebar is open, **When** the user types in the search box, **Then** the element list filters to show only elements matching the search term
2. **Given** a search filter is active, **When** the user clears the search box, **Then** all elements are shown again organized by category
3. **Given** a search term matches no elements, **When** the search completes, **Then** the user sees an empty state message

---

### User Story 5 - Quick Menu Keyboard Navigation (Priority: P3)

A keyboard-focused user opens the quick-pick menu via double-click (or keyboard shortcut) and navigates through options using arrow keys, filtering by typing, and selecting with Enter.

**Why this priority**: Enhances accessibility and power-user efficiency. Core functionality works without this but keyboard support improves usability.

**Independent Test**: Can be fully tested by navigating the quick menu using only keyboard. Delivers value for accessibility compliance.

**Acceptance Scenarios**:

1. **Given** the quick-pick menu is open, **When** the user presses Up/Down arrow keys, **Then** the selection moves through the element options
2. **Given** the quick-pick menu is open, **When** the user types characters, **Then** the options filter to match the typed text
3. **Given** an option is selected in the quick-pick menu, **When** the user presses Enter, **Then** that element type is created

---

### Edge Cases

- What happens when the sidebar is hidden/collapsed while a drag operation is in progress?
  - The drag operation should complete normally if the user drops on the canvas; cancel if dropped elsewhere
- How does the system handle grammars with no creatable elements?
  - Both sidebar and quick menu should show an informative empty state
- What happens if double-click conflicts with existing element behavior (e.g., double-click to edit label)?
  - Double-click on empty canvas areas triggers quick menu; double-click on elements follows element-specific behavior
- What happens when the user double-clicks during a drag operation?
  - Double-click should be ignored while another operation is in progress
- How does the feature behave when multiple diagrams are open?
  - Each diagram has its own context; sidebar reflects the currently active diagram's grammar

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an Element Palette view that integrates with the IDE's sidebar/panel system
- **FR-002**: System MUST display available element types organized by categories with visual thumbnails
- **FR-003**: System MUST support drag-and-drop from the sidebar palette onto the diagram canvas
- **FR-004**: System MUST show a visual drop preview indicator when dragging elements over the canvas
- **FR-005**: System MUST create elements at the precise drop location when drag-and-drop completes
- **FR-006**: System MUST provide a double-click handler on empty canvas areas that opens a quick-pick menu
- **FR-007**: System MUST position the quick-pick menu at the double-click location
- **FR-008**: System MUST create the selected element at the original click position when a menu option is chosen
- **FR-009**: System MUST close the quick-pick menu when the user presses Escape or clicks outside
- **FR-010**: System MUST support keyboard navigation (arrow keys, type-to-filter, Enter to select) in the quick-pick menu
- **FR-011**: System MUST provide a search/filter capability in the sidebar palette
- **FR-012**: System MUST remove or disable the default floating overlay palette
- **FR-013**: System MUST populate element types dynamically based on the active diagram's grammar
- **FR-014**: System MUST display appropriate empty states when no elements are available
- **FR-015**: System MUST distinguish between double-clicks on empty canvas vs. existing elements

### Key Entities

- **Element Type**: A creatable diagram element defined by the grammar, with name, category, description, and visual representation (thumbnail/icon)
- **Category**: A grouping of related element types for organizational purposes (e.g., "Nodes", "Connections", "Containers")
- **Element Palette**: The sidebar view containing categorized, searchable element types
- **Quick-Pick Menu**: The contextual popup menu that appears on canvas double-click

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new element via drag-and-drop in under 3 seconds (from sidebar open to element on canvas)
- **SC-002**: Users can create a new element via double-click quick menu in under 2 seconds
- **SC-003**: 100% of grammar-defined element types appear in both the sidebar palette and quick-pick menu
- **SC-004**: The quick-pick menu appears within 200ms of double-click (perceived as instant)
- **SC-005**: Drag preview feedback is visible within 100ms of starting a drag operation
- **SC-006**: Users can find a specific element using search in under 5 seconds for grammars with 20+ element types
- **SC-007**: The floating overlay palette is completely removed from the diagram editing experience
- **SC-008**: Keyboard-only users can create elements without using a mouse (via quick menu with keyboard navigation)

## Assumptions

- The existing grammar manifest system provides element type metadata (name, description, category) needed for the palette
- Theia's sidebar view API supports the required drag-and-drop functionality
- The GLSP/Sprotty diagram system supports programmatic element creation at specific coordinates
- Element thumbnails can be generated or provided as part of grammar configuration
- The quick-pick menu can be positioned absolutely relative to the diagram viewport
