# Feature Specification: Diagram Editor UX Improvements

**Feature Branch**: `005-diagram-editor-ux`
**Created**: 2026-02-02
**Status**: Draft
**Input**: User description: "The IDE should remember the most recent composite editor layout automatically without prompting the user. Later, we can have a preferences option whether to save the layout automatically or not. The layout must include the diagram zoom level and the current state of all of the toggles. The default zoom level for the diagram should be set at 50%. Move the diagram toolbar from the composite editor window to the diagram view itself so that the diagramming tools appear at the top of the diagram editor (closer to the diagram). Node shapes should expand to accommodate their word-wrapped labels, which should not include double quotes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Layout Persistence (Priority: P1)

A user opens a grammar file in the composite editor, arranges the text and diagram panels side-by-side at their preferred split ratio, adjusts the diagram zoom to a comfortable level, and enables snap-to-grid. They close the file and reopen it later. The IDE automatically restores the exact layout they left — panel arrangement, zoom level, and all toggle states — without any save prompt or manual action.

**Why this priority**: Layout persistence is the core quality-of-life improvement. Losing layout state on every close forces users to repeatedly reconfigure their workspace, which is the most disruptive friction in the current experience.

**Independent Test**: Can be fully tested by opening a file, adjusting layout/zoom/toggles, closing, and reopening — the restored state should match exactly.

**Acceptance Scenarios**:

1. **Given** a user has a composite editor open with a custom split ratio, zoom at 75%, and snap-to-grid enabled, **When** they close and reopen the same file, **Then** the split ratio, zoom level, and snap-to-grid state are all restored.
2. **Given** a user has two different grammar files each with distinct layouts, **When** they switch between them, **Then** each file restores its own independent layout state.
3. **Given** a user opens a grammar file for the first time (no saved layout), **When** the diagram view loads, **Then** the default zoom level is 50% and all toggles are at their default states.

---

### User Story 2 - Diagram Toolbar Relocation (Priority: P2)

A user opens the composite editor and switches to the diagram view. The diagramming tools (zoom, layout, edge routing, toggles) appear directly above the diagram canvas as an embedded toolbar, rather than in the distant composite editor window's tab bar. This makes the tools more discoverable and quicker to reach while working with the diagram.

**Why this priority**: Toolbar proximity to the diagram reduces mouse travel and cognitive distance. It makes diagram-specific tools feel native to the diagram rather than borrowed from the editor frame.

**Independent Test**: Can be tested by opening any grammar file in the composite editor, switching to diagram view, and verifying the toolbar renders at the top of the diagram panel.

**Acceptance Scenarios**:

1. **Given** a user has the composite editor open with the diagram view active, **When** they look at the diagram panel, **Then** a toolbar with zoom, layout, edge routing, and toggle controls appears at the top of the diagram view.
2. **Given** a user switches from text view to diagram view in the composite editor, **When** the diagram becomes active, **Then** the toolbar is visible within the diagram panel (not in the composite editor's tab bar).
3. **Given** a user has the diagram open in standalone mode (not composite), **When** viewing the diagram, **Then** the same toolbar appears at the top of the diagram view.

---

### User Story 3 - Node Label Display Improvements (Priority: P3)

A user creates a grammar model with entities that have long names. The diagram renders each node with its label word-wrapped to fit, and the node shape automatically expands vertically to accommodate the full label text. Labels do not display surrounding double quotes — only the meaningful text content appears.

**Why this priority**: Label readability directly affects the usability of the diagram as a visual representation. Truncated labels or extraneous quotes reduce the diagram's value as a communication tool.

**Independent Test**: Can be tested by creating a model with long entity names and verifying node shapes expand and labels render without double quotes.

**Acceptance Scenarios**:

1. **Given** a model entity with a name longer than the default node width, **When** the diagram renders, **Then** the label text is word-wrapped and the node shape expands vertically to show the full label.
2. **Given** a model entity whose name is stored with surrounding double quotes in the grammar (e.g., `"Finance Review"`), **When** the diagram renders, **Then** the label displays `Finance Review` without quotes.
3. **Given** a node with a short name, **When** the diagram renders, **Then** the node maintains its default minimum size and the label is displayed on a single line.

---

### User Story 4 - Default Zoom Level at 50% (Priority: P1)

When a user opens a diagram for the first time (no previously saved layout), the diagram renders at 50% zoom level instead of the current 100% default. This provides a better overview of the full model, especially for complex grammars with many elements.

**Why this priority**: The default zoom level directly impacts first-open experience for every user and every file. Getting this right is a one-line change with outsized impact on usability.

**Independent Test**: Can be tested by deleting any cached layout for a file and reopening — the diagram should render at 50% zoom.

**Acceptance Scenarios**:

1. **Given** a user opens a grammar file with no previously saved layout, **When** the diagram loads, **Then** the zoom level is 50%.
2. **Given** a user has a saved layout with zoom at 75%, **When** they reopen the file, **Then** the zoom level is 75% (saved state overrides default).

---

### Edge Cases

- What happens when a saved layout references toggle states that no longer exist (e.g., a toggle was removed in an update)? Unknown toggles should be silently ignored during restoration.
- What happens when the saved zoom level is outside the current min/max bounds? The zoom should be clamped to the valid range.
- What happens when the composite editor window is resized after layout restore? The split ratio should be maintained proportionally.
- What happens when layout storage is corrupted or unreadable? The system should fall back to defaults (50% zoom, default toggles) without errors.
- What happens to the toolbar when the diagram panel is very narrow? The toolbar should remain functional, wrapping or showing overflow controls as needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically persist the composite editor layout (panel arrangement, split ratio) when a file is closed, without prompting the user.
- **FR-002**: System MUST automatically persist the diagram zoom level as part of the layout state for each file.
- **FR-003**: System MUST automatically persist the state of all diagram toggles (snap-to-grid, minimap, arrowheads, edge jumps, edge routing mode) as part of the layout state.
- **FR-004**: System MUST restore all persisted layout state (panels, zoom, toggles) when the same file is reopened.
- **FR-005**: System MUST use 50% (0.5) as the default zoom level when no saved layout exists for a file.
- **FR-006**: System MUST render the diagram toolbar (zoom, layout, edge routing, and toggle controls) within the diagram view panel, at the top of the diagram area.
- **FR-007**: System MUST remove the diagram toolbar items from the composite editor's tab bar area when the toolbar is rendered within the diagram view.
- **FR-008**: Node shapes MUST expand vertically to accommodate word-wrapped label text.
- **FR-009**: Node labels MUST NOT display surrounding double quotes — only the inner text content.
- **FR-010**: Layout state MUST be stored per-file (each grammar file has its own independent layout).
- **FR-011**: System MUST gracefully handle corrupted or missing layout data by falling back to default values.

### Key Entities

- **Layout State**: Per-file record containing panel arrangement, split ratio, diagram zoom level, and toggle states. Keyed by file URI.
- **Toggle State**: Named boolean or enum value representing the on/off state of a diagram feature (snap-to-grid, minimap, arrowheads, edge jumps, edge routing mode).

### Assumptions

- The "preferences option for auto-save layout" is deferred to a later iteration. This spec covers the always-on automatic persistence behavior.
- The toolbar relocation applies to the diagram panel specifically — the composite editor's tab bar may still show non-diagram controls (e.g., text editor actions).
- Word wrapping uses space-based line breaking (not hyphenation).
- "Double quotes" refers to literal `"` characters that may appear in label text from the grammar's string representation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can close and reopen a grammar file and see their exact previous layout (panels, zoom, toggles) restored with zero manual reconfiguration.
- **SC-002**: The diagram toolbar is visually located within the diagram panel, reducing the distance between diagram tools and the diagram canvas.
- **SC-003**: New files open with a 50% zoom level, providing an overview of the full model on first open.
- **SC-004**: Node labels with long text display fully (word-wrapped) without truncation, and without double quotes.
- **SC-005**: Layout persistence operates transparently — no save prompts, no user action required beyond normal file open/close workflow.
