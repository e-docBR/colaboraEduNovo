from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.repositories.ocorrencia_repository import OcorrenciaRepository
from app.schemas.ocorrencia import OcorrenciaSchema, OcorrenciaCreate, OcorrenciaUpdate
from app.services.audit import log_action

class OcorrenciaService:
    def __init__(self, session: Session, user_id: int):
        self.repository = OcorrenciaRepository(session)
        self.user_id = user_id

    def list_ocorrencias(
        self,
        aluno_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> dict:
        """Return paginated occurrences.

        Access-control decisions (which aluno_id is visible) must be made by
        the caller before invoking this method.
        """
        items, total = self.repository.list_filtered(aluno_id, page=page, per_page=per_page, date_from=date_from, date_to=date_to)

        schemas = [
            OcorrenciaSchema(
                id=o.id,
                aluno_id=o.aluno_id,
                autor_id=o.autor_id,
                tipo=o.tipo,
                descricao=o.descricao,
                observacao_pais=o.observacao_pais,
                gravidade=o.gravidade or "LEVE",
                acao_tomada=o.acao_tomada,
                resolvida=bool(o.resolvida) if o.resolvida is not None else False,
                data_registro=o.data_registro,
                notificacao_status=o.notificacao_status,
                aluno_nome=o.aluno.nome if o.aluno else "Desconhecido",
                autor_nome=o.autor.username if o.autor else "Sistema",
            )
            for o in items
        ]
        return {"items": schemas, "meta": {"page": page, "per_page": per_page, "total": total}}

    def create(self, data: OcorrenciaCreate) -> OcorrenciaSchema:
        from flask import g
        dt = datetime.now()
        if data.data_registro:
            try:
                dt = datetime.fromisoformat(data.data_registro)
            except ValueError as exc:
                raise ValueError(
                    f"data_registro inválido: '{data.data_registro}'. "
                    "Use o formato ISO-8601 (ex: '2024-05-15T14:30:00')."
                ) from exc

        payload = {
            "aluno_id": data.aluno_id,
            "autor_id": self.user_id,
            "tipo": data.tipo,
            "descricao": data.descricao,
            "observacao_pais": data.observacao_pais,
            "gravidade": data.gravidade,
            "acao_tomada": data.acao_tomada,
            "data_registro": dt,
            "tenant_id": g.tenant_id,
            "academic_year_id": g.academic_year_id
        }
        
        novo = self.repository.create(payload)

        # Handle notification if requested
        if data.notificar_responsaveis:
            from ..core.queue import queue
            from ..core.tasks import notify_occurrence_task
            # Marca como pendente antes de enfileirar (sem commit — o session_scope faz isso)
            novo.notificacao_status = "Pendente"
            self.repository.session.add(novo)
            self.repository.session.flush()
            queue.enqueue(notify_occurrence_task, novo.id)

        # Audit
        log_action(
            self.repository.session, 
            self.user_id, 
            "CREATE", 
            "Ocorrencia", 
            novo.id, 
            {"tipo": novo.tipo, "aluno_id": novo.aluno_id, "notificado": data.notificar_responsaveis}
        )
        
        return OcorrenciaSchema(
             id=novo.id,
                aluno_id=novo.aluno_id,
                autor_id=novo.autor_id,
                tipo=novo.tipo,
                descricao=novo.descricao,
                data_registro=novo.data_registro,
                notificacao_status=novo.notificacao_status,
                aluno_nome=novo.aluno.nome if novo.aluno else "Desconhecido",
                autor_nome="Eu" # Simplified
        )

    def update(self, id: int, data: OcorrenciaUpdate) -> Optional[OcorrenciaSchema]:
        existing = self.repository.get_scoped(id)
        if not existing:
            return None

        update_data = data.model_dump(exclude_unset=True)
        updated = self.repository.update(existing, update_data)
        
        # Audit
        log_action(
            self.repository.session, 
            self.user_id, 
            "UPDATE", 
            "Ocorrencia", 
            updated.id, 
            {"updated_fields": list(update_data.keys())}
        )
        
        return OcorrenciaSchema(
                id=updated.id,
                aluno_id=updated.aluno_id,
                autor_id=updated.autor_id,
                tipo=updated.tipo,
                descricao=updated.descricao,
                data_registro=updated.data_registro,
                notificacao_status=updated.notificacao_status,
                aluno_nome=updated.aluno.nome if updated.aluno else "Desconhecido",
                autor_nome=updated.autor.username if updated.autor else "Sistema"
        )

    def delete(self, id: int) -> bool:
        success = self.repository.delete_scoped(id)
        if success:
            log_action(
                self.repository.session,
                self.user_id,
                "DELETE",
                "Ocorrencia",
                id,
                {"deleted": True}
            )
        return success

    def renotificar(self, ocorrencia_id: int) -> bool:
        oc = self.repository.get_scoped(ocorrencia_id)
        if not oc:
            return False
        from ..core.queue import queue
        from ..core.tasks import notify_occurrence_task
        oc.notificacao_status = "Pendente"
        self.repository.session.add(oc)
        self.repository.session.flush()
        queue.enqueue(notify_occurrence_task, oc.id)
        log_action(
            self.repository.session,
            self.user_id,
            "RENOTIFY",
            "Ocorrencia",
            oc.id,
            {}
        )
        return True
