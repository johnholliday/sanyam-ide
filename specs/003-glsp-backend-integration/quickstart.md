# Quickstart: GLSP Backend Integration

**Feature**: 003-glsp-backend-integration
**Date**: 2026-01-23

## Prerequisites

- Node.js 18+
- pnpm 8+
- Repository cloned and dependencies installed

## Development Setup

```bash
# Install dependencies
pnpm install

# Build all packages (required for types)
pnpm build:extensions

# Start in development mode
pnpm electron start
```

## Key Files to Understand

### Service Interface (read first)

```
packages/types/src/glsp-service.ts     # Service interface definition
```

### Backend Implementation

```
packages/theia-extensions/glsp/src/node/
├── sanyam-glsp-backend-service.ts     # Main service implementation
└── glsp-backend-module.ts             # Inversify bindings
```

### Frontend Integration

```
packages/theia-extensions/glsp/src/browser/
├── sanyam-language-client-provider.ts # RPC proxy consumer
├── diagram-language-client.ts         # High-level diagram API
├── diagram-widget.ts                  # UI widget
└── glsp-frontend-module.ts            # Inversify bindings
```

### Language Server GLSP

```
packages/language-server/src/glsp/
├── glsp-server.ts                     # GLSP server core
├── langium-source-model-storage.ts    # Model state management
└── providers/                         # Feature providers
    ├── ast-to-gmodel-provider.ts      # AST → GModel
    ├── gmodel-to-ast-provider.ts      # GModel → AST
    └── layout-provider.ts             # Auto-layout
```

## Testing Changes

### Manual Testing

1. **Open a .spdk file** in the IDE
2. **Open diagram view** with Ctrl+Shift+D
3. **Verify real data** appears (not mock placeholders)
4. **Edit text** and observe diagram updates
5. **Edit diagram** and observe text updates
6. **Close and reopen** to verify layout persistence

### Test File

Create `test.spdk`:

```
application MyApp {
  description "Test application"
}

entity User {
  name: string
  email: string
}

entity Order {
  id: number
  user: User
}
```

### Expected Behavior

1. Diagram shows 3 nodes: MyApp, User, Order
2. Edge from Order to User (user reference)
3. Labels show entity names
4. Text edits reflect in diagram within 500ms
5. Diagram edits reflect in text within 500ms
6. Layout persists across sessions

## Debugging

### Backend Logs

```bash
# Start with debug logging
DEBUG=sanyam:glsp:* pnpm electron start
```

### Frontend DevTools

1. Open DevTools (Ctrl+Shift+I in Electron)
2. Filter console by "GLSP" or "Diagram"
3. Check Network tab for RPC messages

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Mock data shown | Backend service not connected | Check backend module bindings |
| "Not implemented" error | sendRequest not using proxy | Verify frontend module bindings |
| Layout not persisting | Storage key mismatch | Check URI encoding |
| Edit loops | Version tracking broken | Check sync state logic |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron/Browser                        │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │ DiagramWidget  │───▶│ DiagramLanguage│                   │
│  │ (Sprotty)      │    │ Client         │                   │
│  └────────────────┘    └───────┬────────┘                   │
│                                │                            │
│                    ┌───────────▼───────────┐                │
│                    │ SanyamLanguageClient  │                │
│                    │ Provider (proxy)      │                │
│                    └───────────┬───────────┘                │
└────────────────────────────────┼────────────────────────────┘
                                 │ JSON-RPC/WebSocket
┌────────────────────────────────┼────────────────────────────┐
│                     Node.js Backend                         │
│                    ┌───────────▼───────────┐                │
│                    │ SanyamGlspBackend     │                │
│                    │ ServiceImpl           │                │
│                    └───────────┬───────────┘                │
│                                │                            │
│  ┌─────────────────────────────▼─────────────────────────┐  │
│  │              Unified Language Server                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │ GLSP Server  │  │ Langium Docs │  │ Grammar     │  │  │
│  │  │              │  │              │  │ Registry    │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

After familiarizing with the codebase:

1. Run `/speckit.tasks` to generate implementation tasks
2. Start with Phase 1 (Core RPC Infrastructure)
3. Test each phase before proceeding to next
