-- UPI QR for proxy payment links (lastberth.com flow).
-- Run: psql -d jukebox -f scripts/add-proxy-qr-id.sql

ALTER TABLE proxy_payments
  ADD COLUMN IF NOT EXISTS razorpay_qr_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_proxy_payments_razorpay_qr_id ON proxy_payments(razorpay_qr_id);
