-- Fix RLS Infinite Recursion Between documents and document_shares
-- Migration: 002_fix_rls_recursion.sql
-- Created: 2026-02-18
--
-- Problem: The `documents` SELECT policy references `document_shares`,
-- and the `document_shares` SELECT policy references `documents`.
-- PostgreSQL detects this as infinite recursion (error 42P17).
--
-- Fix: Create a SECURITY DEFINER helper function that checks document
-- ownership without triggering RLS, then use it in `document_shares`
-- policies to break the cycle.

-- =============================================================================
-- HELPER FUNCTION (bypasses RLS to break recursion)
-- =============================================================================

-- Check if the current user owns a document, without triggering RLS on documents.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
CREATE OR REPLACE FUNCTION public.check_document_ownership(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = doc_id
      AND owner_id = (SELECT auth.uid())
  );
$$;

-- =============================================================================
-- FIX document_shares POLICIES (replace documents subqueries with helper)
-- =============================================================================

-- Drop all existing document_shares policies
DROP POLICY IF EXISTS "Users can view relevant shares" ON document_shares;
DROP POLICY IF EXISTS "Owner can create shares" ON document_shares;
DROP POLICY IF EXISTS "Owner can update shares" ON document_shares;
DROP POLICY IF EXISTS "Owner can delete shares" ON document_shares;

-- Recreate using the SECURITY DEFINER helper (no recursion)
CREATE POLICY "Users can view relevant shares"
  ON document_shares FOR SELECT
  USING (
    public.check_document_ownership(document_id)
    OR (SELECT auth.uid()) = shared_with_id
  );

CREATE POLICY "Owner can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (
    public.check_document_ownership(document_id)
  );

CREATE POLICY "Owner can update shares"
  ON document_shares FOR UPDATE
  USING (
    public.check_document_ownership(document_id)
  );

CREATE POLICY "Owner can delete shares"
  ON document_shares FOR DELETE
  USING (
    public.check_document_ownership(document_id)
  );

-- =============================================================================
-- FIX document_versions SELECT POLICY
-- =============================================================================

-- The versions SELECT policy also references documents → document_shares → documents.
-- Use the helper function for the share check too.

-- Helper: check if user has access to a document (owner or shared-with),
-- without triggering RLS on document_shares.
CREATE OR REPLACE FUNCTION public.check_document_access(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = doc_id
      AND deleted_at IS NULL
      AND (
        owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.document_shares
          WHERE document_id = doc_id
            AND shared_with_id = (SELECT auth.uid())
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Users can view versions of accessible documents" ON document_versions;

CREATE POLICY "Users can view versions of accessible documents"
  ON document_versions FOR SELECT
  USING (
    public.check_document_access(document_versions.document_id)
  );

-- =============================================================================
-- FIX documents SELECT POLICY (use helper for share check)
-- =============================================================================

-- The documents SELECT policy itself triggers the recursion when it
-- subqueries document_shares. Replace with a SECURITY DEFINER helper
-- that checks shares without triggering document_shares SELECT policy.

CREATE OR REPLACE FUNCTION public.check_shared_with_user(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_shares
    WHERE document_id = doc_id
      AND shared_with_id = (SELECT auth.uid())
  );
$$;

DROP POLICY IF EXISTS "Users can view accessible documents" ON documents;

CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    -- Active documents: owner or shared access
    (
      deleted_at IS NULL AND (
        (SELECT auth.uid()) = owner_id
        OR public.check_shared_with_user(documents.id)
      )
    )
    OR
    -- Deleted documents: owner only (for restore from trash)
    (deleted_at IS NOT NULL AND (SELECT auth.uid()) = owner_id)
  );
