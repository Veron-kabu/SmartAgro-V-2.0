-- Create request_metrics table for telemetry
CREATE TABLE IF NOT EXISTS request_metrics (
  id serial PRIMARY KEY,
  route text NOT NULL,
  method varchar(8) NOT NULL,
  status integer NOT NULL,
  duration_ms integer NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Helpful index for range queries
CREATE INDEX IF NOT EXISTS idx_request_metrics_created_at ON request_metrics (created_at);
