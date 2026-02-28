-- Jukebox: create schema and seed sample data
-- Run: psql -d jukebox -f scripts/init-db.sql
-- (Create DB first: createdb jukebox)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums (match TypeORM)
DO $$ BEGIN
  CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'venue_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('created', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE queue_item_status_enum AS ENUM ('pending', 'playing', 'played', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  upi_vpa VARCHAR(255) NOT NULL,
  price_per_song INT NOT NULL DEFAULT 100,
  discount_amount INT NOT NULL DEFAULT 0,
  qr_code_url TEXT,
  owner_id UUID NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role admin_role_enum NOT NULL DEFAULT 'venue_admin',
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  album VARCHAR(255),
  genre VARCHAR(255),
  language VARCHAR(255),
  thumbnail_url TEXT,
  thumbnail_hq_url TEXT,
  duration_seconds INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  channel_name VARCHAR(255),
  channel_id VARCHAR(255),
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count BIGINT NOT NULL DEFAULT 0,
  cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  razorpay_qr_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  song_id UUID NOT NULL,
  customer_name VARCHAR(255),
  customer_mobile VARCHAR(255),
  amount INT NOT NULL,
  status payment_status_enum NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_mobile VARCHAR(255),
  status queue_item_status_enum NOT NULL DEFAULT 'pending',
  position INT NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_venue_id ON admins(venue_id);
CREATE INDEX IF NOT EXISTS idx_songs_youtube_video_id ON songs(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_playlists_venue_id ON playlists(venue_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_payments_venue_id ON payments(venue_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_venue_status ON queue_items(venue_id, status);

-- Seed: only if no data exists
-- 1) Super admin (no venue_id) - use for creating venues and global library
INSERT INTO admins (id, email, password_hash, name, role)
SELECT
  'a0b1c2d3-e4f5-4a5b-8c9d-0e1f2a3b4c5d'::UUID,
  'superadmin@jukebox.local',
  '$2b$12$AhqaPEFwlD6iGA2PU6WOQOjoxVd6euENzGwxSDRhIV4GtM5oyaD/G',
  'Super Admin',
  'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE role = 'super_admin');

-- 2) Venue admin (for sample venue)
INSERT INTO admins (id, email, password_hash, name, role)
SELECT
  'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'::UUID,
  'admin@jukebox.local',
  '$2b$12$QiKXrnnKGS0Z3MsusbImq.UBf9aLb5Scr4rL8L3ZboHmKAIOdRXyy',
  'Bar Admin',
  'venue_admin'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = 'admin@jukebox.local');

-- 3) Venue (owner_id = super admin so super admin can manage it)
INSERT INTO venues (id, slug, name, upi_vpa, price_per_song, owner_id)
SELECT
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID,
  'sample-bar',
  'Sample Bar & Grill',
  'samplebar@okaxis',
  100,
  'a0b1c2d3-e4f5-4a5b-8c9d-0e1f2a3b4c5d'::UUID
WHERE NOT EXISTS (SELECT 1 FROM venues LIMIT 1);

-- 4) Link venue admin to venue
UPDATE admins SET venue_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID WHERE id = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'::UUID AND venue_id IS NULL;

-- 5) Sample songs (YouTube video IDs - real public videos)
INSERT INTO songs (id, youtube_video_id, title, artist, channel_name, thumbnail_url, thumbnail_hq_url, duration_seconds, channel_id, view_count, cached_at)
SELECT * FROM (VALUES
  ('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'::UUID, 'dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley', 'Rick Astley', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 212, 'UCuAXFkgsw1L7xaCfnd5JJOw', 1500000000, NOW()),
  ('d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a'::UUID, '9bZkp7q19f0', 'Gangnam Style', 'PSY', 'officialpsy', 'https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg', 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg', 252, 'UCv8Cd7dQ2b2j9Rd7p5LtGzg', 5000000000, NOW()),
  ('e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b'::UUID, 'kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi', 'Luis Fonsi', 'https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg', 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg', 282, 'UCANLZYMidaCbLQFWXBC95Jg', 8500000000, NOW())
) AS v(id, youtube_video_id, title, artist, channel_name, thumbnail_url, thumbnail_hq_url, duration_seconds, channel_id, view_count, cached_at)
WHERE NOT EXISTS (SELECT 1 FROM songs LIMIT 1);

-- 6) Sample playlists
INSERT INTO playlists (id, venue_id, name, description)
SELECT * FROM (VALUES
  ('f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c'::UUID, 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID, 'Classic Hits', 'All-time favourites'),
  ('a7b8c9d0-e1f2-0a1b-4c5d-6e7f8a9b0c1d'::UUID, 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID, 'Party Mix', 'Dance & party')
) AS v(id, venue_id, name, description)
WHERE NOT EXISTS (SELECT 1 FROM playlists LIMIT 1);

INSERT INTO playlist_songs (playlist_id, song_id, sort_order)
SELECT p.id, s.id, row_number() OVER (ORDER BY s.title)
FROM playlists p
CROSS JOIN songs s
WHERE p.venue_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID
  AND NOT EXISTS (SELECT 1 FROM playlist_songs LIMIT 1)
LIMIT 6;
