# Feature Specification: Unified Cloud Storage, Authentication & Licensing

**Feature Branch**: `007-cloud-storage-auth-licensing`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Unified Cloud Storage, Authentication & Licensing for Sanyam IDE"

## Overview

This feature enables Sanyam IDE users to store, access, and collaborate on DSL documents in the cloud. It provides a unified system for user authentication, tiered subscription licensing, and secure programmatic access via API keys.

## Clarifications

### Session 2026-02-11

- Q: What is the AutoSave idle timeout before triggering a cloud save? → A: 10 seconds after last keystroke
- Q: Which subscription tiers have access to AutoSave? → A: All tiers (Free, Pro, Enterprise)
- Q: How should the system handle AutoSave failures? → A: Show subtle status indicator + retry automatically
- Q: Should each AutoSave create a new version in history? → A: Consolidate into one version per 5-minute editing window
- Q: Should real-time collaboration be in scope? → A: Yes, both async sharing AND real-time sessions
- Q: How should users start a live collaboration session? → A: Separate "Start Live Session" command in status bar (generates room code)
- Q: Which tiers have access to real-time collaboration? → A: Pro and Enterprise only
- Q: What sign-in methods should be supported? → A: Email/password, magic link, and OAuth (GitHub, Google, Azure AD)
- Q: Which tiers can use Azure AD authentication? → A: Enterprise only; GitHub/Google available to all tiers
- Q: How should OAuth handle desktop vs browser deployments? → A: Desktop uses loopback redirect; browser uses standard redirect URI
- Q: Should OAuth providers be configurable? → A: Yes, via SANYAM_OAUTH_PROVIDERS environment variable for enterprise SSO flexibility
- Q: How are session tokens persisted? → A: Using Theia's SecretStorage API (encrypted, per-user, survives IDE restarts) storing access token + refresh token
- Q: What happens on IDE startup with stored tokens? → A: System attempts to restore session and validate refresh token before prompting for re-authentication
- Q: What happens on sign-out or token revocation? → A: Both tokens are cleared from SecretStorage immediately
- Q: How is token refresh handled? → A: Subscribe to auth state changes; on TOKEN_REFRESHED: (a) write to SecretStorage, (b) propagate to client factory via observable, (c) update HTTP middleware context
- Q: Should client factory accept static tokens? → A: No; client factory subscribes to auth state stream and resolves current valid token internally
- Q: How should server routes handle authorization? → A: Defense-in-depth: per-request user-scoped client with RLS enforcement; service-role client only for system operations (tier lookups, background jobs)
- Q: Why use per-request user-scoped clients? → A: RLS prevents unauthorized access even if application permission checks have bugs
- Q: How do enterprise deployments handle auth providers? → A: Customer configures their own providers (SAML, corporate OAuth, any Supabase-supported) on self-hosted Supabase
- Q: Should provider IDs be hard-coded? → A: No; discover available providers on startup via Supabase Auth API or SANYAM_AUTH_PROVIDERS env var
- Q: How should login UI handle dynamic providers? → A: Render sign-in options dynamically based on discovered providers
- Q: Which providers are default for hosted/SaaS? → A: GitHub, Google, Azure AD; enterprise uses customer-configured providers
- Q: What should the document storage package be named? → A: `@sanyam/document-store` (not `supabase-storage`) — uses PostgreSQL client methods (.from().select(), .insert()), not Supabase Storage blob API
- Q: How are DSL documents and binary assets stored? → A: DSL source documents stored as PostgreSQL text/JSONB columns; binary assets (diagrams, compiled output) deferred to future phase using Supabase Storage blob with URI `sanyam://{doc-id}/assets/{path}`
- Q: How should the system handle asset URIs before binary storage is implemented? → A: Reserve `/assets/` path segment in URI scheme; return "not yet supported" error so manifests can reference future assets without breaking current resolution
- Q: Are there per-document size limits in addition to total storage quotas? → A: Yes; max_document_size_bytes: Free=256KB, Pro=2MB, Enterprise=8MB. Enforce on create/update, return 413 Payload Too Large with tier limit and upgrade path. Self-hosted enterprise can override via tier_limits table.
- Q: How does optimistic locking work for concurrent document updates? → A: Use documents.version column (auto-incremented) with If-Match header. On mismatch return 409 Conflict with current version. Omitting If-Match allows last-write-wins but logs warning for observability.
- Q: What is the version history retention policy? → A: max_versions_per_document: Free=10, Pro=100, Enterprise=1000 (FIFO deletion on exceed). version_retention_days: Free=90, Pro=365, Enterprise=unlimited. Nightly scheduled job hard-deletes expired versions.
- Q: What is the trash retention policy for soft-deleted documents? → A: trash_retention_days: Free=30, Pro=90, Enterprise=180. Scheduled job hard-deletes after retention period (cascades to versions, shares, storage tracking). Pro+ can restore via "Restore Deleted Document" command (POST /api/v1/documents/:id/restore).
- Q: What pagination scheme should list endpoints use? → A: Cursor-based pagination with query params: limit (default 20, max 100), cursor (opaque base64-encoded updated_at+id), direction (next|prev, default next). Response includes { next_cursor, prev_cursor, total_count }. Applies to /api/v1/documents, /api/v1/documents/:id/versions, /api/v1/api-keys.
- Q: What standard error response format should the API use? → A: All errors (4xx/5xx) return JSON envelope: { error: { code: string, message: string, details?: object } }. Code is machine-readable (e.g., DOCUMENT_NOT_FOUND, TIER_LIMIT_EXCEEDED, OPTIMISTIC_LOCK_CONFLICT). Details carries context-specific data (tier limits, conflicting version, rate limit reset time).
- Q: How should the HTTP gateway handle CORS? → A: Browser deployments require CORS headers via Hono cors() middleware. Origin from SANYAM_CORS_ORIGIN env var (defaults '*' in dev, required in prod). Methods: GET, POST, PUT, DELETE, OPTIONS. AllowedHeaders: Content-Type, Authorization, If-Match. ExposedHeaders: X-RateLimit-*, ETag. Desktop (Electron) requests bypass CORS since they originate from Node backend.
- Q: What happens when a user downgrades from a higher tier? → A: Degradation policy: (a) Documents never deleted — read-only if over limit, must delete to create new. (b) Shares remain active but can't create new. (c) Versioning stops but existing versions remain queryable. (d) API keys revoked on downgrade below API_KEYS tier. FeatureGate.degradeTier() hook called by billing webhook.
- Q: Should Supabase Realtime be integrated for document change notifications? → A: Deferred to future collaboration phase (not Phases 1–4). Current architecture uses request-response fetches; premature Realtime adds connection management complexity without clear user story. Future integration: subscribe to documents table filtered by owner_id/shared_with, surface as Theia FileSystemWatcher provider.
- Q: How should the system handle offline scenarios? → A: Simple offline indicator (no write queuing). SupabaseClientFactory sets isOnline=false on connection failure. Status bar shows "Offline — changes saved locally only." Cloud commands disabled while offline. Local file:// editing unaffected. User must manually re-save to cloud after reconnecting. Offline write queuing deferred to future phase to avoid conflict resolution complexity.
- Q: What caching strategy should UnifiedDocumentResolver use? → A: In-memory cache only for Phases 1–4: Map<string, { content, version, fetchedAt }>. 5-minute TTL eviction or on write confirmation. No persistent cache (SQLite/filesystem) yet — documents are small text (sub-MB), latency acceptable, offline story disables cloud features vs. serving stale data. Persistent cache deferred alongside offline queuing (same conflict resolution requirements).
- Q: How should tier capabilities (feature flags) be managed? → A: tier_limits table is single source of truth with boolean feature columns (has_document_sharing, has_document_versioning, has_api_keys, has_realtime_collaboration, has_azure_ad) alongside numeric limit columns. LicenseValidator fetches full tier_limits row; FeatureGate reads boolean flags from that row, not hard-coded TypeScript mapping. Enables tier capability changes via database update without redeployment.
- Q: What is the complete schema for the tier_limits table? → A: Primary key: tier (subscription_tier enum). Numeric limits: max_documents (int), max_storage_bytes (bigint), max_document_size_bytes (int), max_versions_per_document (int), version_retention_days (int), trash_retention_days (int), api_rate_limit_per_hour (int). Boolean features: has_cloud_storage, has_cloud_auth, has_document_sharing, has_document_versioning, has_api_keys. Seeded with default values for free, pro, enterprise tiers. Single table drives both FeatureGate and CloudDocumentStore.checkTierLimits.
- Q: How should FeatureGate expose both boolean features and numeric limits? → A: Extend FeatureGate interface with getTierLimits(): Promise<TierLimits> method that returns the full tier_limits row for the current user's tier. The TierLimits interface is defined in @sanyam/types so all downstream packages (including @sanyam/projects-core) can access it. This provides a single injection point for both isFeatureEnabled(featureId) boolean checks and numeric limit enforcement, eliminating the separate CloudDocumentStore.checkTierLimits code path.
- Q: How should the system behave when @sanyam/licensing is absent from node_modules? → A: When licensing package is absent, cloud features remain available but bounded by free-tier numeric limits enforced at the HTTP gateway level (Hono middleware reads tier_limits for 'free' tier directly). This prevents the contradictory incentive where removing the licensing package would grant more access than having it installed. LocalOnlyDocumentStore only activates when Supabase itself is unconfigured (missing SUPABASE_URL/SUPABASE_ANON_KEY), not when licensing is absent.
- Q: What is the LicenseValidator cache invalidation strategy? → A: (a) Cache has 15-minute TTL; next isFeatureEnabled() call re-fetches from Supabase after expiry. (b) supabase-auth-provider's onAuthStateChange handler calls LicenseValidator.invalidateCache() on SIGNED_IN and TOKEN_REFRESHED events (tier change may coincide with billing-triggered session refresh). (c) Expose "Sanyam: Refresh License" command for manual cache invalidation in support/debugging scenarios. (d) HTTP gateway does not cache tier at all — fetches tier on each request via per-request user-scoped Supabase client, ensuring server-side enforcement is always current.
- Q: How can downstream packages register their own gated features without modifying @sanyam/licensing? → A: Define FeatureRegistration interface { featureId: string, requiredTier: 'free' | 'pro' | 'enterprise' } in @sanyam/types. FeatureGate accepts registrations via multi-bound inversify FeatureContribution pattern (packages contribute features on startup). FeatureGate builds tier-to-feature map dynamically from all contributions plus boolean columns in tier_limits. This avoids @sanyam/licensing becoming a cross-package bottleneck — future packages declare their own gated features without PRs into licensing.
- Q: How does a user's subscription tier change (billing integration boundary)? → A: Sanyam does not implement billing directly; it integrates with Stripe (or equivalent) via a webhook endpoint. POST /api/v1/webhooks/billing route (service-role auth only, verified via Stripe webhook signature) updates user_profiles.tier when a subscription is created, upgraded, downgraded, or canceled. On downgrade, apply the degradation policies (FR-073-079). The billing webhook handler implementation is out of scope for Phases 1–4, but the schema and route stub should be created in Phase 2 so that manual tier assignment via Supabase dashboard SQL works as an interim solution. SANYAM_DEFAULT_TIER env var (default: 'free') determines the tier used by the auto-create-profile trigger.
- Q: Should a trial tier be included for time-limited pro features during onboarding? → A: Deferred. The subscription_tier enum remains fixed to 'free', 'pro', 'enterprise' for Phases 1–4. Migration includes a comment noting the enum is extensible via `ALTER TYPE subscription_tier ADD VALUE 'trial'`. All downstream code (LicenseValidator, FeatureGate, HTTP gateway) must handle unknown tier values gracefully by defaulting to free-tier limits. This ensures forward compatibility when trial (or other tiers) are added in future phases.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Authentication (Priority: P1)

Users need to sign in to access cloud features, ensuring their documents are secure and accessible across sessions and devices.

**Why this priority**: Authentication is the foundation for all cloud features. Without it, users cannot access cloud storage, sharing, or any tier-restricted functionality.

**Independent Test**: Can be fully tested by completing the sign-in flow and verifying session persistence across browser refreshes.

**Acceptance Scenarios**:

1. **Given** user is not signed in, **When** user clicks "Sign In", **Then** authentication dialog appears with email/password, magic link, and OAuth options (GitHub, Google, Azure AD)
2. **Given** user enters valid email/password credentials, **When** user submits the form, **Then** user is signed in and sees their profile in the status bar
3. **Given** user requests magic link sign-in, **When** user enters their email, **Then** magic link is sent and user can sign in by clicking the link
4. **Given** user selects OAuth provider (GitHub/Google), **When** OAuth flow completes, **Then** user is signed in with their provider identity
5. **Given** Enterprise user selects Azure AD, **When** OAuth flow completes, **Then** user is signed in with their organization identity
6. **Given** non-Enterprise user attempts Azure AD sign-in, **When** they select Azure AD, **Then** upgrade prompt is displayed
7. **Given** user is signed in, **When** user refreshes the browser, **Then** user remains signed in with session restored
8. **Given** user is signed in, **When** user clicks "Sign Out", **Then** user is signed out and cloud features become unavailable

---

### User Story 2 - Save Documents to Cloud (Priority: P1)

Users need to save their local DSL documents to cloud storage so they can access them from anywhere and not lose work if their local machine fails.

**Why this priority**: Cloud storage is the core value proposition. Users must be able to save their work to the cloud.

**Independent Test**: Can be tested by creating a local document, saving it to cloud, and verifying it appears in the cloud document list.

**Acceptance Scenarios**:

1. **Given** user is signed in and has a local document open, **When** user selects "Save to Cloud", **Then** document is uploaded and accessible via cloud URI
2. **Given** user saves to cloud, **When** upload completes, **Then** document appears in user's cloud document list
3. **Given** user has unsaved changes, **When** user saves to cloud, **Then** all changes are persisted and version incremented
4. **Given** user is not signed in, **When** user attempts to save to cloud, **Then** user is prompted to sign in first
5. **Given** user is signed in and has a cloud document open and AutoSave is enabled and user has unsaved changes, **When** user has been idle for 10 seconds, **Then** document is automatically saved to cloud
6. **Given** AutoSave is enabled and network is unavailable, **When** AutoSave attempts to save, **Then** status indicator shows sync pending and system retries automatically when connection restores
7. **Given** user is actively editing with AutoSave enabled, **When** multiple AutoSaves occur within a 5-minute window, **Then** only one version snapshot is created for that window

---

### User Story 3 - Open Cloud Documents (Priority: P1)

Users need to browse and open their cloud-stored documents directly within the IDE.

**Why this priority**: After saving documents to cloud, users need to retrieve them. This completes the basic cloud storage workflow.

**Independent Test**: Can be tested by opening the cloud document browser and selecting a previously saved document.

**Acceptance Scenarios**:

1. **Given** user is signed in, **When** user selects "Open Cloud Document", **Then** list of user's cloud documents is displayed
2. **Given** document list is displayed, **When** user selects a document, **Then** document opens in the editor
3. **Given** user opens a cloud document, **When** user makes and saves changes, **Then** changes are persisted to cloud storage
4. **Given** user has no cloud documents, **When** user opens cloud document browser, **Then** empty state message is displayed with guidance

---

### User Story 4 - Share Documents with Collaborators (Priority: P2)

Users need to share documents with team members for collaboration, with control over permission levels.

**Why this priority**: Collaboration enables team productivity. It builds on the storage foundation but is not required for individual use.

**Independent Test**: Can be tested by sharing a document with another user and verifying they can access it with correct permissions.

**Acceptance Scenarios**:

1. **Given** user owns a cloud document, **When** user selects "Share Document", **Then** sharing dialog appears
2. **Given** sharing dialog is open, **When** user enters collaborator email and selects "View" permission, **Then** collaborator gains read-only access
3. **Given** sharing dialog is open, **When** user enters collaborator email and selects "Edit" permission, **Then** collaborator gains read-write access
4. **Given** user has shared a document, **When** user revokes share, **Then** collaborator loses access immediately
5. **Given** user is a collaborator with view permission, **When** user opens shared document, **Then** user can view but not edit

---

### User Story 5 - Real-Time Collaboration Sessions (Priority: P2)

Users need to collaborate on documents in real-time with team members, seeing each other's cursors and edits as they happen.

**Why this priority**: Real-time collaboration enables immediate team productivity for pair programming and live reviews. Builds on async sharing but provides synchronous workflow.

**Independent Test**: Can be tested by starting a live session, having another user join via room code, and verifying synchronized edits and cursor visibility.

**Acceptance Scenarios**:

1. **Given** user is signed in with Pro or Enterprise tier, **When** user clicks "Start Live Session" in status bar, **Then** room code is generated and copied to clipboard
2. **Given** user has a room code, **When** user clicks "Join Session" and enters the code, **Then** user joins the live collaboration session
3. **Given** two users are in a live session, **When** one user types, **Then** the other user sees the changes in real-time
4. **Given** two users are in a live session, **When** one user selects text, **Then** the other user sees their cursor position and selection highlighted
5. **Given** user is session host, **When** user ends the session, **Then** all participants are notified and disconnected
6. **Given** user is on Free tier, **When** user attempts to start or join a live session, **Then** upgrade prompt is displayed

---

### User Story 6 - View Document Version History (Priority: P2)

Users need to view previous versions of documents and restore them if needed.

**Why this priority**: Version history protects against accidental changes and enables audit trails. Important for productivity but not essential for basic usage.

**Independent Test**: Can be tested by making multiple edits to a document and viewing the version timeline.

**Acceptance Scenarios**:

1. **Given** user has a cloud document open, **When** user selects "Document History", **Then** version timeline is displayed showing all previous versions
2. **Given** version history is displayed, **When** user selects a previous version, **Then** version content is shown for preview
3. **Given** user is previewing a previous version, **When** user selects "Restore This Version", **Then** document content is restored and new version is created
4. **Given** document has no version history, **When** user views history, **Then** only current version is shown

---

### User Story 7 - Subscription Tier Management (Priority: P2)

Users need to understand their current subscription tier and what features are available, with clear upgrade paths for additional capabilities.

**Why this priority**: Tier awareness enables users to understand feature availability and drives subscription upgrades.

**Independent Test**: Can be tested by viewing the subscription panel and verifying feature availability matches the current tier.

**Acceptance Scenarios**:

1. **Given** user is signed in, **When** user views their profile, **Then** current subscription tier is displayed
2. **Given** user is on free tier, **When** user views subscription panel, **Then** comparison of tier features is shown with upgrade options
3. **Given** user is on free tier, **When** user attempts to use a Pro feature, **Then** upgrade prompt is displayed
4. **Given** user is on Pro tier, **When** user views subscription panel, **Then** all Pro features show as available

---

### User Story 8 - API Key Management (Priority: P3)

Developers and power users need programmatic access to their documents for automation, CI/CD pipelines, and third-party integrations.

**Why this priority**: API access enables advanced integrations but is primarily for power users. Core functionality works without it.

**Independent Test**: Can be tested by creating an API key and using it to access the documents endpoint.

**Acceptance Scenarios**:

1. **Given** user is signed in with Pro or Enterprise tier, **When** user opens "Manage API Keys", **Then** API key management panel is displayed
2. **Given** API key panel is open, **When** user creates a new key with name and scopes, **Then** key secret is displayed once for copying
3. **Given** user has existing API keys, **When** user views key list, **Then** key names, creation dates, and scopes are visible (secrets are hidden)
4. **Given** user has an API key, **When** user revokes the key, **Then** key becomes invalid immediately
5. **Given** user is on free tier, **When** user attempts to access API key management, **Then** upgrade prompt is displayed

---

### User Story 9 - Graceful Offline/Unconfigured Behavior (Priority: P3)

Users need the IDE to work seamlessly when cloud services are unavailable, whether due to network issues or intentional local-only usage.

**Why this priority**: Ensures the IDE remains useful in all scenarios, preventing frustration when cloud is unavailable.

**Independent Test**: Can be tested by running the IDE without cloud configuration and verifying local file editing works normally.

**Acceptance Scenarios**:

1. **Given** cloud services are not configured, **When** user opens the IDE, **Then** local file editing works normally without errors
2. **Given** cloud services are not configured, **When** user browses menus, **Then** cloud-specific commands are hidden (not disabled)
3. **Given** user is offline, **When** user attempts a cloud operation, **Then** clear error message explains the connectivity issue
4. **Given** user was working on cloud document, **When** connection is lost, **Then** user is notified and can continue viewing (read-only)

---

### Edge Cases

- What happens when user exceeds storage limit? System displays clear message and blocks new uploads until space is freed or tier is upgraded.
- What happens when shared user tries to share to others? Only document owner can manage sharing permissions.
- What happens when API key rate limit is exceeded? Request returns appropriate error with retry-after information in response headers.
- What happens when document is deleted while collaborator has it open? Collaborator sees notification that document is no longer available.
- What happens when two users edit the same document simultaneously outside a live session? System uses optimistic locking: client sends If-Match header with version; if version mismatch, return 409 Conflict with current version for client merge/retry. Without If-Match header, last-write-wins applies but system logs warning. Users should start a live session for synchronized editing.
- What happens when a participant loses connection during a live session? Participant is removed from session; they can rejoin using the same room code if session is still active.
- What happens when the session host disconnects? Session ends for all participants; they receive a notification that the host has ended the session.
- What happens when user signs in on multiple devices? Sessions are independent; document state syncs on each save/open operation.
- What happens when AutoSave fails due to network issues? System shows subtle "sync pending" indicator and retries automatically when connection restores.
- What happens when OAuth redirect fails in desktop mode? System uses loopback redirect (localhost) for desktop Theia; browser deployments use standard redirect URI.
- What happens when magic link expires? User receives clear message and can request a new magic link.
- What happens when non-Enterprise user tries Azure AD? System displays upgrade prompt explaining Azure AD SSO requires Enterprise tier.
- What happens when stored refresh token is invalid on startup? System clears stored tokens and prompts user to sign in again.
- What happens when user makes many rapid edits with AutoSave enabled? System consolidates into one version per 5-minute window to prevent version bloat.
- What happens when a manifest references a binary asset URI (e.g., `sanyam://d4e5f6a7/assets/diagram.svg`)? System returns "not yet supported" error; manifests can reference future assets without breaking current resolution logic.
- What happens when user tries to save a document that exceeds their tier's size limit? System rejects with 413 Payload Too Large, displays clear message showing current document size, tier limit, and upgrade path.
- What happens when document version count exceeds tier limit? System automatically deletes oldest version(s) using FIFO to maintain count within limit; user is not notified (silent cleanup).
- What happens when versions exceed retention period? Nightly scheduled job hard-deletes versions older than tier's retention period (90 days for Free, 365 days for Pro, unlimited for Enterprise).
- What happens when soft-deleted document exceeds trash retention? Scheduled job hard-deletes document and cascades to versions, shares, and storage tracking (Free: 30 days, Pro: 90 days, Enterprise: 180 days).
- What happens when Free tier user tries to restore a deleted document? System displays upgrade prompt explaining document recovery requires Pro or Enterprise tier.
- What happens when user tries to restore a document after hard deletion? System returns 404 Not Found; document is permanently deleted and cannot be recovered.
- What happens when pagination cursor is invalid or malformed? System returns 400 Bad Request with clear error message; client should retry from beginning (no cursor).
- What happens when pagination cursor references a deleted item? System resumes from the next valid position; deleted items are skipped seamlessly without duplicating or skipping remaining items.
- What happens when limit query parameter exceeds maximum (100)? System clamps to maximum value (100) and includes the actual limit used in response metadata.
- What happens when an unexpected server error occurs? System returns 500 Internal Server Error with standard error envelope containing code INTERNAL_ERROR, generic safe message, and request ID in details for support correlation.
- What happens when request body fails Zod schema validation? System returns 422 Unprocessable Entity with code VALIDATION_ERROR and details containing field-level error messages keyed by JSON path.
- What happens when SANYAM_CORS_ORIGIN is not set in production? Server fails to start with clear error message requiring explicit CORS origin configuration for security.
- What happens when browser makes cross-origin request without CORS headers? Browser blocks the response; this is expected for desktop Electron clients which bypass CORS via Node backend.
- What happens when user downgrades tier and exceeds document count limit? Existing documents become read-only; user must delete documents to fall within new limit before creating new ones.
- What happens when user downgrades tier and has active shares? Existing shares remain active; collaborators retain access; user cannot create new shares until upgrading.
- What happens when user downgrades tier and has existing versions? Existing versions remain queryable; new version snapshots stop being created until user upgrades.
- What happens when user downgrades tier and has API keys? All API keys are immediately revoked; any in-flight requests using those keys receive 401 Unauthorized.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: System MUST allow users to sign in with email/password
- **FR-002**: System MUST allow users to sign in with magic link (passwordless email authentication)
- **FR-003**: System MUST allow users to sign in with OAuth providers: GitHub and Google (all tiers)
- **FR-004**: System MUST allow Enterprise users to sign in with Azure AD for organizational SSO
- **FR-005**: System MUST handle OAuth redirect URI differences between desktop (loopback redirect) and browser deployments
- **FR-006**: System MUST discover available auth providers on startup (via Supabase Auth API or SANYAM_AUTH_PROVIDERS environment variable)
- **FR-007**: System MUST render login UI dynamically based on discovered auth providers (no hard-coded provider IDs)
- **FR-008**: System MUST support enterprise deployments where customers configure their own auth providers (SAML, corporate OAuth, any Supabase-supported provider)
- **FR-009**: System MUST use default providers (GitHub, Google, Azure AD) only for hosted/SaaS deployments; enterprise deployments use customer-configured providers
- **FR-010**: System MUST persist session tokens (access token + refresh token) in encrypted per-user storage that survives IDE restarts
- **FR-011**: System MUST attempt to restore and validate the session on startup before prompting for re-authentication
- **FR-012**: System MUST allow users to sign out and immediately clear all stored tokens
- **FR-013**: System MUST handle automatic token refresh by propagating refreshed tokens to storage, client factories, and active HTTP sessions without user intervention
- **FR-014**: System MUST create per-request user-scoped database clients for all user-facing operations to enforce row-level security policies
- **FR-015**: System MUST restrict service-role/admin database access to system-level operations only (tier lookups, background jobs, migrations)
- **FR-016**: System MUST enforce database-level row-level security (RLS) as defense-in-depth, ensuring unauthorized access prevention even if application permission checks contain bugs

**Cloud Storage**

- **FR-017**: System MUST allow authenticated users to save documents to cloud storage
- **FR-018**: System MUST allow authenticated users to list their cloud documents
- **FR-019**: System MUST allow authenticated users to open cloud documents in the editor
- **FR-020**: System MUST allow authenticated users to delete their cloud documents (soft delete with recovery option)
- **FR-021**: System MUST use a custom URI scheme (`sanyam://`) for cloud document references
- **FR-022**: System MUST reserve the `/assets/` path segment in cloud URIs for future binary asset storage (e.g., `sanyam://{doc-id}/assets/{path}`)
- **FR-023**: System MUST return a "not yet supported" error when resolving asset URIs, allowing manifests to reference future assets without breaking current resolution
- **FR-024**: System MUST track document metadata including name, language type, creation date, and last modified date
- **FR-025**: System MUST implement optimistic locking for document updates using the document version number with If-Match header
- **FR-026**: System MUST return 409 Conflict when If-Match header version differs from stored version, including current version in response for client merge/retry
- **FR-027**: System MUST allow document updates without If-Match header (last-write-wins) but log a warning for observability
- **FR-028**: System MUST enforce trash retention periods for soft-deleted documents (Free: 30 days, Pro: 90 days, Enterprise: 180 days)
- **FR-029**: System MUST run a scheduled job to hard-delete soft-deleted documents after the tier's trash retention period, cascading to associated versions, shares, and storage usage tracking
- **FR-030**: System MUST allow Pro and Enterprise users to restore soft-deleted documents via "Restore Deleted Document" command before hard deletion
- **FR-031**: System MUST expose a restore endpoint (POST /api/v1/documents/:id/restore) for programmatic document recovery

**Document Content Caching**

- **FR-032**: System MUST maintain an in-memory content cache for cloud documents in UnifiedDocumentResolver with structure: Map<string, { content: string, version: number, fetchedAt: Date }>
- **FR-033**: System MUST evict cache entries after 5-minute TTL (time since fetchedAt)
- **FR-034**: System MUST evict cache entries immediately when the resolver receives a write confirmation for that document
- **FR-035**: System MUST NOT implement persistent local caching (SQLite, filesystem) for Phases 1–4

**Document Sharing**

- **FR-036**: System MUST allow document owners to share documents with other users
- **FR-037**: System MUST support three permission levels: view, edit, and admin
- **FR-038**: System MUST allow document owners to revoke sharing permissions
- **FR-039**: System MUST prevent shared users from sharing documents they don't own

**Version History**

- **FR-040**: System MUST automatically create version snapshots when documents are modified
- **FR-041**: System MUST allow users to view version history timeline
- **FR-042**: System MUST allow users to preview previous versions
- **FR-043**: System MUST allow users to restore previous versions
- **FR-044**: System MUST enforce per-document version count limits based on subscription tier (Free: 10, Pro: 100, Enterprise: 1000)
- **FR-045**: System MUST delete oldest versions (FIFO) when document version count exceeds tier limit
- **FR-046**: System MUST enforce time-based version retention limits (Free: 90 days, Pro: 365 days, Enterprise: unlimited)
- **FR-047**: System MUST run a nightly scheduled job to hard-delete versions older than the tier's retention period

**Subscription Tiers**

- **FR-048**: System MUST support three subscription tiers: Free, Pro, and Enterprise
- **FR-049**: System MUST enforce tier-based feature availability
- **FR-050**: System MUST enforce tier-based resource limits (storage space, document count)
- **FR-051**: System MUST enforce per-document size limits based on subscription tier (Free: 256KB, Pro: 2MB, Enterprise: 8MB)
- **FR-052**: System MUST reject document create/update operations that exceed the tier's per-document size limit with a 413 Payload Too Large response including clear message and upgrade path
- **FR-053**: System MUST display current tier and feature availability to users
- **FR-054**: System MUST provide clear upgrade paths and prompts
- **FR-055**: System MUST define tier_limits table in migration 001_documents.sql with: tier (subscription_tier enum, primary key), max_documents (int), max_storage_bytes (bigint), max_document_size_bytes (int), max_versions_per_document (int), version_retention_days (int), trash_retention_days (int), api_rate_limit_per_hour (int), has_cloud_storage (boolean), has_cloud_auth (boolean), has_document_sharing (boolean), has_document_versioning (boolean), has_api_keys (boolean)
- **FR-056**: System MUST seed tier_limits table with default values for 'free', 'pro', and 'enterprise' tiers in the same migration
- **FR-057**: System MUST have LicenseValidator fetch the full tier_limits row for the user's current tier from the database
- **FR-058**: System MUST have FeatureGate read boolean feature flags from the fetched tier_limits row rather than maintaining a hard-coded TypeScript mapping
- **FR-059**: System MUST define TierLimits interface in @sanyam/types that mirrors the tier_limits table row, exposing both boolean feature flags and numeric limits for type-safe access
- **FR-060**: System MUST extend FeatureGate interface with getTierLimits(): Promise\<TierLimits\> method that returns the full tier_limits row for the current user's tier
- **FR-061**: System MUST provide FeatureGate as the single injection point for both boolean feature checks (isFeatureEnabled) and numeric limit enforcement (getTierLimits), eliminating separate code paths
- **FR-062**: System MUST support tier capability changes via database updates without requiring code redeployment
- **FR-063**: LicenseValidator MUST cache tier_limits with a 15-minute TTL; the next isFeatureEnabled() or getTierLimits() call after expiry re-fetches from Supabase
- **FR-064**: supabase-auth-provider's onAuthStateChange handler MUST call LicenseValidator.invalidateCache() on SIGNED_IN and TOKEN_REFRESHED events to handle billing-triggered tier changes
- **FR-065**: System MUST expose a "Sanyam: Refresh License" command that manually invalidates the LicenseValidator cache for support and debugging scenarios
- **FR-066**: HTTP gateway MUST NOT cache tier information; it MUST fetch the user's tier on each request via the per-request user-scoped Supabase client to ensure server-side enforcement is always current
- **FR-067**: System MUST define FeatureRegistration interface { featureId: string, requiredTier: 'free' | 'pro' | 'enterprise' } in @sanyam/types for downstream packages to declare gated features
- **FR-068**: System MUST define FeatureContribution as a multi-bound inversify contribution pattern that packages implement to register their features on startup
- **FR-069**: FeatureGate MUST accept feature registrations from all FeatureContribution implementations and build its tier-to-feature map dynamically on startup
- **FR-070**: FeatureGate.isFeatureEnabled() MUST check both tier_limits boolean columns AND contributed feature registrations when determining feature availability
- **FR-071**: Database migration MUST include a comment documenting that subscription_tier enum is extensible via `ALTER TYPE subscription_tier ADD VALUE 'trial'` (or other future tier names)
- **FR-072**: LicenseValidator, FeatureGate, and HTTP gateway middleware MUST handle unknown tier values gracefully by defaulting to free-tier limits, ensuring forward compatibility when new tiers are added

**Tier Downgrade**

- **FR-073**: System MUST retain all documents when user downgrades tiers; documents exceeding the new tier's count limit become read-only until user deletes enough to fall within limits
- **FR-074**: System MUST prevent document creation when user exceeds their tier's document count limit (return 403 Forbidden with TIER_LIMIT_EXCEEDED code)
- **FR-075**: System MUST retain existing document shares when user downgrades tiers; shared collaborators keep their current access
- **FR-076**: System MUST prevent creation of new shares when user is on a tier without DOCUMENT_SHARING feature (return 403 Forbidden with FEATURE_NOT_AVAILABLE code)
- **FR-077**: System MUST stop creating new version snapshots for users whose tier does not include DOCUMENT_VERSIONING; existing versions remain queryable
- **FR-078**: System MUST revoke all API keys when user downgrades to a tier that does not include API_KEYS feature
- **FR-079**: System MUST provide a FeatureGate.degradeTier() hook that billing webhook handlers call to apply degradation policies atomically

**API Keys**

- **FR-080**: System MUST allow Pro and Enterprise users to create API keys
- **FR-081**: System MUST support scoped permissions on API keys
- **FR-082**: System MUST allow users to list and revoke their API keys
- **FR-083**: System MUST enforce rate limits on API key usage based on subscription tier
- **FR-084**: System MUST log API key usage for auditing

**Graceful Degradation**

- **FR-085**: System MUST function for local file editing when cloud services are unavailable
- **FR-086**: System MUST hide (not disable) cloud features when cloud services are unconfigured
- **FR-087**: System MUST provide clear error messages for connectivity issues
- **FR-088**: System MUST maintain a globally observable isOnline flag that is set to false when SupabaseClientFactory detects a failed connection (network error or Supabase unreachable)
- **FR-089**: System MUST display "Offline — changes saved locally only" in the status bar when isOnline is false
- **FR-090**: System MUST disable cloud commands (Save to Cloud, Share, etc.) while isOnline is false
- **FR-091**: System MUST NOT queue writes while offline; user must manually re-save to cloud after reconnecting
- **FR-092**: System MUST activate LocalOnlyDocumentStore only when Supabase is unconfigured (missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables), not when @sanyam/licensing is absent
- **FR-093**: When @sanyam/licensing is absent from node_modules, system MUST still enable cloud features but enforce free-tier numeric limits at the HTTP gateway level
- **FR-094**: Hono middleware MUST read tier_limits for 'free' tier directly when FeatureGate is unavailable (no licensing package), preventing the contradictory incentive of removing the package to gain more access

**AutoSave**

- **FR-095**: System MUST provide an AutoSave option that users can enable or disable
- **FR-096**: System MUST trigger AutoSave 10 seconds after the user's last edit when AutoSave is enabled
- **FR-097**: System MUST make AutoSave available to all subscription tiers (Free, Pro, Enterprise)
- **FR-098**: System MUST display a subtle status indicator showing AutoSave state (saving, saved, sync pending)
- **FR-099**: System MUST automatically retry failed AutoSave operations when connectivity is restored
- **FR-100**: System MUST consolidate AutoSave operations into one version snapshot per 5-minute editing window

**Real-Time Collaboration**

- **FR-101**: System MUST provide a "Start Live Session" command in the status bar for Pro and Enterprise users
- **FR-102**: System MUST generate a unique room code when starting a live session and copy it to clipboard
- **FR-103**: System MUST allow users to join a live session by entering a room code
- **FR-104**: System MUST synchronize document edits in real-time between all session participants
- **FR-105**: System MUST display remote participants' cursor positions and selections with distinct colors
- **FR-106**: System MUST display participant names/identities in the session
- **FR-107**: System MUST encrypt session content end-to-end (server cannot read shared content)
- **FR-108**: System MUST allow the session host to end the session for all participants
- **FR-109**: System MUST notify participants when another user joins or leaves the session
- **FR-110**: System MUST restrict real-time collaboration to Pro and Enterprise tiers

**API Pagination**

- **FR-111**: System MUST use cursor-based pagination for all list endpoints (/api/v1/documents, /api/v1/documents/:id/versions, /api/v1/api-keys)
- **FR-112**: System MUST accept pagination query parameters: limit (default 20, max 100), cursor (opaque base64-encoded updated_at+id pair), and direction (next | prev, default next)
- **FR-113**: System MUST include a pagination object in all list endpoint responses containing: next_cursor (string | null), prev_cursor (string | null), and total_count (number)
- **FR-114**: System MUST use cursor-based pagination over offset-based to correctly handle concurrent inserts/deletes without skipping or duplicating rows

**API Error Responses**

- **FR-115**: System MUST return all error responses (4xx and 5xx) in a consistent JSON envelope: `{ error: { code: string, message: string, details?: object } }`
- **FR-116**: System MUST use machine-readable error codes in SCREAMING_SNAKE_CASE format (e.g., DOCUMENT_NOT_FOUND, TIER_LIMIT_EXCEEDED, OPTIMISTIC_LOCK_CONFLICT, RATE_LIMIT_EXCEEDED, VALIDATION_ERROR, CLOUD_NOT_CONFIGURED)
- **FR-117**: System MUST include human-readable error messages in the message field suitable for display to end users
- **FR-118**: System MUST include context-specific data in the details field where applicable (e.g., current tier limits for TIER_LIMIT_EXCEEDED, conflicting version number for OPTIMISTIC_LOCK_CONFLICT, rate limit reset time for RATE_LIMIT_EXCEEDED, field-level validation errors for VALIDATION_ERROR)
- **FR-119**: System MUST handle Zod validation errors and format them into the standard error envelope with code VALIDATION_ERROR and field-level details

**CORS Configuration**

- **FR-120**: System MUST include CORS middleware for browser-hosted Theia deployments to enable cross-origin API requests
- **FR-121**: System MUST configure CORS origin from SANYAM_CORS_ORIGIN environment variable, defaulting to '*' in development mode
- **FR-122**: System MUST require explicit SANYAM_CORS_ORIGIN configuration in production mode (fail startup if not set or if set to '*')
- **FR-123**: System MUST allow CORS methods: GET, POST, PUT, DELETE, OPTIONS
- **FR-124**: System MUST allow CORS request headers: Content-Type, Authorization, If-Match
- **FR-125**: System MUST expose CORS response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag

**Billing Integration**

- **FR-126**: System MUST provide a POST /api/v1/webhooks/billing route for receiving billing provider (Stripe or equivalent) webhook events
- **FR-127**: System MUST authenticate the billing webhook route using service-role credentials only (not user session authentication)
- **FR-128**: System MUST verify billing webhook signatures using the billing provider's signature verification mechanism (e.g., Stripe-Signature header) to prevent spoofed events
- **FR-129**: Billing webhook handler MUST update user_profiles.tier when a subscription is created, upgraded, downgraded, or canceled
- **FR-130**: On tier downgrade via billing webhook, system MUST invoke FeatureGate.degradeTier() to apply degradation policies (FR-073-079)
- **FR-131**: System MUST read SANYAM_DEFAULT_TIER environment variable (default: 'free') to determine the default tier for newly created user profiles
- **FR-132**: Auto-create-profile database trigger MUST use SANYAM_DEFAULT_TIER value when creating new user profiles, enabling development and self-hosted deployments to default all users to a specific tier

### Tier Feature Matrix

| Feature                    | Free                 | Pro                  | Enterprise  |
|----------------------------|----------------------|----------------------|-------------|
| Cloud Storage              | 5 documents, 10MB    | 100 documents, 1GB   | Unlimited   |
| Max Document Size          | 256KB                | 2MB                  | 8MB         |
| Email/Password Auth        | Yes                  | Yes                  | Yes         |
| Magic Link Auth            | Yes                  | Yes                  | Yes         |
| OAuth (GitHub, Google)     | Yes                  | Yes                  | Yes         |
| Azure AD SSO               | No                   | No                   | Yes         |
| AutoSave                   | Yes                  | Yes                  | Yes         |
| Document Sharing           | No                   | Yes                  | Yes         |
| Real-Time Collaboration    | No                   | Yes                  | Yes         |
| Version History            | No                   | Yes                  | Yes         |
| Max Versions per Document  | 10                   | 100                  | 1000        |
| Version Retention          | 90 days              | 1 year               | Unlimited   |
| Trash Retention            | 30 days              | 90 days              | 180 days    |
| Document Recovery          | No                   | Yes                  | Yes         |
| API Keys                   | No                   | Yes                  | Yes         |
| Rate Limit (requests/hour) | 100                  | 1,000                | 10,000      |

### Key Entities

- **User Profile**: Represents a user account with authentication credentials, subscription tier, organization membership, and storage usage tracking
- **Cloud Document**: A DSL document stored in the cloud with owner, name, content, language type, version number (auto-incremented, used for optimistic locking via If-Match header), deleted_at timestamp for soft delete, and metadata; recoverable until hard deletion based on tier's trash retention period
- **Document Version**: A historical snapshot of document content at a point in time, linked to the parent document; subject to per-document count limits and time-based retention per tier
- **Document Share**: A permission grant allowing another user to access a document with specified permission level (asynchronous access)
- **Live Collaboration Session**: A real-time editing session with a unique room code, host user, participant list, and end-to-end encrypted communication channel
- **API Key**: A credential for programmatic access with name, scoped permissions, expiration, and usage tracking
- **Subscription Tier**: Defines feature availability and resource limits (Free, Pro, Enterprise); self-hosted enterprise deployments can override defaults via tier_limits table
- **Tier Limits (tier_limits table)**: Single source of truth for tier capabilities, defined in migration 001_documents.sql:
  - Primary key: tier (subscription_tier enum: 'free', 'pro', 'enterprise')
  - Numeric limits: max_documents (int), max_storage_bytes (bigint), max_document_size_bytes (int), max_versions_per_document (int), version_retention_days (int), trash_retention_days (int), api_rate_limit_per_hour (int)
  - Boolean feature flags: has_cloud_storage, has_cloud_auth, has_document_sharing, has_document_versioning, has_api_keys
  - Seeded with default values for free, pro, and enterprise tiers
  - LicenseValidator fetches the full row; FeatureGate exposes it via getTierLimits() method
- **TierLimits (interface in @sanyam/types)**: TypeScript interface mirroring the tier_limits table row, providing type-safe access to both boolean feature flags and numeric limits for consuming packages
- **FeatureRegistration (interface in @sanyam/types)**: Declares a gated feature { featureId: string, requiredTier: 'free' | 'pro' | 'enterprise' }
- **FeatureContribution (multi-bound inversify)**: Contribution pattern allowing downstream packages to register features on startup without modifying @sanyam/licensing
- **FeatureGate (interface)**: Single injection point for tier-based access control:
  - isFeatureEnabled(featureId: string): boolean — checks boolean feature flags and contributed feature registrations
  - getTierLimits(): Promise\<TierLimits\> — returns full tier_limits row for numeric limit enforcement
  - Builds tier-to-feature map dynamically from all FeatureContribution registrations plus tier_limits boolean columns

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the sign-in process in under 30 seconds
- **SC-002**: Documents save to cloud in under 3 seconds for files up to 1MB
- **SC-003**: Cloud document list loads in under 2 seconds for up to 100 documents
- **SC-004**: 95% of users can save their first document to cloud without assistance
- **SC-005**: System supports 10,000 concurrent authenticated users without degradation
- **SC-006**: Document sharing invitation delivery completes in under 5 seconds
- **SC-007**: Version history loads in under 2 seconds for documents with up to 100 versions
- **SC-008**: API key authentication validates in under 100 milliseconds
- **SC-009**: Local file editing remains fully functional when cloud is unavailable (zero cloud-related errors in logs)
- **SC-010**: 90% of users understand their current tier and available features after viewing the subscription panel

## Assumptions

- Users have internet connectivity for initial authentication and cloud operations
- Email addresses are used as primary user identifiers
- Social authentication providers (Google, GitHub) are commonly used by the target user base
- The IDE supports modern browsers with standard web authentication capabilities
- Real-time collaboration uses the Open Collaboration Tools (OCT) protocol via WebSocket connections
- Collaboration server (OCT server) is available and accessible to users
- Offline document editing with sync-on-reconnect is deferred to a future phase
- Binary asset storage (images, generated files) is deferred to a future phase
- Organization/team administration features are deferred to a future phase

## Dependencies

- Cloud infrastructure with authentication service capabilities
- Document storage service with versioning support
- IDE platform supporting custom URI schemes and authentication providers
- Status bar widget system for displaying user state
- Open Collaboration Tools (OCT) server for real-time collaboration sessions
- WebSocket connectivity for real-time communication

## Out of Scope

- Offline write queuing with automatic sync (deferred to future phase — current implementation uses simple offline indicator; user must manually re-save to cloud after reconnecting to avoid conflict resolution complexity)
- Persistent local cache for cloud documents (deferred alongside offline queuing — both features share same conflict resolution requirements; in-memory cache with 5-minute TTL is sufficient for Phases 1–4)
- Binary asset/file storage (future phase: Supabase Storage blob with URI `sanyam://{doc-id}/assets/{path}` — path segment reserved now)
- Organization administration and team management
- Custom Supabase deployment for self-hosted customers (Enterprise deployment mode documented but implementation deferred)
- Document comments and annotations
- Document export/import formats
- Self-hosted collaboration server (uses public OCT server or Sanyam-hosted instance)
- Supabase Realtime subscriptions for document change notifications (deferred to future collaboration phase — current architecture uses request-response fetches; future integration will scope subscriptions to documents filtered by owner_id/shared_with and surface as Theia FileSystemWatcher provider)
- Billing webhook handler implementation (deferred to post-Phase 4 — schema and route stub created in Phase 2 for manual tier assignment via Supabase dashboard SQL during development and early access)
- Trial subscription tier (deferred — subscription_tier enum remains 'free', 'pro', 'enterprise' for Phases 1–4; migration includes extensibility comment; code handles unknown tiers gracefully by defaulting to free-tier limits)
