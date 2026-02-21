-- Add customer_mobile to payments and queue_items (run on existing DBs that used init-db before this column existed)
-- Run: psql -d jukebox -f scripts/add-customer-mobile.sql

ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_mobile VARCHAR(255);
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS customer_mobile VARCHAR(255);
