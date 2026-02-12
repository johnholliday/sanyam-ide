# Research: Unified Cloud Storage, Authentication & Licensing

**Date**: 2026-02-11
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Table of Contents

1. [Supabase Auth + Theia Integration](#1-supabase-auth--theia-integration)
2. [Row-Level Security (RLS) Patterns](#2-row-level-security-rls-patterns)
3. [Cursor-Based Pagination](#3-cursor-based-pagination)
4. [Open Collaboration Tools (OCT) Integration](#4-open-collaboration-tools-oct-integration)
5. [Hono Rate Limiting](#5-hono-rate-limiting)

---

## 1. Supabase Auth + Theia Integration

### Decision
Implement a custom `AuthenticationProvider` for Theia that integrates with Supabase Auth, supporting OAuth flows for GitHub, Google, and Azure AD in both browser and Electron contexts.

### Key Interfaces to Implement

```typescript
// Theia's AuthenticationProvider interface
interface AuthenticationProvider {
  id: string;
  label: string;
  supportsMultipleAccounts: boolean;

  getSessions(scopes?: ReadonlyArray<string>): Thenable<ReadonlyArray<AuthenticationSession>>;
  createSession(scopes: ReadonlyArray<string>): Thenable<AuthenticationSession>;
  removeSession(sessionId: string): Thenable<void>;

  readonly onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;
}

interface AuthenticationSession {
  id: string;
  accessToken: string;
  idToken?: string;
  account: AuthenticationSessionAccountInformation;
  scopes: ReadonlyArray<string>;
}
```

### OAuth Flow: Browser vs Desktop

| Context | Redirect URI | Flow |
|---------|--------------|------|
| Browser | `https://app.sanyam.dev/auth/callback` | Standard redirect via `theia.env.openExternal()` |
| Electron | `http://localhost:PORT/auth/callback` | Loopback HTTP server on random available port |

**Desktop Loopback Pattern**:
1. Find available port (use existing `isPortInUse()` utility)
2. Start HTTP server listening on `http://localhost:PORT`
3. Open OAuth URL via `shell.openExternal()` with loopback redirect URI
4. Server receives callback, extracts code, closes listener
5. Exchange code for tokens, send to renderer via IPC

### SecretStorage Usage Pattern

```typescript
// Store tokens securely (encrypted by OS credential store)
await secretStorage.store(`supabase:${sessionId}:access_token`, tokens.access_token);
await secretStorage.store(`supabase:${sessionId}:refresh_token`, tokens.refresh_token);
await secretStorage.store(`supabase:${sessionId}:expires_at`, expiresAt.toString());

// Session metadata in localStorage (account info, scopes)
// Fast lookups without SecretStorage overhead
```

### Token Refresh Pattern

```typescript
// Schedule refresh 5 minutes before expiry
const refreshInMs = Math.max(1000, (expiresInSeconds - 300) * 1000);
setTimeout(() => refreshToken(sessionId), refreshInMs);

// On refresh: POST to Supabase /auth/v1/token?grant_type=refresh_token
// Update SecretStorage with new tokens
// Reschedule next refresh
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Use Supabase SDK's built-in auth | Not compatible with Theia's AuthenticationProvider model |
| Custom protocol handler (`electron://`) | Loopback HTTP server is simpler, more reliable |
| Static refresh interval | Wastes resources; better to schedule based on actual expiry |

---

## 2. Row-Level Security (RLS) Patterns

### Decision
Use user-scoped Supabase clients for all user-facing operations, with RLS policies as defense-in-depth. Service-role client reserved for system operations only.

### Creating User-Scoped Clients

```typescript
function createUserScopedClient(userAccessToken: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,  // Use anon key, NOT service role
    {
      global: {
        headers: {
          Authorization: `Bearer ${userAccessToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
```

### RLS Policies for Documents Table

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view own documents + shared documents
CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
        AND document_shares.shared_with_id = (SELECT auth.uid())
    )
  );

-- INSERT: Users can only create own documents
CREATE POLICY "Users can create own documents"
  ON documents FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- UPDATE: Owner can update
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- DELETE: Owner can soft-delete
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING ((SELECT auth.uid()) = owner_id);
```

**Performance Note**: Always wrap `auth.uid()` in `(SELECT auth.uid())` for caching per-statement.

### When to Use Service-Role vs User-Scoped

| Operation | Client Type | Rationale |
|-----------|-------------|-----------|
| User CRUD operations | User-scoped | RLS enforces ownership |
| Tier limit lookups | Service-role | System needs to read tier_limits for any user |
| Background cleanup jobs | Service-role | System-level operations across users |
| Admin dashboard | Service-role | Explicit admin authorization at app level |

---

## 3. Cursor-Based Pagination

### Decision
Use opaque base64-encoded cursors with compound key (`updated_at`, `id`) for all list endpoints.

### Cursor Encoding/Decoding

```typescript
function encodeCursor(record: { updated_at: Date; id: string }): string {
  const payload = `${record.updated_at.toISOString()}|${record.id}`;
  return Buffer.from(payload).toString('base64');
}

function decodeCursor(cursor: string): { updated_at: Date; id: string } {
  const payload = Buffer.from(cursor, 'base64').toString('utf-8');
  const [updated_at, id] = payload.split('|');
  return { updated_at: new Date(updated_at), id };
}
```

### SQL Query Pattern

```sql
-- Forward pagination (direction = 'next')
SELECT * FROM documents
WHERE (updated_at, id) > ($1::timestamp, $2::uuid)
  AND deleted_at IS NULL
  AND owner_id = auth.uid()
ORDER BY updated_at ASC, id ASC
LIMIT $3 + 1;  -- +1 to detect if more results exist

-- Backward pagination (direction = 'prev')
SELECT * FROM documents
WHERE (updated_at, id) < ($1::timestamp, $2::uuid)
  AND deleted_at IS NULL
  AND owner_id = auth.uid()
ORDER BY updated_at DESC, id DESC
LIMIT $3 + 1;
```

### Required Index

```sql
CREATE INDEX idx_documents_updated_id
  ON documents(updated_at, id)
  WHERE deleted_at IS NULL;
```

### Edge Cases

| Case | Handling |
|------|----------|
| Deleted items | Transparent gaps; cursor skips to next valid position |
| Concurrent inserts | Keyset pagination handles naturally (no offset drift) |
| Invalid cursor | Return 400 Bad Request, client retries from beginning |
| Empty results | Return `{ data: [], next_cursor: null, prev_cursor: null }` |

---

## 4. Open Collaboration Tools (OCT) Integration

### Decision
Use `@theia/collaboration` package which wraps OCT for real-time collaboration sessions with room codes.

### OCT Architecture

| Component | Purpose |
|-----------|---------|
| `open-collaboration-server` | Message broker, room management, JWT auth |
| `open-collaboration-protocol` | Core protocol, encryption, transport |
| `open-collaboration-yjs` | Yjs CRDT synchronization |
| `@theia/collaboration` | Theia extension wrapping OCT |

**Communication Model**: Centralized peer-to-peer via WebSocket. Server relays encrypted messages; cannot read content.

### Key Theia Classes

```typescript
// Register commands
CollaborationFrontendContribution  // "Create Room", "Join Room" commands

// Active session management
CollaborationInstance              // Host or guest session, manages Yjs sync

// Filesystem for guests
CollaborationFileSystemProvider    // Virtual filesystem overlay

// Peer colors
CollaborationColorService          // Cursor/selection colors per peer
```

### Room Flow

**Host creates room**:
1. `connectionProvider.createRoom(user)` → returns `{ roomId, roomToken }`
2. `roomId` displayed as room code for sharing

**Guest joins room**:
1. `connectionProvider.joinRoom(roomCode, user)` → sends `Peer.Join` request
2. Host approves via callback
3. Guest receives `JoinRoomResponse` with workspace info

### End-to-End Encryption

| Key Type | Algorithm | Purpose |
|----------|-----------|---------|
| Asymmetric | RSA-OAEP 4096-bit SHA-256 | Key exchange between peers |
| Symmetric | AES-CBC 256-bit | Message content encryption |

**Flow**: Each message uses fresh AES key; key is RSA-encrypted per recipient. Server cannot decrypt.

---

## 5. Hono Rate Limiting

### Decision
Use `hono-rate-limiter` with dynamic tier-based limits and standard response headers.

### Middleware Pattern

```typescript
import { rateLimiter } from "hono-rate-limiter";

const tierLimits = {
  free: 100,
  pro: 1000,
  enterprise: 10000,
};

app.use(
  rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: async (c) => {
      const user = c.get("user");
      const tier = user?.tier ?? "free";
      return tierLimits[tier];
    },
    keyGenerator: async (c) => {
      const user = c.get("user");
      return user?.id ?? c.req.header("x-forwarded-for") ?? "anonymous";
    },
    standardHeaders: "draft-6",
  })
);
```

### Response Headers (Draft-6 Standard)

| Header | Meaning |
|--------|---------|
| `RateLimit-Limit` | Maximum requests allowed in window |
| `RateLimit-Remaining` | Requests remaining in current window |
| `RateLimit-Reset` | Seconds until window resets |
| `RateLimit-Policy` | Server quota policy |

### 429 Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset": 1800,
      "tier": "free"
    }
  }
}
```

### Storage: In-Memory vs Redis

| Storage | Use Case |
|---------|----------|
| In-Memory (default) | Single-server deployments, Phases 1-4 |
| Redis | Horizontal scaling, production multi-instance |

---

## Summary

All research topics resolved. Key decisions:

1. **Supabase Auth**: Custom Theia AuthenticationProvider with loopback redirect for Electron
2. **RLS**: User-scoped clients for all user operations; service-role for system operations
3. **Pagination**: Cursor-based with `(updated_at, id)` compound key
4. **OCT**: Use `@theia/collaboration` package; E2E encrypted sessions
5. **Rate Limiting**: `hono-rate-limiter` with tier-based dynamic limits

Ready for Phase 1: Data Model and API Contracts.
