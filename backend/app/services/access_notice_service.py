"""Generation of access notices for guardians."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import secrets
import string

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Aluno, Usuario
from app.services.accounts import ensure_responsavel_user


@dataclass(frozen=True)
class AccessNoticeResult:
    buffer: BytesIO
    filename: str
    row_count: int


class AccessNoticeService:
    SITE_URL = "https://gestao.colaboraedu.cloud"

    def __init__(self, session: Session):
        self.session = session

    def generate_class_docx(
        self,
        *,
        tenant_id: int,
        academic_year_id: int | None,
        turma: str,
        school_name: str,
    ) -> AccessNoticeResult:
        alunos = self._list_students(tenant_id, academic_year_id, turma)
        if not alunos:
            raise ValueError("Nenhum aluno ativo encontrado para a turma informada.")

        try:
            from docx import Document
            from docx.enum.text import WD_ALIGN_PARAGRAPH
            from docx.shared import Inches, Pt
        except ImportError as exc:  # pragma: no cover - environment/configuration guard
            raise RuntimeError("Dependência python-docx não instalada.") from exc

        document = Document()
        section = document.sections[0]
        section.top_margin = Inches(0.65)
        section.bottom_margin = Inches(0.65)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

        for index, aluno in enumerate(alunos):
            if index:
                document.add_page_break()
            usuario = self._reset_guardian_password(aluno)
            password = self._temporary_password()
            usuario.password_hash = hash_password(password)
            usuario.must_change_password = True
            usuario.is_active = True
            usuario.deleted_at = None
            usuario.is_archived = False
            self.session.add(usuario)
            self._append_notice(
                document=document,
                school_name=school_name,
                aluno=aluno,
                username=usuario.username,
                password=password,
                align=WD_ALIGN_PARAGRAPH,
                font_size=Pt,
            )

        buffer = BytesIO()
        document.save(buffer)
        buffer.seek(0)
        safe_turma = "".join(ch if ch.isalnum() else "_" for ch in turma).strip("_") or "turma"
        return AccessNoticeResult(
            buffer=buffer,
            filename=f"comunicados_acesso_{safe_turma}.docx",
            row_count=len(alunos),
        )

    def _list_students(
        self,
        tenant_id: int,
        academic_year_id: int | None,
        turma: str,
    ) -> list[Aluno]:
        query = self.session.query(Aluno).filter(
            Aluno.tenant_id == tenant_id,
            Aluno.turma == turma,
            Aluno.is_archived.is_(False),
        )
        if academic_year_id:
            query = query.filter(Aluno.academic_year_id == academic_year_id)
        return query.order_by(Aluno.nome.asc()).all()

    def _reset_guardian_password(self, aluno: Aluno) -> Usuario:
        usuario, _initial_password = ensure_responsavel_user(self.session, aluno)
        if not usuario:
            raise RuntimeError(f"Não foi possível criar responsável para {aluno.nome}.")
        usuario.aluno_id = aluno.id
        usuario.matricula = aluno.matricula
        usuario.tenant_id = aluno.tenant_id
        usuario.role = "responsavel"
        return usuario

    @staticmethod
    def _temporary_password(length: int = 10) -> str:
        alphabet = string.ascii_uppercase + string.ascii_lowercase + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(length))

    def _append_notice(
        self,
        *,
        document,
        school_name: str,
        aluno: Aluno,
        username: str,
        password: str,
        align,
        font_size,
    ) -> None:
        title = document.add_paragraph()
        title.alignment = align.CENTER
        run = title.add_run(school_name)
        run.bold = True
        run.font.size = font_size(14)

        subtitle = document.add_paragraph()
        subtitle.alignment = align.CENTER
        run = subtitle.add_run("Comunicado de Acesso ao ColaboraEdu")
        run.bold = True
        run.font.size = font_size(16)

        document.add_paragraph()
        document.add_paragraph("Prezada família,")
        document.add_paragraph(
            "A escola passa a utilizar o ColaboraEdu para aproximar a família da vida escolar "
            "dos estudantes. Pelo sistema, os responsáveis podem acompanhar boletins, notas, "
            "ocorrências, comunicados e outras informações importantes."
        )
        document.add_paragraph(
            "Esse acesso facilita o acompanhamento pedagógico, melhora a comunicação com a escola "
            "e ajuda a família a participar mais de perto do desenvolvimento do estudante."
        )

        document.add_paragraph("Dados do aluno:", style=None).runs[0].bold = True
        document.add_paragraph(f"Nome: {aluno.nome}")
        document.add_paragraph(f"Matrícula: {aluno.matricula}")
        document.add_paragraph(f"Turma: {aluno.turma}")
        document.add_paragraph(f"Turno: {aluno.turno}")

        document.add_paragraph()
        document.add_paragraph("Dados de acesso do responsável:", style=None).runs[0].bold = True
        document.add_paragraph(f"Site: {self.SITE_URL}")
        document.add_paragraph(f"Escola: {school_name}")
        document.add_paragraph(f"Usuário: {username}")
        document.add_paragraph(f"Senha temporária: {password}")

        document.add_paragraph()
        warning = document.add_paragraph()
        warning.add_run("Importante: ").bold = True
        warning.add_run(
            "no primeiro acesso, será solicitada a troca da senha. Guarde estes dados com segurança."
        )

        footer = document.add_paragraph()
        footer.alignment = align.CENTER
        footer.add_run("Atenciosamente,\nEquipe Escolar").bold = True
