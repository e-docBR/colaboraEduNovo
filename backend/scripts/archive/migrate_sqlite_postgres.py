import os
import sqlite3
import sys
from pathlib import Path

# Add backend directory to path so we can import app
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app import create_app
from app.core.database import SessionLocal
from app.models.aluno import Aluno
from app.models.nota import Nota
from app.models.usuario import Usuario
from sqlalchemy import text

def migrate():
    # Path to SQLite DB
    sqlite_path = Path(__file__).resolve().parent.parent.parent / "data" / "boletins.db"
    
    if not sqlite_path.exists():
        print(f"FATAL: SQLite database not found at {sqlite_path}")
        return

    print(f"Connecting to SQLite at {sqlite_path}...")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    app = create_app()
    with app.app_context():
        print("Connected to PostgreSQL via Flask App.")
        session = SessionLocal()
        
        try:
            # Clear existing data
            print("Clearing existing PostgreSQL data...")
            session.execute(text("TRUNCATE TABLE notas, usuarios, alunos RESTART IDENTITY CASCADE"))
            
            # Migrate Alunos
            print("Migrating Alunos...")
            cursor.execute("SELECT * FROM alunos")
            alunos_rows = cursor.fetchall()
            for row in alunos_rows:
                aluno = Aluno(
                    id=row["id"],
                    matricula=row["matricula"],
                    nome=row["nome"],
                    turma=row["turma"],
                    turno=row["turno"]
                )
                session.add(aluno)
            session.commit()
            print(f"Migrated {len(alunos_rows)} alunos.")

            # Migrate Notas
            print("Migrating Notas...")
            cursor.execute("SELECT * FROM notas")
            notas_rows = cursor.fetchall()
            for row in notas_rows:
                nota = Nota(
                    id=row["id"],
                    aluno_id=row["aluno_id"],
                    disciplina=row["disciplina"],
                    disciplina_normalizada=row["disciplina_normalizada"] if "disciplina_normalizada" in row.keys() and row["disciplina_normalizada"] else row["disciplina"].upper(),
                    trimestre1=row["trimestre1"],
                    trimestre2=row["trimestre2"],
                    trimestre3=row["trimestre3"],
                    total=row["total"],
                    faltas=row["faltas"],
                    situacao=row["situacao"]
                )
                session.add(nota)
            session.commit()
            print(f"Migrated {len(notas_rows)} notas.")

            # Migrate Usuarios
            print("Migrating Usuarios...")
            cursor.execute("SELECT * FROM usuarios")
            users_rows = cursor.fetchall()
            for row in users_rows:
                user = Usuario(
                    id=row["id"],
                    username=row["username"],
                    password_hash=row["password_hash"],
                    role=row["role"],
                    is_admin=bool(row["is_admin"]),
                    aluno_id=row["aluno_id"],
                    must_change_password=bool(row["must_change_password"])
                )
                # Check for photo_url safely
                if "photo_url" in row.keys() and row["photo_url"]:
                     user.photo_url = row["photo_url"]
                
                session.add(user)
            session.commit()
            print(f"Migrated {len(users_rows)} usuarios.")
            
            # Reset sequences
            print("Resetting sequences...")
            session.execute(text("SELECT setval('alunos_id_seq', (SELECT MAX(id) FROM alunos))"))
            session.execute(text("SELECT setval('notas_id_seq', (SELECT MAX(id) FROM notas))"))
            session.execute(text("SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios))"))
            session.commit()
            
            print("Migration completed successfully!")
        except Exception as e:
            session.rollback()
            print(f"Error during migration: {e}")
            raise
        finally:
            session.close()

if __name__ == "__main__":
    migrate()
