#!/bin/sh
set -e

# Wait for PostgreSQL to be ready before running migrations.
# Retries for up to 30 seconds (30 × 1s) so the container survives slow DB starts
# without a fixed sleep that might be too short on cold storage.
echo "Waiting for database..."
MAX_TRIES=30
i=0
until pg_isready -h "${PGHOST:-postgres}" -U "${POSTGRES_USER:-postgres}" -q; do
    i=$((i + 1))
    if [ "$i" -ge "$MAX_TRIES" ]; then
        echo "Database did not become ready after ${MAX_TRIES}s — aborting."
        exit 1
    fi
    sleep 1
done
echo "Database is ready."

# Run migrations
echo "Running migrations..."
flask db upgrade

# Exec the main container command
echo "Starting application..."
exec "$@"
