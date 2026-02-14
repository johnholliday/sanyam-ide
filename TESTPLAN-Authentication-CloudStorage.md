# Manual Testing Plan: Authentication & Cloud Storage

## Context

Feature 007 introduced three new packages — `@sanyam/supabase-auth`, `@sanyam/document-store`, and `@sanyam/licensing` — plus an HTTP gateway with rate limiting, API key auth, and tier-based feature gating. This plan walks through end-to-end manual verification of all cloud features against a local Supabase stack.

---

## Step 0: Add Convenience Scripts

Add `supabase:start` and `supabase:stop` scripts to the root `package.json` (after the existing `structurizr:rebuild` entry, keeping alphabetical order among the `s` scripts):

**File:** `/home/john/dev/sanyam-ide/package.json` (line ~81, in the `"scripts"` block)

```json
"supabase:start": "npx supabase start",
"supabase:stop": "npx supabase stop",
```

This lets you run `pnpm supabase:start` and `pnpm supabase:stop` instead of invoking `npx supabase` directly.

---

## Prerequisites

### 0. Ensure Docker is Running

Supabase local development uses Docker containers. Verify Docker is available:

```bash
docker info
```

### 1. Start the Local Supabase Stack

The Supabase CLI is installed as a project dependency (`supabase` in root `package.json`). Use the convenience scripts added in Step 0:

```bash
cd /home/john/dev/sanyam-ide
pnpm supabase:start
```

This launches PostgreSQL (port 54322), PostgREST API (54321), GoTrue auth, Studio UI (54323), and Inbucket email catcher (54324-54326). The command output prints `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — save these.

Verify it's healthy:

```bash
npx supabase status
```

You can also check status and credentials at any time with:

```bash
npx supabase status
```

> **Tip:** `pnpm supabase:start` and `pnpm supabase:stop` are the recommended way to manage the stack. Use `npx supabase <subcommand>` for other CLI operations like `status`, `db push`, `logs`.

### 2. Configure Environment

Create/update `.env.local` with the values from the `pnpm supabase:start` output:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
SANYAM_AUTH_MODE=supabase
SANYAM_AUTH_PROVIDERS=email,github
SANYAM_API_PORT=3001
```

Magic link emails are captured by Inbucket at `http://127.0.0.1:54324`.

#### 2a. GitHub OAuth App

1. Go to **GitHub > Settings > Developer settings > OAuth Apps > New OAuth App**.
2. Fill in:

   | Field | Value |
   |---|---|
   | **Application name** | `Sanyam IDE (local dev)` |
   | **Homepage URL** | `http://127.0.0.1:3002` |
   | **Authorization callback URL** | `http://127.0.0.1:54321/auth/v1/callback` |

3. Do **not** enable Device flow (the standard web redirect flow is used).
4. After creating the app, copy the **Client ID** and generate a **Client Secret**.
5. Add to `.env.local`:

   ```bash
   GITHUB_CLIENT_ID=<Client ID>
   GITHUB_CLIENT_SECRET=<Client Secret>
   ```

#### 2b. Azure AD (Microsoft Entra ID)

1. Go to **[entra.microsoft.com](https://entra.microsoft.com) > Identity > Applications > App registrations > New registration**.
2. Fill in:

   | Field | Value |
   |---|---|
   | **Display name** | `Sanyam IDE (local dev)` |
   | **Supported account types** | Single tenant (your org) or Multitenant |
   | **Redirect URI** | Platform: **Web**, URI: `http://127.0.0.1:54321/auth/v1/callback` |

3. From the **Overview** page, copy the **Application (client) ID** and **Directory (tenant) ID**.
4. Go to **Certificates & secrets > New client secret**. Copy the **Value** (not the Secret ID — the Value is only shown once).
5. Add to `.env.local`:

   ```bash
   AZURE_CLIENT_ID=<Application (client) ID>
   AZURE_CLIENT_SECRET=<client secret Value>
   AZURE_TENANT_URL=https://login.microsoftonline.com/<Directory (tenant) ID>
   ```

6. To test Azure AD, also add `azure-ad` to the providers list:

   ```bash
   SANYAM_AUTH_PROVIDERS=email,github,azure-ad
   ```

#### 2c. Stripe Webhook Secret (for billing tests)

The Stripe webhook integration is currently stubbed (signature verification accepts all requests), so a real Stripe account is not required for local testing. Set a placeholder value:

```bash
STRIPE_WEBHOOK_SECRET=whsec_test_local_development
```

When ready to test with real Stripe events, install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to http://127.0.0.1:3001/api/v1/webhooks/billing
```

The `stripe listen` command prints a `whsec_...` signing secret — use that as `STRIPE_WEBHOOK_SECRET`.

#### 2d. Restart Supabase

After updating `.env.local` with OAuth credentials, restart Supabase so GoTrue picks up the new environment variables:

```bash
pnpm supabase:stop && pnpm supabase:start
```

### 3. Build & Start the Browser App

```bash
pnpm build
pnpm start:browser
```

Browser app runs at `http://localhost:3002`. HTTP gateway runs at port 3001.

### 4. Open Supabase Studio

Open `http://127.0.0.1:54323` in a browser — this gives you direct DB inspection for verifying state throughout testing.

---

## Phase 1: Authentication

### Test 1.1 — Email Sign-Up

1. In the IDE, trigger the sign-up command (Command Palette > `Sanyam: Sign Up` or equivalent UI).
2. Enter a test email (e.g. `alice@test.com`) and a password (min 6 chars).
3. **Expected:** Success response. In Supabase Studio > Authentication > Users, the new user appears.
4. **Verify in DB:** `SELECT * FROM user_profiles WHERE email = 'alice@test.com'` — profile auto-created with `tier = 'free'`, `storage_used_bytes = 0`, `document_count = 0`.

### Test 1.2 — Email Sign-In

1. Sign out first if signed in.
2. Sign in with the email/password from Test 1.1.
3. **Expected:** Status bar shows authenticated state (user email or avatar). `AuthStateEmitter` fires `SIGNED_IN` event.
4. **Verify:** The access token is a valid JWT — decode it at jwt.io and confirm `sub` matches the user's UUID.

### Test 1.3 — Magic Link Sign-In

1. Sign out. Trigger sign-in with magic link using `alice@test.com`.
2. Open Inbucket at `http://127.0.0.1:54324` — a magic link email should appear.
3. Click the link (or extract the OTP code from the email body).
4. **Expected:** Session established, status bar updates.

### Test 1.4 — GitHub OAuth Sign-In

1. Ensure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set in `.env.local` and Supabase has been restarted.
2. Sign out if signed in.
3. Trigger GitHub sign-in (Command Palette > `Sanyam: Sign In` and select GitHub).
4. **Expected:** Browser redirects to GitHub's authorization page. After granting access, redirected back to `http://127.0.0.1:54321/auth/v1/callback`, then to the IDE at `http://127.0.0.1:3002`.
5. **Expected:** Status bar shows authenticated state with GitHub identity. `AuthStateEmitter` fires `SIGNED_IN` event.
6. **Verify in DB:** `SELECT * FROM auth.users WHERE raw_app_meta_data->>'provider' = 'github'` — user exists. `user_profiles` row auto-created with `tier = 'free'`.

### Test 1.5 — Azure AD OAuth Sign-In

1. Ensure `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_URL` are set in `.env.local`, `azure-ad` is in `SANYAM_AUTH_PROVIDERS`, and Supabase has been restarted.
2. Sign out if signed in.
3. Trigger Azure AD sign-in (Command Palette > `Sanyam: Sign In` and select Azure AD).
4. **Expected:** Browser redirects to Microsoft login. After authenticating, redirected back through the callback to the IDE.
5. **Expected:** Status bar shows authenticated state. `AuthStateEmitter` fires `SIGNED_IN` event.
6. **Verify in DB:** `SELECT * FROM auth.users WHERE raw_app_meta_data->>'provider' = 'azure'` — user exists.

### Test 1.6 — Token Refresh

1. While signed in, note the `expiresAt` from the session (inspect via dev tools console or a debug command).
2. Default Supabase local JWT expiry is 3600s (1 hour). The auto-refresh fires 5 minutes before expiry.
3. **Shortcut:** Call `refreshToken()` manually (via console or a test command).
4. **Expected:** `TOKEN_REFRESHED` event fires. New `accessToken` and `expiresAt` values differ from original.

### Test 1.7 — Session Persistence Across Reload

1. While signed in, refresh the browser (`F5`).
2. **Expected:** Session is restored from SecretStorage. `INITIAL_SESSION` event fires. User remains authenticated without re-entering credentials.

### Test 1.8 — Sign Out

1. Trigger sign-out (Command Palette > `Sanyam: Sign Out`).
2. **Expected:** Status bar clears auth state. `SIGNED_OUT` event fires. Session cleared from SecretStorage.
3. Refresh browser — user should remain signed out.

### Test 1.9 — Graceful Degradation (No Supabase)

1. Stop Supabase: `pnpm supabase:stop`.
2. Reload the IDE browser app.
3. **Expected:** IDE loads normally. Auth features are disabled/hidden. Local editing works without errors. No crash or unhandled rejection in console.
4. Restart Supabase: `pnpm supabase:start`.

---

## Phase 2: Cloud Document Storage

> **Pre-condition:** Sign in as the user from Phase 1 (free tier).

### Test 2.1 — Create a Cloud Document

1. Open or create a local DSL file in the IDE.
2. Use Command Palette > `Sanyam: Save to Cloud`.
3. **Expected:** Document saved. Confirmation shown.
4. **Verify in DB:** `SELECT * FROM documents WHERE owner_id = '<user-uuid>'` — document appears with `version = 1`, `deleted_at IS NULL`.
5. **Verify:** `user_profiles.document_count` incremented to 1. `storage_used_bytes` updated.

### Test 2.2 — List Cloud Documents

1. Use Command Palette > `Sanyam: Open Cloud Document`.
2. **Expected:** List shows the document from Test 2.1 with name, language, last modified timestamp.

### Test 2.3 — Update a Cloud Document

1. Open the cloud document. Make edits to the content.
2. Save again (or wait for AutoSave — 10s idle delay).
3. **Expected:** Document updated. Version incremented to 2.
4. **Verify in DB:** `documents.version = 2`. A row in `document_versions` with `version_number = 1` preserves the original content.

### Test 2.4 — Version History

1. Make a few more edits and saves to accumulate versions.
2. Use Command Palette > `Sanyam: Document History`.
3. **Expected:** Version list displayed in descending order (newest first). Each entry shows version number, timestamp, size.

### Test 2.5 — Restore a Previous Version

1. From the version history, select an older version.
2. Use Command Palette > `Sanyam: Restore Document`.
3. **Expected:** Document content reverts to the selected version. A **new** version is created (version number increments — this is not a rollback, it's a restore-as-new-version).

### Test 2.6 — Soft Delete & Restore

1. Delete a cloud document (Command Palette or context menu).
2. **Expected:** Document disappears from the default document list.
3. **Verify in DB:** `documents.deleted_at IS NOT NULL` (soft delete — row still exists).
4. If a "Trash" or restore UI exists, restore the document.
5. **Expected:** Document reappears in list. `deleted_at` cleared to NULL.

### Test 2.7 — Optimistic Locking Conflict

1. Open the same cloud document in two browser tabs/windows (both signed in as the same user).
2. Edit in Tab A and save.
3. Edit in Tab B (which still has the old version) and save.
4. **Expected:** Tab B receives an `OPTIMISTIC_LOCK_CONFLICT` error with the current version number. User prompted to reload or merge.

### Test 2.8 — AutoSave Behavior

1. Open a cloud document. Make a small edit.
2. Stop typing and wait 10 seconds (the `idleDelayMs`).
3. **Expected:** AutoSave triggers. Status indicator shows "Saving..." then "Saved".
4. Make another edit within 5 minutes (the `versionConsolidationMs` window).
5. Wait for AutoSave again.
6. **Verify in DB:** Only one new version was created (consolidation — the second save updated the same version, not a new one).
7. Wait >5 minutes, make another edit, wait for AutoSave.
8. **Verify:** A new version row is created this time.

### Test 2.9 — AutoSave Offline Recovery

1. While editing a cloud document, stop Supabase (`pnpm supabase:stop`).
2. Make edits. AutoSave should attempt and fail.
3. **Expected:** Status shows "Offline" or "Error". No data loss — edits preserved locally.
4. Restart Supabase (`pnpm supabase:start`).
5. **Expected:** AutoSave retries and succeeds. Status returns to "Saved".

---

## Phase 3: Tier Limits & Licensing

### Test 3.1 — Free Tier Document Limit (5 documents)

1. Signed in as a free-tier user.
2. Create 5 cloud documents (the free tier maximum).
3. Attempt to create a 6th document.
4. **Expected:** `TIER_LIMIT_EXCEEDED` error. Clear message indicating the document limit.

### Test 3.2 — Free Tier Storage Limit (10 MB)

1. Create a document with very large content approaching the 256 KB per-document limit (free tier).
2. Attempt to save a document that would push total storage past 10 MB.
3. **Expected:** `TIER_LIMIT_EXCEEDED` error referencing storage quota.

### Test 3.3 — Free Tier Version Limit (10 versions per document)

1. Create a document and make 10+ saves (waiting >5 minutes between saves to avoid consolidation, or save manually each time).
2. **Verify in DB:** `SELECT COUNT(*) FROM document_versions WHERE document_id = '<id>'` never exceeds 10. Oldest versions are auto-purged (FIFO via `enforce_version_limit()` trigger).

### Test 3.4 — Upgrade Tier & Verify Expanded Limits

1. In Supabase Studio, manually update the user's tier:
   ```sql
   UPDATE user_profiles SET tier = 'pro' WHERE email = 'alice@test.com';
   ```
2. Refresh the license cache (Command Palette > `Sanyam: Refresh License` or wait 15 minutes).
3. **Expected:** Can now create up to 100 documents, 1 GB storage, 100 versions per document. Pro-only features (sharing, API keys, permanent delete) become available.

### Test 3.5 — Feature Gating

Verify feature availability per tier:

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Cloud storage | Yes | Yes | Yes |
| Version history | Yes | Yes | Yes |
| Document sharing | No | Yes | Yes |
| Permanent delete | No | Yes | Yes |
| API keys | No | Yes | Yes |
| Offline mode | No | Yes | Yes |

1. As a free user, attempt to share a document. **Expected:** Feature disabled / error message.
2. Upgrade to Pro (via DB update). Retry. **Expected:** Feature now available.

---

## Phase 4: Document Sharing (requires Pro tier)

> **Pre-condition:** User `alice@test.com` is Pro tier (from Test 3.4). Create a second user `bob@test.com` (free tier) via sign-up.

### Test 4.1 — Share a Document (View Permission)

1. As Alice, create a cloud document with some content.
2. Use Command Palette > `Sanyam: Share Document`.
3. Share with Bob's email, permission = `view`.
4. **Verify in DB:** `SELECT * FROM document_shares WHERE document_id = '<id>'` — row exists with `permission = 'view'`.

### Test 4.2 — Shared User Can View

1. Sign in as Bob in a separate browser/incognito window.
2. Open cloud documents list.
3. **Expected:** Alice's shared document appears in Bob's list (via RLS policy).
4. Open it. **Expected:** Content is visible, read-only.

### Test 4.3 — Shared User Cannot Edit (View-Only)

1. As Bob, attempt to edit the shared document.
2. **Expected:** Edit rejected or disabled. RLS prevents UPDATE for view-only shares.

### Test 4.4 — Upgrade Share to Edit

1. As Alice, update the share permission to `edit`.
2. **Verify in DB:** `document_shares.permission = 'edit'`.
3. As Bob, attempt to edit the document.
4. **Expected:** Edit succeeds. Document updated.

### Test 4.5 — Revoke Share

1. As Alice, remove the share.
2. **Verify in DB:** Share row deleted.
3. As Bob, refresh the document list.
4. **Expected:** Alice's document no longer appears. Direct access returns not-found/forbidden.

---

## Phase 5: HTTP Gateway & API Keys (requires Pro tier)

### Test 5.1 — Health & Readiness Endpoints

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","supabase":true,"auth":true,"version":"..."}

curl http://localhost:3001/api/ready
# Expected: 200 OK (or 503 if still initializing)
```

### Test 5.2 — Authenticated API Request (Bearer Token)

```bash
# Get access token from a signed-in session (browser dev tools or auth flow)
TOKEN="<access_token_jwt>"

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/documents
# Expected: 200 with paginated document list for the authenticated user
```

### Test 5.3 — Unauthenticated API Request

```bash
curl http://localhost:3001/api/documents
# Expected: 401 Unauthorized (when SANYAM_AUTH_MODE=supabase)
```

### Test 5.4 — Create API Key (Pro+ only)

1. As a Pro-tier user, use Command Palette > `Sanyam: Manage API Keys`.
2. Create a new API key with scopes: `documents:read`, `documents:write`.
3. **Expected:** Key returned in format `sanyam_<32 hex chars>`. Key shown only once.
4. **Verify in DB:** `SELECT * FROM api_keys WHERE user_id = '<uuid>'` — row exists with `key_hash` (SHA-256, not the raw key), `scopes`, and `expires_at`.

### Test 5.5 — API Key Authentication

```bash
API_KEY="sanyam_<the key from Test 5.4>"

curl -H "X-API-Key: $API_KEY" \
     http://localhost:3001/api/documents
# Expected: 200 with document list (same as Bearer auth, scoped to the key owner)
```

### Test 5.6 — API Key Scope Enforcement

```bash
# Create a key with only documents:read scope
# Attempt a write operation:
curl -X POST -H "X-API-Key: $READ_ONLY_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name":"test","content":"hello","language_id":"example"}' \
     http://localhost:3001/api/documents
# Expected: 403 Forbidden — insufficient scope
```

### Test 5.7 — Rate Limiting

```bash
# Fire many rapid requests (free tier: 100/min)
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3001/api/documents
done
# Expected: First 100 return 200. Requests 101+ return 429 with:
#   X-RateLimit-Limit: 100
#   X-RateLimit-Remaining: 0
#   Retry-After: <seconds>
```

### Test 5.8 — CORS Headers

```bash
curl -I -X OPTIONS \
  -H "Origin: http://localhost:3002" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:3001/api/documents
# Expected: Access-Control-Allow-Origin present,
#   Access-Control-Allow-Headers includes Authorization, X-API-Key
```

---

## Phase 6: URI Scheme

### Test 6.1 — Open Document by URI

1. Construct a URI: `sanyam://documents/<document-uuid>` (use a real UUID from the DB).
2. Open it in the IDE (however URI handling is exposed — command palette, CLI arg, or link).
3. **Expected:** Document content loaded and displayed.

### Test 6.2 — Open Specific Version by URI

1. Construct: `sanyam://documents/<uuid>/versions/1`
2. Open it.
3. **Expected:** Version 1's content displayed (not the latest version).

---

## Phase 7: Edge Cases & Error Handling

### Test 7.1 — Expired Session Handling

1. Sign in. In Supabase Studio, manually delete the user's session from `auth.sessions`.
2. Attempt a cloud operation.
3. **Expected:** Token refresh fails. User is signed out gracefully. Prompted to re-authenticate.

### Test 7.2 — Concurrent Edits from Two Users

1. Alice shares a document with Bob (edit permission).
2. Both open the document simultaneously.
3. Alice saves. Bob saves (with the stale version).
4. **Expected:** Bob receives an optimistic lock conflict. Content is not silently overwritten.

### Test 7.3 — Large Document Near Size Limit

1. Create a document with content near the per-document size limit (256 KB for free, 2 MB for pro).
2. Attempt to save content just over the limit.
3. **Expected:** Clear error about document size limit. Content not saved.

### Test 7.4 — Invalid/Revoked API Key

```bash
curl -H "X-API-Key: sanyam_0000000000000000000000000000000000" \
     http://localhost:3001/api/documents
# Expected: 401 Unauthorized
```

---

## Cleanup

```bash
# Stop Supabase (preserves data)
pnpm supabase:stop

# Full reset (drops all data)
npx supabase stop --no-backup
pnpm supabase:start
```
