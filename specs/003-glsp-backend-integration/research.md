# Research: GLSP Backend Integration

**Feature**: 003-glsp-backend-integration
**Date**: 2026-01-23

## Research Questions Addressed

### 1. How should frontend-backend RPC communication be structured?

**Decision**: Use Theia's standard `JsonRpcConnectionHandler` pattern with a dedicated service path.

**Rationale**:
- Standard Theia pattern ensures compatibility with both Electron and browser deployments
- `WebSocketConnectionProvider.createProxy()` handles serialization automatically
- Single service interface covers all GLSP operations, reducing connection overhead

**Alternatives Considered**:
- **GLSP WebSocket protocol**: More complex, requires custom message handling, overkill for single-user IDE
- **VS Code commands**: Limited to request/response, no streaming, performance concerns
- **Direct language server protocol extension**: Would require LSP protocol changes, less maintainable

**Implementation Pattern**:
```typescript
// Backend: Register RPC handler
bind(ConnectionHandler).toDynamicValue(ctx =>
    new JsonRpcConnectionHandler(SanyamGlspServicePath, () =>
        ctx.container.get(SanyamGlspService)
    )
).inSingletonScope();

// Frontend: Create proxy
bind(SanyamGlspService).toDynamicValue(ctx => {
    const provider = ctx.container.get(WebSocketConnectionProvider);
    return provider.createProxy<SanyamGlspService>(SanyamGlspServicePath);
}).inSingletonScope();
```

### 2. Where should the service interface be defined?

**Decision**: Define interface and symbol in `@sanyam/types` package.

**Rationale**:
- Prevents Inversify symbol mismatch between frontend and backend
- Types package has no runtime dependencies
- Already contains GLSP-related types (`GModelRoot`, `GlspContext`, etc.)

**Alternatives Considered**:
- **Separate common package**: Additional package to maintain
- **Duplicate in each package**: Symbol mismatch issues
- **Backend exports, frontend imports**: Circular dependency risk

### 3. How should the backend service initialize?

**Decision**: Lazy initialization with request queuing.

**Rationale**:
- Language server initialization can take 2-5 seconds
- Users may open diagrams before server is ready
- Queue ensures no lost requests

**Implementation Pattern**:
```typescript
@injectable()
class SanyamGlspBackendServiceImpl {
    private initialized = false;
    private pendingRequests: Array<() => void> = [];

    @postConstruct()
    protected async initialize(): Promise<void> {
        await this.loadGrammarContributions();
        this.initialized = true;
        this.pendingRequests.forEach(resolve => resolve());
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;
        return new Promise(resolve => this.pendingRequests.push(resolve));
    }
}
```

### 4. How should edit loops be prevented during bidirectional sync?

**Decision**: Source tracking with version-based suppression.

**Rationale**:
- Simple boolean flag insufficient (race conditions)
- Version numbers allow precise tracking
- Works with last-edit-wins conflict resolution

**Implementation Pattern**:
```typescript
interface SyncState {
    lastTextVersion: number;
    lastDiagramVersion: number;
    suppressTextUpdates: boolean;
    suppressDiagramUpdates: boolean;
}

// When diagram edit occurs:
syncState.suppressTextUpdates = true;
await applyTextEdit(edit);
syncState.lastTextVersion = document.version;
syncState.suppressTextUpdates = false;

// When text change notification arrives:
if (syncState.suppressTextUpdates && document.version === syncState.lastTextVersion) {
    return; // Skip echo update
}
```

### 5. Where should diagram layouts be persisted?

**Decision**: Dual storage - Theia StorageService (user profile) primary, .layout.json sidecar optional.

**Rationale**:
- User profile storage is reliable, survives file moves within workspace
- Sidecar files useful for sharing layouts (team collaboration future)
- URI-keyed storage aligns with spec requirement

**Storage Schema**:
```typescript
interface PersistedLayout {
    version: 1;
    fileUri: string;
    timestamp: number;
    positions: Record<string, { x: number; y: number }>;
    sizes: Record<string, { width: number; height: number }>;
    viewport?: { scroll: { x: number; y: number }; zoom: number };
}
```

**Storage Key Format**: `sanyam.diagram.layout.${encodeURIComponent(fileUri)}`

### 6. How should grammar contributions be discovered at runtime?

**Decision**: Use existing `@sanyam/grammar-scanner` package.

**Rationale**:
- Already implemented for language server startup
- Scans workspace for `sanyam.contribution` in package.json
- Returns `LanguageContribution[]` ready for use

**Integration Point**:
```typescript
async loadGrammarContributions(): Promise<void> {
    const scanResult = await scanForGrammarPackages({
        workspaceRoot: this.getWorkspaceRoot(),
    });

    for (const pkg of scanResult.packages) {
        const module = await import(pkg.contributionPath);
        this.contributions.set(pkg.languageId, module.contribution);
    }
}
```

### 7. How should the backend access the language server?

**Decision**: Direct instantiation in backend service (not LSP protocol).

**Rationale**:
- Backend runs in same Node.js process as language server
- No need for protocol overhead
- Direct access to AST, documents, GLSP providers

**Alternatives Considered**:
- **LSP client-server**: Unnecessary complexity for in-process communication
- **Shared singleton**: Already how Theia backend works
- **Microservice architecture**: Overkill for desktop IDE

## Existing Code Analysis

### Current Frontend State

| File | Status | Notes |
|------|--------|-------|
| `diagram-language-client.ts` | Ready | Has mock fallback, needs real data |
| `sanyam-language-client-provider.ts` | Stub | `sendRequest()` throws "not implemented" |
| `glsp-frontend-module.ts` | Ready | Bindings in place |
| `diagram-widget.ts` | Ready | Has `DiagramState` interface |

### Current Backend State

| File | Status | Notes |
|------|--------|-------|
| `sanyam-glsp-server-contribution.ts` | Stub | Only logs, doesn't process |
| `glsp-backend-module.ts` | Ready | Basic bindings in place |
| `langium-source-model-storage.ts` | Partial | Has metadata cache, no file I/O |

### Existing Types (in @sanyam/types)

| Type | Location | Notes |
|------|----------|-------|
| `GModelRoot`, `GNode`, `GEdge` | glsp-providers.ts | Complete |
| `ModelMetadata` | glsp-providers.ts | Has positions, sizes, routing |
| `GlspContext` | glsp-providers.ts | Complete |
| `GlspFeatureProviders` | glsp-providers.ts | Extensible interface |

## Technology Decisions Summary

| Area | Decision | Constitution Compliance |
|------|----------|------------------------|
| RPC | JsonRpcConnectionHandler | ✅ Standard Theia pattern |
| Interface location | @sanyam/types | ✅ No circular deps |
| Initialization | Lazy with queue | ✅ Graceful degradation |
| Loop prevention | Version-based tracking | ✅ Fail fast pattern |
| Layout storage | Theia StorageService | ✅ User profile per spec |
| Grammar discovery | @sanyam/grammar-scanner | ✅ Grammar agnostic |
| Backend LS access | Direct instantiation | ✅ In-process, no `any` |
