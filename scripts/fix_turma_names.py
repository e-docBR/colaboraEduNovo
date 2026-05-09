import sys
import os
import re

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.database import SessionLocal
from app.models import Aluno
from sqlalchemy import select

def normalize_turma_name(name: str | None, turno: str | None = None) -> str | None:
    """Standardizes turma names.
    Standard: 'Xº Y' (e.g., '6º A')
    EJA (Noturno): 'X/Y Z' (e.g., '6/7 A', '8/9 B')
    """
    if not name:
        return name

    # 1. Basic cleaning
    name = " ".join(name.split()).upper()

    # 2. Handle "ANO(S)" / "SERIE"
    name = re.sub(r"\bANOS?\b\.?", "", name)
    name = re.sub(r"\bS[EÉ]RIE\b\.?", "", name)

    # 3. Handle numbers followed by letter directly (e.g., 6A -> 6º A)
    # Match digit(s) followed optionally by 'o' or 'º' or 'ª' then space or letter
    match = re.search(r"(?P<num>\d+)\s*(?P<ord>[º°ºªoa])?\s*(?P<letra>[A-Z])$", name)
    num, letra = None, None
    
    if match:
        num = match.group("num")
        letra = match.group("letra")
    else:
        # 4. Handle just number + letter (no ordinal) at the end if step 3 missed it
        match_simple = re.search(r"\b(?P<num>\d+)\s+(?P<letra>[A-Z])\b", name)
        if match_simple:
            num = match_simple.group("num")
            letra = match_simple.group("letra")

    if num and letra:
        # Check for EJA (Noturno)
        is_noturno = turno and "NOTURNO" in turno.upper()
        if is_noturno:
            if num in ["6", "7"]:
                return f"6/7 {letra}"
            if num in ["8", "9"]:
                return f"8/9 {letra}"
        
        return f"{num}º {letra}"

    # 5. Final fallback cleanup
    name = " ".join(name.split())
    # Ensure there is a º after the number if missing
    name = re.sub(r"(\d+)(?!\s*º)\s*", r"\1º ", name)
    
    return " ".join(name.split()).strip()

def run_migration():
    session = SessionLocal()
    try:
        print("Starting Turma Name Standardization Migration (Version 2 - EJA Support)...")
        
        # Standardize Alunos
        stmt = select(Aluno)
        alunos = session.execute(stmt).scalars().all()
        
        count = 0
        
        for aluno in alunos:
            old_name = aluno.turma
            new_name = normalize_turma_name(old_name, aluno.turno)
            
            if old_name != new_name:
                print(f"Updating Aluno {aluno.id} ({aluno.nome}) [{aluno.turno or 'N/A'}]: '{old_name}' -> '{new_name}'")
                aluno.turma = new_name
                count += 1
        
        session.commit()
        print(f"Successfully updated {count} Aluno records.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
