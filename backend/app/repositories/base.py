from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select

T = TypeVar("T")

class BaseRepository(Generic[T]):
    def __init__(self, session: Session, model: Type[T]):
        self.session = session
        self.model = model

    def get(self, id: int) -> Optional[T]:
        return self.session.get(self.model, id)

    def get_scoped(self, id: int) -> Optional[T]:
        """Tenant-aware lookup. Prevents cross-tenant IDOR by filtering on tenant_id."""
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        if tenant_id is None or not hasattr(self.model, "tenant_id"):
            return self.get(id)
        return (
            self.session.query(self.model)
            .filter(self.model.id == id, self.model.tenant_id == tenant_id)
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        stmt = select(self.model).offset(skip).limit(limit)
        return self.session.execute(stmt).scalars().all()

    def create(self, obj_in: dict) -> T:
        db_obj = self.model(**obj_in)
        self.session.add(db_obj)
        self.session.flush()
        return db_obj

    def update(self, db_obj: T, obj_in: dict) -> T:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        self.session.add(db_obj)
        return db_obj

    def delete(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            self.session.delete(obj)
            return True
        return False

    def delete_scoped(self, id: int) -> bool:
        """Tenant-aware delete. Prevents cross-tenant IDOR."""
        obj = self.get_scoped(id)
        if obj:
            self.session.delete(obj)
            return True
        return False
