-- Drop audit_logs table (idempotent)
-- Generated: 2025-11-19

BEGIN;

-- Ensure we drop the table if it exists
DROP TABLE IF EXISTS audit_logs CASCADE;

COMMIT;
