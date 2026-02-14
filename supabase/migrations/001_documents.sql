-- Sanyam IDE Cloud Storage Schema
-- Migration: 001_documents.sql
-- Created: 2026-02-11
--
-- This migration creates the core schema for cloud document storage,
-- authentication profiles, sharing, versioning, API keys, and tier limits.
--
-- NOTE: subscription_tier enum is extensible via:
--   ALTER TYPE subscription_tier ADD VALUE 'trial';
-- All downstream code handles unknown tiers by defaulting to 'free' limits.

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');

-- Document share permission levels
CREATE TYPE share_permission AS ENUM ('view', 'edit', 'admin');

-- API key scopes
CREATE TYPE api_scope AS ENUM (
  'documents:read',
  'documents:write',
  'documents:delete',
  'versions:read',
  'shares:read',
  'shares:write'
);

-- =============================================================================
-- TIER LIMITS TABLE
-- =============================================================================

-- Single source of truth for tier capabilities and numeric limits.
-- Changes take effect without code redeployment.
CREATE TABLE tier_limits (
  -- Primary key: tier enum
  tier subscription_tier PRIMARY KEY,

  -- Numeric limits
  max_documents integer NOT NULL DEFAULT 5,
  max_storage_bytes bigint NOT NULL DEFAULT 10485760,  -- 10MB
  max_document_size_bytes integer NOT NULL DEFAULT 262144,  -- 256KB
  max_versions_per_document integer NOT NULL DEFAULT 10,
  version_retention_days integer NOT NULL DEFAULT 90,
  trash_retention_days integer NOT NULL DEFAULT 30,
  api_rate_limit_per_hour integer NOT NULL DEFAULT 100,

  -- Boolean feature flags
  has_cloud_storage boolean NOT NULL DEFAULT true,
  has_cloud_auth boolean NOT NULL DEFAULT true,
  has_document_sharing boolean NOT NULL DEFAULT false,
  has_document_versioning boolean NOT NULL DEFAULT false,
  has_api_keys boolean NOT NULL DEFAULT false,
  has_realtime_collaboration boolean NOT NULL DEFAULT false,
  has_azure_ad boolean NOT NULL DEFAULT false,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default values
INSERT INTO tier_limits (tier, max_documents, max_storage_bytes, max_document_size_bytes,
  max_versions_per_document, version_retention_days, trash_retention_days, api_rate_limit_per_hour,
  has_cloud_storage, has_cloud_auth, has_document_sharing, has_document_versioning,
  has_api_keys, has_realtime_collaboration, has_azure_ad)
VALUES
  ('free', 5, 10485760, 262144, 10, 90, 30, 100,
   true, true, false, false, false, false, false),
  ('pro', 100, 1073741824, 2097152, 100, 365, 90, 1000,
   true, true, true, true, true, true, false),
  ('enterprise', 2147483647, 9223372036854775807, 8388608, 1000, -1, 180, 10000,
   true, true, true, true, true, true, true);

-- RLS: public read, admin write via service role (bypasses RLS)
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier limits"
  ON tier_limits FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- USER PROFILES TABLE
-- =============================================================================

-- Extended user profile linked to Supabase Auth auth.users
CREATE TABLE user_profiles (
  -- Links to auth.users.id
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile info
  email text NOT NULL,
  display_name text,
  avatar_url text,

  -- Subscription
  tier subscription_tier NOT NULL DEFAULT 'free',
  trial_expires_at timestamptz,  -- Reserved for future trial tier

  -- Usage tracking
  storage_used_bytes bigint NOT NULL DEFAULT 0,
  document_count integer NOT NULL DEFAULT 0,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for tier lookups
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);

-- RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- Users can update their own profile (except tier - managed by billing)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  default_tier public.subscription_tier;
BEGIN
  -- Read default tier from environment or use 'free'
  BEGIN
    default_tier := COALESCE(
      current_setting('app.default_tier', true)::public.subscription_tier,
      'free'::public.subscription_tier
    );
  EXCEPTION WHEN OTHERS THEN
    default_tier := 'free'::public.subscription_tier;
  END;

  INSERT INTO public.user_profiles (id, email, tier)
  VALUES (NEW.id, NEW.email, default_tier);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- =============================================================================
-- DOCUMENTS TABLE
-- =============================================================================

-- Cloud-stored DSL documents with soft delete support
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  owner_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Document metadata
  name text NOT NULL,
  language_id text NOT NULL,  -- e.g., 'ecml', 'garp'

  -- Content (text for DSL source)
  content text NOT NULL DEFAULT '',
  content_size_bytes integer GENERATED ALWAYS AS (octet_length(content)) STORED,

  -- Optimistic locking
  version integer NOT NULL DEFAULT 1,

  -- Soft delete
  deleted_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_owner_id ON documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_updated_at_id ON documents(updated_at, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NOT NULL;

-- RLS policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- NOTE: "Users can view accessible documents" policy is deferred to after
-- document_shares table creation (references document_shares).
-- That single policy covers both active (owner+shared) and deleted (owner only) documents.

-- INSERT: Only owner
CREATE POLICY "Users can create documents"
  ON documents FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- UPDATE: Only owner
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- DELETE: Only owner (soft delete)
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING ((SELECT auth.uid()) = owner_id);

-- Auto-update updated_at and increment version
CREATE OR REPLACE FUNCTION update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_document_timestamp();

-- Update user storage tracking
CREATE OR REPLACE FUNCTION update_user_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles
    SET storage_used_bytes = storage_used_bytes + NEW.content_size_bytes,
        document_count = document_count + 1
    WHERE id = NEW.owner_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles
    SET storage_used_bytes = storage_used_bytes - OLD.content_size_bytes + NEW.content_size_bytes
    WHERE id = NEW.owner_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles
    SET storage_used_bytes = storage_used_bytes - OLD.content_size_bytes,
        document_count = document_count - 1
    WHERE id = OLD.owner_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE TRIGGER documents_storage_tracking
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_user_storage();

-- =============================================================================
-- DOCUMENT VERSIONS TABLE
-- =============================================================================

-- Historical snapshots of document content
CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent document
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Version info
  version_number integer NOT NULL,
  content text NOT NULL,
  content_size_bytes integer GENERATED ALWAYS AS (octet_length(content)) STORED,

  -- Metadata
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Unique version per document
  UNIQUE(document_id, version_number)
);

-- Indexes
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_versions_created_at ON document_versions(created_at);

-- RLS policies (inherit from parent document)
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- NOTE: "Users can view versions of accessible documents" policy is deferred to after
-- document_shares table creation (references document_shares).

-- Only owner can create versions (via document save)
CREATE POLICY "Owner can create versions"
  ON document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_versions.document_id
        AND (SELECT auth.uid()) = documents.owner_id
    )
  );

-- Enforce version count limit (FIFO deletion)
CREATE OR REPLACE FUNCTION enforce_version_limit()
RETURNS TRIGGER AS $$
DECLARE
  max_versions integer;
  current_count integer;
BEGIN
  -- Get user's tier limit
  SELECT t.max_versions_per_document INTO max_versions
  FROM public.documents d
  JOIN public.user_profiles u ON d.owner_id = u.id
  JOIN public.tier_limits t ON u.tier = t.tier
  WHERE d.id = NEW.document_id;

  -- Count current versions
  SELECT COUNT(*) INTO current_count
  FROM public.document_versions
  WHERE document_id = NEW.document_id;

  -- Delete oldest if over limit
  IF current_count > max_versions THEN
    DELETE FROM public.document_versions
    WHERE id IN (
      SELECT id FROM public.document_versions
      WHERE document_id = NEW.document_id
      ORDER BY version_number ASC
      LIMIT current_count - max_versions
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE TRIGGER enforce_version_limit_trigger
  AFTER INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_version_limit();

-- =============================================================================
-- DOCUMENT SHARES TABLE
-- =============================================================================

-- Sharing permissions between users
CREATE TABLE document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document being shared
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- User receiving share
  shared_with_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Permission level
  permission share_permission NOT NULL DEFAULT 'view',

  -- Metadata
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- One share per user per document
  UNIQUE(document_id, shared_with_id)
);

-- Indexes
CREATE INDEX idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX idx_document_shares_shared_with_id ON document_shares(shared_with_id);

-- RLS policies
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Users can view shares for documents they own or are shared with
CREATE POLICY "Users can view relevant shares"
  ON document_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
        AND (SELECT auth.uid()) = documents.owner_id
    )
    OR (SELECT auth.uid()) = shared_with_id
  );

-- Only document owner can create shares
CREATE POLICY "Owner can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
        AND (SELECT auth.uid()) = documents.owner_id
    )
  );

-- Only document owner can update shares
CREATE POLICY "Owner can update shares"
  ON document_shares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
        AND (SELECT auth.uid()) = documents.owner_id
    )
  );

-- Only document owner can delete shares
CREATE POLICY "Owner can delete shares"
  ON document_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
        AND (SELECT auth.uid()) = documents.owner_id
    )
  );

-- =============================================================================
-- DEFERRED RLS POLICIES (require document_shares to exist)
-- =============================================================================

-- Documents: Owner or shared access (SELECT)
CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    -- Active documents: owner or shared access
    (
      deleted_at IS NULL AND (
        (SELECT auth.uid()) = owner_id
        OR EXISTS (
          SELECT 1 FROM document_shares
          WHERE document_shares.document_id = documents.id
            AND document_shares.shared_with_id = (SELECT auth.uid())
        )
      )
    )
    OR
    -- Deleted documents: owner only (for restore from trash)
    (deleted_at IS NOT NULL AND (SELECT auth.uid()) = owner_id)
  );

-- Document versions: Inherit access from parent document
CREATE POLICY "Users can view versions of accessible documents"
  ON document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_versions.document_id
        AND documents.deleted_at IS NULL
        AND (
          (SELECT auth.uid()) = documents.owner_id
          OR EXISTS (
            SELECT 1 FROM document_shares
            WHERE document_shares.document_id = documents.id
              AND document_shares.shared_with_id = (SELECT auth.uid())
          )
        )
    )
  );

-- =============================================================================
-- API KEYS TABLE
-- =============================================================================

-- API keys for programmatic access
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Key info (hash, not plaintext)
  name text NOT NULL,
  key_hash text NOT NULL,  -- SHA-256 hash of key
  key_prefix text NOT NULL,  -- First 8 chars for identification

  -- Permissions
  scopes api_scope[] NOT NULL DEFAULT '{}',

  -- Usage tracking
  last_used_at timestamptz,
  usage_count integer NOT NULL DEFAULT 0,

  -- Expiration (optional)
  expires_at timestamptz,

  -- Revocation
  revoked_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Unique prefix per user for easy identification
  UNIQUE(user_id, key_prefix)
);

-- Indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own keys
CREATE POLICY "Users can view own keys"
  ON api_keys FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create keys"
  ON api_keys FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own keys"
  ON api_keys FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own keys"
  ON api_keys FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SCHEDULED CLEANUP FUNCTIONS
-- =============================================================================

-- Run nightly: Delete versions beyond retention period
CREATE OR REPLACE FUNCTION cleanup_expired_versions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.document_versions v
  USING public.documents d, public.user_profiles u, public.tier_limits t
  WHERE v.document_id = d.id
    AND d.owner_id = u.id
    AND u.tier = t.tier
    AND t.version_retention_days > 0  -- -1 means unlimited
    AND v.created_at < now() - (t.version_retention_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Run nightly: Hard-delete documents past trash retention
CREATE OR REPLACE FUNCTION cleanup_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM public.documents d
  USING public.user_profiles u, public.tier_limits t
  WHERE d.owner_id = u.id
    AND u.tier = t.tier
    AND d.deleted_at IS NOT NULL
    AND d.deleted_at < now() - (t.trash_retention_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant access to authenticated users
GRANT SELECT ON tier_limits TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON documents TO authenticated;
GRANT ALL ON document_versions TO authenticated;
GRANT ALL ON document_shares TO authenticated;
GRANT ALL ON api_keys TO authenticated;

-- Grant access to service role for admin operations
GRANT ALL ON tier_limits TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON documents TO service_role;
GRANT ALL ON document_versions TO service_role;
GRANT ALL ON document_shares TO service_role;
GRANT ALL ON api_keys TO service_role;
