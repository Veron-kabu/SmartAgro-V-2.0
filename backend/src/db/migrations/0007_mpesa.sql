-- M-Pesa (Daraja) tables
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  phone VARCHAR(32) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  account_reference VARCHAR(64),
  transaction_desc VARCHAR(160),
  shortcode VARCHAR(16),
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  result_code VARCHAR(16),
  result_desc TEXT,
  mpesa_receipt_number VARCHAR(64),
  transaction_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'initiated',
  raw_callback JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpesa_b2c_payments (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  command_id VARCHAR(32) DEFAULT 'BusinessPayment',
  remarks VARCHAR(160),
  occasion VARCHAR(64),
  shortcode VARCHAR(16),
  conversation_id VARCHAR(128),
  transaction_id VARCHAR(64),
  result_code VARCHAR(16),
  result_desc TEXT,
  raw_result JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpesa_callback_logs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  body JSONB NOT NULL,
  related_id INTEGER,
  received_at TIMESTAMP DEFAULT NOW()
);
