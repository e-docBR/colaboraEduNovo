import hashlib
import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from loguru import logger
from pathlib import Path
from ..models import Aluno, Nota

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def _model_path(tenant_id: int) -> Path:
    return _DATA_DIR / f"risk_model_{tenant_id}.joblib"


def _hash_path(tenant_id: int) -> Path:
    return _model_path(tenant_id).with_suffix(".sha256")


def train_risk_model(tenant_id: int) -> None:
    """Background-safe: fetches its own DB session to train per-tenant model."""
    from ..core.database import session_scope

    try:
        with session_scope() as session:
            # Fetch all alunos for this tenant with their notas in one query (A-08 fix)
            rows = session.execute(
                select(
                    Aluno.id,
                    func.avg(Nota.total).label("mean_score"),
                    func.count(Nota.id).filter(Nota.total < 60).label("low_grades"),
                    func.sum(Nota.faltas).label("faltas"),
                )
                .join(Nota, Nota.aluno_id == Aluno.id)
                .where(Aluno.tenant_id == tenant_id)
                .group_by(Aluno.id)
            ).all()

        if not rows:
            logger.warning("No data to train model for tenant {}.", tenant_id)
            return

        data = [
            {
                "mean_score": float(r.mean_score or 0),
                "low_grades": int(r.low_grades or 0),
                "faltas": int(r.faltas or 0),
                "target": 1 if (int(r.low_grades or 0) >= 2 or int(r.faltas or 0) > 15) else 0,
            }
            for r in rows
        ]

        df = pd.DataFrame(data)
        X = df[["mean_score", "low_grades", "faltas"]]
        y = df["target"]

        model = LogisticRegression()
        model.fit(X, y)

        path = _model_path(tenant_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, path)
        _hash_path(tenant_id).write_text(hashlib.sha256(path.read_bytes()).hexdigest())
        logger.info("Risk model trained for tenant {}.", tenant_id)

    except Exception as e:
        logger.error("Training failed for tenant {}: {}", tenant_id, e)


def enqueue_training(tenant_id: int) -> None:
    """Enqueues model training as a background RQ task (A-05)."""
    from ..core.queue import queue
    queue.enqueue(train_risk_model, tenant_id)


def predict_risk(aluno_id: int, session: Session) -> dict:
    """Returns probability and insights about failure risk for a student."""
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    year_id = getattr(g, "academic_year_id", None)
    if not tenant_id:
        return {"score": 0.0, "status": "ERRO", "error": "tenant indisponível"}

    model_path = _model_path(tenant_id)
    hash_path = _hash_path(tenant_id)

    if not model_path.exists():
        logger.info("Model not found for tenant {}, scheduling training.", tenant_id)
        enqueue_training(tenant_id)
        return {"score": 0.0, "status": "TREINANDO"}

    if hash_path.exists():
        stored = hash_path.read_text().strip()
        actual = hashlib.sha256(model_path.read_bytes()).hexdigest()
        if stored != actual:
            logger.error("Model integrity check failed for tenant {} — retraining.", tenant_id)
            enqueue_training(tenant_id)
            return {"score": 0.0, "status": "TREINANDO"}

    try:
        model = joblib.load(model_path)

        aluno_query = session.query(Aluno).filter(Aluno.id == aluno_id, Aluno.tenant_id == tenant_id)
        if year_id:
            aluno_query = aluno_query.filter(Aluno.academic_year_id == year_id)
        aluno = aluno_query.first()
        if not aluno:
            return {"score": 0.0, "status": "INEXISTENTE"}

        # Single aggregation query instead of N+1 loop (A-08 fix)
        notas_query = select(
                func.avg(Nota.total).label("mean_score"),
                func.count(Nota.id).filter(Nota.total < 60).label("low_grades"),
                func.sum(Nota.faltas).label("faltas"),
            ).where(Nota.aluno_id == aluno_id, Nota.tenant_id == tenant_id)
        if year_id:
            notas_query = notas_query.where(Nota.academic_year_id == year_id)
        row = session.execute(notas_query).one()

        mean_score = float(row.mean_score or 0)
        low_grades = int(row.low_grades or 0)
        faltas = int(row.faltas or 0)

        features = pd.DataFrame([{"mean_score": mean_score, "low_grades": low_grades, "faltas": faltas}])
        risk_prob = float(model.predict_proba(features)[0][1])

        return {
            "score": round(risk_prob, 2),
            "status": "ALTO" if risk_prob > 0.7 else "MEDIO" if risk_prob > 0.4 else "BAIXO",
            "factors": {
                "media_geral": round(mean_score, 1),
                "disciplinas_abaixo_60": low_grades,
                "total_faltas": faltas,
            },
        }

    except Exception as e:
        logger.error("Prediction failed: {}", e)
        return {"score": 0.0, "status": "ERRO", "error": str(e)}
