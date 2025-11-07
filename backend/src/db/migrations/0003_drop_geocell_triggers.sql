-- Clean up legacy geocell triggers/functions that reference removed columns
BEGIN;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS users_set_geocell ON users;
DROP TRIGGER IF EXISTS products_set_geocell ON products;

-- Drop trigger functions if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trg_users_set_geocell'
  ) THEN
    EXECUTE 'DROP FUNCTION trg_users_set_geocell()';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trg_products_set_geocell'
  ) THEN
    EXECUTE 'DROP FUNCTION trg_products_set_geocell()';
  END IF;
END$$;

-- Drop helper function used by triggers (signature from legacy migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'geocell_from_location'
  ) THEN
    -- Legacy signature: (jsonb, integer)
    BEGIN
      EXECUTE 'DROP FUNCTION geocell_from_location(jsonb, integer)';
    EXCEPTION WHEN undefined_function THEN
      -- Ignore if different signature or already gone
      NULL;
    END;
  END IF;
END$$;

-- Drop any old indexes on geo_cell if present (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_users_geo_cell') THEN
    EXECUTE 'DROP INDEX idx_users_geo_cell';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_products_geo_cell') THEN
    EXECUTE 'DROP INDEX idx_products_geo_cell';
  END IF;
END$$;

COMMIT;