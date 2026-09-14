-- Payment proxy for lastberth.com (muzobox acts as payment proxy).
-- Run: psql -d jukebox -f scripts/add-proxy-payments.sql

DO $$ BEGIN
  CREATE TYPE proxy_payment_status_enum AS ENUM ('created', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS proxy_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount INT NOT NULL,
  redirect_uri VARCHAR(2000) NOT NULL,
  callback_url VARCHAR(2000),
  reference_id VARCHAR(255),
  customer_name VARCHAR(255),
  customer_mobile VARCHAR(32),
  customer_email VARCHAR(255),
  description VARCHAR(500),
  status proxy_payment_status_enum NOT NULL DEFAULT 'created',
  razorpay_order_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  callback_status VARCHAR(32),
  callback_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proxy_payments_status ON proxy_payments(status);
CREATE INDEX IF NOT EXISTS idx_proxy_payments_reference_id ON proxy_payments(reference_id);
CREATE INDEX IF NOT EXISTS idx_proxy_payments_razorpay_order_id ON proxy_payments(razorpay_order_id);
