"""Notas endpoints."""
from decimal import Decimal
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from ...core.database import session_scope
from ...models import Aluno, Nota
from ...services import log_action


def serialize_nota_row(nota: Nota, aluno: Aluno | None = None) -> dict:
    data = {
        "id": nota.id,
        "disciplina": nota.disciplina,
        "trimestre1": float(nota.trimestre1) if nota.trimestre1 is not None else None,
        "trimestre2": float(nota.trimestre2) if nota.trimestre2 is not None else None,
        "trimestre3": float(nota.trimestre3) if nota.trimestre3 is not None else None,
        "total": float(nota.total) if nota.total is not None else None,
        "faltas": nota.faltas,
        "situacao": nota.situacao,
    }
    if aluno:
        data["aluno"] = {
            "id": aluno.id,
            "nome": aluno.nome,
            "turma": aluno.turma,
            "turno": aluno.turno,
            "status": aluno.status,
        }
    return data


def register(parent: Blueprint) -> None:
    bp = Blueprint("notas", __name__)

    @bp.get("/notas/filtros")
    @jwt_required()
    def get_filtros():
        """Retorna todos os valores únicos para filtros."""
        # Mapeamento de disciplinas para normalização
        normalizacao = {
            "ARTES": "ARTE",
            "INGLÊS": "LÍNGUA INGLESA",
            "INGLES": "LÍNGUA INGLESA",
            "LÍNGUA PORTUGUÊSA": "LÍNGUA PORTUGUESA",
            "LINGUA PORTUGUESA": "LÍNGUA PORTUGUESA",
        }
        
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        year_id = getattr(g, "academic_year_id", None)

        with session_scope() as session:
            query = session.query(Nota.disciplina).distinct()
            if tenant_id:
                query = query.filter(Nota.tenant_id == tenant_id)
            if year_id:
                query = query.filter(Nota.academic_year_id == year_id)
                
            disciplinas_raw = query.all()
            disciplinas_set = set()
            
            for (disc,) in disciplinas_raw:
                if disc:
                    # Normaliza usando o mapeamento
                    disc_upper = disc.upper()
                    disc_normalizada = normalizacao.get(disc_upper, disc)
                    disciplinas_set.add(disc_normalizada)
            
            disciplinas = sorted(list(disciplinas_set))
            
        return jsonify({
            "disciplinas": disciplinas
        })

    @bp.get("/notas")
    @jwt_required()
    def list_notas():
        if "aluno" in (get_jwt().get("roles") or []):
            return jsonify({"error": "Acesso restrito"}), 403
        turma = request.args.get("turma")
        turno = request.args.get("turno")
        disciplina = request.args.get("disciplina")
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(500, int(request.args.get("per_page", 20)))

        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        year_id = getattr(g, "academic_year_id", None)

        with session_scope() as session:
            query = session.query(Nota).options(joinedload(Nota.aluno))
            
            if tenant_id:
                query = query.filter(Nota.tenant_id == tenant_id)
            if year_id:
                query = query.filter(Nota.academic_year_id == year_id)
                
            if disciplina:
                query = query.filter(Nota.disciplina == disciplina)
            if turma or turno:
                query = query.join(Aluno)
                if turma:
                    query = query.filter(Aluno.turma == turma)
                if turno:
                    query = query.filter(Aluno.turno == turno)

            total = query.count()
            notas = query.offset((page - 1) * per_page).limit(per_page).all()
            
            # Serialize within session context to avoid DetachedInstanceError
            items = [serialize_nota_row(nota, nota.aluno) for nota in notas]

        return jsonify({
            "items": items,
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total
            }
        })

    @bp.patch("/notas/<int:nota_id>")
    @jwt_required()
    def update_nota(nota_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        if "admin" not in roles:
             return jsonify({"error": "Acesso negado. Apenas administradores podem editar notas."}), 403

        payload = request.get_json() or {}
        allowed_fields = {"trimestre1", "trimestre2", "trimestre3", "total", "faltas", "situacao"}
        updates = {k: v for k, v in payload.items() if k in allowed_fields}
        if not updates:
            return jsonify({"error": "Nenhum campo válido informado"}), 400

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            from flask import g
            nota = (
                session.query(Nota)
                .filter(Nota.id == nota_id, Nota.tenant_id == g.tenant_id)
                .first()
            )
            if not nota:
                return jsonify({"error": "Nota não encontrada"}), 404
            
            # Capture old state for audit
            old_values = {}
            for k in updates.keys():
                val = getattr(nota, k)
                if isinstance(val, Decimal):
                    val = float(val)
                old_values[k] = val
            
            # Apply updates
            for key, value in updates.items():
                setattr(nota, key, value)
            
            # Auto-calculate total if not explicitly provided and trimesters changed.
            # Only non-None trimester values count — a missing grade is not a zero.
            if "total" not in updates:
                if any(k in updates for k in ["trimestre1", "trimestre2", "trimestre3"]):
                    values = [
                        float(v)
                        for v in [nota.trimestre1, nota.trimestre2, nota.trimestre3]
                        if v is not None
                    ]
                    nota.total = sum(values) / len(values) if values else None

            session.add(nota)
            session.flush()
            
            # Log action
            log_action(
                session,
                user_id,
                "UPDATE",
                "Nota",
                nota.id,
                {"old": old_values, "new": updates}
            )

            session.refresh(nota)
            
            # Invalidate cache
            from ...core.cache import invalidate_tenant_cache
            invalidate_tenant_cache()
            
            return jsonify(serialize_nota_row(nota))

    parent.register_blueprint(bp)
