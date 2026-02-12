# Specification Quality Checklist: Unified Cloud Storage, Authentication & Licensing

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-02-11
**Updated**: 2026-02-11 (after clarification sessions)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Summary

**Status**: PASSED

All checklist items validated successfully:

1. **Content Quality**: Spec focuses on user needs (sign in, save documents, share, AutoSave, real-time collaboration) without mentioning specific technologies. Written in business language.

2. **Requirement Completeness**:
   - 132 functional requirements (FR-001 to FR-132), each testable
   - Authentication & Security: 16 requirements (FR-001 to FR-016) covering sign-in methods, token management, dynamic provider discovery, and defense-in-depth security
   - Cloud Storage: 15 requirements (FR-017 to FR-031) including optimistic locking, trash retention, and document recovery
   - Document Content Caching: 4 requirements (FR-032 to FR-035) specifying in-memory cache with 5-minute TTL
   - Version History: 8 requirements (FR-040 to FR-047) including retention policy (count limits + time-based expiry)
   - Subscription Tiers: 7 requirements (FR-048 to FR-054) including per-document size limits
   - Database-Driven Feature Flags: 18 requirements (FR-055 to FR-072) specifying tier_limits table schema, seeding, TierLimits interface, FeatureGate, LicenseValidator cache invalidation, extensible feature registration via FeatureContribution, and enum extensibility/unknown tier handling
   - Tier Downgrade: 7 requirements (FR-073 to FR-079) specifying degradation policy for documents, shares, versioning, and API keys
   - API Keys: 5 requirements (FR-080 to FR-084) specifying creation, permissions, revocation, and rate limiting
   - Graceful Degradation: 10 requirements (FR-085 to FR-094) including offline indicator strategy and conditional module loading (licensing-absent fallback)
   - AutoSave: 6 requirements (FR-095 to FR-100) specifying idle timeout, tier availability, and version consolidation
   - Real-Time Collaboration: 10 requirements (FR-101 to FR-110) specifying live sessions, room codes, sync, and encryption
   - API Pagination: 4 requirements (FR-111 to FR-114) specifying cursor-based pagination for all list endpoints
   - API Error Responses: 5 requirements (FR-115 to FR-119) specifying standardized error envelope format
   - CORS Configuration: 6 requirements (FR-120 to FR-125) specifying cross-origin request handling for browser deployments
   - Billing Integration: 7 requirements (FR-126 to FR-132) specifying Stripe webhook route, signature verification, tier updates, and SANYAM_DEFAULT_TIER env var
   - 10 measurable success criteria with specific metrics
   - 32 edge cases documented (tier downgrade cases added)
   - Clear scope boundaries with "Out of Scope" section (12 deferred items)

3. **Feature Readiness**:
   - 9 user stories with detailed acceptance scenarios
   - User Story 1 (Authentication) expanded to 8 scenarios covering all sign-in methods
   - Clear tier feature matrix with authentication breakdown by method
   - Complete security model: token lifecycle + RLS defense-in-depth

## Clarification Session Log

**Session 2026-02-11**: 44 clarifications recorded (across 28 sessions)

| Question | Answer | Sections Updated |
|----------|--------|------------------|
| AutoSave idle timeout | 10 seconds after last keystroke | User Story 2, FR-042 |
| AutoSave tier availability | All tiers (Free, Pro, Enterprise) | FR-043, Tier Feature Matrix |
| AutoSave failure handling | Show subtle status indicator + auto-retry | FR-044, FR-045, Edge Cases |
| AutoSave version creation | Consolidate: one version per 5-minute window | User Story 2, FR-046, Edge Cases |
| Real-time collaboration scope | Both async sharing AND real-time sessions | Out of Scope, User Story 5, FR-047-056 |
| Real-time session initiation | Separate "Start Live Session" in status bar | User Story 5, FR-047, FR-048 |
| Real-time collaboration tiers | Pro and Enterprise only | FR-056, Tier Feature Matrix |
| Sign-in methods supported | Email/password, magic link, OAuth (GitHub, Google, Azure AD) | FR-001-004, User Story 1 |
| Azure AD tier restriction | Enterprise only; GitHub/Google available to all | FR-004, Tier Feature Matrix |
| OAuth redirect handling | Desktop uses loopback; browser uses standard redirect | FR-005, Edge Cases |
| OAuth provider configuration | Configurable via SANYAM_OAUTH_PROVIDERS env var | FR-006 |
| Session token persistence | Encrypted per-user storage (access + refresh tokens) | FR-007 |
| Startup session restoration | Validate refresh token before re-auth prompt | FR-008, Edge Cases |
| Sign-out token handling | Clear all tokens immediately | FR-009 |
| Token refresh handling | Propagate to storage, client factories, HTTP sessions | FR-010 |
| Client factory token approach | Subscribe to auth stream, not static tokens | FR-010 |
| Server route authorization | Defense-in-depth: per-request user-scoped client + RLS | FR-011, FR-012, FR-013 |
| Why per-request clients? | RLS prevents unauthorized access even with app bugs | FR-013 |
| Enterprise auth provider handling | Customer configures own providers on self-hosted Supabase | FR-008 |
| Should provider IDs be hard-coded? | No; discover via Supabase Auth API or env var | FR-006, FR-007 |
| Login UI dynamic providers | Render sign-in options based on discovered providers | FR-007 |
| Default providers for hosted/SaaS | GitHub, Google, Azure AD; enterprise uses custom | FR-009 |
| Document storage package name | `@sanyam/document-store` (uses Postgres client, not Storage API) | Planning terminology |
| DSL document storage method | PostgreSQL text/JSONB columns; binary assets deferred (blob storage) | FR-017-024, Assumptions |
| Asset URI handling before blob support | Reserve `/assets/` path; return "not yet supported" error | FR-022, FR-023, Edge Cases, Out of Scope |
| Per-document size limits | Free=256KB, Pro=2MB, Enterprise=8MB; 413 error with upgrade path; self-hosted can override | FR-036, FR-037, Tier Matrix, Edge Cases, Key Entities |
| Optimistic locking mechanism | version column + If-Match header; 409 Conflict on mismatch; no If-Match = last-write-wins with warning | FR-025, FR-026, FR-027, Edge Cases, Key Entities |
| Version retention policy | Count: Free=10, Pro=100, Enterprise=1000 (FIFO). Time: Free=90d, Pro=365d, Enterprise=unlimited. Nightly cleanup job. | FR-036-039, Tier Matrix, Edge Cases, Key Entities |
| Trash retention policy | Free=30d, Pro=90d, Enterprise=180d; cascade delete versions/shares/usage; Pro+ can restore via command/API | FR-028-031, Tier Matrix, Edge Cases, Key Entities |
| API pagination scheme | Cursor-based: limit (default 20, max 100), cursor (base64 updated_at+id), direction (next\|prev). Response: { next_cursor, prev_cursor, total_count }. Applies to all list endpoints. | FR-082-085, Edge Cases |
| API error response format | Consistent JSON envelope: { error: { code, message, details? } }. Machine-readable codes (SCREAMING_SNAKE_CASE). Context-specific details (tier limits, version conflicts, validation errors). | FR-086-090, Edge Cases |
| CORS configuration | Origin from SANYAM_CORS_ORIGIN env var ('*' in dev, required in prod). Methods: GET/POST/PUT/DELETE/OPTIONS. AllowedHeaders: Content-Type, Authorization, If-Match. ExposedHeaders: X-RateLimit-*, ETag. N/A for Electron. | FR-095-100, Edge Cases |
| Tier downgrade policy | Documents read-only if over limit. Shares remain active, no new shares. Versioning stops, existing queryable. API keys revoked. FeatureGate.degradeTier() hook for billing webhook. | FR-051-057, Edge Cases |
| Supabase Realtime deferral | Deferred to future collaboration phase (not Phases 1–4). Current architecture uses request-response. Future: subscribe to documents by owner_id/shared_with, surface as Theia FileSystemWatcher. | Out of Scope |
| Offline behavior strategy | Simple offline indicator (no write queuing). isOnline flag set by SupabaseClientFactory. Status bar shows "Offline — changes saved locally only." Cloud commands disabled. User must manually re-save after reconnecting. | FR-070-073, Out of Scope |
| Caching strategy | In-memory only for Phases 1–4: Map<string, { content, version, fetchedAt }>. 5-min TTL or evict on write confirmation. No persistent cache (SQLite/filesystem). Sufficient for sub-MB text files with acceptable latency. Persistent cache deferred alongside offline queuing. | FR-032-035, Out of Scope |
| Database-driven feature flags | tier_limits table with boolean feature columns (has_document_sharing, has_document_versioning, has_api_keys, has_realtime_collaboration) as single source of truth. LicenseValidator fetches full tier row. FeatureGate reads boolean flags from tier row, not hard-coded mapping. Eliminates code/database disconnect. | FR-055-058, Key Entities, Tier Matrix |
| Complete tier_limits schema | Explicit column definitions in migration 001_documents.sql: tier (subscription_tier enum PK), max_documents (int), max_storage_bytes (bigint), max_document_size_bytes (int), max_versions_per_document (int), version_retention_days (int), trash_retention_days (int), api_rate_limit_per_hour (int), has_cloud_storage (bool), has_cloud_auth (bool), has_document_sharing (bool), has_document_versioning (bool), has_api_keys (bool). Seeded with defaults for free/pro/enterprise. | FR-055-060, Key Entities |
| FeatureGate interface extension | Extend FeatureGate with getTierLimits(): Promise\<TierLimits\> method returning full tier_limits row. TierLimits interface defined in @sanyam/types for type-safe access across all downstream packages. Single injection point for both boolean feature checks (isFeatureEnabled) and numeric limit enforcement. | FR-059-061, Key Entities |
| Licensing-absent fallback | When @sanyam/licensing is absent, cloud features remain available but bounded by free-tier limits enforced at HTTP gateway (Hono middleware reads tier_limits for 'free' tier). Prevents contradictory incentive of removing package for more access. LocalOnlyDocumentStore only activates when Supabase is unconfigured (missing env vars). | FR-082-084, Edge Cases |
| LicenseValidator cache invalidation | (a) 15-minute TTL; re-fetch on expiry. (b) onAuthStateChange invalidates on SIGNED_IN/TOKEN_REFRESHED. (c) "Sanyam: Refresh License" command for manual invalidation. (d) HTTP gateway does NOT cache — per-request fetch for always-current server-side enforcement. | FR-063-066, Edge Cases |
| Extensible feature registration | FeatureRegistration interface { featureId, requiredTier } in @sanyam/types. FeatureContribution multi-bound inversify pattern for package-contributed features on startup. FeatureGate builds tier-to-feature map dynamically from contributions + tier_limits boolean columns. Avoids @sanyam/licensing as cross-package bottleneck. | FR-067-070, Key Entities |
| Billing integration boundary | Sanyam integrates with Stripe via POST /api/v1/webhooks/billing (service-role auth, Stripe signature verification). On downgrade, apply degradation policies (FR-073-079). Webhook handler implementation deferred to post-Phase 4; schema/route stub in Phase 2 for manual tier assignment. SANYAM_DEFAULT_TIER env var (default: 'free') for auto-create-profile trigger. | FR-126-132, Out of Scope |
| Trial tier deferral | subscription_tier enum remains 'free', 'pro', 'enterprise' for Phases 1–4. Migration includes comment documenting extensibility via `ALTER TYPE subscription_tier ADD VALUE`. All tier-handling code (LicenseValidator, FeatureGate, HTTP gateway) must default unknown tiers to free-tier limits for forward compatibility. | FR-071-072, Out of Scope |

## Notes

- Specification is ready for `/speckit.plan` to proceed with implementation planning
- Authentication fully specified: 3 methods (email/password, magic link, OAuth) with 3 OAuth providers
- Complete token lifecycle: storage, startup restoration, automatic refresh propagation, sign-out cleanup
- Defense-in-depth security model:
  - Per-request user-scoped database clients for user operations
  - Row-level security (RLS) at database level as safety net
  - Service-role client restricted to system-only operations
- Azure AD restricted to Enterprise tier for organizational SSO
- OAuth redirect URI handling documented for both desktop Theia and browser deployments
- Provider IDs configurable via environment variable for enterprise flexibility
- Storage architecture clarified: DSL documents in PostgreSQL (text/JSONB); binary assets via Supabase Storage in future phase
- Asset URI path segment (`/assets/`) reserved now for forward compatibility
- Per-document size limits enforced: Free=256KB, Pro=2MB, Enterprise=8MB (matches Supabase default payload limit)
- Self-hosted enterprise deployments can override tier limits via tier_limits table
- Optimistic locking: version column + If-Match header → 409 Conflict on mismatch; omitted If-Match allows last-write-wins with warning logging
- Version retention policy:
  - Count limits: Free=10, Pro=100, Enterprise=1000 versions per document (FIFO deletion on exceed)
  - Time limits: Free=90 days, Pro=365 days, Enterprise=unlimited (nightly scheduled cleanup job)
- Trash retention policy (soft delete → hard delete garbage collection):
  - Retention periods: Free=30 days, Pro=90 days, Enterprise=180 days
  - Hard delete cascades to: versions, shares, storage usage tracking
  - Document recovery: Pro+ tiers can restore via "Sanyam: Restore Deleted Document" command
  - HTTP API: POST /api/v1/documents/:id/restore endpoint for programmatic recovery
  - Scheduled job: Nightly cleanup permanently deletes expired soft-deleted documents
- API pagination: Cursor-based pagination for all list endpoints
  - Query params: limit (default 20, max 100), cursor (opaque base64 updated_at+id), direction (next|prev)
  - Response object: { next_cursor: string|null, prev_cursor: string|null, total_count: number }
  - Applies to: /api/v1/documents, /api/v1/documents/:id/versions, /api/v1/api-keys
  - Preferred over offset-based: handles concurrent inserts/deletes without skipping or duplicating rows
- API error responses: Standardized JSON envelope for all 4xx/5xx errors
  - Format: `{ error: { code: string, message: string, details?: object } }`
  - Code field: machine-readable identifier (SCREAMING_SNAKE_CASE)
  - Standard codes: DOCUMENT_NOT_FOUND, TIER_LIMIT_EXCEEDED, OPTIMISTIC_LOCK_CONFLICT, RATE_LIMIT_EXCEEDED, VALIDATION_ERROR, CLOUD_NOT_CONFIGURED, INTERNAL_ERROR
  - Details field: context-specific data (tier limits, conflicting version, validation errors by field path, rate limit reset time)
  - Zod validation errors automatically formatted with code VALIDATION_ERROR and field-level details
- CORS configuration for browser-hosted Theia deployments:
  - Origin: SANYAM_CORS_ORIGIN env var (defaults to '*' in development, required in production)
  - Allowed methods: GET, POST, PUT, DELETE, OPTIONS
  - Allowed request headers: Content-Type, Authorization, If-Match
  - Exposed response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag
  - Desktop Electron: CORS not applicable (requests originate from Node backend, not browser)
- Tier downgrade policy (graceful degradation when user downgrades subscription):
  - Documents: never deleted; read-only if over new tier's count limit; must delete to create new
  - Shares: existing remain active with collaborator access; cannot create new shares
  - Versioning: stops creating snapshots; existing versions remain queryable
  - API keys: immediately revoked on downgrade below API_KEYS tier
  - Implementation: FeatureGate.degradeTier() hook called by billing webhook handler
- Supabase Realtime: explicitly deferred to future collaboration phase
  - Rationale: current architecture uses request-response fetches (UnifiedDocumentResolver); IDE saves explicitly
  - Premature integration adds connection management complexity without clear user story
  - Future design: subscriptions scoped to documents table by owner_id/shared_with
  - Integration point: surface as Theia FileSystemWatcher provider for automatic dirty-state tracking
- Offline behavior: simple indicator strategy (no write queuing)
  - SupabaseClientFactory detects failed connection → sets isOnline=false
  - Status bar displays "Offline — changes saved locally only"
  - Cloud commands (Save to Cloud, Share, etc.) disabled while offline
  - Local file:// editing continues unaffected
  - No write queuing — user must manually re-save to cloud after reconnecting
  - Rationale: avoids conflict resolution complexity entirely; offline write queuing deferred to future phase
- Document content caching: in-memory only for Phases 1–4
  - UnifiedDocumentResolver cache structure: Map<string, { content: string, version: number, fetchedAt: Date }>
  - Cache eviction: 5-minute TTL or immediately on write confirmation
  - No persistent local cache (SQLite, filesystem) — deferred alongside offline queuing
  - Rationale: documents are small text files (sub-MB), latency acceptable, offline story disables cloud features vs. serving stale data
  - Persistent cache shares conflict resolution requirements with offline queuing (future phase)
- Database-driven feature flags: tier_limits table as single source of truth
  - Complete schema defined in migration 001_documents.sql
  - Primary key: tier (subscription_tier enum: 'free', 'pro', 'enterprise')
  - Numeric limits: max_documents (int), max_storage_bytes (bigint), max_document_size_bytes (int), max_versions_per_document (int), version_retention_days (int), trash_retention_days (int), api_rate_limit_per_hour (int)
  - Boolean feature columns: has_cloud_storage, has_cloud_auth, has_document_sharing, has_document_versioning, has_api_keys
  - Seeded with default values for free, pro, and enterprise tiers in same migration
  - LicenseValidator fetches complete tier_limits row for user's subscription tier
  - FeatureGate reads boolean flags from tier row rather than hard-coded TypeScript mapping
  - Benefit: tier capabilities configurable at database level without code redeployment
  - Self-hosted enterprise can customize feature availability per tier via database
- FeatureGate interface design:
  - isFeatureEnabled(featureId: string): boolean — checks boolean feature flags
  - getTierLimits(): Promise\<TierLimits\> — returns full tier_limits row for numeric limit enforcement
  - Single injection point for all tier-based access control (eliminates separate CloudDocumentStore.checkTierLimits code path)
  - TierLimits interface defined in @sanyam/types for type-safe access across all downstream packages
- Conditional module loading (licensing-absent fallback):
  - When @sanyam/licensing is absent from node_modules, cloud features remain available
  - Free-tier numeric limits enforced at HTTP gateway level (Hono middleware reads tier_limits directly)
  - Prevents contradictory incentive where removing the licensing package grants more access
  - LocalOnlyDocumentStore only activates when Supabase is unconfigured (missing SUPABASE_URL/SUPABASE_ANON_KEY)
  - This decouples cloud storage availability from licensing package presence
- LicenseValidator cache invalidation strategy:
  - 15-minute TTL on cached tier_limits; re-fetch from Supabase after expiry
  - onAuthStateChange handler (SIGNED_IN, TOKEN_REFRESHED) calls invalidateCache() for billing-triggered tier changes
  - "Sanyam: Refresh License" command for manual invalidation in support/debugging scenarios
  - HTTP gateway does NOT cache tier — fetches per-request via user-scoped client for always-current enforcement
  - Users who upgrade mid-session see new tier within 15 minutes or immediately on token refresh
- Extensible feature registration (FeatureContribution pattern):
  - FeatureRegistration interface { featureId: string, requiredTier: 'free' | 'pro' | 'enterprise' } in @sanyam/types
  - FeatureContribution multi-bound inversify pattern — packages contribute features on startup
  - FeatureGate builds tier-to-feature map dynamically from all contributions + tier_limits boolean columns
  - Benefit: downstream packages (e.g., @sanyam/projects-core) declare their own gated features without PRs to @sanyam/licensing
  - Avoids @sanyam/licensing becoming a cross-package bottleneck as feature set grows
- Billing integration boundary:
  - Sanyam integrates with Stripe (or equivalent) via webhook — does not implement billing directly
  - POST /api/v1/webhooks/billing route: service-role auth only, verified via Stripe-Signature header
  - Webhook handler updates user_profiles.tier on subscription create/upgrade/downgrade/cancel
  - On downgrade, invokes FeatureGate.degradeTier() to apply degradation policies (FR-073-079)
  - Implementation timing: webhook handler implementation deferred to post-Phase 4
  - Phase 2: creates schema and route stub for manual tier assignment via Supabase dashboard SQL
  - Interim workflow: `UPDATE user_profiles SET tier = 'pro' WHERE id = '...'` during development/early access
  - SANYAM_DEFAULT_TIER env var (default: 'free') used by auto-create-profile trigger
  - Allows development and self-hosted deployments to default all users to a specific tier
- Trial tier (deferred to future phase):
  - subscription_tier enum remains fixed to 'free', 'pro', 'enterprise' for Phases 1–4
  - Migration includes comment: enum extensible via `ALTER TYPE subscription_tier ADD VALUE 'trial'`
  - Forward compatibility: LicenseValidator, FeatureGate, HTTP gateway default unknown tiers to free-tier limits
  - Future trial implementation: add 'trial' to enum, trial_expires_at column, FeatureGate treats as pro, LicenseValidator checks expiry
