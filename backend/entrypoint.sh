#!/bin/sh
set -e

# Run migrations in background so the server can start and pass healthcheck.
# If you use Supabase and already ran supabase-setup.sql, migrations are no-ops.
run_migrations() {
  echo "Running DB migrations (background)..."
  if [ -n "$DATABASE_URL" ]; then
    MIGRATION_URL="${DATABASE_MIGRATION_URL:-$DATABASE_URL}"
    psql "$MIGRATION_URL" -f scripts/init-db.sql 2>/dev/null || true
    psql "$MIGRATION_URL" -f scripts/add-global-playlist-and-super-admin.sql 2>/dev/null || true
    psql "$MIGRATION_URL" -f scripts/add-customer-mobile.sql 2>/dev/null || true
    psql "$MIGRATION_URL" -f scripts/add-venue-discount.sql 2>/dev/null || true
    psql "$MIGRATION_URL" -f scripts/add-razorpay-qr.sql 2>/dev/null || true
  else
    [ -z "$DB_PASSWORD" ] && return
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/init-db.sql 2>/dev/null || true
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-global-playlist-and-super-admin.sql 2>/dev/null || true
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-customer-mobile.sql 2>/dev/null || true
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-venue-discount.sql 2>/dev/null || true
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f scripts/add-razorpay-qr.sql 2>/dev/null || true
  fi
  echo "Migrations finished."
}
run_migrations &

echo "Starting Jukebox API..."
exec node dist/main.js
