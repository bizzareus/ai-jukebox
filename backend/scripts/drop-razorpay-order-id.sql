-- Remove razorpay_order_id from payments; QR flow uses only razorpay_qr_id (referred to as order id).
-- Run after add-razorpay-qr.sql on existing DBs. Safe to run if column already dropped.

ALTER TABLE payments DROP COLUMN IF EXISTS razorpay_order_id;
