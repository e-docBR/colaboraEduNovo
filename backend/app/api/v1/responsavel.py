"""Portal do Responsável — endpoints filtrados para responsáveis verem dados do filho."""
from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ...core.database import session_scope


def register(parent: Blueprint) -> None:
    bp = Blueprint("responsavel", __name__)

    @bp.get("/responsavel/meu-filho")
    @jwt_required()
    def get_meu_filho():
        """Returns the aluno's full detail plus recent ocorrências and comunicados.

        Exclusive to the `responsavel` role — staff must use the standard aluno endpoints.
        """
        claims = get_jwt()
        roles = set(claims.get("roles") or [])
        matricula = claims.get("matricula")

        if "responsavel" not in roles or not matricula:
            return jsonify({"error": "Acesso restrito a responsáveis"}), 403

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            from ...services.aluno_service import AlunoService
            from ...models import Ocorrencia, Comunicado, ComunicadoLeitura
            from flask import g
            from sqlalchemy import desc

            service = AlunoService(session, user_id=user_id)
            aluno, _media, _notas = service.get_aluno_by_matricula(matricula)

            if not aluno:
                return jsonify({"error": "Aluno não encontrado para este ano letivo"}), 404

            aluno_detail = service.get_aluno_details(aluno.id)
            if not aluno_detail:
                return jsonify({"error": "Aluno não encontrado"}), 404

            # Recent ocorrências (last 20, non-archived)
            oc_query = (
                session.query(Ocorrencia)
                .filter(Ocorrencia.aluno_id == aluno.id)
            )
            if getattr(g, "tenant_id", None):
                oc_query = oc_query.filter(Ocorrencia.tenant_id == g.tenant_id)
            if getattr(g, "academic_year_id", None):
                oc_query = oc_query.filter(Ocorrencia.academic_year_id == g.academic_year_id)
            ocorrencias = oc_query.order_by(desc(Ocorrencia.data_registro)).limit(20).all()

            # Recent comunicados (last 20 relevant to this aluno's turma/turno/all)
            com_query = session.query(Comunicado)
            if getattr(g, "tenant_id", None):
                com_query = com_query.filter(Comunicado.tenant_id == g.tenant_id)
            if getattr(g, "academic_year_id", None):
                com_query = com_query.filter(Comunicado.academic_year_id == g.academic_year_id)
            from sqlalchemy import or_
            com_query = com_query.filter(
                or_(
                    Comunicado.target_type == "all",
                    Comunicado.target_type.is_(None),
                    Comunicado.target_value == aluno.turma,
                    Comunicado.target_value == aluno.turno,
                )
            )
            comunicados_raw = com_query.order_by(desc(Comunicado.data_envio)).limit(20).all()

            # Mark which comunicados have been read by this user
            read_ids = {
                r.comunicado_id
                for r in session.query(ComunicadoLeitura.comunicado_id).filter(
                    ComunicadoLeitura.usuario_id == user_id
                ).all()
            }

            comunicados = [
                {
                    "id": c.id,
                    "titulo": c.titulo,
                    "conteudo": c.conteudo,
                    "data_envio": c.data_envio.isoformat() if c.data_envio else None,
                    "lido": c.id in read_ids,
                }
                for c in comunicados_raw
            ]

            return jsonify({
                "aluno": aluno_detail.model_dump(),
                "ocorrencias": [
                    {
                        "id": o.id,
                        "tipo": o.tipo,
                        "descricao": o.descricao,
                        "data_registro": o.data_registro.isoformat() if o.data_registro else None,
                        "resolvida": o.resolvida,
                        "observacao_pais": o.observacao_pais,
                        "gravidade": getattr(o, "gravidade", None),
                    }
                    for o in ocorrencias
                ],
                "comunicados": comunicados,
            })

    parent.register_blueprint(bp)
