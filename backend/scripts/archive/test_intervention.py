from app.services.intervention_service import intervention_service
from app.core.database import SessionLocal
import json

def test_interventions():
    session = SessionLocal()
    try:
        # Get first student
        from app.models import Aluno
        aluno = session.query(Aluno).first()
        if not aluno:
            print("No students found in DB.")
            return
            
        print(f"Testing interventions for: {aluno.nome} (ID: {aluno.id})")
        result = intervention_service.analyze_student(session, aluno.id)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_interventions()
