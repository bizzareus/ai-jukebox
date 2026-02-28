-- Add dedication_message to payments and queue_items (song dedication / shoutout)
-- Run: psql -d jukebox -f scripts/add-dedication-message.sql

ALTER TABLE payments ADD COLUMN IF NOT EXISTS dedication_message VARCHAR(500);
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS dedication_message VARCHAR(500);
