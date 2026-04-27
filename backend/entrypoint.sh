#!/bin/sh
set -e

# Wait for DB (simple wait, better to use wait-for-it or healthcheck in real prod)
echo "Waiting for database..."
sleep 5

# Run migrations
echo "Running migrations..."
# Using --app app is redundant if FLASK_APP is set but safe.
# If 'db' command is missing, it means Flask-Migrate is not initialized properly or 'flask_migrate' package is missing.
# We will try to run it, but if it fails, we will NOT crash the container to allow debugging (temporarily).
flask db upgrade

# Seed initial data if needed (optional)
# python -m app.scripts.seed

# Exec the main container command
echo "Starting application..."
exec "$@"
