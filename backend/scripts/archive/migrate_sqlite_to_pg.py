import sqlite3
import psycopg2
import os
import sys

def migrate():
    sqlite_path = "/data/boletins.db"
    pg_url = os.environ.get("DATABASE_URL")
    
    if not pg_url:
        print("DATABASE_URL not found")
        sys.exit(1)

    lite_conn = sqlite3.connect(sqlite_path)
    lite_cur = lite_conn.cursor()

    pg_conn = psycopg2.connect(pg_url)
    pg_conn.autocommit = True
    pg_cur = pg_conn.cursor()

    # Disable triggers
    pg_cur.execute("SET session_replication_role = 'replica';")

    tables = [
        ("tenants", "tenants"),
        ("academic_years", "academic_years"),
        ("usuarios", "usuarios"),
        ("alunos", "alunos"),
        ("notas", "notas"),
        ("ocorrencias", "ocorrencias"),
        ("comunicados", "comunicados"),
        ("audit_logs", "audit_logs")
    ]

    boolean_cols = {
        "is_active", "is_current", "is_admin", "must_change_password", 
        "resolvida", "arquivado", "is_read"
    }

    print("Starting migration...")
    for lite_table, pg_table in tables:
        lite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (lite_table,))
        if not lite_cur.fetchone():
            print(f"  SKIP: {lite_table} not found in SQLite")
            continue

        print(f"  MIGRATING: {lite_table} -> {pg_table}")
        
        lite_cur.execute(f"PRAGMA table_info({lite_table})")
        cols = [r[1] for r in lite_cur.fetchall()]
        lite_cur.execute(f"SELECT {', '.join(cols)} FROM {lite_table}")
        rows = lite_cur.fetchall()
        print(f"    Rows: {len(rows)}")

        pg_cur.execute(f"TRUNCATE TABLE {pg_table} RESTART IDENTITY CASCADE")
        
        if rows:
            bool_indices = [i for i, c in enumerate(cols) if c in boolean_cols]
            placeholders = ", ".join(["%s"] * len(cols))
            query = f"INSERT INTO {pg_table} ({', '.join(cols)}) VALUES ({placeholders})"
            
            for row in rows:
                new_row = list(row)
                for idx in bool_indices:
                    if new_row[idx] is not None:
                        new_row[idx] = bool(new_row[idx])
                pg_cur.execute(query, tuple(new_row))
            
            # Sequence reset
            try:
                pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{pg_table}', 'id'), (SELECT MAX(id) FROM {pg_table}))")
            except Exception as e:
                # print(f"    Seq reset failed for {pg_table} (might not be an identity table)")
                pass
            
            # Verify immediately
            pg_cur.execute(f"SELECT count(*) FROM {pg_table}")
            print(f"    Verified count in PG: {pg_cur.fetchone()[0]}")

    pg_cur.execute("SET session_replication_role = 'origin';")
    pg_conn.close()
    lite_conn.close()
    print("MIGRATION FINISHED SUCCESSFULLY")

if __name__ == "__main__":
    migrate()
