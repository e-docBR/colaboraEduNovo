import sqlite3, psycopg2, os, sys, time

def migrate():
    sqlite_path = "/data/boletins.db"
    pg_url = os.environ.get("DATABASE_URL")
    lite_conn = sqlite3.connect(sqlite_path)
    pg_conn = psycopg2.connect(pg_url)
    pg_conn.autocommit = True
    pg_cur = pg_conn.cursor()
    pg_cur.execute("SET session_replication_role = 'replica';")

    # Only users for now
    pg_cur.execute("TRUNCATE TABLE usuarios CASCADE")
    lite_cur = lite_conn.cursor()
    lite_cur.execute("SELECT id, username, email, password_hash, role, is_admin, aluno_id, photo_url, must_change_password, is_active, tenant_id FROM usuarios")
    rows = lite_cur.fetchall()
    
    for row in rows:
        r = list(row)
        r[5] = bool(r[5])
        r[8] = bool(r[8])
        r[9] = bool(r[9])
        pg_cur.execute("INSERT INTO usuarios (id, username, email, password_hash, role, is_admin, aluno_id, photo_url, must_change_password, is_active, tenant_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", tuple(r))
    
    print(f"DONE. Count inside: {len(rows)}")
    pg_cur.execute("SELECT count(*) FROM usuarios")
    print(f"Verify inside: {pg_cur.fetchone()[0]}")
    
    print("GOING TO SLEEP FOR 60s. CHECK NOW!")
    time.sleep(60)
    pg_conn.close()

if __name__ == "__main__":
    migrate()
