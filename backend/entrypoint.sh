#!/bin/sh
set -e

# Wait for PostgreSQL to be ready before running migrations.
# Uses Python TCP check since pg_isready is not available in python:slim images.
echo "Waiting for database..."
MAX_TRIES=30
i=0
DB_HOST="${PGHOST:-postgres}"
DB_PORT="${PGPORT:-5432}"

until python3 -c "
import socket, sys
try:
    s = socket.create_connection(('${DB_HOST}', ${DB_PORT}), timeout=2)
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge "$MAX_TRIES" ]; then
        echo "Database did not become ready after ${MAX_TRIES}s — aborting."
        exit 1
    fi
    echo "  Waiting for ${DB_HOST}:${DB_PORT}... (${i}/${MAX_TRIES})"
    sleep 1
done
echo "Database is ready."

# Run migrations
echo "Running migrations..."
flask db upgrade

# Exec the main container command
echo "Starting application..."
exec "$@"
