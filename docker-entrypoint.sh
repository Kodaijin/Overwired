#!/bin/sh
# Applies any pending database migrations, then starts the app.
#
# `migrate deploy` only applies migration files that already exist - it never
# generates one and never resets data, so it is safe to run on every start.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "AUTH_SECRET is not set. Generate one with: openssl rand -base64 48" >&2
  exit 1
fi

echo "Applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "Starting Pain Tracker on port ${PORT:-3000}..."
exec "$@"
