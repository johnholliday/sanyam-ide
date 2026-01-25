# Implementation Plan: Complete GLSP Backend Integration

**Branch**: `003-glsp-backend-integration` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-glsp-backend-integration/spec.md`

## Summary

Complete the GLSP backend integration to enable bidirectional synchronization between text and diagram views, with layout persistence. The frontend `DiagramLanguageClient` currently falls back to mock data because `SanyamLanguageClientProvider.sendRequest()` is not implemented. This plan establishes the RPC service layer connecting frontend to the unified language server's GLSP capabilities.

## Technical Context

**Language/Version**: TypeScript 5.x (per constitution)
**Primary Dependencies**: Langium 4.x, Eclipse GLSP 2.x, Eclipse Theia 1.x, Inversify 6.x
**Storage**: Theia StorageService (user profile), file-based metadata (.layout.json sidecar files)
**Testing**: Mocha/Chai (Theia standard), manual E2E testing
**Target Platform**: Electron desktop app, browser version
**Project Type**: Monorepo with frontend/backend packages
**Performance Goals**: <2s diagram load, <500ms sync updates, <200ms layout restore (per spec SC-001 through SC-010)
**Constraints**: Must work with dynamic grammar discovery, no hardcoded grammar references
**Scale/Scope**: Files up to 1000 lines, 500+ diagram elements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Grammar Agnosticism | ✅ PASS | Service routes requests by file URI; grammar lookup via registry |
| Backward Compatibility | ✅ PASS | Existing mock fallback preserved; new service is additive |
| Declarative Over Imperative | ✅ PASS | Layout persistence uses JSON manifests, not code |
| Extension Over Modification | ✅ PASS | New service bindings extend existing modules |
| TypeScript 5.x | ✅ PASS | All code in TypeScript |
| Langium 4.x | ✅ PASS | Uses existing Langium integration |
| Eclipse GLSP 2.x | ✅ PASS | Uses existing GLSP types |
| Inversify 6.x | ✅ PASS | All services injectable |
| No `any` without justification | ✅ PASS | Use proper typing throughout |
| No circular dependencies | ✅ PASS | Shared types in @sanyam/types |
| Services must be injectable | ✅ PASS | All new services use @injectable() |
| Services expose interfaces | ✅ PASS | Interface in types package, impl in backend |

## Project Structure

### Documentation (this feature)

```text
specs/003-glsp-backend-integration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (service interface definitions)
```

### Source Code (repository root)

```text
packages/
├── types/src/
│   ├── glsp-service.ts          # NEW: SanyamGlspService interface + response types
│   └── index.ts                 # Export new types
│
├── theia-extensions/glsp/
│   ├── src/browser/
│   │   ├── sanyam-language-client-provider.ts  # MODIFY: Implement sendRequest via proxy
│   │   ├── glsp-frontend-module.ts             # MODIFY: Bind service proxy
│   │   ├── diagram-widget.ts                   # MODIFY: Add layout persistence
│   │   └── layout-storage-service.ts           # NEW: Frontend layout persistence
│   │
│   └── src/node/
│       ├── sanyam-glsp-backend-service.ts      # NEW: Backend service implementation
│       └── glsp-backend-module.ts              # MODIFY: Bind service + RPC handler
│
└── language-server/src/glsp/
    └── langium-source-model-storage.ts         # MODIFY: Implement file-based metadata I/O
```

**Structure Decision**: Extends existing monorepo structure. New code in existing packages to maintain cohesion. Shared interface in @sanyam/types prevents symbol resolution issues between frontend/backend.

## Complexity Tracking

No constitution violations requiring justification.

## Implementation Phases

### Phase 1: Core RPC Infrastructure (P1 - View Diagram)

**Goal**: Replace mock data with real language server responses

1. **Define service interface** in `@sanyam/types`
   - `SanyamGlspService` interface with all GLSP operations
   - Response types: `LoadModelResponse`, `ExecuteOperationResponse`, etc.
   - Service path constant for Theia RPC

2. **Implement backend service** in `glsp/src/node/`
   - `SanyamGlspBackendServiceImpl` hosts language server
   - Initialize grammar contributions on startup
   - Route requests to appropriate GLSP providers

3. **Update backend module** bindings
   - Bind service implementation
   - Register `JsonRpcConnectionHandler` for RPC

4. **Update frontend provider**
   - Create proxy via `WebSocketConnectionProvider`
   - Implement `sendRequest()` to route to service methods

### Phase 2: Bidirectional Sync (P2/P3 - Text ↔ Diagram)

**Goal**: Enable live synchronization between text and diagram

1. **Diagram → Text sync** (P2)
   - Implement operation handlers in backend
   - Convert GModel operations to text edits
   - Apply edits via language server document management

2. **Text → Diagram sync** (P3)
   - Listen for document change notifications
   - Regenerate GModel from updated AST
   - Push updates to frontend via events

3. **Edit loop prevention** (FR-013)
   - Track edit source (text vs diagram)
   - Suppress echo updates during sync

4. **Last-edit-wins conflict resolution** (FR-014)
   - Timestamp-based ordering
   - No user prompts on conflict

### Phase 3: Multi-Grammar Support (P4)

**Goal**: Dynamic grammar discovery at runtime

1. **Grammar scanner integration**
   - Use `@sanyam/grammar-scanner` at backend startup
   - Load grammar contributions dynamically

2. **Per-grammar provider resolution**
   - Route requests to appropriate grammar's GLSP providers
   - Fall back to default providers when not specified

### Phase 4: Layout Persistence (P5)

**Goal**: Save and restore diagram layouts per file

1. **Frontend storage service**
   - Use Theia `StorageService` for user profile storage
   - Key by file URI
   - Store positions, sizes, viewport

2. **Backend metadata persistence**
   - Implement actual file I/O in `LangiumSourceModelStorage`
   - Save to `.layout.json` sidecar files
   - Load on model request

3. **Reset layout action**
   - Clear saved positions
   - Re-apply automatic layout

## Dependencies Between Phases

```
Phase 1 (P1) ─────────────────────────────────────┐
     │                                            │
     v                                            v
Phase 2 (P2/P3) ──────────────────────────> Phase 4 (P5)
     │
     v
Phase 3 (P4)
```

- Phase 1 is prerequisite for all others
- Phase 2/3 can proceed in parallel with Phase 4
- Phase 3 depends on Phase 2 (needs working sync first)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Language server initialization slow | Medium | Lazy loading, queue requests until ready |
| Edit loops between text/diagram | High | Source tracking, debouncing, loop detection |
| Large file performance | Medium | Virtualization, incremental updates |
| Symbol resolution between packages | High | Shared types package, proper exports |

## Success Metrics

From spec:
- SC-001: Diagram view loads in <2 seconds
- SC-002: Diagram updates within 500ms of text changes
- SC-004: Zero mock data when GLSP provider exists
- SC-007: Text updates within 500ms of diagram edits
- SC-009: Layout restored within 200ms
