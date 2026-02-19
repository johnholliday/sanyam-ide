-- Add metadata column to documents table
-- Migration: 003_add_documents_metadata.sql
-- Created: 2026-02-19
--
-- The documents table was missing a metadata jsonb column that the API
-- expects for storing arbitrary key-value pairs (localUri, savedAt, etc.).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
