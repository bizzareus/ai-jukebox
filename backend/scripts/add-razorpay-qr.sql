-- Razorpay QR Code flow: payments can be created via Razorpay QR (no order) or legacy order.
-- Run on existing DBs that used init-db before these columns existed.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_qr_id VARCHAR(255) UNIQUE;
ALTER TABLE payments ALTER COLUMN razorpay_order_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_qr_id ON payments(razorpay_qr_id) WHERE razorpay_qr_id IS NOT NULL;
