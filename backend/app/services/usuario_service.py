from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.usuario_repository import UsuarioRepository
from app.core.security import hash_password, verify_password, generate_tokens
from app.core.exceptions import AppError, UnauthorizedError, NotFoundError, ValidationError
from app.models import Aluno
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioSchema, LoginResponse

class UsuarioService:
    def __init__(self, session: Session):
        self.repository = UsuarioRepository(session)

    def authenticate(self, username: str, password: str, tenant_slug: Optional[str] = None) -> LoginResponse:
        from app.models.tenant import Tenant

        # Resolve tenant first so we scope the user lookup to the correct school.
        # Without this, two schools with the same username would return the wrong user.
        tenant_id: Optional[int] = None
        if tenant_slug:
            tenant = self.repository.session.execute(
                select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active == True)
            ).scalar_one_or_none()
            if not tenant:
                raise UnauthorizedError("Escola não encontrada")
            tenant_id = tenant.id

        user = self.repository.get_by_username(username, tenant_id=tenant_id)
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Usuário ou senha inválidos")

        # super_admin can log in from any tenant scope without restriction
        if tenant_id and user.role != "super_admin" and user.tenant_id != tenant_id:
            raise UnauthorizedError("Usuário não pertence a esta escola")

        roles = [user.role] if user.role else []

        # Resolve the current academic year for this tenant so it's embedded in the JWT
        academic_year_id = None
        if user.tenant_id:
            from app.models.academic_year import AcademicYear
            current_year = self.repository.session.execute(
                select(AcademicYear).where(
                    AcademicYear.tenant_id == user.tenant_id,
                    AcademicYear.is_current == True,
                )
            ).scalar_one_or_none()
            if current_year:
                academic_year_id = current_year.id

        extra_claims = {
            "aluno_id": user.aluno_id,
            "tenant_id": user.tenant_id,
            "academic_year_id": academic_year_id,
        }
        tokens = generate_tokens(identity=str(user.id), roles=roles, extra_claims=extra_claims)
        
        # Build schema to return
        # Need to ensure relationship is loaded? Repository should load what is needed or lazy load
        user_schema = UsuarioSchema.model_validate(user)
        
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=user_schema
        )

    def change_password(self, user_id: int, current_pass: str, new_pass: str) -> None:
        user = self.repository.get(user_id)
        if not user:
            raise NotFoundError("Usuário")
            
        if not verify_password(current_pass, user.password_hash):
            raise AppError("Senha atual inválida")
            
        user.password_hash = hash_password(new_pass)
        user.must_change_password = False
        self.repository.session.add(user) # Should be in update method in repo but ok
        self.repository.session.commit()

    def create_user(self, data: UsuarioCreate) -> UsuarioSchema:
        if self.repository.exists_username(data.username):
            raise AppError("Usuário já existe", status_code=409)

        if data.aluno_id:
            aluno = self.repository.session.get(Aluno, data.aluno_id)
            if not aluno:
                raise ValidationError("Aluno informado não existe")

        user_data = data.model_dump(exclude={"password"})
        user_data["password_hash"] = hash_password(data.password)
        
        new_user = self.repository.create(user_data)
        return UsuarioSchema.model_validate(new_user)

    def update_user(self, user_id: int, data: UsuarioUpdate) -> UsuarioSchema:
        user = self.repository.get(user_id)
        if not user:
            raise NotFoundError("Usuário")

        if data.username:
            if self.repository.exists_username(data.username, exclude_id=user_id):
                raise AppError("Nome de usuário já está em uso", status_code=409)
        
        if data.aluno_id:
            aluno = self.repository.session.get(Aluno, data.aluno_id)
            if not aluno:
                raise ValidationError("Aluno informado não existe")

        update_dict = data.model_dump(exclude_unset=True, exclude={"password"})
        
        if data.password:
             update_dict["password_hash"] = hash_password(data.password)

        updated = self.repository.update(user, update_dict)
        return UsuarioSchema.model_validate(updated)

    def list_users(self, page: int, per_page: int, query: str = None, role: str = None) -> dict:
        skip = (page - 1) * per_page
        users, total = self.repository.list_filtered(skip, per_page, query, role)
        
        return {
            "items": [UsuarioSchema.model_validate(u) for u in users],
            "total": total,
            "page": page,
            "per_page": per_page
        }

    def delete_user(self, user_id: int, current_user_id: int) -> None:
        if user_id == current_user_id:
            raise AppError("Não é possível remover o próprio usuário", status_code=400)
            
        if not self.repository.delete(user_id):
            raise NotFoundError("Usuário")
