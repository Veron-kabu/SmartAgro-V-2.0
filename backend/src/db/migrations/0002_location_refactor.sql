-- Location refactor: add normalized columns, backfill from legacy JSON, drop geo_cell
BEGIN;

-- Users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS place_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_details JSONB;

-- Products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS place_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_details JSONB;

-- Backfill from legacy JSON blobs if present
UPDATE users SET
  latitude = COALESCE(latitude, NULLIF((location->>'lat'), '')::NUMERIC),
  longitude = COALESCE(longitude, NULLIF((location->>'lng'), '')::NUMERIC),
  place_name = COALESCE(place_name, NULLIF((location->>'name'), '')),
  address_details = COALESCE(address_details, NULLIF(location->'address', 'null')::jsonb)
WHERE location IS NOT NULL;

UPDATE products SET
  latitude = COALESCE(latitude, NULLIF((location->>'lat'), '')::NUMERIC),
  longitude = COALESCE(longitude, NULLIF((location->>'lng'), '')::NUMERIC),
  place_name = COALESCE(place_name, NULLIF((location->>'name'), '')),
  address_details = COALESCE(address_details, NULLIF(location->'address', 'null')::jsonb)
WHERE location IS NOT NULL;

-- Drop legacy geocell columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'geo_cell'
  ) THEN
    EXECUTE 'ALTER TABLE users DROP COLUMN geo_cell';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'geo_cell'
  ) THEN
    EXECUTE 'ALTER TABLE products DROP COLUMN geo_cell';
  END IF;
END$$;

-- Helpful indexes for bounding-box filters
CREATE INDEX IF NOT EXISTS idx_users_lat ON users (latitude);
CREATE INDEX IF NOT EXISTS idx_users_lng ON users (longitude);
CREATE INDEX IF NOT EXISTS idx_products_lat ON products (latitude);
CREATE INDEX IF NOT EXISTS idx_products_lng ON products (longitude);

COMMIT;