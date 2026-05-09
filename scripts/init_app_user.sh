#!/bin/bash
# PostgreSQL init script — runs once when the postgres container first starts.
# Creates a limited application user for runtime DML-only access.
# Alembic migrations continue to use POSTGRES_USER (superuser) for DDL.
set -e

: "${APP_DB_USER:?APP_DB_USER env var required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD env var required}"
: "${POSTGRES_DB:?POSTGRES_DB env var required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
      CREATE USER ${APP_DB_USER} WITH PASSWORD '${APP_DB_PASSWORD}';
    END IF;
  END\$\$;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};
  GRANT USAGE ON SCHEMA public TO ${APP_DB_USER};
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_DB_USER};
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_DB_USER};
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_USER};
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ${APP_DB_USER};
EOSQL

echo "app_user '${APP_DB_USER}' created and granted DML privileges on '${POSTGRES_DB}'."
