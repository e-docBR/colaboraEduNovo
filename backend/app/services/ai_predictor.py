import pandas as pd
from sklearn.linear_model import LogisticRegression
from sqlalchemy import select
from sqlalchemy.orm import Session
from loguru import logger
import pickle
from pathlib import Path
from ..models import Aluno, Nota
from ..core.database import SessionLocal

MODEL_PATH = Path(__file__).resolve().parents[3] / "data" / "risk_model.pkl"

def train_risk_model(session: Session):
    """
    Trains a simple logistic regression model to predict failure risk.
    """
    try:
        # 1. Fetch Data
        stm = select(Aluno)
        alunos = session.execute(stm).scalars().all()
        
        data = []
        for aluno in alunos:
            # Aggregate grades
            total_score = 0
            low_grades_count = 0
            faltas = 0
            
            for nota in aluno.notas:
                # Use total or estimate based on trimesters
                score = float(nota.total or 0)
                if score < 60:
                    low_grades_count += 1
                total_score += score
                faltas += (nota.faltas or 0)
            
            # Heuristic Target: If > 2 low grades OR > 15 faltas -> Risk
            is_risk = 1 if (low_grades_count >= 2 or faltas > 15) else 0
            
            data.append({
                "mean_score": total_score / len(aluno.notas) if aluno.notas else 0,
                "low_grades": low_grades_count,
                "faltas": faltas,
                "target": is_risk
            })
            
        if not data:
            logger.warning("No data to train model.")
            return
            
        df = pd.DataFrame(data)
        
        # 2. Train Model
        X = df[["mean_score", "low_grades", "faltas"]]
        y = df["target"]
        
        model = LogisticRegression()
        model.fit(X, y)
        
        # 3. Save
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
            
    except Exception as e:
        logger.error(f"Training failed: {e}")
        
from sqlalchemy.orm import Session

def predict_risk(aluno_id: int, session: Session) -> dict:
    """
    Returns probability and insights about failure risk for a student.
    """
    if not MODEL_PATH.exists():
        logger.info("Model not found, training new one...")
        train_risk_model(session)
        
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
            
        aluno = session.get(Aluno, aluno_id)
        if not aluno:
            return {"score": 0.0, "status": "INEXISTENTE"}
            
        # Extract features
        total_score = 0
        low_grades_count = 0
        faltas = 0
        for nota in aluno.notas:
            score = float(nota.total or 0)
            if score < 60:
                low_grades_count += 1
            total_score += score
            faltas += (nota.faltas or 0)
            
        num_notas = len(aluno.notas)
        mean_score = total_score / num_notas if num_notas else 0
        
        features = pd.DataFrame([{
            "mean_score": mean_score,
            "low_grades": low_grades_count,
            "faltas": faltas
        }])
        
        # Predict probability
        risk_prob = float(model.predict_proba(features)[0][1])
        
        return {
            "score": round(risk_prob, 2),
            "status": "ALTO" if risk_prob > 0.7 else "MEDIO" if risk_prob > 0.4 else "BAIXO",
            "factors": {
                "media_geral": round(mean_score, 1),
                "disciplinas_abaixo_60": low_grades_count,
                "total_faltas": faltas
            }
        }
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return {"score": 0.0, "status": "ERRO", "error": str(e)}
