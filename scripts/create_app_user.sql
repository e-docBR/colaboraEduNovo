-- Run this script as the superuser (POSTGRES_USER) after the database is created.
-- Substitute APP_DB_USER and APP_DB_PASSWORD with the actual values before running.
--
-- This creates a limited application user that can only perform DML (SELECT/INSERT/UPDATE/DELETE).
-- Alembic migrations continue to use the superuser for DDL (CREATE TABLE, ALTER, etc.).

CREATE USER app_user WITH PASSWORD 'REPLACE_ME';

GRANT CONNECT ON DATABASE boletins TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
