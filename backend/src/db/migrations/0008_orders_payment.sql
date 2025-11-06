-- Add payment tracking fields to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(64) NULL;
