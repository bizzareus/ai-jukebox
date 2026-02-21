-- Allow playlists without a venue (global library)
-- Run: psql -d jukebox -f scripts/add-global-playlist-and-super-admin.sql

ALTER TABLE playlists ALTER COLUMN venue_id DROP NOT NULL;

-- Super admin account (password: password) - change after first login in production
INSERT INTO admins (id, email, password_hash, name, role)
SELECT
  'a0b1c2d3-e4f5-4a5b-8c9d-0e1f2a3b4c5d'::UUID,
  'superadmin@jukebox.local',
  '$2b$12$AhqaPEFwlD6iGA2PU6WOQOjoxVd6euENzGwxSDRhIV4GtM5oyaD/G',
  'Super Admin',
  'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE role = 'super_admin');
