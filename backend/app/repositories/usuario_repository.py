from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session, joinedload

from app.models import Usuario, Aluno
from app.repositories.base import BaseRepository

class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def get_by_username(self, username: str, tenant_id: Optional[int] = None) -> Optional[Usuario]:
        """Busca por username/email dentro do tenant especificado (ou globalmente para super_admin)."""
        stmt = select(Usuario).where(
            or_(Usuario.username == username, Usuario.email == username)
        )
        if tenant_id is not None:
            stmt = stmt.where(Usuario.tenant_id == tenant_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def exists_username(self, username: str, exclude_id: Optional[int] = None) -> bool:
        stmt = select(Usuario).where(Usuario.username == username)
        if exclude_id:
            stmt = stmt.where(Usuario.id != exclude_id)
        return self.session.execute(stmt).first() is not None

    def list_filtered(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_text: Optional[str] = None, 
        role: Optional[str] = None
    ) -> tuple[List[Usuario], int]:
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)

        # Build query
        stmt = (
            select(Usuario)
            .options(joinedload(Usuario.aluno))
            .outerjoin(Aluno)
        )
        
        count_stmt = select(func.count(Usuario.id)).outerjoin(Aluno)

        if tenant_id:
            stmt = stmt.where(Usuario.tenant_id == tenant_id)
            count_stmt = count_stmt.where(Usuario.tenant_id == tenant_id)
            
        if query_text:
            like = f"%{query_text}%"
            # Keep aluno filters for searchability
            filter_cond = or_(
                Usuario.username.ilike(like),
                Aluno.nome.ilike(like),
                Aluno.matricula.ilike(like),
            )
            stmt = stmt.where(filter_cond)
            count_stmt = count_stmt.where(filter_cond)

        if role:
            stmt = stmt.where(Usuario.role == role)
            count_stmt = count_stmt.where(Usuario.role == role)

        total = self.session.execute(count_stmt).scalar() or 0
        
        results = self.session.execute(
            stmt.order_by(func.lower(Usuario.username)).offset(skip).limit(limit)
        ).scalars().all()

        return results, total
