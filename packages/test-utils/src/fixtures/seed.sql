-- Seed data for integration tests
-- This file is executed after migrations to set up test data

-- Note: Test users are created dynamically via createTestUser()
-- This file contains only static reference data that tests may depend on

-- Ensure tier_limits table has the expected tiers
INSERT INTO tier_limits (tier, max_documents, max_storage_bytes, max_api_keys, features)
VALUES
  ('free', 10, 104857600, 0, '{"sharing": false, "collaboration": false, "version_history": 7}'),
  ('pro', 100, 1073741824, 5, '{"sharing": true, "collaboration": true, "version_history": 30}'),
  ('enterprise', -1, 10737418240, -1, '{"sharing": true, "collaboration": true, "version_history": -1, "sso": true}')
ON CONFLICT (tier) DO UPDATE SET
  max_documents = EXCLUDED.max_documents,
  max_storage_bytes = EXCLUDED.max_storage_bytes,
  max_api_keys = EXCLUDED.max_api_keys,
  features = EXCLUDED.features;

-- Verify seed data
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM tier_limits) >= 3, 'tier_limits should have at least 3 tiers';
END $$;
