-- Add flat discount (₹ off) to venues. Final price = price_per_song - discount_amount (min 1).
-- Run on existing DBs that used init-db before this column existed.

ALTER TABLE venues ADD COLUMN IF NOT EXISTS discount_amount INT NOT NULL DEFAULT 0;
