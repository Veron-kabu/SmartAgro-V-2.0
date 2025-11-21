-- Migration: drop mpesa_callback_logs
-- This migration removes the mpesa_callback_logs table which is no longer used.
BEGIN;
DROP TABLE IF EXISTS mpesa_callback_logs;
COMMIT;
