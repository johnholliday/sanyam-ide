---
title: "GLSP Pipeline"
description: "The three-layer request/response pipeline for diagram operations"
layout: layouts/doc.njk
eleventyNavigation:
  key: GLSP Pipeline
  parent: Architecture
  order: 4
---

The GLSP (Graphical Language Server Protocol) pipeline has three layers that requests pass through between the browser and the language server. Understanding this pipeline is critical when modifying diagram behavior.

## Overview

```
Browser (Sprotty)
  ↓ GLSP Actions
SanyamLanguageClientProvider     ← Layer 1: Browser-side proxy
  ↓ JSON-RPC
SanyamGlspBackendServiceImpl     ← Layer 2: Backend service bridge
  ↓ Direct call
GLSP Server (Language Server)    ← Layer 3: Server-side handler
  ↓ AST → GModel
ast-to-gmodel-provider
```

## Layer 1: Browser-Side Proxy

**File**: `packages/theia-extensions/glsp/src/browser/sanyam-language-client-provider.ts`

The `SanyamLanguageClientProvider` lives in the browser process. It:

1. Receives GLSP actions from the Sprotty diagram widget
2. Serializes them as JSON-RPC requests
3. Sends them over the Theia language client connection to the backend
4. Deserializes and returns the response

This layer handles the browser-to-backend communication boundary.

## Layer 2: Backend Service Bridge

**File**: `packages/theia-extensions/glsp/src/node/sanyam-glsp-backend-service.ts`

The `SanyamGlspBackendServiceImpl` runs in the Theia backend (Node.js) process. It:

1. Receives JSON-RPC requests from the language client
2. Translates them into GLSP server API calls
3. Invokes the GLSP server (which shares the same process as the language server)
4. Returns the GLSP response back through JSON-RPC

This layer bridges the Theia backend service layer with the GLSP server API.

## Layer 3: Server-Side Handler

**Files**: `packages/language-server/src/glsp/`

The GLSP server handles the actual diagram logic:

1. Parses the GLSP request
2. Accesses the Langium AST for the target document
3. Converts AST to GModel using the `ast-to-gmodel-provider`
4. Applies layout via ELK
5. Returns the GModel response

## AST-to-GModel Conversion

The `defaultAstToGModelProvider` performs a three-pass conversion:

### Pass 1: Create Nodes

For each AST node with a `diagramNode` manifest configuration:
- Creates a GModel node with the configured type, shape, CSS classes
- Calls `getLabel()` (custom or default) for the display text
- Creates ports from manifest port configuration
- Records source ranges for code-diagram mapping

### Pass 2: Determine Nesting and Edges

For each created node:
- Walks up the AST `$container` chain to find the nearest diagrammed ancestor
- If the ancestor is a container type → records parent-child nesting
- Otherwise → creates a containment edge
- Scans AST properties for cross-references and creates reference edges

### Pass 3: Nest Children

- Populates container node body compartments with their nested child nodes
- Skips body population for collapsed containers (shows header only)

## Model Type Normalization

The `SanyamModelFactory` (browser-side) normalizes grammar-specific GLSP types to base types for Sprotty view resolution:

```
node:actor     → node        (SanyamNodeView)
node:content   → node        (SanyamNodeView)
node:workflow  → node:container (SanyamContainerNodeView)
edge:flow      → edge        (SanyamEdgeView)
edge:reference → edge        (SanyamEdgeView)
```

The original type is preserved in the model element's properties for CSS targeting:

```css
/* Target specific node types via CSS */
.sanyam-node[data-node-type="node:actor"] { /* ... */ }
```

## Diagram Action Flow

### Opening a Diagram

```
1. User opens a .ecml file
2. DiagramWidget created with Sprotty container
3. SprottyDiagramManager.setModel() called
4. RequestModelAction dispatched → Layer 1 → Layer 2 → Layer 3
5. Server parses AST, runs ast-to-gmodel-provider
6. GModel returned → Layer 2 → Layer 1
7. SanyamModelFactory normalizes types
8. Sprotty renders SVG via registered views
```

### Moving a Node

```
1. User drags a node
2. MoveAction dispatched locally (Sprotty)
3. On drag end → MoveCompleteAction
4. SanyamMouseListener fires callback
5. UpdatePositionAction → Layer 1 → Layer 2 → Layer 3
6. Server updates position metadata
7. Updated model returned and re-rendered
```

### Creating a Node (from Tool Palette)

```
1. User selects tool, clicks canvas
2. CreateNodeAction → Layer 1 → Layer 2 → Layer 3
3. Server creates new AST element
4. Runs ast-to-gmodel-provider for full model
5. Returns new GModel with the created node
6. Sprotty renders updated diagram
```

## Important: Three-Layer Modification Rule

When modifying GLSP request/response types, you **must** update all three layers:

1. **`@sanyam/types`** — Define the interface changes
2. **`sanyam-language-client-provider.ts`** — Update browser-side serialization
3. **`sanyam-glsp-backend-service.ts`** — Update backend-side bridge

Missing any layer causes silent data loss or runtime errors.

> **Debugging tip**: When making GLSP changes, add a canary field to the response (e.g., `_debug: true`) and verify it arrives at the browser before making real changes. This confirms end-to-end pipeline connectivity.

## server-factory.ts is NOT Used in Theia

A common gotcha: `packages/language-server/src/glsp/server-factory.ts` contains GLSP handler registrations that are **only used in standalone mode** (direct GLSP server, not Theia). In Theia browser mode, requests go through the three-layer pipeline described above.

If you modify handlers in `server-factory.ts` and don't see changes in the browser, this is why — you need to modify the corresponding handler in the language server's GLSP provider files.

## Language Server Restart Requirement

The language server runs as a separate process. Changes to server-side code (Layer 3) require a full IDE restart — browser refresh alone is not sufficient. The language server process must be terminated and restarted.
