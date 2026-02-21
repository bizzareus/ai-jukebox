#!/bin/sh
set -e

echo "Running DB migrations..."

if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -f scripts/init-db.sql || echo "init-db.sql already applied, continuing..."
  psql "$DATABASE_URL" -f scripts/add-global-playlist-and-super-admin.sql || echo "super-admin migration already applied, continuing..."
  psql "$DATABASE_URL" -f scripts/add-customer-mobile.sql || echo "customer-mobile migration already applied, continuing..."
else
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/init-db.sql || echo "init-db.sql already applied, continuing..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-global-playlist-and-super-admin.sql || echo "super-admin migration already applied, continuing..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-customer-mobile.sql || echo "customer-mobile migration already applied, continuing..."
fi

echo "Starting Jukebox API..."
exec node dist/main.js
