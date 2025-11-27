-- Add key_features JSONB column to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS key_features jsonb DEFAULT '[]'::jsonb;

-- Backfill from description if needed: (optional, keep commented)
-- UPDATE products SET key_features = jsonb_build_array(substring(description from '^[^\n]+' FOR 1)) WHERE key_features = '[]'::jsonb AND description IS NOT NULL;
