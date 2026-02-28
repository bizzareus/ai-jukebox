#!/bin/sh
set -e
export BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
export PORT="${PORT:-80}"
# In production, BACKEND_URL must point to your backend service (e.g. https://backend.up.railway.app).
# Otherwise nginx will proxy /api/ to localhost:3001 and webhooks/API will get "Connection refused".
if [ "$BACKEND_URL" = "http://localhost:3001" ] && [ "$PORT" = "80" ]; then
  echo "Warning: BACKEND_URL is default (localhost:3001). Set BACKEND_URL to your backend URL for /api and webhooks to work."
fi
envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
