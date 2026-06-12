"""Professores — endpoints filtrados para professores verem suas turmas."""
from flask import Blueprint, jsonify, g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import func, distinct

from ...core.database import session_scope
from ...models import UsuarioTurma, Aluno, Nota

def register(parent: Blueprint) -> None:
    bp = Blueprint("professores", __name__)

    @bp.get("/professores/me/turmas")
    @jwt_required()
    def get_my_turmas():
        claims = get_jwt()
        roles = set(claims.get("roles") or [])

        # Only professors or admins can access
        if "professor" not in roles and "admin" not in roles and "super_admin" not in roles:
            return jsonify({"error": "Acesso restrito a professores e administradores"}), 403

        user_id = int(get_jwt_identity())
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)

        with session_scope() as session:
            # If admin or super_admin, they see ALL classes
            if "admin" in roles or "super_admin" in roles:
                turma_names_query = session.query(distinct(Aluno.turma)).filter(
                    Aluno.tenant_id == tenant_id,
                    Aluno.academic_year_id == academic_year_id
                ).all()
                turma_names = [t[0] for t in turma_names_query if t[0]]
            else:
                links = session.query(UsuarioTurma.turma).filter(
                    UsuarioTurma.usuario_id == user_id,
                    UsuarioTurma.tenant_id == tenant_id,
                    UsuarioTurma.academic_year_id == academic_year_id
                ).all()
                turma_names = [link[0] for link in links if link[0]]

            results = []
            for t_name in turma_names:
                total_alunos = session.query(func.count(Aluno.id)).filter(
                    Aluno.turma == t_name,
                    Aluno.tenant_id == tenant_id,
                    Aluno.academic_year_id == academic_year_id
                ).scalar() or 0
                
                turno = session.query(Aluno.turno).filter(
                    Aluno.turma == t_name,
                    Aluno.tenant_id == tenant_id,
                    Aluno.academic_year_id == academic_year_id
                ).limit(1).scalar() or ""

                media = session.query(func.avg(Nota.total)).join(Aluno).filter(
                    Aluno.turma == t_name,
                    Nota.tenant_id == tenant_id,
                    Nota.academic_year_id == academic_year_id
                ).scalar() or 0.0

                faltas_medias = session.query(func.avg(Nota.faltas)).join(Aluno).filter(
                    Aluno.turma == t_name,
                    Nota.tenant_id == tenant_id,
                    Nota.academic_year_id == academic_year_id
                ).scalar() or 0.0

                results.append({
                    "turma": t_name,
                    "turno": turno,
                    "total_alunos": total_alunos,
                    "media": float(media),
                    "faltas_medias": float(faltas_medias)
                })

            # Sort by turma name
            results.sort(key=lambda x: x["turma"])
            return jsonify(results)

    parent.register_blueprint(bp)
