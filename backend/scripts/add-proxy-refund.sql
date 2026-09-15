-- Refund tracking for proxy payments (lastberth automated refunds).
-- Run: psql -d jukebox -f scripts/add-proxy-refund.sql

ALTER TABLE proxy_payments
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS refund_amount INT,
  ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_error TEXT;

CREATE INDEX IF NOT EXISTS idx_proxy_payments_refund_status ON proxy_payments(refund_status);
