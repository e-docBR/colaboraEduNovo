import sys
import os
from sqlalchemy import func, text

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.database import SessionLocal
from app.models import Aluno

def debug_turmas():
    session = SessionLocal()
    try:
        print("--- Debugging Turmas ---")
        
        # 1. Count by exact turma string
        results = session.query(Aluno.turma, Aluno.turno, func.count(Aluno.id))\
            .group_by(Aluno.turma, Aluno.turno)\
            .order_by(Aluno.turma).all()
        
        print("\n[Aggregated Counts by Turma/Turno]")
        for turma, turno, count in results:
            print(f"Turma: '{turma}' | Turno: '{turno}' | Count: {count}")

        # 2. Check specific "H" classes
        print("\n[Detailed List for 'H' classes]")
        h_students = session.query(Aluno.id, Aluno.nome, Aluno.turma, Aluno.turno, Aluno.academic_year_id)\
            .filter(Aluno.turma.ilike("%H"))\
            .all()
        
        for s in h_students:
            print(f"ID: {s.id} | Name: {s.nome} | Turma: '{s.turma}' | Turno: '{s.turno}' | Year: {s.academic_year_id}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    debug_turmas()
