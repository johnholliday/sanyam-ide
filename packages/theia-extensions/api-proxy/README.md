# @sanyam/theia-api-proxy

Theia backend extension that proxies `/api/*` requests to the language server's embedded REST gateway.

## Purpose

Enables accessing the Grammar API through the same port as the IDE:

```
http://localhost:3002/api/v1/ecml/operations/generate-powershell
         └── IDE port ──┘    └── proxied to language server ──┘
```

## Installation

### 1. Copy to your extensions directory

```bash
cp -r api-proxy-extension packages/theia-extensions/api-proxy
```

### 2. Add to workspace

Add to your root `pnpm-workspace.yaml` if not already covered by glob:

```yaml
packages:
  - 'packages/theia-extensions/*'
```

### 3. Add dependency to browser-app

```bash
cd packages/browser-app
pnpm add @sanyam/theia-api-proxy@workspace:*
```

### 4. Rebuild

```bash
pnpm build
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SANYAM_API_PORT` | `3001` | Port where language server REST gateway listens |
| `NODE_ENV` | — | Set to `development` for proxy debug logging |

## Endpoints Proxied

| Path | Target |
|------|--------|
| `/api/*` | `http://localhost:3001/api/*` |
| `/health` | `http://localhost:3001/health` |
| `/ready` | `http://localhost:3001/ready` |

## Usage

After integration, access API operations via the IDE port:

```bash
# Health check
curl http://localhost:3002/health

# List operations
curl http://localhost:3002/api/v1/ecml/operations

# Execute operation
curl -X POST http://localhost:3002/api/v1/ecml/operations/generate-powershell \
  -H "Content-Type: application/json" \
  -d '{"uri": "file:///workspace/model.ecml"}'
```

## Error Handling

If the language server API is unavailable, the proxy returns:

```json
{
  "error": "Bad Gateway",
  "message": "Language server API is not available",
  "target": "http://localhost:3001"
}
```

HTTP status: `502 Bad Gateway`

## CORS

Since requests now go through the IDE origin, CORS is not required for browser-based API calls from the IDE frontend.
