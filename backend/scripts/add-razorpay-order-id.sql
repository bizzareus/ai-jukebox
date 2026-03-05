-- Razorpay Order ID for "Pay Online" (Checkout / hosted payment page).
-- Run on existing DBs. Safe to run if column already exists.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255) UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
