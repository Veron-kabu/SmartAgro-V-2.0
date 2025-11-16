-- Migration: add persistent cart table
-- Date: 2025-11-16

CREATE TABLE IF NOT EXISTS cart (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate cart rows for the same user+product
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_cart_user_product' AND n.nspname = current_schema()
  ) THEN
    CREATE UNIQUE INDEX idx_cart_user_product ON cart(user_id, product_id);
  END IF;
END$$;
