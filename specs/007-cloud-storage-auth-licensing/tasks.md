# Tasks: Unified Cloud Storage, Authentication & Licensing

**Input**: Design documents from `/specs/007-cloud-storage-auth-licensing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md project structure:
- `packages/types/src/` - @sanyam/types (extend existing)
- `packages/document-store/src/` - @sanyam/document-store (new)
- `packages/supabase-auth/src/` - @sanyam/supabase-auth (new)
- `packages/licensing/src/` - @sanyam/licensing (new)
- `packages/language-server/src/http/` - HTTP routes (extend)
- `packages/theia-extensions/product/src/browser/` - Theia UI (extend)
- `supabase/migrations/` - Database schema

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, new package scaffolding, and database schema

- [x] T001 Create package directory structure for `packages/document-store/` with package.json, tsconfig.json
- [x] T002 [P] Create package directory structure for `packages/supabase-auth/` with package.json, tsconfig.json
- [x] T003 [P] Create package directory structure for `packages/licensing/` with package.json, tsconfig.json
- [x] T003a [P] Create README.md for `packages/document-store/` with purpose, installation, usage, and API reference
- [x] T003b [P] Create README.md for `packages/supabase-auth/` with purpose, installation, usage, and API reference
- [x] T003c [P] Create README.md for `packages/licensing/` with purpose, installation, usage, and API reference
- [x] T004 [P] Create `supabase/` directory with supabase config.toml for local development
- [x] T005 Add new package dependencies to root package.json and workspace configuration
- [x] T006 Add @supabase/supabase-js, @hono/zod-validator, zod dependencies to relevant packages
- [x] T007 Create `.env.example` with all required environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, etc.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [x] T008 Create `supabase/migrations/001_documents.sql` with subscription_tier, share_permission, api_scope enums
- [x] T009 Add tier_limits table with all numeric limits and boolean feature flags to `001_documents.sql`
- [x] T010 Add user_profiles table with RLS policies and auto-create trigger to `001_documents.sql`
- [x] T011 Add documents table with RLS policies and storage tracking trigger to `001_documents.sql`
- [x] T012 Add document_versions table with RLS policies and version limit trigger to `001_documents.sql`
- [x] T013 Add document_shares table with RLS policies to `001_documents.sql`
- [x] T014 Add api_keys table with RLS policies to `001_documents.sql`
- [x] T015 Add cleanup functions (cleanup_expired_versions, cleanup_trash) to `001_documents.sql`
- [x] T016 Create `supabase/seed.sql` with tier_limits default values for free/pro/enterprise

### Shared Types (@sanyam/types)

- [x] T017 [P] Create TierLimits interface in `packages/types/src/tier-limits.ts`
- [x] T018 [P] Create FeatureRegistration interface in `packages/types/src/feature-registration.ts`
- [x] T019 [P] Create CloudDocument, DocumentVersion, DocumentShare interfaces in `packages/types/src/cloud-document.ts`
- [x] T020 [P] Create ApiKey, ApiScope types in `packages/types/src/api-key.ts`
- [x] T021 [P] Create UserProfile interface in `packages/types/src/user-profile.ts`
- [x] T022 [P] Create error code enums and ErrorResponse type in `packages/types/src/api-errors.ts`
- [x] T023 [P] Create Pagination types in `packages/types/src/pagination.ts`
- [x] T024 Export all new types from `packages/types/src/index.ts`

### Supabase Client Factory (@sanyam/document-store)

- [x] T025 Create SupabaseClientFactory interface and DI tokens in `packages/document-store/src/supabase-client-factory.ts`
- [x] T026 Implement SupabaseClientFactory with user-scoped client creation for RLS enforcement
- [x] T027 Add isOnline observable flag and connection health monitoring to SupabaseClientFactory

### HTTP Gateway Foundation (sanyam-language-server)

- [x] T028 Create error handling middleware in `packages/language-server/src/http/middleware/error-handler.ts`
- [x] T029 Create Zod validation middleware in `packages/language-server/src/http/middleware/validation.ts`
- [x] T030 [P] Create CORS middleware in `packages/language-server/src/http/middleware/cors.ts`
- [x] T031 [P] Create rate limiting middleware in `packages/language-server/src/http/middleware/rate-limit.ts`
- [x] T032 Create cursor-based pagination utilities in `packages/language-server/src/http/middleware/pagination.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - User Authentication (Priority: P1)

**Goal**: Users can sign in via email/password, magic link, or OAuth (GitHub, Google, Azure AD) and maintain sessions across IDE restarts

**Independent Test**: Sign in, refresh browser, verify session persists; sign out, verify cloud features unavailable

### Implementation for User Story 1

- [x] T033 [P] [US1] Create AuthStateEmitter interface and implementation in `packages/supabase-auth/src/auth-state-emitter.ts`
- [x] T034 [P] [US1] Create AuthSessionStorage wrapper for Theia SecretStorage in `packages/supabase-auth/src/auth-session-storage.ts`
- [x] T035 [US1] Create SupabaseAuthProvider implementing Theia AuthenticationProvider in `packages/supabase-auth/src/supabase-auth-provider.ts`
- [x] T036 [US1] Implement OAuth handler with browser vs desktop (loopback) redirect logic in `packages/supabase-auth/src/oauth-handler.ts`
- [x] T037 [US1] Implement token refresh scheduling and persistence in SupabaseAuthProvider
- [x] T038 [US1] Add dynamic auth provider discovery (Supabase API or SANYAM_AUTH_PROVIDERS env) to SupabaseAuthProvider
- [x] T039 [US1] Create auth middleware for HTTP gateway in `packages/language-server/src/http/middleware/auth.ts`
- [x] T040 [US1] Create DI module and exports for @sanyam/supabase-auth in `packages/supabase-auth/src/index.ts`
- [x] T041 [US1] Register SupabaseAuthProvider in Theia frontend DI in `packages/theia-extensions/product/src/browser/cloud/supabase-auth-frontend-module.ts`
- [x] T042 [US1] Create auth status bar widget showing signed-in user in `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T043 [US1] Implement Sign In command with dynamic provider buttons in `packages/theia-extensions/product/src/browser/cloud/cloud-auth-commands.ts`
- [x] T044 [US1] Implement Sign Out command and token cleanup in `packages/theia-extensions/product/src/browser/cloud/cloud-auth-commands.ts`

**Checkpoint**: User Story 1 (Authentication) should be fully functional and testable independently

---

## Phase 4: User Story 2 - Save Documents to Cloud (Priority: P1)

**Goal**: Users can save local DSL documents to cloud storage with the "Save to Cloud" command

**Independent Test**: Open local document, run "Save to Cloud" command, verify document appears in cloud document list

### Implementation for User Story 2

- [x] T045 [P] [US2] Create CloudDocumentStore interface in `packages/document-store/src/cloud-document-store.ts`
- [x] T046 [P] [US2] Create Zod schemas for document requests in `packages/language-server/src/http/routes/documents.schemas.ts`
- [x] T047 [US2] Implement CloudDocumentStore with create, update, delete operations using RLS-aware clients
- [x] T048 [US2] Add tier limit checking (document count, storage quota, document size) to CloudDocumentStore
- [x] T049 [US2] Implement POST /api/v1/documents endpoint in `packages/language-server/src/http/routes/documents.ts`
- [x] T050 [US2] Implement PUT /api/v1/documents/:id endpoint with optimistic locking (If-Match header)
- [x] T051 [US2] Implement DELETE /api/v1/documents/:id endpoint (soft delete)
- [x] T051a [US2] Implement POST /api/v1/documents/:id/restore endpoint with tier check (Pro+) in `packages/language-server/src/http/routes/documents.ts`
- [x] T052 [US2] Create SanyamUriScheme handler for `sanyam://` URIs in `packages/document-store/src/sanyam-uri-scheme.ts`, including `/assets/` path detection that returns "not yet supported" error per FR-022/FR-023
- [x] T053 [US2] Create "Save to Cloud" command in `packages/theia-extensions/product/src/browser/cloud/save-to-cloud-command.ts`
- [x] T054 [US2] Add cloud save status indicator to `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T055 [US2] Create DI module and exports for @sanyam/document-store in `packages/document-store/src/index.ts`

**Checkpoint**: User Story 2 (Save to Cloud) should be fully functional and testable independently

---

## Phase 5: User Story 3 - Open Cloud Documents (Priority: P1)

**Goal**: Users can browse and open their cloud-stored documents from within the IDE

**Independent Test**: Run "Open Cloud Document" command, select a document from list, verify it opens in editor

### Implementation for User Story 3

- [x] T056 [P] [US3] Create DocumentCache with 5-minute TTL in `packages/document-store/src/document-cache.ts`
- [x] T057 [US3] Create UnifiedDocumentResolver for cloud/local document resolution in `packages/document-store/src/unified-document-resolver.ts`
- [x] T058 [US3] Implement GET /api/v1/documents endpoint with pagination in `packages/language-server/src/http/routes/documents.ts`
- [x] T059 [US3] Implement GET /api/v1/documents/:id endpoint with ETag header
- [x] T060 [US3] Register SanyamUriScheme as Theia ResourceResolver for opening cloud documents
- [x] T061 [US3] Create "Open Cloud Document" command with document browser dialog in `packages/theia-extensions/product/src/browser/cloud/open-cloud-document.ts`
- [x] T062 [US3] Create CloudDocumentBrowserDialog showing paginated document list
- [x] T063 [US3] Handle empty state with guidance when user has no cloud documents
- [x] T063a [US3] Create "Restore Deleted Document" command with trash browser dialog in `packages/theia-extensions/product/src/browser/cloud/restore-document-command.ts`
- [x] T063b [US3] Add "Deleted Documents" tab to CloudDocumentBrowserDialog showing soft-deleted documents with restore option

**Checkpoint**: User Stories 1, 2, AND 3 (Core Cloud) should all work independently - MVP COMPLETE

---

## Phase 6: User Story 7 - Subscription Tier Management (Priority: P2)

**Goal**: Users can view their subscription tier and understand feature availability

**Independent Test**: View profile/subscription panel, verify tier and feature limits are correctly displayed

**Note**: Implementing US7 before US4-6 because licensing/feature gates are required for tier-restricted features

### Implementation for User Story 7

- [x] T064 [P] [US7] Create LicenseValidator interface in `packages/licensing/src/license-validator.ts`
- [x] T065 [P] [US7] Create FeatureGate interface with isFeatureEnabled and getTierLimits in `packages/licensing/src/feature-gate.ts`
- [x] T066 [US7] Implement LicenseValidator with 15-minute cached tier_limits fetching
- [x] T067 [US7] Implement FeatureGate with dynamic feature registration via FeatureContribution pattern
- [x] T068 [US7] Add cache invalidation on auth state changes (SIGNED_IN, TOKEN_REFRESHED) to LicenseValidator
- [x] T069 [US7] Create licensing middleware for HTTP gateway in `packages/language-server/src/http/middleware/licensing.ts`
- [x] T070 [US7] Create "Sanyam: Refresh License" command in `packages/licensing/src/commands/refresh-license-command.ts`
- [x] T071 [US7] Create subscription panel widget showing tier and limits in `packages/theia-extensions/product/src/browser/cloud/subscription-panel.ts`
- [x] T072 [US7] Add tier display to user profile area in `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T073 [US7] Create upgrade prompt dialog component for feature gates in `packages/theia-extensions/product/src/browser/cloud/upgrade-prompt-dialog.ts`
- [x] T074 [US7] Create DI module and exports for @sanyam/licensing in `packages/licensing/src/index.ts`

**Checkpoint**: User Story 7 (Tier Management) should be functional - users see their tier and limits

---

## Phase 7: User Story 4 - Share Documents with Collaborators (Priority: P2)

**Goal**: Document owners can share documents with other users (view/edit/admin permissions)

**Independent Test**: Share a document with another user's email, verify they can access it with correct permission level

### Implementation for User Story 4

- [x] T075 [P] [US4] Create Zod schemas for share requests in `packages/language-server/src/http/routes/shares.schemas.ts`
- [x] T076 [US4] Add sharing methods to CloudDocumentStore (createShare, revokeShare, listShares)
- [x] T077 [US4] Implement GET /api/v1/documents/:id/shares endpoint in `packages/language-server/src/http/routes/shares.ts`
- [x] T078 [US4] Implement POST /api/v1/documents/:id/shares endpoint with tier check (Pro+)
- [x] T079 [US4] Implement DELETE /api/v1/documents/:id/shares/:shareId endpoint
- [x] T080 [US4] Create "Share Document" command in `packages/theia-extensions/product/src/browser/cloud/share-document-command.ts`
- [x] T081 [US4] Create ShareDocumentDialog with email input and permission selector
- [x] T082 [US4] Show shared documents in cloud document browser with share indicator

**Checkpoint**: User Story 4 (Document Sharing) should be functional and independently testable

---

## Phase 8: User Story 6 - View Document Version History (Priority: P2)

**Goal**: Users can view version history timeline and restore previous versions

**Independent Test**: Make multiple edits, view version history, select a version, restore it

### Implementation for User Story 6

- [x] T083 [P] [US6] Create Zod schemas for version requests in `packages/language-server/src/http/routes/versions.schemas.ts`
- [x] T084 [US6] Add version methods to CloudDocumentStore (listVersions, getVersion, restoreVersion)
- [x] T085 [US6] Implement version snapshot creation on document update in CloudDocumentStore
- [x] T086 [US6] Implement GET /api/v1/documents/:id/versions endpoint in `packages/language-server/src/http/routes/versions.ts`
- [x] T087 [US6] Implement GET /api/v1/documents/:id/versions/:versionNumber endpoint
- [x] T088 [US6] Implement POST /api/v1/documents/:id/versions/:versionNumber/restore endpoint
- [x] T089 [US6] Create "Document History" command in `packages/theia-extensions/product/src/browser/cloud/document-history-command.ts`
- [x] T090 [US6] Create DocumentHistoryPanel showing version timeline with preview capability
- [x] T091 [US6] Implement version restore confirmation dialog

**Checkpoint**: User Story 6 (Version History) should be functional and independently testable

---

## Phase 9: User Story 5 - Real-Time Collaboration Sessions (Priority: P2)

**Goal**: Users can start live collaboration sessions with room codes for synchronized editing

**Independent Test**: Start live session, copy room code, join from another browser/device, verify synchronized edits and cursor visibility

### Implementation for User Story 5

- [x] T092 [P] [US5] Add @theia/collaboration and @open-collaboration-tools/yjs dependencies to product extension
- [x] T093 [US5] Create CollaborationSessionService wrapping OCT in `packages/theia-extensions/product/src/browser/collaboration/collaboration-session-service.ts`
- [x] T094 [US5] Create "Start Live Session" command in `packages/theia-extensions/product/src/browser/collaboration/start-live-session-command.ts`
- [x] T095 [US5] Create "Join Session" command with room code input in `packages/theia-extensions/product/src/browser/collaboration/join-session-command.ts`
- [x] T096 [US5] Add live session indicator with participant count to `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T097 [US5] Create "End Session" command for session hosts in `packages/theia-extensions/product/src/browser/collaboration/end-session-command.ts`
- [x] T098 [US5] Add tier gate (Pro+ only) for live session commands in collaboration command handlers
- [x] T099 [US5] Show participant cursors and selections with distinct colors via CollaborationColorService integration
- [x] T099a [US5] Verify OCT encryption is active: add integration test confirming session messages are encrypted and server cannot read content per FR-107

**Checkpoint**: User Story 5 (Real-Time Collaboration) should be functional and independently testable

---

## Phase 10: User Story 8 - API Key Management (Priority: P3)

**Goal**: Pro/Enterprise users can create, list, and revoke API keys for programmatic access

**Independent Test**: Create API key with scopes, copy the secret, use it to call documents API, revoke key, verify it stops working

### Implementation for User Story 8

- [x] T100 [P] [US8] Create Zod schemas for API key requests in `packages/language-server/src/http/routes/api-keys.schemas.ts`
- [x] T101 [US8] Create API key authentication middleware in `packages/language-server/src/http/middleware/api-key-auth.ts`
- [x] T102 [US8] Implement API key CRUD in CloudDocumentStore (createApiKey, listApiKeys, revokeApiKey)
- [x] T103 [US8] Implement GET /api/v1/api-keys endpoint in `packages/language-server/src/http/routes/api-keys.ts`
- [x] T104 [US8] Implement POST /api/v1/api-keys endpoint (returns key secret once)
- [x] T105 [US8] Implement GET /api/v1/api-keys/:id endpoint
- [x] T106 [US8] Implement DELETE /api/v1/api-keys/:id endpoint
- [x] T107 [US8] Create "Manage API Keys" command in `packages/theia-extensions/product/src/browser/cloud/manage-api-keys-command.ts`
- [x] T108 [US8] Create ApiKeyManagementPanel with create/list/revoke functionality
- [x] T109 [US8] Add tier gate (Pro+ only) for API key management

**Checkpoint**: User Story 8 (API Key Management) should be functional and independently testable

---

## Phase 11: User Story 9 - Graceful Offline/Unconfigured Behavior (Priority: P3)

**Goal**: IDE works seamlessly when cloud services are unavailable or unconfigured

**Independent Test**: Run IDE without SUPABASE_URL, verify local editing works and cloud commands are hidden

### Implementation for User Story 9

- [x] T110 [P] [US9] Create LocalOnlyDocumentStore fallback in `packages/document-store/src/local-only-document-store.ts`
- [x] T111 [US9] Add cloud configuration detection to SupabaseClientFactory (check SUPABASE_URL/SUPABASE_ANON_KEY)
- [x] T112 [US9] Implement conditional DI binding: CloudDocumentStore vs LocalOnlyDocumentStore based on config
- [x] T113 [US9] Add offline status bar indicator ("Offline - changes saved locally only") to `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T114 [US9] Hide cloud commands when cloud is unconfigured (use Theia command visibility)
- [x] T115 [US9] Disable cloud commands when isOnline is false
- [x] T116 [US9] Create clear error messages for connectivity issues in `packages/language-server/src/http/middleware/error-handler.ts` using standard error envelope format (FR-115-119)
- [x] T117 [US9] Implement free-tier fallback in gateway when @sanyam/licensing is absent

**Checkpoint**: User Story 9 (Graceful Degradation) should be functional - IDE works offline

---

## Phase 12: AutoSave Feature (Cross-Cutting, P1 Tier Feature)

**Goal**: Automatic cloud save after 10 seconds of idle with version consolidation

**Note**: AutoSave is available to all tiers per spec

- [x] T118 [P] Create AutoSaveService interface in `packages/document-store/src/auto-save-service.ts`
- [x] T119 Implement AutoSaveService in `packages/document-store/src/auto-save-service.ts` with 10-second idle detection and debouncing
- [x] T120 Implement 5-minute version consolidation window in `packages/document-store/src/auto-save-service.ts`
- [x] T121 Add AutoSave toggle to settings/preferences in `packages/theia-extensions/product/src/browser/cloud/auto-save-preferences.ts`
- [x] T122 Add AutoSave status indicator (saving, saved, sync pending) to `packages/theia-extensions/product/src/browser/cloud/cloud-status-bar.ts`
- [x] T123 Implement automatic retry on network failure with exponential backoff in `packages/document-store/src/auto-save-service.ts`

---

## Phase 13: Billing Webhook Stub & Tier Degradation

**Goal**: Prepare billing integration boundary with route stub and degradation policies

- [x] T124 [P] Create Zod schemas for billing webhook in `packages/language-server/src/http/routes/webhooks/billing.schemas.ts`
- [x] T125 Create POST /api/v1/webhooks/billing route stub in `packages/language-server/src/http/routes/webhooks/billing.ts`
- [x] T126 Implement signature verification placeholder for Stripe webhook
- [x] T127 Implement FeatureGate.degradeTier() hook for tier downgrade policies
- [x] T128 Implement API key revocation on tier downgrade below API_KEYS tier
- [x] T129 Add tier change handler that applies degradation policies

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and integration verification

- [x] T130 [P] Update CLAUDE.md with new package information
- [x] T131 [P] Add build commands for new packages to root package.json
- [x] T132 [P] Update Turborepo pipeline configuration for new packages
- [x] T133 Run quickstart.md validation (local Supabase setup, sign-in flow, save/open documents)
- [x] T134 Verify all HTTP routes return standard error envelope format
- [x] T135 Verify rate limiting headers are correctly set on all responses
- [x] T136 Verify CORS headers work for browser deployments
- [x] T137 Add environment variable validation on startup (fail-fast for missing required vars in production)
- [x] T138 Final integration test: complete user journey from sign-in through document save/open/share

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Setup completion - BLOCKS all user stories
- **Phases 3-11 (User Stories)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3)
  - US7 (Licensing) should complete before US4-6 (tier-gated features)
- **Phase 12-13 (AutoSave/Billing)**: Depend on US2 (Save to Cloud)
- **Phase 14 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

| User Story | Depends On | Notes |
|------------|------------|-------|
| US1 (Auth) | Foundation | No story dependencies |
| US2 (Save) | US1 | Requires authentication |
| US3 (Open) | US1, US2 | Requires auth and documents exist |
| US7 (Tiers) | US1 | Requires auth; enables tier gates |
| US4 (Share) | US1, US7 | Requires auth and tier checks |
| US5 (Collab) | US1, US7 | Requires auth and tier checks |
| US6 (Versions) | US1, US2, US7 | Requires docs and tier checks |
| US8 (API Keys) | US1, US7 | Requires auth and tier checks |
| US9 (Offline) | Foundation | Can parallel with US1 |

### Within Each User Story

- Interfaces/types before implementations
- Backend (routes) before frontend (commands/UI)
- Core implementation before UI polish

### Parallel Opportunities

**Setup Phase (T001-T007)**:
- T002, T003, T004 can all run in parallel

**Foundation Phase (T008-T032)**:
- T017-T023 (types) can all run in parallel
- T028-T031 (middleware) can run in parallel

**Per User Story**:
- Tasks marked [P] within same story can run in parallel
- Different user stories can be worked on in parallel by different developers

---

## Parallel Example: Foundation Types

```bash
# Launch all type definitions in parallel:
Task: "Create TierLimits interface in packages/types/src/tier-limits.ts"
Task: "Create FeatureRegistration interface in packages/types/src/feature-registration.ts"
Task: "Create CloudDocument interfaces in packages/types/src/cloud-document.ts"
Task: "Create ApiKey types in packages/types/src/api-key.ts"
Task: "Create UserProfile interface in packages/types/src/user-profile.ts"
Task: "Create error types in packages/types/src/api-errors.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Authentication)
4. Complete Phase 4: User Story 2 (Save to Cloud)
5. Complete Phase 5: User Story 3 (Open Cloud Documents)
6. **STOP and VALIDATE**: Test auth flow, save, and open independently
7. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1-3): Auth + Save + Open = Core cloud functionality
2. Add US7 (Tiers): Users see their tier and limits
3. Add US4 (Sharing): Document collaboration (Pro+)
4. Add US6 (Versions): Version history (Pro+)
5. Add US5 (Real-Time): Live collaboration sessions (Pro+)
6. Add US8 (API Keys): Programmatic access (Pro+)
7. Add US9 (Offline): Graceful degradation
8. Add AutoSave + Polish

### Suggested Development Phases

**Week 1**: Setup + Foundation + US1 (Auth)
**Week 2**: US2 (Save) + US3 (Open) = MVP complete
**Week 3**: US7 (Tiers) + US4 (Sharing)
**Week 4**: US6 (Versions) + US9 (Offline)
**Week 5**: US5 (Collab) + US8 (API Keys)
**Week 6**: AutoSave + Billing Stub + Polish

---

## Summary

| Phase | Task Count | User Story |
|-------|------------|------------|
| Setup | 10 | - |
| Foundational | 25 | - |
| US1 Authentication | 12 | P1 |
| US2 Save Documents | 12 | P1 |
| US3 Open Documents | 10 | P1 |
| US7 Tier Management | 11 | P2 |
| US4 Document Sharing | 8 | P2 |
| US6 Version History | 9 | P2 |
| US5 Real-Time Collab | 9 | P2 |
| US8 API Key Mgmt | 10 | P3 |
| US9 Offline Behavior | 8 | P3 |
| AutoSave | 6 | - |
| Billing Stub | 6 | - |
| Polish | 9 | - |
| **Total** | **145** | |

### MVP Scope (User Stories 1-3)

- **Tasks**: 69 (Setup + Foundation + US1 + US2 + US3)
- **Deliverable**: Users can sign in, save documents to cloud, open them, and restore from trash
- **Independent Test**: Complete sign-in → save → refresh → open → delete → restore cycle

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All HTTP responses must use standard error envelope: `{ error: { code, message, details } }` per FR-115-119
- FR-014 (per-request user-scoped clients) and FR-016 (RLS defense-in-depth) are complementary requirements describing implementation approach vs. security rationale - both are intentionally retained
- "Clear error messages" (FR-087) are implemented via the standard error envelope format with human-readable `message` field
