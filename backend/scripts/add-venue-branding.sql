-- Add venue branding columns: logo, cover image, theme color, tagline
-- Run: psql -d jukebox -f scripts/add-venue-branding.sql

ALTER TABLE venues ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS tagline VARCHAR(255);
