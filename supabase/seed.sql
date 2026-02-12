-- Sanyam IDE Seed Data
-- This file is run after migrations to populate initial data
--
-- Note: tier_limits are already seeded in the migration file.
-- This file is for additional test data during development.

-- Verify tier_limits were seeded correctly
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tier_limits WHERE tier = 'free') THEN
    RAISE EXCEPTION 'tier_limits not seeded correctly';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tier_limits WHERE tier = 'pro') THEN
    RAISE EXCEPTION 'tier_limits not seeded correctly';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tier_limits WHERE tier = 'enterprise') THEN
    RAISE EXCEPTION 'tier_limits not seeded correctly';
  END IF;

  RAISE NOTICE 'tier_limits seeded correctly with free, pro, and enterprise tiers';
END $$;
