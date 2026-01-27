# Implementation Plan: Diagram Editor UX Polish

**Branch**: `004-diagram-ux-polish` | **Date**: 2026-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-diagram-ux-polish/spec.md`

## Summary

This feature addresses 8 diagram editor UX improvements: smooth layout restoration on open, layout persistence, marquee selection, properties panel, document outline, snap-to-grid, grammar-driven tool palette, and port-based connections. The implementation builds on the existing GLSP infrastructure in `packages/theia-extensions/glsp/` and `packages/language-server/src/glsp/`, extending the current layout storage service, enhancing the marquee selection tool, and adding new Theia contributions.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2017 target, strict mode)
**Primary Dependencies**: Eclipse GLSP 2.x, Eclipse Theia 1.67.0, Sprotty 1.4.0, Langium 4.x, Inversify 6.x, React 18.x
**Storage**: Theia StorageService (existing layout-storage-service.ts), file-based sidecar (.layout.json considered for export)
**Testing**: Mocha + Chai (existing test infrastructure)
**Target Platform**: Electron desktop app, Browser version
**Project Type**: Monorepo - Theia extension packages
**Performance Goals**: Layout restore <100ms, Tool palette generation <50ms, Property panel render <100ms (per constitution)
**Constraints**: Grammar-agnostic (all behavior driven by GrammarManifest), no hard-coded AST types
**Scale/Scope**: Support diagrams with 100+ nodes, multiple grammar packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Grammar Agnosticism | ✅ Pass | All node/edge types from GrammarManifest; property/child classification via manifest overrides |
| Backward Compatibility | ✅ Pass | Extends existing services; no breaking changes to DiagramWidget API |
| Declarative Over Imperative | ✅ Pass | Tool palette, port config, connection rules all manifest-driven |
| Extension Over Modification | ✅ Pass | New contributions extend Theia; providers follow existing patterns |
| TypeScript Standards | ✅ Pass | Explicit return types, JSDoc, no `any` without justification |
| Inversify DI | ✅ Pass | All services injectable; singleton scope where appropriate |
| Performance Requirements | ✅ Pass | Targets align with constitution metrics |
| Accessibility | ⚠️ Check | Properties panel must have proper labels/keyboard nav |

**Gate Result**: PASS - proceed with implementation

## Project Structure

### Documentation (this feature)

```text
specs/004-diagram-ux-polish/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/           # Phase 1 API contracts
│   ├── layout-cache.ts
│   ├── properties-panel.ts
│   └── port-definitions.ts
└── tasks.md             # Phase 2 task breakdown (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── types/src/
│   ├── grammar-manifest.ts      # Extend with port definitions, property overrides
│   └── glsp-service.ts          # Add property extraction service types
│
├── theia-extensions/glsp/src/browser/
│   ├── diagram-widget.ts                 # Enhance layout restore flow
│   ├── layout-storage-service.ts         # Already exists - extend if needed
│   ├── ui-extensions/
│   │   ├── selection/
│   │   │   └── marquee-selection-tool.ts # Enhance trigger (Ctrl+Drag on canvas)
│   │   ├── tool-palette/
│   │   │   └── tool-palette-ui-extension.ts # Grammar-driven population
│   │   └── snap-to-grid/                 # NEW: Snap-to-grid extension
│   │       ├── index.ts
│   │       ├── snap-grid-tool.ts
│   │       └── snap-grid-actions.ts
│   ├── properties/                       # NEW: Properties panel
│   │   ├── index.ts
│   │   ├── properties-panel-widget.ts    # Theia widget
│   │   ├── properties-panel-contribution.ts
│   │   ├── property-form.tsx             # React form component
│   │   └── property-utils.ts             # Property/child classification
│   └── ports/                            # NEW: Port rendering
│       ├── index.ts
│       ├── port-view.ts                  # Sprotty view for ports
│       └── port-connection-rules.ts
│
├── language-server/src/
│   ├── glsp/providers/
│   │   ├── tool-palette-provider.ts      # Enhance with manifest hierarchy
│   │   └── property-provider.ts          # NEW: Extract properties from AST
│   └── lsp/providers/
│       └── document-symbol-provider.ts   # Already provides outline - enhance
│
└── ide/product/src/                       # Theia contribution registration
    └── browser/
        └── sanyam-ide-frontend-module.ts # Register properties panel
```

**Structure Decision**: Extending existing monorepo structure. New components (properties panel, snap-to-grid, ports) follow established patterns in `packages/theia-extensions/glsp/`.

## Complexity Tracking

No constitution violations requiring justification. All components use standard patterns.

---

## Phase 0: Research Findings

### R1: Layout Restore Without Flicker

**Decision**: Use CSS visibility + opacity transitions with pre-positioned elements

**Rationale**: The existing `diagram-widget.ts` already implements `layout-pending` class pattern (lines 674-766). The issue is that auto-layout runs even when saved positions exist. Solution:
1. Load saved layout BEFORE setting model
2. Apply positions to GModel during `convertToSprottyModel`
3. Skip auto-layout when saved positions cover all elements
4. Use existing CSS transition mechanism for reveal

**Alternatives Considered**:
- Render off-screen canvas first: Rejected - complex, potential flickering during transfer
- Delay render until layout complete: Already implemented but needs enhancement

### R2: Marquee Selection Trigger

**Decision**: Ctrl+Drag on empty canvas (not on element)

**Rationale**: The existing `marquee-selection-tool.ts` has the selection logic. Current issue is activation - it's enabled via `EnableMarqueeSelectAction`. For Ctrl+Drag:
1. Add mouse listener to Sprotty canvas
2. On mousedown+Ctrl on empty space → enable marquee mode
3. Existing logic handles the rest

**Alternatives Considered**:
- Dedicated marquee tool button: Rejected - less intuitive than standard Ctrl+Drag
- Shift+Drag: Rejected - conflicts with Shift-click extend selection pattern

### R3: Properties Panel Architecture

**Decision**: Theia widget with React form, grammar-driven property detection

**Rationale**: Theia has established widget patterns. React 18.x is in constitution. Property vs child classification:
1. Default heuristic: scalar types (string, number, boolean, enum) = properties
2. Manifest override: `propertyOverrides` field in GrammarManifest
3. Multi-select: Show intersection of common properties

**Alternatives Considered**:
- Web components: Rejected - React already in use, better ecosystem
- Monaco-based property editor: Rejected - overkill for simple forms

### R4: Document Outline Integration

**Decision**: Leverage existing LSP DocumentSymbol provider, enhance for diagram selection sync

**Rationale**: `document-symbol-provider.ts` already provides outline. Need to add:
1. Selection sync: When outline item clicked → select in diagram AND text editor
2. Bidirectional: Diagram selection → highlight outline item

**Alternatives Considered**:
- Custom outline view: Rejected - duplication of LSP functionality
- GLSP-specific outline: Rejected - break text/diagram unification

### R5: Snap-to-Grid Implementation

**Decision**: Sprotty ISnapper implementation with configurable grid size

**Rationale**: Sprotty has built-in snap support via `ISnapper` interface. Need:
1. Create `GridSnapper` that rounds to grid coordinates
2. Toolbar toggle to enable/disable
3. Persist preference in Theia settings

**Alternatives Considered**:
- Post-move adjustment: Rejected - janky UX
- Client-side only snap: Using Sprotty's server-coordinated approach

### R6: Grammar-Driven Tool Palette

**Decision**: Extend `tool-palette-provider.ts` to use full manifest hierarchy

**Rationale**: Current implementation has fallback defaults. Need to:
1. Read `rootTypes[].diagramNode` for all node types
2. Read `diagramTypes[].nodeTypes` and `edgeTypes` for visibility
3. Reflect AST type hierarchy from grammar

**Alternatives Considered**:
- Static palette per grammar: Rejected - against grammar-agnostic principle

### R7: Port-Based Connections

**Decision**: Extend GrammarManifest with port definitions, Sprotty SPort rendering

**Rationale**: Sprotty has native port support. Need:
1. Add `ports` field to `DiagramNodeConfig` in manifest
2. Create port views in Sprotty DI config
3. Validate connections against manifest rules

**Alternatives Considered**:
- Edge routing to node edges: Rejected - less semantic than explicit ports

---

## Phase 1: Data Model

### Layout Cache Schema (existing - no changes needed)

```typescript
// Already defined in layout-storage-service.ts
interface DiagramLayout {
  version: 1;
  uri: string;
  timestamp: number;
  elements: Record<string, ElementLayout>;
}

interface ElementLayout {
  position: { x: number; y: number };
  size?: { width: number; height: number };
}
```

### GrammarManifest Extensions

```typescript
// Additions to @sanyam/types/grammar-manifest.ts

/**
 * Port configuration for a node type.
 */
export interface PortConfig {
  /** Port identifier (unique within node) */
  readonly id: string;
  /** Port display label */
  readonly label?: string;
  /** Port position on node: 'top' | 'bottom' | 'left' | 'right' */
  readonly position: 'top' | 'bottom' | 'left' | 'right';
  /** Offset from center of edge (0-1, 0.5 = center) */
  readonly offset?: number;
  /** Allowed connection types (edge glspTypes) */
  readonly allowedConnections?: readonly string[];
  /** Port visual style */
  readonly style?: 'circle' | 'square' | 'diamond';
}

/**
 * Connection rule between ports.
 */
export interface ConnectionRule {
  /** Source node glspType */
  readonly sourceType: string;
  /** Source port ID (or '*' for any) */
  readonly sourcePort?: string;
  /** Target node glspType */
  readonly targetType: string;
  /** Target port ID (or '*' for any) */
  readonly targetPort?: string;
  /** Edge glspType to create */
  readonly edgeType: string;
}

/**
 * Property classification override.
 */
export interface PropertyOverride {
  /** AST property name */
  readonly property: string;
  /** Override classification */
  readonly classification: 'property' | 'child';
}

// Extensions to existing interfaces
export interface DiagramNodeConfig {
  // ... existing fields ...

  /** Port definitions for this node type */
  readonly ports?: readonly PortConfig[];
}

export interface DiagramTypeConfig {
  // ... existing fields ...

  /** Connection rules for this diagram type */
  readonly connectionRules?: readonly ConnectionRule[];

  /** Property classification overrides */
  readonly propertyOverrides?: readonly PropertyOverride[];
}
```

### Properties Panel Service Interface

```typescript
// packages/types/src/properties-service.ts

/**
 * Property descriptor for display in properties panel.
 */
export interface PropertyDescriptor {
  /** Property name */
  readonly name: string;
  /** Display label */
  readonly label: string;
  /** Property type */
  readonly type: 'string' | 'number' | 'boolean' | 'enum' | 'reference';
  /** Current value */
  readonly value: unknown;
  /** For enum type: available options */
  readonly options?: readonly string[];
  /** Whether property is read-only */
  readonly readOnly?: boolean;
  /** Validation rules */
  readonly validation?: {
    readonly required?: boolean;
    readonly pattern?: string;
    readonly min?: number;
    readonly max?: number;
  };
}

/**
 * Properties extraction result.
 */
export interface PropertiesResult {
  /** Element ID(s) being inspected */
  readonly elementIds: string[];
  /** Available properties */
  readonly properties: readonly PropertyDescriptor[];
  /** Element type label */
  readonly typeLabel: string;
}

/**
 * Property update request.
 */
export interface PropertyUpdateRequest {
  /** URI of the document */
  readonly uri: string;
  /** Element ID(s) to update */
  readonly elementIds: string[];
  /** Property name */
  readonly property: string;
  /** New value */
  readonly value: unknown;
}
```

### Snap-to-Grid Configuration

```typescript
// packages/theia-extensions/glsp/src/browser/ui-extensions/snap-to-grid/snap-grid-types.ts

export interface SnapGridConfig {
  /** Grid enabled */
  enabled: boolean;
  /** Grid cell size in pixels */
  gridSize: number;
  /** Show grid lines (visual feedback) */
  showGrid: boolean;
}

export const DEFAULT_SNAP_GRID_CONFIG: SnapGridConfig = {
  enabled: false,
  gridSize: 20,
  showGrid: false,
};
```

---

## Phase 1: Contracts

See `contracts/` directory for full API definitions:

- `contracts/layout-cache.ts` - Layout persistence API
- `contracts/properties-panel.ts` - Properties service API
- `contracts/port-definitions.ts` - Port and connection rule types

---

## Quickstart Guide

### Testing Layout Restore

1. Open a diagram file (e.g., `.ecml` with diagramming enabled)
2. Arrange nodes manually
3. Close the diagram tab
4. Reopen the file → nodes should appear in saved positions without jumping

### Testing Marquee Selection

1. Open a diagram with multiple nodes
2. Hold Ctrl and click on empty canvas space
3. Drag to draw selection rectangle
4. Release → enclosed elements should be selected

### Testing Properties Panel

1. Open View → Properties (or use command palette)
2. Select a diagram element
3. Properties panel shows editable fields
4. Modify a value → model updates

### Testing Snap-to-Grid

1. Click the grid icon in diagram toolbar
2. Drag a node → it should snap to grid intersections
3. Toggle off → free movement resumes

---

## Implementation Priorities

Based on spec priorities (P1 > P2 > P3):

**Phase A (P1 - Critical)**:
1. Layout restore without flicker (User Stories 1, 2)
2. Layout persistence (already exists, enhance)

**Phase B (P2 - Important)**:
3. Marquee selection (User Story 3)
4. Properties panel (User Story 4)
5. Document outline sync (User Story 5)

**Phase C (P3 - Enhancement)**:
6. Snap-to-grid (User Story 6)
7. Grammar-driven tool palette (User Story 7)
8. Port-based connections (User Story 8)

---

## Agent Context Update

Run after completing Phase 1:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This updates CLAUDE.md with:
- New packages: `@sanyam-ide/properties-panel`
- Technologies: React form handling, Sprotty ISnapper
- Active features: 004-diagram-ux-polish
