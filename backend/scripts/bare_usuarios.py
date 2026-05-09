"""One-time SQLite→Postgres migration script — DO NOT RUN IN PRODUCTION.
Requires ALLOW_BARE_MIGRATE=1 to execute."""
import os, sys, sqlite3, psycopg2

if os.environ.get("ALLOW_BARE_MIGRATE") != "1":
    print("ERROR: Set ALLOW_BARE_MIGRATE=1 to run this destructive script.")
    sys.exit(1)

lite = sqlite3.connect("/data/boletins.db")
cur_l = lite.cursor()
cur_l.execute("SELECT id, username, email, password_hash, role, is_admin, aluno_id, photo_url, must_change_password, is_active, tenant_id FROM usuarios")
rows = cur_l.fetchall()
print(f"SQLite Rows: {len(rows)}")

pg_url = os.environ.get("DATABASE_URL")
pg = psycopg2.connect(pg_url)
pg.autocommit = True
cur_p = pg.cursor()

# Check if table exists
cur_p.execute("SELECT table_name FROM information_schema.tables WHERE table_name='usuarios'")
if not cur_p.fetchone():
    print("PG Table 'usuarios' DOES NOT EXIST!")
    import sys; sys.exit(1)

cur_p.execute("TRUNCATE TABLE usuarios CASCADE")
print("Truncated PG.")

for row in rows:
    new_row = list(row)
    new_row[5] = bool(new_row[5])
    new_row[8] = bool(new_row[8])
    new_row[9] = bool(new_row[9])
    
    cur_p.execute("INSERT INTO usuarios (id, username, email, password_hash, role, is_admin, aluno_id, photo_url, must_change_password, is_active, tenant_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", tuple(new_row))

cur_p.execute("SELECT count(*) FROM usuarios")
print(f"PG Rows after insert: {cur_p.fetchone()[0]}")
pg.close()
lite.close()
