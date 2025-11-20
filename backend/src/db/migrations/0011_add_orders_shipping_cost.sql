-- Add shipping_cost column to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;